import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

export const moneyStringSchema = z
  .string()
  .min(1, 'Amount is required')
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative amount with at most 2 decimal places')
  .refine((v) => parseFloat(v) > 0, 'Amount must be greater than zero');
