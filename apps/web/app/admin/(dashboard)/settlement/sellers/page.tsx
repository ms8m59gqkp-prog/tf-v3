/**
 * 셀러별 정산 페이지
 * WHY: 셀러 단위로 정산 이력 조회
 * HOW: Server Component → SellerSettlementClient
 * WHERE: /admin/settlement/sellers
 */
import SellerSettlementClient from './SellerSettlementClient'

export const metadata = { title: 'TF Admin — 셀러별 정산' }

export default function SellersPage() {
  return <SellerSettlementClient />
}
