import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ServiceError extends HTTPException {
  readonly status: ContentfulStatusCode;

  constructor(message: string, status = 400) {
    const validStatus = (status || 400) as ContentfulStatusCode;
    super(validStatus, { message });
    this.name = "ServiceError";
    this.status = validStatus;
  }

  get statusCode(): number {
    return this.status;
  }
}

export function isForeignKeyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("FOREIGN KEY constraint failed") || message.includes("foreign key");
}