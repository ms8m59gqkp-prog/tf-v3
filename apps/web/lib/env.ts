/**
 * 환경변수 검증 및 타입 안전 접근
 * WHY: 런타임 오류 방지 (미설정 환경변수 조기 감지)
 * HOW: 서버 시작 시 필수 환경변수 존재 확인
 * WHERE: 모든 서버 사이드 코드에서 import
 */

function getEnvVar(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다`)
  }
  return value
}

// Supabase
export const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

// Auth
export const ADMIN_PASSWORD_HASH = getEnvVar('ADMIN_PASSWORD_HASH')
