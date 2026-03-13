/**
 * 주문 관리 페이지
 * WHY: 주문 접수/검수/보류 관리
 * HOW: Server Component → OrderClient
 * WHERE: /admin/orders
 */
import OrderClient from './OrderClient'

export const metadata = { title: 'TF Admin — 주문 관리' }

export default function OrdersPage() {
  return <OrderClient />
}
