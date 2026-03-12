/**
 * 위탁 대량등록 서비스 (L1 Business Layer)
 * WHY: consignment.service.ts 150줄 제한 준수 — 대량등록 로직 분리
 * HOW: phone→셀러 매핑 + bulkCreate repo 호출
 * WHERE: 위탁 대량등록 API route에서 호출
 */
import { AppError } from '../errors'
import * as consignmentsBulkRepo from '../db/repositories/consignments-bulk.repo'
import * as sellersRepo from '../db/repositories/sellers.repo'
import * as sellersBatchRepo from '../db/repositories/sellers-batch.repo'
import type { ConsignmentRequest } from '../types/domain/consignment'
import type { BulkResult } from '../db/types'
import { normalizePhone } from '../utils/phone'

export interface RawConsignmentRow {
  name: string
  phone: string
  productName: string
  desiredPrice: number
  productCondition: string
  source?: string
  memo?: string
}

export async function bulkCreate(rows: RawConsignmentRow[]): Promise<BulkResult<ConsignmentRequest>> {
  if (rows.length === 0) throw new AppError('VALIDATION', '등록할 행이 없습니다')

  const phones = [...new Set(rows.map(r => normalizePhone(r.phone)))]
  const batchResult = await sellersBatchRepo.findByPhones(phones)
  if (batchResult.error !== null) throw new AppError('INTERNAL', batchResult.error)

  const sellerMap = new Map<string, string>()
  for (const seller of batchResult.data) {
    sellerMap.set(seller.phone, seller.id)
  }

  for (const row of rows) {
    const phone = normalizePhone(row.phone)
    if (!sellerMap.has(phone)) {
      const created = await sellersRepo.findOrCreate(row.name, phone)
      if (created.error !== null) throw new AppError('INTERNAL', created.error)
      sellerMap.set(phone, created.data.id)
    }
  }

  const mapped = rows.map((row, idx) => ({
    rowIndex: idx,
    data: {
      seller_id: sellerMap.get(normalizePhone(row.phone))!,
      product_name: row.productName,
      desired_price: row.desiredPrice,
      product_condition: row.productCondition,
      source: row.source ?? null,
      memo: row.memo ?? null,
      status: 'pending' as const,
    },
  }))

  return consignmentsBulkRepo.bulkCreate(mapped)
}
