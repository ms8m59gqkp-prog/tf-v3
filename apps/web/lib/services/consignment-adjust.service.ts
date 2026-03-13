/**
 * 위탁 가격 조정 공개 서비스 (L1 Business Layer)
 * WHY: 셀러가 토큰 기반으로 가격 조정 조회/응답 — 인증 없이 토큰으로만 접근
 * HOW: adjustment_token 검증 → 상태/응답 확인 → repo 위임
 * WHERE: /api/consignment/adjust/[token] 라우트에서 호출
 */
import { AppError } from '../errors'
import * as adjustRepo from '../db/repositories/consignment-adjust.repo'
import type { SellerResponse } from '../types/domain/consignment'

/** 셀러에게 노출할 안전한 필드 */
export interface AdjustmentView {
  id: string
  productName: string
  desiredPrice: number
  adjustmentPrice: number | null
  status: string | null
  sellerResponse: SellerResponse | null
}

/** 토큰으로 위탁 조회 → 공개 필드만 반환 */
export async function getByToken(token: string): Promise<AdjustmentView> {
  const result = await adjustRepo.findByToken(token)
  if (result.error !== null) {
    if (result.error.startsWith('NOT_FOUND:')) {
      throw new AppError('NOT_FOUND', '유효하지 않은 토큰입니다')
    }
    throw new AppError('INTERNAL', result.error)
  }

  const c = result.data
  return {
    id: c.id,
    productName: c.productName,
    desiredPrice: c.desiredPrice,
    adjustmentPrice: c.adjustmentPrice ?? null,
    status: c.status ?? null,
    sellerResponse: c.sellerResponse ?? null,
  }
}

/** 셀러 응답 저장 (수락/역제안/거절) */
export async function respondToAdjust(
  token: string,
  response: SellerResponse,
  counterPrice?: number,
): Promise<AdjustmentView> {
  const result = await adjustRepo.findByToken(token)
  if (result.error !== null) {
    if (result.error.startsWith('NOT_FOUND:')) {
      throw new AppError('NOT_FOUND', '유효하지 않은 토큰입니다')
    }
    throw new AppError('INTERNAL', result.error)
  }

  const c = result.data
  if (c.status !== 'on_hold') {
    throw new AppError('CONFLICT', `응답 불가 상태입니다: ${c.status}`)
  }
  if (c.sellerResponse !== null && c.sellerResponse !== undefined) {
    throw new AppError('CONFLICT', '이미 응답이 완료되었습니다')
  }

  const cp = response === 'counter' ? (counterPrice ?? null) : null
  const updated = await adjustRepo.updateResponse(c.id, response, cp)
  if (updated.error !== null) throw new AppError('INTERNAL', updated.error)

  const u = updated.data
  return {
    id: u.id,
    productName: u.productName,
    desiredPrice: u.desiredPrice,
    adjustmentPrice: u.adjustmentPrice ?? null,
    status: u.status ?? null,
    sellerResponse: u.sellerResponse ?? null,
  }
}
