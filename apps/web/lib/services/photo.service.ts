/**
 * 사진 분류 및 매칭 서비스 (L1 Business Layer)
 * WHY: 위탁 사진을 AI로 분류하고 상품과 자동 매칭하여 수작업 감소
 * HOW: Vision 게이트웨이 경유 분류 + 메타데이터 스코어링 + Vision 비교
 * WHERE: 사진 업로드/매칭 API route에서 호출
 */
import { AppError } from '../errors'
import { classifyImages, compareImages } from '../gateway/claude-vision'
import type { ImageInput, ClassifyResult as VisionClassifyResult, CompareResult } from '../gateway/claude-vision'
import { normalizeBrand } from '../utils/brand'
import { normalizeCategory } from '../utils/category'
import type { StProduct } from '../types/domain/product'

const SCORE_WEIGHTS = { brandExact: 35, brandSimilar: 25, category: 30, color: 20, size: 15 }
const VISION_THRESHOLD_LOW = 40
const VISION_THRESHOLD_HIGH = 85
const AUTO_SELECT_THRESHOLD = 70
const BATCH_SIZE = 5

export interface PhotoGroup {
  groupId: string
  images: ImageInput[]
  metadata?: {
    brand?: string
    category?: string
    color?: string
    size?: string
  }
}

export interface ClassifyOptions { maxRetries?: number }

export interface ClassifyResultItem {
  groupId: string
  result: VisionClassifyResult
}

export interface MatchResultItem {
  groupId: string
  productId: string
  score: number
  matchMethod: 'metadata' | 'vision' | 'both'
}

export async function classify(
  images: ImageInput[],
  options?: ClassifyOptions,
): Promise<VisionClassifyResult[]> {
  if (images.length === 0) {
    throw new AppError('VALIDATION', '분류할 이미지가 없습니다')
  }

  const maxRetries = options?.maxRetries ?? 1
  const results: VisionClassifyResult[] = []

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE)
    let lastErr: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await classifyImages(batch)
        results.push({ ...result, brand: normalizeBrand(result.brand) })
        lastErr = null
        break
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }

    if (lastErr) {
      throw new AppError('SERVICE_UNAVAILABLE', `사진 분류 실패: ${lastErr.message}`)
    }
  }

  return results
}

function calcMetadataScore(group: PhotoGroup, product: StProduct): number {
  let score = 0
  const meta = group.metadata
  if (!meta) return 0

  if (meta.brand && product.brand) {
    const normGroup = normalizeBrand(meta.brand)
    const normProduct = normalizeBrand(product.brand)
    if (normGroup === normProduct) score += SCORE_WEIGHTS.brandExact
    else if (normGroup.includes(normProduct) || normProduct.includes(normGroup)) {
      score += SCORE_WEIGHTS.brandSimilar
    }
  }

  if (meta.category && product.category) {
    const normGroupCat = normalizeCategory(meta.category)
    const normProductCat = normalizeCategory(product.category)
    if (normGroupCat === normProductCat) score += SCORE_WEIGHTS.category
    else return -Infinity
  }

  if (meta.color && product.color) {
    if (meta.color.toLowerCase() === product.color.toLowerCase()) score += SCORE_WEIGHTS.color
  }

  if (meta.size && product.size) {
    if (meta.size.toLowerCase() === product.size.toLowerCase()) score += SCORE_WEIGHTS.size
  }

  return score
}

export async function match(
  photoGroups: PhotoGroup[],
  products: StProduct[],
): Promise<MatchResultItem[]> {
  const results: MatchResultItem[] = []

  for (const group of photoGroups) {
    for (const product of products) {
      const score = calcMetadataScore(group, product)
      if (score < VISION_THRESHOLD_LOW) continue

      if (score >= AUTO_SELECT_THRESHOLD) {
        results.push({ groupId: group.groupId, productId: product.id, score, matchMethod: 'metadata' })
        continue
      }

      // VISION_THRESHOLD_LOW <= score < VISION_THRESHOLD_HIGH → Vision 비교
      if (score < VISION_THRESHOLD_HIGH && group.images[0] && product.referenceImage) {
        const refImage: ImageInput = { base64: product.referenceImage, mediaType: 'image/jpeg' }
        const cmp: CompareResult = await compareImages(group.images[0], refImage)
        const adjusted = cmp.match ? score + 25 : score - 20

        if (adjusted >= AUTO_SELECT_THRESHOLD) {
          results.push({ groupId: group.groupId, productId: product.id, score: adjusted, matchMethod: 'both' })
        }
      }
    }
  }

  return results
}
