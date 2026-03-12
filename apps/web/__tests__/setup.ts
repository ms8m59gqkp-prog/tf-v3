/**
 * vitest 전역 setup — .env.local 로딩 + 테스트용 환경변수 설정
 * WHY: repo 함수가 env.ts를 import하므로 모듈 로딩 전 환경변수 필수
 * HOW: .env.local 파싱 → process.env 주입 → Tokyo DB URL 오버라이드
 * WHERE: vitest.config.ts setupFiles
 */
import fs from 'fs'
import path from 'path'

// .env.local은 monorepo 루트에 위치
const envPath = path.resolve(__dirname, '..', '..', '..', '.env.local')

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    // 미설정이거나 빈 문자열이면 덮어쓰기
    if (!process.env[key] || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

// Tokyo DB로 오버라이드 (repos가 NEXT_PUBLIC_SUPABASE_URL 사용)
if (process.env.TOKYO_SERVICE_ROLE_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jmgscpmkrvvxxuzejrdf.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TOKYO_SERVICE_ROLE_KEY
}

// ADMIN_PASSWORD_HASH — env.ts가 요구하지만 repo 테스트에는 불필요
if (!process.env.ADMIN_PASSWORD_HASH) {
  process.env.ADMIN_PASSWORD_HASH = '$2b$12$testhashdummyvalue00000000000000000000000000'
}
