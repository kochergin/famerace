import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma, type User } from "@famerace/db";
import { z } from "zod";
import { DomainError, unauthorized } from "../errors";
import { audit } from "../statemachine";

const scrypt = promisify(scryptCb);

// Session-cookie auth backed by a Session table (revocable server-side).
// Swappable for Auth.js later; the session contract is the only coupling.

const SESSION_TTL_DAYS = 30;

export const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers and underscores only"),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(60),
  dobAttested18: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you are 18 or older" }),
  }),
  referralCode: z.string().optional(),
});

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function signup(input: z.infer<typeof signupSchema>): Promise<{ user: User; token: string }> {
  const data = signupSchema.parse(input);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }] },
    select: { id: true },
  });
  if (existing) throw new DomainError("USER_EXISTS", "Username or email already in use", 409);

  const referredBy = data.referralCode
    ? await prisma.user.findUnique({ where: { referralCode: data.referralCode }, select: { id: true } })
    : null;

  const user = await prisma.user.create({
    data: {
      username: data.username.toLowerCase(),
      displayName: data.displayName,
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      dobAttested18: true,
      referralCode: randomBytes(6).toString("hex"),
      referredByUserId: referredBy?.id ?? null,
    },
  });
  await audit(prisma, { actorId: user.id, action: "USER_SIGNUP", objectType: "User", objectId: user.id });
  const token = await createSession(user.id);
  return { user, token };
}

// Brute-force throttle: per-identifier failure counter with a lockout window.
// In-process (per instance) — swap for a Redis counter in multi-process prod.
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 60_000;
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

export async function login(identifier: string, password: string): Promise<{ user: User; token: string }> {
  const key = identifier.toLowerCase();
  const gate = loginFailures.get(key);
  if (gate && gate.lockedUntil > Date.now()) {
    throw new DomainError("RATE_LIMITED", "Too many attempts — try again in a minute", 429);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: key }, { username: key }],
      status: "ACTIVE",
    },
  });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    const next = { count: (gate?.count ?? 0) + 1, lockedUntil: 0 };
    if (next.count >= LOGIN_MAX_FAILURES) {
      next.count = 0;
      next.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    }
    loginFailures.set(key, next);
    throw new DomainError("BAD_CREDENTIALS", "Wrong username or password", 401);
  }
  loginFailures.delete(key);
  const token = await createSession(user.id);
  return { user, token };
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000),
    },
  });
  return token;
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  return session.user;
}

export async function requireUser(token: string | undefined): Promise<User> {
  const user = await getSessionUser(token);
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(token: string | undefined): Promise<User> {
  const user = await requireUser(token);
  if (!user.roles.includes("ADMIN") && !user.roles.includes("MODERATOR")) {
    throw new DomainError("FORBIDDEN", "Admin access required", 403);
  }
  return user;
}
