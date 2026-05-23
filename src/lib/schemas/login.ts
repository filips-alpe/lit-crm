import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1),
});

export type LoginSchema = typeof loginSchema;
