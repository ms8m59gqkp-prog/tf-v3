/**
 * 가격 추정 서비스 (L1 Business Layer)
 * WHY: 네이버 검색 기반 정가 추정 + 캐시 관리
 * HOW: cache 확인 → miss → naver gateway → calc → cache 저장 → 반환
 * WHERE: price-estimate API route에서 호출
 */
import * as naverGw from '../gateway/naver-shopping'
import * as cacheRepo from '../db/repositories/price-estimate-cache.repo'
import { getConditionMultiplier } from '../calculators/price-estimator.calc'
import { AppError } from '../errors'

interface EstimateParams {
  brand: string
  model: string
  category: string
  condition: string
}

interface EstimateResult {
  estimatedPrice: number
  source: 'naver_estimate' | 'manual'
  confidence: number
  reasoning?: string
}

/** 캐시 유효기간: 7일 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function buildCacheKey(brand: string, model: string, category: string, condition: string): string {
  return `${brand}:${model}:${category}:${condition}`
}

/**
 * 정가 추정 — 캐시 → 네이버 검색 → 감가율 적용
 */
export async function estimate(params: EstimateParams): Promise<EstimateResult> {
  const { brand, model, category, condition } = params
  if (!brand.trim()) throw new AppError('VALIDATION', '브랜드가 비어있습니다')
  if (!model.trim()) throw new AppError('VALIDATION', '모델명이 비어있습니다')

  const cacheKey = buildCacheKey(brand, model, category, condition)

  // 1. 캐시 확인
  const cached = await cacheRepo.findByKey(cacheKey)
  if (!cached.error && cached.data) {
    return {
      estimatedPrice: cached.data.retailPrice,
      source: 'naver_estimate',
      confidence: cached.data.confidence,
      reasoning: cached.data.reasoning ?? undefined,
    }
  }

  // 2. 네이버 검색
  const query = `${brand} ${model}`
  const searchResult = await naverGw.searchProducts(query, 20)

  if (searchResult.items.length === 0) {
    return { estimatedPrice: 0, source: 'manual', confidence: 0, reasoning: '검색 결과 없음' }
  }

  // 3. 가격 집계 — 중앙값 기반
  const prices = searchResult.items
    .map(item => Number(item.lprice))
    .filter(p => p > 0)
    .sort((a, b) => a - b)

  if (prices.length === 0) {
    return { estimatedPrice: 0, source: 'manual', confidence: 0, reasoning: '유효한 가격 없음' }
  }

  const medianPrice = prices[Math.floor(prices.length / 2)]
  const multiplier = getConditionMultiplier(condition)
  const estimatedPrice = Math.round(medianPrice * multiplier)
  const confidence = Math.min(prices.length / 10, 1)
  const reasoning = `네이버 ${prices.length}건 중앙값 ${medianPrice}원 × ${condition} 감가율 ${multiplier}`

  // 4. 캐시 저장
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()
  const sources = searchResult.items.slice(0, 5).map(item => ({
    title: item.title.replace(/<[^>]*>/g, ''),
    price: Number(item.lprice),
    mall: item.mallName,
    link: item.link,
  }))

  const upsertResult = await cacheRepo.upsert({
    cacheKey, brand,
    productName: `${brand} ${model}`,
    retailPrice: estimatedPrice,
    confidence, reasoning, expiresAt,
    sources,
  })
  if (upsertResult.error) {
    console.error('[price-estimate] 캐시 저장 실패:', upsertResult.error)
  }

  return { estimatedPrice, source: 'naver_estimate', confidence, reasoning }
}
