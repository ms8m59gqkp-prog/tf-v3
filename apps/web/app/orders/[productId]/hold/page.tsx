/**
 * Public: 주문보류 동의 페이지
 * WHY: 고객이 토큰으로 접근하여 아이템별 동의/거부
 * HOW: Server Component → HoldClient
 * WHERE: /orders/[productId]/hold
 */
import HoldClient from './HoldClient'

export const metadata = { title: 'TF — 주문 보류 확인' }

export default function HoldPage() {
  return <HoldClient />
}
