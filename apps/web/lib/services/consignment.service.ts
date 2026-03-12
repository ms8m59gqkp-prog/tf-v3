/**
 * 위탁 서비스 (L1 Business Layer)
 * WHY: 위탁 접수/검수/승인 비즈니스 로직 캡슐화 — repo 직접 노출 방지
 * HOW: camelCase ↔ snake_case 변환 + DbResult 에러 → AppError throw
 * WHERE: 위탁 목록/상세/생성/상태전이/승인/삭제 API route에서 호출
 */
import { AppError } from '../errors'
import * as consignmentsRepo from '../db/repositories/consignments.repo'
import * as consignmentsQueryRepo from '../db/repositories/consignments-query.repo'
import * as sellersRepo from '../db/repositories/sellers.repo'
import type { ConsignmentWithRelations } from '../db/repositories/consignments.repo'
import type { ConsignmentRequest, ConsignmentStatus } from '../types/domain/consignment'
import type { PageOptions } from '../db/types'

export { bulkCreate, type RawConsignmentRow } from './consignment-bulk.service'

export interface StatusExtra {
  memo?: string
  inspectionImage?: string
  adjustmentPrice?: number
  adjustmentToken?: string
  receivedAt?: string
  inspectedAt?: string
}

export interface CreateConsignmentInput {
  sellerId: string
  productName: string
  desiredPrice: number
  productCondition: string
  source?: string
  memo?: string
}

export async function create(input: CreateConsignmentInput): Promise<ConsignmentRequest> {
  const sellerResult = await sellersRepo.findById(input.sellerId)
  if (sellerResult.error !== null) {
    throw new AppError('NOT_FOUND', `셀러를 찾을 수 없습니다: ${input.sellerId}`)
  }

  const result = await consignmentsRepo.create({
    seller_id: input.sellerId,
    product_name: input.productName,
    desired_price: input.desiredPrice,
    product_condition: input.productCondition,
    source: input.source ?? null,
    memo: input.memo ?? null,
    status: 'pending',
  })
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function list(
  filters: { status?: string; sellerId?: string; search?: string },
  pageOptions: PageOptions,
): Promise<{ items: ConsignmentWithRelations[]; total: number }> {
  const result = await consignmentsQueryRepo.list(filters, pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

export async function getById(id: string): Promise<ConsignmentWithRelations> {
  const result = await consignmentsRepo.findById(id)
  if (result.error !== null) throw new AppError('NOT_FOUND', `위탁을 찾을 수 없습니다: ${id}`)
  return result.data
}

const EXTRA_KEY_MAP: Record<string, string> = {
  memo: 'memo',
  inspectionImage: 'inspection_image',
  adjustmentPrice: 'adjustment_price',
  adjustmentToken: 'adjustment_token',
  receivedAt: 'received_at',
  inspectedAt: 'inspected_at',
}

export async function updateStatus(
  id: string, newStatus: ConsignmentStatus, extra?: StatusExtra,
): Promise<ConsignmentRequest> {
  if (newStatus === 'approved') {
    throw new AppError('CONFLICT', '승인은 approveConsignment()을 사용하세요')
  }
  const snakeExtra: Record<string, unknown> = {}
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      const snakeKey = EXTRA_KEY_MAP[key]
      if (snakeKey && val !== undefined) snakeExtra[snakeKey] = val
    }
  }

  const result = await consignmentsQueryRepo.updateStatus(id, newStatus, snakeExtra)
  if (result.error !== null) throw new AppError('CONFLICT', result.error)
  return result.data
}

export async function approveConsignment(id: string): Promise<ConsignmentRequest> {
  const current = await consignmentsRepo.findById(id)
  if (current.error !== null) throw new AppError('NOT_FOUND', `위탁을 찾을 수 없습니다: ${id}`)

  const status = current.data.status
  if (status !== 'inspecting' && status !== 'pending') {
    throw new AppError('CONFLICT', `승인 불가 상태입니다: ${status}`)
  }

  const rpcResult = await consignmentsRepo.generateProductNumber()
  if (rpcResult.error !== null) throw new AppError('INTERNAL', `채번 실패: ${rpcResult.error}`)
  const productNumber = rpcResult.data

  const result = await consignmentsQueryRepo.updateStatus(id, 'approved', {
    product_number: productNumber as string,
    approved_at: new Date().toISOString(),
  })
  if (result.error !== null) throw new AppError('CONFLICT', result.error)
  return result.data
}

export async function batchDelete(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const result = await consignmentsQueryRepo.batchDelete(ids)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}
