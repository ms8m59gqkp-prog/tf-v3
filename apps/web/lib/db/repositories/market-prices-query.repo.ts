/**
 * 시세 데이터 조회 쿼리 (market_prices 테이블)
 * WHY: market-prices.repo.ts 120줄 제한 준수 위한 쿼리 분리
 * HOW: COLUMNS + mapRow 재사용, 브랜드/카테고리 복합 검색
 * WHERE: market-price.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbListResult, PageOptions } from '../types'
import type { MarketPrice } from './market-prices.repo'

export interface MarketPriceFilters {
  brand?: string
  category?: string
  condition?: string
  source?: string
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

export async function list(
  filters?: MarketPriceFilters,
  pageOptions?: PageOptions,
): Promise<DbListResult<MarketPrice>> {
  const client = createAdminClient()
  let query = client.from('market_prices').select(COLUMNS, { count: 'exact' })

  if (filters?.brand) query = query.ilike('brand', `%${filters.brand}%`)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.condition) query = query.eq('condition', filters.condition)
  if (filters?.source) query = query.eq('source', filters.source)

  query = query.order('created_at', { ascending: false })
  if (pageOptions) {
    const from = (pageOptions.page - 1) * pageOptions.pageSize
    const to = from + pageOptions.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapRow),
    total: count ?? 0,
    error: null,
  }
}

export async function findByBrandCategory(
  brand: string,
  category: string,
): Promise<DbListResult<MarketPrice>> {
  const client = createAdminClient()
  const { data, error, count } = await client
    .from('market_prices')
    .select(COLUMNS, { count: 'exact' })
    .ilike('brand', `%${brand}%`)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .range(0, 49)
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapRow),
    total: count ?? 0,
    error: null,
  }
}
