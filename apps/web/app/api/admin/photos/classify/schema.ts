/**
 * POST /api/admin/photos/classify — 사진 분류 스키마
 * WHY: ImageInput 배열 + ClassifyOptions 검증
 * HOW: base64 + mediaType 쌍 배열, 최대 20장
 * WHERE: classify/route.ts에서 import
 */
import { z } from 'zod'

const ImageInputSchema = z.object({
  base64: z.string().min(1, 'base64 데이터가 비어있습니다'),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export const ClassifySchema = z.object({
  images: z.array(ImageInputSchema).min(1, '이미지가 최소 1장 필요합니다').max(20),
  options: z.object({
    maxRetries: z.number().int().min(0).max(3).optional(),
  }).optional(),
})
