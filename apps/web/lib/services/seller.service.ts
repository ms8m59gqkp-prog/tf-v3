/**
 * 셀러 서비스 (L1 Business Layer)
 * WHY: 셀러 목록/상세/수정 비즈니스 로직 캡슐화 — repo 직접 노출 방지
 * HOW: 기존 sellers.repo + sellers-query.repo 래핑 + camelCase ↔ snake_case 변환
 * WHERE: 셀러 관리 API route에서 호출
 */
import { AppError } from '../errors'
import * as sellersRepo from '../db/repositories/sellers.repo'
import * as sellersQueryRepo from '../db/repositories/sellers-query.repo'
import * as sellerHistoryRepo from '../db/repositories/seller-history.repo'
import type { Seller } from '../types/domain/seller'
import type { PageOptions } from '../db/types'

export async function list(
  filters: { status?: string; search?: string },
  pageOptions: PageOptions,
): Promise<{ items: Seller[]; total: number }> {
  // search가 있으면 이름+전화로 검색, 없으면 페이지네이션 목록
  if (filters.search) {
    const result = await sellersQueryRepo.findByNameAndPhone(
      filters.search, filters.search,
    )
    if (result.error !== null) throw new AppError('INTERNAL', result.error)
    // findByNameAndPhone은 단건이므로 배열로 래핑
    return { items: result.data ? [result.data] : [], total: result.data ? 1 : 0 }
  }

  const result = await sellersQueryRepo.listByPage(pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

export async function getById(id: string): Promise<Seller> {
  const result = await sellersRepo.findById(id)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', `셀러를 찾을 수 없습니다: ${id}`)
  }
  return result.data
}

const UPDATABLE_FIELDS = new Set([
  'name', 'phone', 'email', 'sellerTier', 'status', 'commissionRate',
  'channelType', 'bankName', 'bankAccount', 'bankHolder',
  'address', 'nickname', 'marketingConsent',
  'contractStart', 'contractEnd', 'taggingCode',
])

const CAMEL_TO_SNAKE: Record<string, string> = {
  sellerTier: 'seller_tier',
  commissionRate: 'commission_rate',
  channelType: 'channel_type',
  bankName: 'bank_name',
  bankAccount: 'bank_account',
  bankHolder: 'bank_holder',
  marketingConsent: 'marketing_consent',
  contractStart: 'contract_start',
  contractEnd: 'contract_end',
  taggingCode: 'tagging_code',
}

export async function update(
  id: string,
  fields: Partial<Record<string, unknown>>,
): Promise<Seller> {
  const snakeFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (!UPDATABLE_FIELDS.has(k) || v === undefined) continue
    const snakeKey = CAMEL_TO_SNAKE[k] ?? k
    snakeFields[snakeKey] = v
  }

  if (Object.keys(snakeFields).length === 0) {
    throw new AppError('VALIDATION', '수정할 필드가 없습니다')
  }

  // marketingConsent 변경 시 타임스탬프 자동 갱신
  if ('marketing_consent' in snakeFields) {
    snakeFields.marketing_consent_at = new Date().toISOString()
  }

  const result = await sellersRepo.update(id, snakeFields)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', `셀러 수정 실패: ${result.error}`)
  }
  return result.data
}

export async function getHistory(
  sellerId: string,
): Promise<{ consignmentCount: number; orderCount: number; settlementCount: number }> {
  // 셀러 존재 확인
  const seller = await sellersRepo.findById(sellerId)
  if (seller.error !== null) {
    throw new AppError('NOT_FOUND', `셀러를 찾을 수 없습니다: ${sellerId}`)
  }

  const counts = await sellerHistoryRepo.countBySellerId(sellerId)
  if (counts.error !== null) {
    throw new AppError('INTERNAL', `활동 이력 조회 실패: ${counts.error}`)
  }
  return counts.data
}
