/**
 * 공용 Zod 검증 스키마
 * WHY: 여러 도메인에서 공통 사용하는 검증 규칙 중앙화
 * HOW: Zod 스키마 5개 정의 (phone, sellerCode, productNumber, orderId, price)
 * WHERE: API 라우트, 폼 검증에서 import
 */
import { z } from 'zod'

export const phoneSchema = z
  .string()
  .regex(/^01[016789]\d{7,8}$/, '올바른 전화번호 형식이 아닙니다 (예: 01012345678)')

export const sellerCodeSchema = z
  .string()
  .regex(/^\d{5}$/, '셀러코드는 5자리 숫자여야 합니다')

export const productNumberSchema = z
  .string()
  .regex(/^\d{13}$/, '상품번호는 13자리 숫자여야 합니다')

export const orderIdSchema = z
  .string()
  .regex(/^\d{8}-\d{6}$/, '주문번호 형식이 올바르지 않습니다 (예: 20260304-000042)')

export const priceSchema = z
  .number()
  .int('가격은 정수여야 합니다')
  .nonnegative('가격은 0 이상이어야 합니다')
