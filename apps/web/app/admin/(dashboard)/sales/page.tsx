/**
 * 매출 관리 페이지
 * WHY: 매출 업로드 + 위탁 감지 진입점
 * HOW: SalesClient RSC 래퍼
 * WHERE: /admin/sales
 */
import SalesClient from './SalesClient'

export const metadata = { title: 'TF Admin — 매출 관리' }

export default function SalesPage() {
  return <SalesClient />
}
