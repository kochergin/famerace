import { redirect } from "next/navigation";
import { DomainError } from "@famerace/core";
import { ZodError } from "zod";

/**
 * Run a server-action body; on DomainError/ZodError redirect back with a
 * readable error message in the query string instead of a 500 page.
 */
export async function withErrorRedirect<T>(backTo: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DomainError) {
      redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
    }
    if (error instanceof ZodError) {
      const message = error.errors[0]?.message ?? "Invalid input";
      redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
    }
    throw error;
  }
}

