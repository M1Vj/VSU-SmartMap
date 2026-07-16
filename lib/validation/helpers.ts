import { ZodError, ZodSchema } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

export function formatZodError(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
}

export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, errors: formatZodError(parsed.error) };
}