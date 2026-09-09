import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

/**
 * Shared React Hook Form resolver helper. Every form in the app builds its
 * resolver through this so validation wiring stays identical.
 *
 *   const form = useForm<FormValues>({ resolver: resolver(schema) });
 */
export function resolver<TSchema extends ZodType>(schema: TSchema) {
  return zodResolver(schema);
}
