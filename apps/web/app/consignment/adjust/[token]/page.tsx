/**
 * Public: 위탁 가격조정 페이지
 * WHY: 셀러가 토큰으로 접근하여 가격 응답
 * HOW: Server Component → AdjustClient
 * WHERE: /consignment/adjust/[token]
 */
import AdjustClient from './AdjustClient'

export const metadata = { title: 'TF — 가격 조정' }

export default function AdjustPage() {
  return <AdjustClient />
}
