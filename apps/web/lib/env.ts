/**
 * 환경변수 검증 및 중앙 관리
 * WHY: V2에서 ENV 미설정 시 인증 우회 등 10건 발생 — 런타임 검증 필수
 * HOW: requireEnv()로 런타임 검증, 서버 전용 변수는 호출 시점에만 평가
 * WHERE: 모든 lib/ 파일에서 import { requireEnv, PUBLIC_ENV } from '@/lib/env'
 */

// ---------------------------------------------------------------------------
// Runtime validator — 호출 시점에만 평가 (module top-level 호출 금지)
// ---------------------------------------------------------------------------

export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${key}`)
  }
  return value
}

// ---------------------------------------------------------------------------
// Server-only env key catalog
// requireEnv(SERVER_ENV_KEYS.XXX) 형태로 호출 시점에 검증
// 절대 module top-level에서 평가하지 않는다 (Next.js build 실패 방지)
// ---------------------------------------------------------------------------

export const SERVER_ENV_KEYS = {
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  ADMIN_ID: 'ADMIN_ID',
  ADMIN_PASSWORD: 'ADMIN_PASSWORD',
  SESSION_SECRET: 'SESSION_SECRET',
  UPSTASH_REDIS_REST_URL: 'UPSTASH_REDIS_REST_URL',
  UPSTASH_REDIS_REST_TOKEN: 'UPSTASH_REDIS_REST_TOKEN',
  WAREHOUSE_NAME: 'WAREHOUSE_NAME',
  WAREHOUSE_PHONE: 'WAREHOUSE_PHONE',
  WAREHOUSE_ZIPCODE: 'WAREHOUSE_ZIPCODE',
  WAREHOUSE_ADDRESS: 'WAREHOUSE_ADDRESS',
  SENTRY_DSN: 'SENTRY_DSN',
  NAVER_CLIENT_ID: 'NAVER_CLIENT_ID',
  NAVER_CLIENT_SECRET: 'NAVER_CLIENT_SECRET',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  PHOTOROOM_API_KEY: 'PHOTOROOM_API_KEY',
} as const

// ---------------------------------------------------------------------------
// Public env — NEXT_PUBLIC_* 는 빌드 타임에 인라인되므로 즉시 읽기 가능
// ---------------------------------------------------------------------------

export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
} as const
