/**
 * ERP 연동 페이지
 * WHY: 네이버 정산 업로드 진입점
 * HOW: ErpClient RSC 래퍼
 * WHERE: /admin/sales/erp
 */
import ErpClient from './ErpClient'

export const metadata = { title: 'TF Admin — ERP 연동' }

export default function ErpPage() {
  return <ErpClient />
}
