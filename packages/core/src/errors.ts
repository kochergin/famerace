/** Domain error with a stable code, safe to surface to the UI. */
export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}

export const notFound = (what: string) => new DomainError("NOT_FOUND", `${what} not found`, 404);
export const forbidden = (message = "You are not allowed to do that") =>
  new DomainError("FORBIDDEN", message, 403);
export const unauthorized = () => new DomainError("UNAUTHORIZED", "Sign in required", 401);
