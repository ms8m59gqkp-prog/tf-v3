/**
 * 인프라 헬스체크 서비스 (L1 Business Layer)
 * WHY: L3 route에서 직접 DB/Storage 호출 방지 (architecture-spec §3.4)
 * HOW: DB·Storage·SMS 각각 개별 타임아웃 + Promise.allSettled 병렬 실행
 * WHERE: GET /api/health 라우트
 */
import * as infraRepo from '../db/repositories/infra.repo'
import { ALIGO_API_KEY } from '../env'

const CHECK_TIMEOUT_MS = 3_000

interface CheckResult {
  ok: boolean
  latencyMs: number
  /** 내부 전용 — 외부 응답에서는 sanitize 후 제거 */
  error?: string
}

/** 내부 에러 메시지에서 민감 정보(연결 문자열, 키, 스택) 제거 */
function sanitizeError(msg: string | undefined): string | undefined {
  if (!msg) return undefined
  // 연결 문자열, API 키, 스택 트레이스 제거
  if (/postgres|supabase|eyJ|at\s+\w+\s+\(/.test(msg)) return 'service unavailable'
  return msg
}

export interface HealthResult {
  status: 'healthy' | 'degraded'
  checks: {
    db: CheckResult
    storage: CheckResult
    sms: CheckResult
  }
  timestamp: string
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}

async function checkDb(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const result = await Promise.race([infraRepo.ping(), timeoutPromise(CHECK_TIMEOUT_MS)])
    if (!result.ok) return { ok: false, latencyMs: Date.now() - start, error: result.error }
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const result = await Promise.race([infraRepo.pingStorage(), timeoutPromise(CHECK_TIMEOUT_MS)])
    if (!result.ok) return { ok: false, latencyMs: Date.now() - start, error: result.error }
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function checkSms(): Promise<CheckResult> {
  if (!ALIGO_API_KEY) {
    return { ok: false, latencyMs: 0, error: 'ALIGO_API_KEY 미설정' }
  }
  return { ok: true, latencyMs: 0 }
}

export async function runHealthCheck(internal = false): Promise<HealthResult> {
  const [db, storage, sms] = await Promise.allSettled([
    checkDb(), checkStorage(), checkSms(),
  ])

  const checks = {
    db: db.status === 'fulfilled' ? db.value : { ok: false, latencyMs: 0, error: db.reason?.message },
    storage: storage.status === 'fulfilled' ? storage.value : { ok: false, latencyMs: 0, error: storage.reason?.message },
    sms: sms.status === 'fulfilled' ? sms.value : { ok: false, latencyMs: 0, error: sms.reason?.message },
  }

  // §3.3: 외부 응답 시 에러 메시지 sanitize
  if (!internal) {
    checks.db.error = sanitizeError(checks.db.error)
    checks.storage.error = sanitizeError(checks.storage.error)
    checks.sms.error = sanitizeError(checks.sms.error)
  }

  const allOk = checks.db.ok && checks.storage.ok
  return {
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }
}
