/**
 * 상품 리포지토리 — st_products 테이블 CRUD
 * WHY: 상품 정보 조회/이미지 URL 업데이트 데이터 접근
 * HOW: createAdminClient + mapRow
 * WHERE: product 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import { chunkArray } from '@/lib/utils/chunk'
import type { StProduct } from '@/lib/types/domain/product'

const COLUMNS = 'id, product_number, brand, model, category, sub_category, condition, size, color, description, original_price, estimated_price, sold_price, measurements, image_urls, seller_id, order_id, status, created_at, updated_at'

export function mapRow(row: Record<string, unknown>): StProduct {
  return {
    id: row.id as string,
    productNumber: row.product_number as string,
    brand: (row.brand as string) || '',
    model: (row.model as string) || '',
    category: (row.category as string) || undefined,
    subCategory: (row.sub_category as string) || undefined,
    condition: (row.condition as string) || undefined,
    size: (row.size as string) || undefined,
    color: (row.color as string) || undefined,
    description: (row.description as string) || undefined,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    estimatedPrice: row.estimated_price != null ? Number(row.estimated_price) : undefined,
    soldPrice: row.sold_price != null ? Number(row.sold_price) : undefined,
    measurements: row.measurements as StProduct['measurements'],
    imageUrls: row.image_urls as string[] | undefined,
    sellerId: (row.seller_id as string) || undefined,
    orderId: (row.order_id as string) || undefined,
    status: (row.status as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getById(id: string): Promise<StProduct> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('st_products').select(COLUMNS).eq('id', id).single()
  if (error) throw new Error(`[products.getById] ${error.message}`)
  return mapRow(data)
}

export async function getByProductNumber(productNumber: string): Promise<StProduct> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('st_products').select(COLUMNS).eq('product_number', productNumber).single()
  if (error) throw new Error(`[products.getByProductNumber] ${error.message}`)
  return mapRow(data)
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<StProduct[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('st_products')
    .select(COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[products.listByPage] ${error.message}`)
  return data.map(mapRow)
}

export async function listBySellerId(sellerId: string): Promise<StProduct[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('st_products')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[products.listBySellerId] ${error.message}`)
  return data.map(mapRow)
}

export async function getByIds(ids: string[]): Promise<StProduct[]> {
  if (ids.length === 0) return []
  const chunks = chunkArray(ids, 100)
  const sb = createAdminClient()
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await sb.from('st_products').select(COLUMNS).in('id', chunk)
      if (error) throw new Error(`[products.getByIds] ${error.message}`)
      return data.map(mapRow)
    }),
  )
  return results.flatMap((r) => r)
}

export async function updateImageUrls(id: string, urls: string[]): Promise<StProduct> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('st_products')
    .update({ image_urls: urls, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[products.updateImageUrls] ${error.message}`)
  return mapRow(data)
}
