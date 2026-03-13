/**
 * 위탁 관리 페이지
 * WHY: 위탁 접수/검수/승인 관리
 * HOW: Server Component → ConsignmentClient
 * WHERE: /admin/consignments
 */
import ConsignmentClient from './ConsignmentClient'

export const metadata = { title: 'TF Admin — 위탁 관리' }

export default function ConsignmentsPage() {
  return <ConsignmentClient />
}
