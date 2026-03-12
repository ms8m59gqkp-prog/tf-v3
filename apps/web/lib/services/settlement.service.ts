/**
 * 정산 서비스 (L1 Business Layer)
 * WHY: 정산 생성/확정/지급 비즈니스 로직 캡슐화 — repo 직접 노출 방지
 * HOW: SETTLEMENT_TRANSITIONS 기반 상태 전이 검증 + DbResult 에러 → AppError throw
 * WHERE: 정산 목록/상세/생성/확정/지급 API route에서 호출
 */
import { AppError } from '../errors'
import * as settlementRepo from '../db/repositories/settlement.repo'
import * as settlementStatusRepo from '../db/repositories/settlement-status.repo'
import * as soldItemsRepo from '../db/repositories/sold-items.repo'
import type { SettlementWithSeller, SettlementWithDetails } from '../db/repositories/settlement.repo'
import type { Settlement, SettlementStatus, SoldItem } from '../types/domain/settlement'
import { SETTLEMENT_TRANSITIONS } from '../types/domain/settlement'
import type { SellerTier } from '../types/domain/seller'
import type { PageOptions } from '../db/types'
import { calculateSettlement } from '../calculators/settlement.calc'
import * as sellersRepo from '../db/repositories/sellers.repo'

// ─── 내부 helper ───

async function getSoldItemsForSeller(
  sellerId: string, periodStart: string, periodEnd: string,
): Promise<SoldItem[]> {
  const result = await soldItemsRepo.listPending(sellerId, periodStart, periodEnd)
  if (result.error !== null) {
    throw new AppError('INTERNAL', `판매기록 조회 실패: ${result.error}`)
  }
  return result.data
}

// ─── export 함수 ───

export interface GenerateParams {
  periodStart: string
  periodEnd: string
}

export interface GenerateResult {
  period: { start: string; end: string }
  createdCount: number
  settlements: Settlement[]
  failedSellers: Array<{ sellerId: string; error: string }>
}

/** 정산 일괄 생성 — V2 워크플로우 */
export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const { periodStart, periodEnd } = params
  const sellersResult = await sellersRepo.listActive()
  if (sellersResult.error !== null) {
    throw new AppError('INTERNAL', `셀러 목록 조회 실패: ${sellersResult.error}`)
  }

  // P0-1: 동일 기간 기존 정산 존재 확인
  const existingResult = await settlementRepo.list(
    { periodFrom: periodStart, periodTo: periodEnd }, { page: 1, pageSize: 1 },
  )
  if (existingResult.error === null && existingResult.total > 0) {
    throw new AppError('CONFLICT', `해당 기간(${periodStart}~${periodEnd})에 이미 ${existingResult.total}건의 정산이 존재합니다`)
  }

  const settlements: Settlement[] = []
  const failedSellers: Array<{ sellerId: string; error: string }> = []

  for (const seller of sellersResult.data) {
    try {
      const soldItems = await getSoldItemsForSeller(seller.id, periodStart, periodEnd)
      if (soldItems.length === 0) continue

      const calcResult = calculateSettlement({
        seller: {
          id: seller.id,
          commissionRate: seller.commissionRate,
          sellerTier: seller.sellerTier ?? 'general' as SellerTier,
        },
        soldItems,
        periodStart,
        periodEnd,
      })

      const rpcResult = await settlementStatusRepo.createWithItems({
        sellerId: calcResult.sellerId,
        periodStart: calcResult.periodStart,
        periodEnd: calcResult.periodEnd,
        totalSales: calcResult.totalSales,
        commissionRate: calcResult.commissionRate,
        commissionAmount: calcResult.commissionAmount,
        returnDeduction: calcResult.returnDeduction,
        settlementAmount: calcResult.settlementAmount,
        itemCount: calcResult.itemCount,
        soldItemIds: calcResult.soldItemIds,
      })
      if (rpcResult.error !== null) throw new AppError('INTERNAL', rpcResult.error)
      settlements.push(rpcResult.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      console.error(`[settlement.service] generate 실패 (seller=${seller.id}):`, msg)
      failedSellers.push({ sellerId: seller.id, error: msg })
    }
  }

  return { period: { start: periodStart, end: periodEnd }, createdCount: settlements.length, settlements, failedSellers }
}

/** 정산 확정 (draft → confirmed) */
export async function confirm(id: string): Promise<Settlement> {
  const current = await getById(id)
  const allowed = SETTLEMENT_TRANSITIONS[current.status as SettlementStatus] ?? []
  if (!allowed.includes('confirmed')) {
    throw new AppError('CONFLICT', `확정 불가: 현재 상태 '${current.status}' (draft만 가능)`)
  }
  const result = await settlementStatusRepo.confirm(id)
  if (result.error !== null) throw new AppError('CONFLICT', result.error)
  return result.data
}

/** 정산 지급 (confirmed → paid) */
export async function pay(id: string, paidBy: string, transferRef?: string): Promise<Settlement> {
  const current = await getById(id)
  const allowed = SETTLEMENT_TRANSITIONS[current.status as SettlementStatus] ?? []
  if (!allowed.includes('paid')) {
    throw new AppError('CONFLICT', `지급 불가: 현재 상태 '${current.status}' (confirmed만 가능)`)
  }
  const result = await settlementStatusRepo.pay(id, paidBy, transferRef)
  if (result.error !== null) throw new AppError('CONFLICT', result.error)
  return result.data
}

/** 정산 목록 조회 (필터 + 페이지네이션) */
export async function list(
  filters: { status?: SettlementStatus; periodFrom?: string; periodTo?: string; sellerId?: string },
  pageOptions: PageOptions,
): Promise<{ items: SettlementWithSeller[]; total: number }> {
  const result = await settlementRepo.list(filters, pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

/** 정산 상세 조회 */
export async function getById(id: string): Promise<SettlementWithDetails> {
  const result = await settlementRepo.findById(id)
  if (result.error !== null) throw new AppError('NOT_FOUND', `정산 ID ${id} 조회 실패: ${result.error}`)
  return result.data
}
