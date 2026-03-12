/**
 * API 에러 — HTTP 상태 매핑 + re-export
 * WHY: L3 route에서 HTTP 응답 생성 시 ErrorCode→status 변환 필요
 * HOW: lib/errors.ts의 AppError/ErrorCode를 re-export + HTTP_STATUS 매핑 추가
 * WHERE: response.ts errFrom(), 모든 route handler
 */

export { AppError, type ErrorCode } from '../errors'

export const HTTP_STATUS: Record<
  import('../errors').ErrorCode,
  number
> = {
  VALIDATION: 400,
  AUTH: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMIT: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500,
}
