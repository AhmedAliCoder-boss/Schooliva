import { z } from "zod";

export const signInSchema = z.object({
  login: z.string().trim().min(1, "Enter your email, username, or user ID."),
  password: z.string().min(1, "Enter your password."),
});

export type AuthFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};