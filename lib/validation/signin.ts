import { z } from "zod";
import { EMAIL_MAX_LENGTH } from "@/lib/constants";

export const signinSchema = z.object({
  email: z.string().email().max(EMAIL_MAX_LENGTH),
  password: z.string().min(1, "Password is required"),
  csrfToken: z.string().min(1, "Invalid or expired security token"),
});

export type SigninInput = z.infer<typeof signinSchema>;
