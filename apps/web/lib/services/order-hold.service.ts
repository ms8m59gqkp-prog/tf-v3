/**
 * 주문 보류 공개 서비스 (L1 Business Layer)
 * WHY: 고객이 토큰 기반으로 보류 상품 조회/동의 — 인증 없이 토큰으로만 접근
 * HOW: hold_token(orders) 검증 → 보류 아이템 확인 → repo 위임
 * WHERE: /api/orders/[productId]/hold 라우트에서 호출
 */
import { AppError } from '../errors'
import * as holdRepo from '../db/repositories/order-hold.repo'
import type { OrderItem } from '../types/domain/order'

/** 고객에게 노출할 안전한 아이템 필드 */
export interface HoldItemView {
  id: string
  productNumber: string
  brand: string
  model: string
  holdAdjustedPrice: number | null
  holdReason: string | null
  holdPhotoUrl: string | null
  holdDate: string | null
  customerAgreed: boolean
  customerAgreedAt: string | null
}

/** 고객에게 노출할 보류 주문 뷰 */
export interface HoldOrderPublicView {
  orderNumber: string
  customerName: string
  items: HoldItemView[]
}

function toItemView(item: OrderItem): HoldItemView {
  return {
    id: item.id,
    productNumber: item.productNumber,
    brand: item.brand,
    model: item.model,
    holdAdjustedPrice: item.holdAdjustedPrice ?? null,
    holdReason: item.holdReason ?? null,
    holdPhotoUrl: item.holdPhotoUrl ?? null,
    holdDate: item.holdDate ?? null,
    customerAgreed: item.customerAgreed,
    customerAgreedAt: item.customerAgreedAt ?? null,
  }
}

/** 토큰으로 보류 주문 + 아이템 조회 → 공개 필드만 반환 */
export async function getByToken(token: string): Promise<HoldOrderPublicView> {
  const result = await holdRepo.findByHoldToken(token)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', '유효하지 않은 토큰입니다')
  }

  const { order, items } = result.data
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    items: items.map(toItemView),
  }
}

/** 고객 동의/거절 응답 저장 (개별 아이템 단위) */
export async function respondToHold(
  token: string,
  itemId: string,
  agreed: boolean,
): Promise<HoldItemView> {
  const result = await holdRepo.findByHoldToken(token)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', '유효하지 않은 토큰입니다')
  }

  const item = result.data.items.find((i) => i.id === itemId)
  if (!item) {
    throw new AppError('NOT_FOUND', '해당 아이템을 찾을 수 없습니다')
  }
  if (item.customerAgreedAt !== null && item.customerAgreedAt !== undefined) {
    throw new AppError('CONFLICT', '이미 응답이 완료되었습니다')
  }

  const updated = await holdRepo.updateCustomerResponse(itemId, agreed)
  if (updated.error !== null) throw new AppError('INTERNAL', updated.error)
  return toItemView(updated.data)
}
