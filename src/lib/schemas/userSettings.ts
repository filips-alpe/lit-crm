import { z } from 'zod';

export const userSettingsSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatarSeed: z.string().min(1).max(64).nullish(),
});

export type UserSettingsSchema = typeof userSettingsSchema;
