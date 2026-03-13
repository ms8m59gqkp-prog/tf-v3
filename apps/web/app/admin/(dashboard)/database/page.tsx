/**
 * 시세 DB 페이지
 * WHY: 시세 데이터 CRUD 진입점
 * HOW: MarketPriceClient RSC 래퍼
 * WHERE: /admin/database
 */
import MarketPriceClient from './MarketPriceClient'

export const metadata = { title: 'TF Admin — 시세 DB' }

export default function DatabasePage() {
  return <MarketPriceClient />
}
