/**
 * 환경변수 검증 및 타입 안전 접근
 * WHY: 런타임 오류 방지 (미설정 환경변수 조기 감지)
 * HOW: 필수(getEnvVar) → throw, 선택(getOptionalEnvVar) → undefined
 * WHERE: 모든 서버 사이드 코드에서 import
 */

function getEnvVar(key: string): string {
  const value = process.env[key]?.trim()
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다`)
  }
  return value
}

function getOptionalEnvVar(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

// Supabase
export const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

// Auth
export const ADMIN_PASSWORD_HASH = getEnvVar('ADMIN_PASSWORD_HASH')

// SMS (Aligo) — 선택: 미설정 시 SMS 기능 비활성
export const ALIGO_API_KEY = getOptionalEnvVar('ALIGO_API_KEY')
export const ALIGO_USER_ID = getOptionalEnvVar('ALIGO_USER_ID')
export const ALIGO_SENDER = getOptionalEnvVar('ALIGO_SENDER')

// AI — 선택: 미설정 시 AI 기능 비활성
export const ANTHROPIC_API_KEY = getOptionalEnvVar('ANTHROPIC_API_KEY')

// PhotoRoom — 선택: 미설정 시 배경 제거 비활성
export const PHOTOROOM_API_KEY = getOptionalEnvVar('PHOTOROOM_API_KEY')

// 네이버 쇼핑 API — 선택: 미설정 시 가격 추정 비활성
export const NAVER_CLIENT_ID = getOptionalEnvVar('NAVER_CLIENT_ID')
export const NAVER_CLIENT_SECRET = getOptionalEnvVar('NAVER_CLIENT_SECRET')

// 헬스체크 토큰 — 선택: 미설정 시 상세 체크 비활성
export const HEALTHCHECK_TOKEN = getOptionalEnvVar('HEALTHCHECK_TOKEN')

