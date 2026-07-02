import { randomBytes } from "node:crypto";
import { prisma } from "@famerace/db";

/** Truncate all app tables between tests (order-independent via CASCADE). */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

export async function makeUser(
  overrides: {
    username?: string;
    roles?: ("BACKER" | "SCOUT" | "CREATOR" | "ADMIN")[];
    /** USDC wallet balance; generously funded by default so money flows just work. */
    usdcCents?: number;
  } = {},
) {
  const suffix = randomBytes(4).toString("hex");
  return prisma.user.create({
    data: {
      username: overrides.username ?? `user_${suffix}`,
      displayName: `User ${suffix}`,
      email: `${overrides.username ?? `user_${suffix}`}@test.dev`,
      referralCode: randomBytes(6).toString("hex"),
      dobAttested18: true,
      roles: overrides.roles ?? ["BACKER"],
      usdcCents: overrides.usdcCents ?? 10_000_000,
    },
  });
}
