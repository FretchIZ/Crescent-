import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_ROUNDS = 12;

const COMMON_PASSWORDS = new Set([
  "password123",
  "password1",
  "12345678",
  "qwerty123",
  "letmein1",
  "welcome123",
  "admin123",
  "iloveyou1",
]);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "This password is too common");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
