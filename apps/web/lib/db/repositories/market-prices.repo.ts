/**
 * 시세 데이터 CRUD (market_prices 테이블)
 * WHY: 브랜드/카테고리별 시세 데이터 관리
 * HOW: COLUMNS 명시 + mapRow snake→camelCase + DbResult 래핑
 * WHERE: market-price.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'

export interface MarketPrice {
  id: string
  brand: string
  category: string
  price: number
  size: string | null
  condition: string | null
  material: string | null
  color: string | null
  measurements: Record<string, unknown> | null
  source: string | null
  sourceUrl: string | null
  sourceDate: string | null
  imagePaths: string[] | null
  rawTitle: string | null
  rawContent: string | null
  productName: string | null
  createdAt: string | null
  updatedAt: string | null
}

const COLUMNS = [
  'id', 'brand', 'category', 'price', 'size', 'condition', 'material',
  'color', 'measurements', 'source', 'source_url', 'source_date',
  'image_paths', 'raw_title', 'raw_content', 'product_name',
  'created_at', 'updated_at',
].join(', ')

function mapRow(row: Record<string, unknown>): MarketPrice {
  return {
    id: row.id as string,
    brand: row.brand as string,
    category: row.category as string,
    price: Number(row.price),
    size: (row.size as string) ?? null,
    condition: (row.condition as string) ?? null,
    material: (row.material as string) ?? null,
    color: (row.color as string) ?? null,
    measurements: (row.measurements as Record<string, unknown>) ?? null,
    source: (row.source as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    sourceDate: (row.source_date as string) ?? null,
    imagePaths: (row.image_paths as string[]) ?? null,
    rawTitle: (row.raw_title as string) ?? null,
    rawContent: (row.raw_content as string) ?? null,
    productName: (row.product_name as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  }
}


export interface CreateMarketPriceInput {
  brand: string
  category: string
  price: number
  size?: string
  condition?: string
  material?: string
  color?: string
  measurements?: Record<string, unknown>
  source?: string
  sourceUrl?: string
  sourceDate?: string
  imagePaths?: string[]
  productName?: string
}

export async function create(input: CreateMarketPriceInput): Promise<DbResult<MarketPrice>> {
  const client = createAdminClient()
  const { data, error } = await client.from('market_prices').insert({
    brand: input.brand,
    category: input.category,
    price: input.price,
    size: input.size ?? null,
    condition: input.condition ?? null,
    material: input.material ?? null,
    color: input.color ?? null,
    measurements: input.measurements ?? null,
    source: input.source ?? null,
    source_url: input.sourceUrl ?? null,
    source_date: input.sourceDate ?? null,
    image_paths: input.imagePaths ?? null,
    product_name: input.productName ?? null,
  }).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

