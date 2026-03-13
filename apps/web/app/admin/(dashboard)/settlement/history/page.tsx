/**
 * 정산 이력 페이지
 * WHY: 확정/지급/실패된 정산 이력 조회 진입점
 * HOW: Server Component → HistoryClient
 * WHERE: /admin/settlement/history
 */
import HistoryClient from './HistoryClient'

export const metadata = { title: 'TF Admin — 정산 이력' }

export default function HistoryPage() {
  return <HistoryClient />
}
