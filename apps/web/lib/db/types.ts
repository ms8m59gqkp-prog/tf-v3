/**
 * 리포지토리 공용 타입
 * WHY: 모든 리포지토리가 일관된 반환 타입을 사용하고, 벌크 처리 실패를 구조화
 * HOW: 유니온 타입(성공/실패)으로 타입 안전 분기, FailedRow로 인라인 수정 지원
 * WHERE: apps/web/lib/db/repositories/*.repo.ts, transactions/*.tx.ts
 */

/** 단일 결과 — 성공 시 data, 실패 시 error */
export type DbResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

/** 목록 결과 — 페이지네이션 포함 */
export type DbListResult<T> =
  | { data: T[]; total: number; error: null }
  | { data: []; total: 0; error: string }

/** 벌크 INSERT 결과 — 부분실패 지원 (성공 행 즉시 저장, 실패 행 구조화 반환) */
export interface BulkResult<T> {
  succeeded: T[]
  failed: FailedRow[]
  total: number
}

/** 실패 행 구조 — 프론트엔드 인라인 수정용 (행번호 + 원본 + 에러 목록) */
export interface FailedRow {
  rowIndex: number
  data: Record<string, unknown>
  errors: FieldError[]
}

/** 필드별 에러 — 5가지 타입으로 원인 분류 */
export interface FieldError {
  field: string
  type: 'missing' | 'format' | 'duplicate' | 'fk_not_found' | 'constraint'
  message: string
  expected?: string
}

/** 페이지네이션 옵션 — 모든 list() 메서드 공용 */
export interface PageOptions {
  page: number
  pageSize: number
  sortBy?: string
  ascending?: boolean
}
