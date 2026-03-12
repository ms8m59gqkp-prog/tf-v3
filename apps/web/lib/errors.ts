/**
 * 도메인 에러 코드 + AppError (L1 Business Layer)
 * WHY: §2.2 의존 방향 준수 — L1 서비스에서 L3 api/ import 금지
 * HOW: ErrorCode type + AppError class (HTTP 무관)
 * WHERE: 서비스/리포지토리에서 throw, route의 errFrom()에서 catch
 */

export type ErrorCode =
  | 'VALIDATION' | 'AUTH' | 'FORBIDDEN'
  | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE'
  | 'RATE_LIMIT' | 'SERVICE_UNAVAILABLE' | 'INTERNAL'

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
