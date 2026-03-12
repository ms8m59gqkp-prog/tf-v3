/**
 * GET /api/health — 인프라 헬스체크
 * WHY: 외부 모니터링 (Liveness probe)
 * HOW: HEALTHCHECK_TOKEN 없으면 status만, 있으면 상세 checks 포함
 * WHERE: 모니터링 시스템, Kubernetes probe
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { HEALTHCHECK_TOKEN } from '@/lib/env'
import { runHealthCheck } from '@/lib/services/infra-check.service'

export async function GET(req: NextRequest) {
  const result = await runHealthCheck()
  const status = result.status === 'healthy' ? 200 : 503

  const token = req.headers.get('x-healthcheck-token')
  if (HEALTHCHECK_TOKEN && token === HEALTHCHECK_TOKEN) {
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(
    { status: result.status, timestamp: result.timestamp },
    { status },
  )
}
