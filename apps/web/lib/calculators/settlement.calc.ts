/**
 * 정산 금액 계산기 (L1 Business Layer)
 * WHY: V2 정산 계산 로직 계승 — Math.round 반올림 (결정 D-8)
 * HOW: 판매 항목 합산 → 수수료율 적용 → 반올림 → 정산 금액 산출
 * WHERE: settlement 서비스에서 호출, calcCommission 단위 테스트
 */

import { AppError } from '../errors'
import type { SoldItem } from '../types/domain/settlement'
import type { SellerTier } from '../types/domain/seller'
import { getCommissionRate } from '../types/domain/seller'

interface CalcParams {
  seller: { id: string; commissionRate?: number | null; sellerTier: SellerTier }
  soldItems: SoldItem[]
  periodStart: string
  periodEnd: string
}

interface CalcResult {
  sellerId: string
  periodStart: string
  periodEnd: string
  totalSales: number
  commissionRate: number
  commissionAmount: number
  returnDeduction: number
  settlementAmount: number
  itemCount: number
  soldItemIds: string[]
}

/** 수수료 계산 — Math.round 반올림 (V2 동일) */
export function calcCommission(totalSales: number, rate: number): number {
  if (totalSales < 0) {
    throw new AppError('VALIDATION', '총 매출액이 음수입니다')
  }
  if (rate < 0 || rate > 1) {
    throw new AppError('VALIDATION', '수수료율이 범위를 벗어났습니다 (0~1)')
  }
  return Math.round(totalSales * rate)
}

/** 정산 계산 — soldItems 합산 → 수수료 차감 */
export function calculateSettlement(params: CalcParams): CalcResult {
  const { seller, soldItems, periodStart, periodEnd } = params

  if (soldItems.length === 0) {
    throw new AppError('VALIDATION', '정산 대상 판매 항목이 없습니다')
  }

  const totalSales = soldItems.reduce(
    (sum, item) => sum + item.salePrice * item.quantity, 0,
  )
  const rate = getCommissionRate(seller)
  const commissionAmount = calcCommission(totalSales, rate)
  const returnDeduction = 0 // V2 동일 — 향후 확장

  return {
    sellerId: seller.id,
    periodStart,
    periodEnd,
    totalSales,
    commissionRate: rate,
    commissionAmount,
    returnDeduction,
    settlementAmount: totalSales - commissionAmount - returnDeduction,
    itemCount: soldItems.length,
    soldItemIds: soldItems.map((item) => item.id),
  }
}
