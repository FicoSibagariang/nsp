import type { MiddlewareHandler, ValidationTargets } from "hono";
import type { ZodType, z } from "zod";

export function zValidator<
  Target extends keyof ValidationTargets,
  T extends ZodType<any>
>(
  target: Target,
  schema: T
): MiddlewareHandler<any, any, { in: { [K in Target]: z.input<T> }; out: { [K in Target]: z.output<T> } }> {
  return async (c, next) => {
    let data: unknown;
    if (target === "json") {
      data = await c.req.json().catch(() => ({}));
    } else if (target === "query") {
      data = c.req.query();
    } else if (target === "param") {
      data = c.req.param();
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      return c.json(
        {
          message: "The given data was invalid.",
          errors: result.error.flatten().fieldErrors,
        },
        400
      );
    }
    c.req.addValidatedData(target as any, result.data);
    await next();
  };
}
