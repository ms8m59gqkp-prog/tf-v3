/**
 * 매출 장부 페이지
 * WHY: 매출 장부 조회 진입점
 * HOW: LedgerClient RSC 래퍼
 * WHERE: /admin/sales/ledger
 */
import LedgerClient from './LedgerClient'

export const metadata = { title: 'TF Admin — 매출 장부' }

export default function LedgerPage() {
  return <LedgerClient />
}
