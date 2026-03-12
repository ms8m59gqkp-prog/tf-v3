/**
 * 상품 공유 인프라 + 기본 CRUD
 * WHY: st_products 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 36컬럼 명시 + mapRow snake->camelCase + PostgREST FK JOIN sellers
 * WHERE: 상품 목록/상세/상태변경 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { StProduct } from '../../types/domain/product'
import type { Seller } from '../../types/domain/seller'
import type { DbResult } from '../types'

/** DDL st_products 36컬럼 전체 -- SELECT * 금지 (AV1) */
const COLUMNS = `id, product_number, legacy_code, product_name, seller_id, sale_price,
  product_type, is_active, smart_store_registered, consignment_date,
  created_at, updated_at, brand, size, origin, material, measurements,
  naver_product_id, seller_payment, product_condition, unsellable_reason,
  sold_at, sold_amount, sales_record_id, buyer_name, reference_image,
  photos, photo_status, smartstore_status, smartstore_data, composition,
  category, retail_price, retail_price_source, retail_price_confidence, color` as const

/** [J3] 상품 + 셀러 JOIN 타입 */
export interface StProductWithSeller extends StProduct {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerTier'> | null
}

/** st_products 36필드 매핑: snake_case -> camelCase, NUMERIC(3,2) -> Number() */
function mapRow(row: Record<string, unknown>): StProduct {
  return {
    id: row.id as string,
    productNumber: (row.product_number as string) ?? null,
    legacyCode: (row.legacy_code as string) ?? null,
    productName: row.product_name as string,
    sellerId: (row.seller_id as string) ?? null,
    salePrice: row.sale_price as number,
    productType: (row.product_type as StProduct['productType']) ?? null,
    isActive: (row.is_active as boolean) ?? null,
    smartStoreRegistered: (row.smart_store_registered as boolean) ?? null,
    consignmentDate: (row.consignment_date as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    brand: (row.brand as string) ?? null,
    size: (row.size as string) ?? null,
    origin: (row.origin as string) ?? null,
    material: (row.material as string) ?? null,
    measurements: (row.measurements as unknown as Record<string, unknown>) ?? null,
    naverProductId: (row.naver_product_id as string) ?? null,
    sellerPayment: (row.seller_payment as number) ?? null,
    productCondition: (row.product_condition as string) ?? null,
    unsellableReason: (row.unsellable_reason as string) ?? null,
    soldAt: (row.sold_at as string) ?? null,
    soldAmount: (row.sold_amount as number) ?? null,
    salesRecordId: (row.sales_record_id as string) ?? null,
    buyerName: (row.buyer_name as string) ?? null,
    referenceImage: (row.reference_image as string) ?? null,
    photos: (row.photos as unknown[]) ?? null,
    photoStatus: (row.photo_status as StProduct['photoStatus']) ?? null,
    smartstoreStatus: (row.smartstore_status as StProduct['smartstoreStatus']) ?? null,
    smartstoreData: (row.smartstore_data as unknown as Record<string, unknown>) ?? null,
    composition: (row.composition as string) ?? null,
    category: (row.category as string) ?? null,
    retailPrice: (row.retail_price as number) ?? null,
    retailPriceSource: (row.retail_price_source as StProduct['retailPriceSource']) ?? null,
    retailPriceConfidence: row.retail_price_confidence != null
      ? Number(row.retail_price_confidence) : null,
    color: (row.color as string) ?? null,
  }
}

function mapSellerJoin(row: Record<string, unknown>): Pick<Seller, 'name' | 'phone' | 'sellerTier'> | null {
  const seller = row.sellers as unknown as Record<string, unknown> | null
  if (!seller) return null
  return {
    name: seller.name as string,
    phone: seller.phone as string,
    sellerTier: (seller.seller_tier as Seller['sellerTier']) ?? null,
  }
}

const JOIN_SELECT = `${COLUMNS}, sellers(name, phone, seller_tier)`

function mapProductWithSeller(row: Record<string, unknown>): StProductWithSeller {
  return { ...mapRow(row), sellers: mapSellerJoin(row) }
}

export { mapRow, mapProductWithSeller, COLUMNS, JOIN_SELECT }
export async function findById(id: string): Promise<DbResult<StProductWithSeller>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('st_products').select(JOIN_SELECT).eq('id', id).single()
  if (error) return { data: null, error: error.message }
  return { data: mapProductWithSeller(data as unknown as Record<string, unknown>), error: null }
}

export async function findByIds(ids: string[]): Promise<DbResult<StProductWithSeller[]>> {
  if (ids.length === 0) return { data: [], error: null }
  const client = createAdminClient()
  const { data, error } = await client.from('st_products').select(JOIN_SELECT).in('id', ids)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapProductWithSeller), error: null }
}

export async function update(
  id: string, fields: Partial<Record<string, unknown>>,
): Promise<DbResult<StProduct>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('st_products').update(fields).eq('id', id).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function create(
  input: Partial<Record<string, unknown>> & { product_name: string; sale_price: number },
): Promise<DbResult<StProduct>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('st_products').insert(input).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}
