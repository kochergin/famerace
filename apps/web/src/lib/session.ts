import { cookies } from "next/headers";
import { cache } from "react";
import { users } from "@famerace/core";
import type { User } from "@famerace/db";

export const SESSION_COOKIE = "famerace_session";

export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  return users.getSessionUser(jar.get(SESSION_COOKIE)?.value);
});

export async function requireCurrentUser(): Promise<User> {
  const jar = await cookies();
  return users.requireUser(jar.get(SESSION_COOKIE)?.value);
}

export async function requireCurrentAdmin(): Promise<User> {
  const jar = await cookies();
  return users.requireAdmin(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 3600,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
