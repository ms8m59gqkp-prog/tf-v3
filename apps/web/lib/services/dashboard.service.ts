/**
 * 대시보드 요약 집계 서비스 (L1 Business Layer)
 * WHY: 관리자 대시보드에 위탁/주문/정산/최근활동 통계 제공
 * HOW: dashboard.repo로 각 테이블 count 병렬 실행 (allSettled로 부분 실패 허용)
 * WHERE: GET /api/admin/dashboard
 */
import * as dashboardRepo from '../db/repositories/dashboard.repo'

export interface DashboardSummary {
  consignments: { total: number; pending: number; inspecting: number }
  orders: { total: number; active: number }
  settlements: { total: number; draft: number; confirmed: number }
  recentActivity: { todayConsignments: number; todaySales: number }
  partial: boolean
}

/** 대시보드 요약 데이터 조회 (부분 실패 허용) */
export async function getSummary(): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10)
  const c = await dashboardRepo.getAllCounts(today)

  const hasError = Object.values(c).some(r => r.error !== null)
  if (hasError) {
    const failed = Object.entries(c)
      .filter(([, r]) => r.error)
      .map(([k, r]) => `${k}: ${r.error}`)
    console.error('[dashboard] 부분 실패:', failed.join(', '))
  }

  return {
    consignments: {
      total: c.consTotal.count,
      pending: c.consPending.count,
      inspecting: c.consInspecting.count,
    },
    orders: {
      total: c.ordTotal.count,
      active: c.ordActive.count,
    },
    settlements: {
      total: c.setTotal.count,
      draft: c.setDraft.count,
      confirmed: c.setConfirmed.count,
    },
    recentActivity: {
      todayConsignments: c.todayCons.count,
      todaySales: c.todaySales.count,
    },
    partial: hasError,
  }
}
