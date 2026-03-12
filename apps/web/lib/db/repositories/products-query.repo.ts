/**
 * 상품 조회 + 집계
 * WHY: products.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: 5개 상태 필터 + .or() 금지 대응 + getSummary 집계
 * WHERE: 상품 목록 화면, 대시보드 집계
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult, DbListResult, PageOptions } from '../types'
import { JOIN_SELECT, mapProductWithSeller, type StProductWithSeller } from './products.repo'

export interface ProductSummary {
  photoPending: number
  photoDone: number
  selling: number
  sold: number
  inactive: number
}

interface ProductFilters {
  status?: 'photo_pending' | 'photo_done' | 'selling' | 'sold' | 'inactive'
  sellerId?: string
  search?: string
}

/**
 * 상품 목록 조회 (5개 상태 필터 + 검색)
 * [AV3] .or() 금지: product_number 패턴이면 product_number 검색, 아니면 product_name 검색
 */
export async function list(
  filters?: ProductFilters,
  pageOptions?: PageOptions,
): Promise<DbListResult<StProductWithSeller>> {
  const client = createAdminClient()
  let query = client.from('st_products').select(JOIN_SELECT, { count: 'exact' })

  if (filters?.status === 'photo_pending') {
    query = query.in('photo_status', ['pending', 'shooting'])
  } else if (filters?.status === 'photo_done') {
    query = query.eq('photo_status', 'completed').eq('smartstore_status', 'draft')
  } else if (filters?.status === 'selling') {
    query = query.eq('is_active', true).is('sold_at', null)
      .in('smartstore_status', ['uploaded', 'selling'])
  } else if (filters?.status === 'sold') {
    query = query.not('sold_at', 'is', null)
  } else if (filters?.status === 'inactive') {
    query = query.eq('is_active', false)
  }

  if (filters?.sellerId) query = query.eq('seller_id', filters.sellerId)

  if (filters?.search) {
    const pattern = `%${filters.search}%`
    const isProductNumber = /^[A-Z0-9-]+$/i.test(filters.search)
    if (isProductNumber) {
      query = query.ilike('product_number', pattern)
    } else {
      query = query.ilike('product_name', pattern)
    }
  }

  query = query.order('created_at', { ascending: false })
  if (pageOptions) {
    const from = (pageOptions.page - 1) * pageOptions.pageSize
    const to = from + pageOptions.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapProductWithSeller),
    total: count ?? 0,
    error: null,
  }
}

export async function getSummary(): Promise<DbResult<ProductSummary>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('st_products')
    .select('photo_status, smartstore_status, is_active, sold_at')
    .range(0, 99999)
  if (error) return { data: null, error: error.message }

  const rows = data as unknown as Record<string, unknown>[]
  const s: ProductSummary = { photoPending: 0, photoDone: 0, selling: 0, sold: 0, inactive: 0 }
  for (const r of rows) {
    if (r.is_active === false) { s.inactive++; continue }
    if (r.sold_at != null) { s.sold++; continue }
    const photo = r.photo_status as string
    const ss = r.smartstore_status as string
    if (photo === 'pending' || photo === 'shooting') { s.photoPending++ }
    else if (photo === 'completed' && ss === 'draft') { s.photoDone++ }
    else if ((ss === 'uploaded' || ss === 'selling') && r.is_active === true) { s.selling++ }
  }
  return { data: s, error: null }
}
