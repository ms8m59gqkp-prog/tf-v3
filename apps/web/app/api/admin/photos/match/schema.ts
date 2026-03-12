/**
 * POST /api/admin/photos/match — 사진 매칭 스키마
 * WHY: PhotoGroup[] + StProduct[] 배열 검증
 * HOW: 사진 그룹(groupId + images + metadata) + 상품 목록
 * WHERE: match/route.ts에서 import
 */
import { z } from 'zod'

const ImageInputSchema = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const PhotoGroupSchema = z.object({
  groupId: z.string().min(1),
  images: z.array(ImageInputSchema).min(1),
  metadata: z.object({
    brand: z.string().optional(),
    category: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
  }).optional(),
})

const ProductRefSchema = z.object({
  id: z.string().uuid(),
  productName: z.string(),
  salePrice: z.number(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  referenceImage: z.string().nullable().optional(),
})

export const PhotoMatchSchema = z.object({
  photoGroups: z.array(PhotoGroupSchema).min(1),
  products: z.array(ProductRefSchema).min(1),
})
