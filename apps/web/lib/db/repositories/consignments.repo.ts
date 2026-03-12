/**
 * 위탁 공유 인프라 + 기본 CRUD
 * WHY: consignment_requests 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 28컬럼 명시 + mapRow/mapJoinRow + DbResult 래핑
 * WHERE: 위탁 접수/검수/승인 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { ConsignmentRequest } from '../../types/domain/consignment'
import type { Seller } from '../../types/domain/seller'
import type { StProduct } from '../../types/domain/product'
import type { DbResult } from '../types'

/** DDL 28컬럼 전체 — SELECT * 금지 (AV1) */
const COLUMNS = `id, seller_id, product_name, desired_price, product_condition,
  status, approved_at, product_id, source, memo, created_at, updated_at,
  image_url, applied_at, employee_purchase_date, privacy_consent,
  product_number, received_at, inspected_at, measurements, item_type,
  inspection_image, adjustment_token, adjustment_price, seller_response,
  seller_counter_price, origin, composition` as const

/** JOIN 셀러 + 상품 (PostgREST FK 자동 JOIN) */
const JOIN_COLUMNS = `${COLUMNS}, sellers(name, phone, seller_code, seller_tier),
  st_products(product_number)` as const

/** 위탁 + 셀러 + 상품 JOIN 타입 */
export interface ConsignmentWithRelations extends ConsignmentRequest {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerCode' | 'sellerTier'> | null
  stProducts: Pick<StProduct, 'productNumber'> | null
}

/** 28필드 snake_case → camelCase 매핑 */
function mapRow(row: Record<string, unknown>): ConsignmentRequest {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    productName: row.product_name as string,
    desiredPrice: row.desired_price as number,
    productCondition: row.product_condition as string,
    status: (row.status as ConsignmentRequest['status']) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    productId: (row.product_id as string) ?? null,
    source: (row.source as ConsignmentRequest['source']) ?? null,
    memo: (row.memo as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    appliedAt: (row.applied_at as string) ?? null,
    employeePurchaseDate: (row.employee_purchase_date as string) ?? null,
    privacyConsent: (row.privacy_consent as string) ?? null,
    productNumber: (row.product_number as string) ?? null,
    receivedAt: (row.received_at as string) ?? null,
    inspectedAt: (row.inspected_at as string) ?? null,
    measurements: (row.measurements as Record<string, unknown>) ?? null,
    itemType: (row.item_type as string) ?? null,
    inspectionImage: (row.inspection_image as string) ?? null,
    adjustmentToken: (row.adjustment_token as string) ?? null,
    adjustmentPrice: (row.adjustment_price as number) ?? null,
    sellerResponse: (row.seller_response as ConsignmentRequest['sellerResponse']) ?? null,
    sellerCounterPrice: (row.seller_counter_price as number) ?? null,
    origin: (row.origin as string) ?? null,
    composition: (row.composition as string) ?? null,
  }
}

/** JOIN 결과 매핑 (sellers + st_products 포함) */
function mapJoinRow(row: Record<string, unknown>): ConsignmentWithRelations {
  const base = mapRow(row)
  const sellers = row.sellers as Record<string, unknown> | null
  const stProducts = row.st_products as Record<string, unknown> | null
  return {
    ...base,
    sellers: sellers ? {
      name: sellers.name as string,
      phone: sellers.phone as string,
      sellerCode: sellers.seller_code as string,
      sellerTier: (sellers.seller_tier as Seller['sellerTier']) ?? null,
    } : null,
    stProducts: stProducts ? {
      productNumber: (stProducts.product_number as string) ?? null,
    } : null,
  }
}

export { COLUMNS, JOIN_COLUMNS, mapRow, mapJoinRow }

export async function findById(id: string): Promise<DbResult<ConsignmentWithRelations>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('consignment_requests').select(JOIN_COLUMNS).eq('id', id).single()
  if (error) return { data: null, error: error.message }
  return { data: mapJoinRow(data as Record<string, unknown>), error: null }
}

export async function generateProductNumber(): Promise<DbResult<string>> {
  const client = createAdminClient()
  const { data, error } = await client.rpc(
    'generate_product_number' as never, {} as never,
  )
  if (error) return { data: null, error: error.message }
  return { data: data as string, error: null }
}

export async function create(
  input: Record<string, unknown>,
): Promise<DbResult<ConsignmentRequest>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('consignment_requests').insert(input).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}
