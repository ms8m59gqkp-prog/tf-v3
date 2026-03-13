/**
 * 상품 관리 페이지
 * WHY: 상품 등록/수정/조회/네이버 내보내기 관리
 * HOW: Server Component -> ProductClient
 * WHERE: /admin/products
 */
import ProductClient from './ProductClient'

export const metadata = { title: 'TF Admin — 상품 관리' }

export default function ProductsPage() {
  return <ProductClient />
}
