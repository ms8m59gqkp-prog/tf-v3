/**
 * 매출-정산 매칭 서비스 (L1 Business Layer)
 * WHY: V2 3단계 자동매칭 + 수동매칭 + 정산 큐 비즈니스 로직 캡슐화
 * HOW: 상품주문번호 → 구매자+금액 → 상품명 자카드 유사도 순서로 매칭
 * WHERE: 매칭 관련 API route에서 호출
 */
import { AppError } from '../errors'
import * as srqRepo from '../db/repositories/sales-records-query.repo'
import * as nsqRepo from '../db/repositories/naver-settlements-query.repo'
import * as matchesRepo from '../db/repositories/settlement-matches.repo'
import * as queueRepo from '../db/repositories/settlement-queue.repo'
import * as queueSummaryRepo from '../db/repositories/settlement-queue-summary.repo'
import type { SalesRecord, NaverSettlement, SettlementMatch, SellerSettlementSummary, MatchStatus } from '../types/domain/settlement'
import { normalizeBrand } from '../utils/brand'

const MATCH_CHUNK_SIZE = 500
const THRESHOLD_AUTO = 0.85
const THRESHOLD_REVIEW = 0.70

// ─── 내부 helper ───
interface MatchDetail { salesRecordId: string; naverSettlementId: string; matchType: string; matchScore: number }
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .split(/[\s,./\-()]+/).filter(t => t.length > 0)
      .map(t => normalizeBrand(t).toLowerCase()),
  )
}

function jaccardSimilarity(a: string, b: string): number {
  const sA = tokenize(a), sB = tokenize(b)
  if (sA.size === 0 && sB.size === 0) return 1
  const inter = [...sA].filter(x => sB.has(x)).length
  const union = new Set([...sA, ...sB]).size
  return union === 0 ? 0 : inter / union
}

