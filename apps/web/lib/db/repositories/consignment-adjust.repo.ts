/**
 * 위탁 가격 조정 토큰 기반 조회/응답 리포지토리
 * WHY: 셀러 공개 페이지에서 adjustment_token으로 위탁 조회 + 응답 저장
 * HOW: adjustment_token 기반 SELECT + seller_response/counter_price UPDATE
 * WHERE: consignment-adjust.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { ConsignmentRequest } from '../../types/domain/consignment'
import type { DbResult } from '../types'
import { COLUMNS, mapRow } from './consignments.repo'

/** adjustment_token으로 위탁 요청 조회 (만료 체크 포함) */
export async function findByToken(
  token: string,
): Promise<DbResult<ConsignmentRequest>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('consignment_requests')
    .select(COLUMNS)
    .eq('adjustment_token', token)
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'NOT_FOUND: 유효하지 않은 토큰입니다' }
  /* expires_at NULL = 만료 미설정(영구 유효). .or() 금지(§5.2)로 JS 체크 */
  const expiresAt = data.adjustment_token_expires_at as string | null
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return { data: null, error: 'NOT_FOUND: 유효하지 않은 토큰입니다' }
  }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

/** 셀러 응답 + 희망가 업데이트 */
export async function updateResponse(
  id: string,
  response: string,
  counterPrice: number | null,
): Promise<DbResult<ConsignmentRequest>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('consignment_requests')
    .update({
      seller_response: response,
      seller_counter_price: counterPrice,
    })
    .eq('id', id)
    .is('seller_response', null)
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}
