/**
 * 정산 목록 페이지
 * WHY: 정산 현황 + 워크플로우 진입점
 * HOW: Server Component → SettlementClient
 * WHERE: /admin/settlement
 */
import SettlementClient from './SettlementClient'

export const metadata = { title: 'TF Admin — 정산' }

export default function SettlementPage() {
  return <SettlementClient />
}
