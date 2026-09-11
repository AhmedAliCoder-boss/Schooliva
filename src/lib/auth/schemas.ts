import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Valid email enter karein."),
  password: z.string().min(1, "Password enter karein."),
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