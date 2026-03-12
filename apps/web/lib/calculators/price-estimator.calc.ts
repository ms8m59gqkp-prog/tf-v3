/**
 * 네이버 검색 기반 정가 추정 계산기 (L1 Business Layer)
 * WHY: V2 triggerPriceEstimate 재현 — 조건별 감가율 적용
 * HOW: brand+model 검증 → condition 감가율 적용 → 추정 결과 반환
 * WHERE: 상품 등록/수정 시 호출, Phase 5+에서 네이버 API 연동
 */

import { AppError } from '../errors'

interface EstimateParams {
  brand: string
  model: string
  category: string
  condition: string
}

type RetailPriceSource = 'naver_estimate' | 'manual' | 'desired_price'

interface EstimateResult {
  estimatedPrice: number
  source: RetailPriceSource
  confidence: number
}

const CONDITION_MULTIPLIERS: Record<string, number> = {
  N: 0.85,
  S: 0.70,
  A: 0.55,
  B: 0.40,
}

/** 조건 등급별 감가 배율 (V2 동일) */
export function getConditionMultiplier(condition: string): number {
  return CONDITION_MULTIPLIERS[condition] ?? 0.50
}

/**
 * 정가 추정 — price-estimate.service.ts로 위임
 * Phase 5-C: 실제 네이버 검색 API 연동 완료
 */
export async function estimateRetailPrice(
  params: EstimateParams,
): Promise<EstimateResult> {
  const { brand, model, category, condition } = params

  if (!brand.trim()) {
    throw new AppError('VALIDATION', '브랜드가 비어있습니다')
  }
  if (!model.trim()) {
    throw new AppError('VALIDATION', '모델명이 비어있습니다')
  }

  // price-estimate.service.ts에서 전체 플로우 담당
  // calc는 순수 계산만 담당: 감가율 적용
  const { estimate } = await import('../services/price-estimate.service')
  return estimate({ brand, model, category, condition })
}
