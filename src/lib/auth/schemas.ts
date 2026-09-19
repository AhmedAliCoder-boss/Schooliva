import { z } from "zod";

export const signInSchema = z.object({
  login: z.string().trim().min(1, "Email, username ya User ID enter karein."),
  password: z.string().min(1, "Password enter karein."),
});

export const createAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Full name enter karein."),
  username: z.string().trim().min(3, "Username kam se kam 3 characters ka hona chahiye.").regex(/^[a-zA-Z0-9._-]+$/, "Username mein sirf letters, numbers, dot, dash ya underscore use karein."),
  email: z.string().trim().email("Valid email enter karein."),
  password: z.string().min(8, "Password kam se kam 8 characters ka hona chahiye."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Valid email enter karein."),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password kam se kam 8 characters ka hona chahiye."),
  confirmPassword: z.string().min(1, "Password confirm karein."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords match nahi karte.",
  path: ["confirmPassword"],
});

export type AuthFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};