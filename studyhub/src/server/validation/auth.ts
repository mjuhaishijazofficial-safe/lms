import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});
