import { z } from "zod";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_BYTES,
} from "@/lib/photos";

const contentType = z.enum(ALLOWED_CONTENT_TYPES);
const optionalSize = z.number().int().positive().max(20_000).optional();

export const photoPresignSchema = z.object({
  entryId: z.uuid(),
  contentType,
  bytes: z.number().int().min(1).max(MAX_BYTES),
  width: optionalSize,
  height: optionalSize,
});

export const photoConfirmSchema = photoPresignSchema.extend({
  photoId: z.uuid(),
  r2Key: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(1).max(2000),
  sort: z.number().int().min(0).max(2),
});

export type PhotoPresign = z.infer<typeof photoPresignSchema>;
export type PhotoConfirm = z.infer<typeof photoConfirmSchema>;
