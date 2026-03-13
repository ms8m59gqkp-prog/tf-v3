/**
 * 매출 서비스 (L1 Business Layer)
 * WHY: 매출장/네이버정산 업로드 + 위탁 감지 비즈니스 로직 캡슐화
 * HOW: repo 호출 → BulkResult → UploadResult 변환, 위탁 분류는 product-classifier 위임
 * WHERE: 매출 업로드 API route, 위탁 감지 API route에서 호출
 */
import { AppError } from '../errors'
import * as salesRecordsRepo from '../db/repositories/sales-records.repo'
import * as salesRecordsQueryRepo from '../db/repositories/sales-records-query.repo'
import * as naverSettlementsRepo from '../db/repositories/naver-settlements.repo'
import { classifyProduct } from '../utils/product-classifier'
import type { SalesRecord } from '../types/domain/settlement'

/* ─── 인터페이스 ─── */

export interface UploadResult {
  inserted: number
  duplicated: number
  failed: number
  sessionId: string
}

export interface DetectResult {
  matched: number
  details: Array<{
    productName: string
    consignmentSeller: string
    saleDate: string
    saleAmount: number
  }>
  unmatched: string[]
}

/* ─── 1. uploadSalesLedger ─── */

export async function uploadSalesLedger(
  rows: Record<string, unknown>[], sessionId: string,
): Promise<UploadResult> {
  if (rows.length === 0) throw new AppError('VALIDATION', '업로드할 행이 없습니다')

  const batchId = sessionId

  for (const row of rows) {
    const name = row.product_name as string
    if (name) {
      const classified = classifyProduct(name)
      if (classified.isConsignment) {
        row.is_consignment = true
        row.consignment_seller = classified.sellerName
      }
    }
  }

  const result = await salesRecordsRepo.bulkInsert(rows, batchId, sessionId)
  const duplicated = result.failed.filter(
    f => f.errors.some(e => e.type === 'duplicate'),
  ).length

  return {
    inserted: result.succeeded.length,
    duplicated,
    failed: result.failed.length - duplicated,
    sessionId,
  }
}

/* ─── 2. uploadNaverSettle ─── */

export async function uploadNaverSettle(
  rows: Record<string, unknown>[], batchId: string,
): Promise<UploadResult> {
  if (rows.length === 0) throw new AppError('VALIDATION', '업로드할 행이 없습니다')

  const result = await naverSettlementsRepo.bulkInsert(rows, batchId)
  const duplicated = result.failed.filter(
    f => f.errors.some(e => e.type === 'duplicate'),
  ).length

  return {
    inserted: result.succeeded.length,
    duplicated,
    failed: result.failed.length - duplicated,
    sessionId: batchId,
  }
}

/* ─── 3. deleteBySession ─── */

export async function deleteBySession(sessionId: string): Promise<number> {
  const matchCheck = await salesRecordsQueryRepo.hasMatchedInSession(sessionId)
  if (matchCheck.error !== null) throw new AppError('INTERNAL', matchCheck.error)
  if (matchCheck.data) {
    throw new AppError('CONFLICT', '매칭된 매출 기록이 포함되어 있어 삭제할 수 없습니다. 매칭 해제 후 다시 시도하세요.')
  }

  const result = await salesRecordsQueryRepo.deleteBySessionId(sessionId)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

/* ─── 4. listLedger ─── */

export async function listLedger(page: number, pageSize: number) {
  const result = await salesRecordsQueryRepo.list({ page, pageSize })
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { data: result.data, total: result.total }
}

/* ─── 5. detectConsignmentSales ─── */

export async function detectConsignmentSales(batchId: string): Promise<DetectResult> {
  const result = await salesRecordsQueryRepo.listByBatch(batchId)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)

  const consignmentRecords = result.data.filter(
    (r: SalesRecord) => r.isConsignment === true,
  )

  const details: DetectResult['details'] = []
  const unmatched: string[] = []

  for (const rec of consignmentRecords) {
    if (rec.consignmentSeller) {
      details.push({
        productName: rec.productName ?? '',
        consignmentSeller: rec.consignmentSeller,
        saleDate: rec.saleDate,
        saleAmount: rec.saleAmount ?? 0,
      })
    } else {
      unmatched.push(rec.productName ?? rec.id)
    }
  }

  return { matched: details.length, details, unmatched }
}