function matchPair(
  sales: SalesRecord[], navers: NaverSettlement[],
  usedS: Set<string>, usedN: Set<string>,
): MatchDetail[] {
  const out: MatchDetail[] = []
  const push = (sId: string, nId: string, type: string, score: number) => {
    out.push({ salesRecordId: sId, naverSettlementId: nId, matchType: type, matchScore: score })
    usedS.add(sId); usedN.add(nId)
  }
  // Step 1: 상품주문번호 완전일치 (16자리+)
  for (const s of sales) {
    if (usedS.has(s.id) || !s.productNumber || s.productNumber.length < 16) continue
    for (const n of navers) {
      if (!usedN.has(n.id) && n.productOrderNo === s.productNumber) { push(s.id, n.id, 'product_order_no', 1.0); break }
    }
  }
  // Step 2: 구매자명 + 금액 완전일치
  for (const s of sales) {
    if (usedS.has(s.id) || !s.buyerName || s.finalAmount == null) continue
    for (const n of navers) {
      if (usedN.has(n.id)) continue
      if (s.buyerName === n.buyerName && s.finalAmount === n.settleAmount) { push(s.id, n.id, 'buyer_amount', 0.9); break }
    }
  }
  // Step 3: 상품명 자카드 유사도
  for (const s of sales) {
    if (usedS.has(s.id) || !s.productName) continue
    let best = 0, bestN: NaverSettlement | null = null
    for (const n of navers) {
      if (usedN.has(n.id) || !n.productName) continue
      const sc = jaccardSimilarity(s.productName, n.productName)
      if (sc > best) { best = sc; bestN = n }
    }
    if (bestN && best >= THRESHOLD_REVIEW) push(s.id, bestN.id, 'product_name', best)
  }
  return out
}
/** 매칭 저장 + 양쪽 상태 갱신 (실패 시 보상 롤백) */
async function persistMatch(
  salesRecordId: string, naverSettlementId: string,
  matchType: string, matchScore: number, matchReason?: string,
): Promise<SettlementMatch> {
  const r = await matchesRepo.create({ salesRecordId, naverSettlementId, matchType, matchScore, matchReason })
  if (r.error !== null) throw new AppError('INTERNAL', `매칭 저장 실패: ${r.error}`)
  const status = matchType === 'manual' ? 'manual_matched' as const
    : (matchScore >= THRESHOLD_AUTO ? 'auto_matched' as const : 'manual_matched' as const)
  const srRes = await srqRepo.updateMatchStatus([salesRecordId], status, 'unmatched')
  if (srRes.error !== null) {
    await matchesRepo.deleteByIds([r.data.id])
    throw new AppError('INTERNAL', `매출장 상태 갱신 실패: ${srRes.error}`)
  }
  const nsRes = await nsqRepo.updateMatchStatus([naverSettlementId], status, 'unmatched')
  if (nsRes.error !== null) {
    await srqRepo.updateMatchStatus([salesRecordId], 'unmatched', status)
    await matchesRepo.deleteByIds([r.data.id])
    throw new AppError('INTERNAL', `네이버 정산 상태 갱신 실패: ${nsRes.error}`)
  }
  return r.data
}
// ─── export 함수 ───
export interface AutoMatchResult { matched: number; needsReview: number; unmatched: number; details: MatchDetail[] }
export async function autoMatch(): Promise<AutoMatchResult> {
  const [sRes, nRes] = await Promise.all([srqRepo.listUnmatched(), nsqRepo.listUnmatched()])
  if (sRes.error !== null) throw new AppError('INTERNAL', `매출장 조회 실패: ${sRes.error}`)
  if (nRes.error !== null) throw new AppError('INTERNAL', `네이버 정산 조회 실패: ${nRes.error}`)
  const details: MatchDetail[] = []
  const usedS = new Set<string>(), usedN = new Set<string>()
  for (let i = 0; i < sRes.data.length; i += MATCH_CHUNK_SIZE) {
    details.push(...matchPair(sRes.data.slice(i, i + MATCH_CHUNK_SIZE), nRes.data, usedS, usedN))
  }
  let matched = 0, needsReview = 0
  for (const d of details) {
    if (d.matchScore >= THRESHOLD_AUTO) { matched++ } else { needsReview++ }
    await persistMatch(d.salesRecordId, d.naverSettlementId, d.matchType, d.matchScore)
  }
  return { matched, needsReview, unmatched: sRes.data.length - matched - needsReview, details }
}
export async function manualMatch(
  salesRecordId: string, naverSettlementId: string, reason?: string,
): Promise<SettlementMatch> {
  return persistMatch(salesRecordId, naverSettlementId, 'manual', 1.0, reason)
}
export async function cancelMatch(matchId: string): Promise<void> {
  const fRes = await matchesRepo.findByMatchIds([matchId])
  if (fRes.error !== null) throw new AppError('NOT_FOUND', `매칭 조회 실패: ${fRes.error}`)
  const m = fRes.data[0]
  if (!m) throw new AppError('NOT_FOUND', `매칭 ID ${matchId} 없음`)
  const delRes = await matchesRepo.deleteByIds([matchId])
  if (delRes.error !== null) throw new AppError('INTERNAL', `매칭 삭제 실패: ${delRes.error}`)
  // soft-fail: 삭제 후 원본 상태 복원 실패는 로그만 (매칭 당시 설정된 상태를 expectedCurrent로 사용)
  const prevStatus: MatchStatus = m.matchType === 'manual' ? 'manual_matched'
    : ((m.matchScore ?? 0) >= THRESHOLD_AUTO ? 'auto_matched' : 'manual_matched')
  if (m.salesRecordId) await srqRepo.updateMatchStatus([m.salesRecordId], 'unmatched', prevStatus)
  if (m.naverSettlementId) await nsqRepo.updateMatchStatus([m.naverSettlementId], 'unmatched', prevStatus)
}
export interface QueueResult { queued: number; skipped: number }
export async function queueSettlements(): Promise<QueueResult> {
  const qRes = await queueRepo.listByStatus('pending')
  if (qRes.error !== null) throw new AppError('INTERNAL', `큐 조회 실패: ${qRes.error}`)
  const existing = new Set(qRes.data.map(q => q.matchId).filter(Boolean))
  // TODO: Phase 5에서 매칭 전체 조회 repo 확장 후 큐 등록 로직 구현
  return { queued: 0, skipped: existing.size }
}
export async function getQueueSummary(): Promise<SellerSettlementSummary[]> {
  const r = await queueSummaryRepo.getSellerSummary()
  if (r.error !== null) throw new AppError('INTERNAL', `큐 집계 조회 실패: ${r.error}`)
  return r.data
}
export async function clearQueue(): Promise<void> {
  const r = await queueRepo.deleteByStatus('pending')
  if (r.error !== null) throw new AppError('INTERNAL', `큐 삭제 실패: ${r.error}`)
}
