/**
 * 셀러명 기반 매칭
 * WHY: V2 seller-matcher.ts 재현 — 매출장의 위탁판매자명과 셀러 DB 매칭
 * HOW: 순수 문자열 비교 (정규화 후 exact match), DB/HTTP 미사용
 * WHERE: settlement.service.ts, matching.service.ts에서 import
 */
import type { Seller } from '../types/domain/seller'

export interface ParsedSellerName {
  original: string
  normalized: string
}

/** 이름 정규화: 공백/특수문자 제거 + 소문자 */
export function parseSellerName(raw: string): ParsedSellerName {
  const normalized = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
  return { original: raw.trim(), normalized }
}

/** 셀러 목록에서 이름으로 매칭 (정규화 exact match) */
export function matchSellerByName(rawName: string, sellers: Seller[]): Seller | null {
  if (!rawName.trim()) return null
  const parsed = parseSellerName(rawName)
  if (!parsed.normalized) return null

  for (const seller of sellers) {
    const sellerParsed = parseSellerName(seller.name)
    if (sellerParsed.normalized === parsed.normalized) return seller
    if (seller.nickname) {
      const nickParsed = parseSellerName(seller.nickname)
      if (nickParsed.normalized === parsed.normalized) return seller
    }
  }
  return null
}
