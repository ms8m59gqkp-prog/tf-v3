/**
 * 대시보드 페이지
 * WHY: 어드민 메인 진입점 — 핵심 지표 한눈에
 * HOW: Server Component → DashboardClient
 * WHERE: /admin/dashboard
 */
import DashboardClient from './DashboardClient'

export const metadata = { title: 'TF Admin — 대시보드' }

export default function DashboardPage() {
  return <DashboardClient />
}
