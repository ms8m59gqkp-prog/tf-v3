/**
 * 가격 추정 캐시 CRUD (price_estimate_cache 테이블)
 * WHY: 네이버 API 호출 절약 + 동일 조건 재추정 방지
 * HOW: cache_key 기반 조회/upsert, expires_at 만료 체크
 * WHERE: price-estimate.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'

export interface PriceEstimateCache {
  id: string
  cacheKey: string
  brand: string
  productName: string | null
  retailPrice: number
  confidence: number
  sources: Record<string, unknown>[] | null
  reasoning: string | null
  expiresAt: string
  createdAt: string | null
  updatedAt: string | null
}

const COLUMNS = [
  'id', 'cache_key', 'brand', 'product_name', 'retail_price',
  'confidence', 'sources', 'reasoning', 'expires_at',
  'created_at', 'updated_at',
].join(', ')

function mapRow(row: Record<string, unknown>): PriceEstimateCache {
  return {
    id: row.id as string,
    cacheKey: row.cache_key as string,
    brand: row.brand as string,
    productName: (row.product_name as string) ?? null,
    retailPrice: Number(row.retail_price),
    confidence: Number(row.confidence),
    sources: (row.sources as Record<string, unknown>[]) ?? null,
    reasoning: (row.reasoning as string) ?? null,
    expiresAt: row.expires_at as string,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  }
}

/** 캐시 조회 — expires_at이 현재 이후인 유효한 캐시만 반환 */
export async function findByKey(cacheKey: string): Promise<DbResult<PriceEstimateCache | null>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('price_estimate_cache')
    .select(COLUMNS)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export interface UpsertCacheInput {
  cacheKey: string
  brand: string
  productName?: string
  retailPrice: number
  confidence: number
  sources?: Record<string, unknown>[]
  reasoning?: string
  expiresAt: string
}

/** 캐시 upsert — cache_key 기준 충돌 시 업데이트 */
export async function upsert(input: UpsertCacheInput): Promise<DbResult<PriceEstimateCache>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('price_estimate_cache')
    .upsert({
      cache_key: input.cacheKey,
      brand: input.brand,
      product_name: input.productName ?? null,
      retail_price: input.retailPrice,
      confidence: input.confidence,
      sources: input.sources ?? null,
      reasoning: input.reasoning ?? null,
      expires_at: input.expiresAt,
    }, { onConflict: 'cache_key' })
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}
