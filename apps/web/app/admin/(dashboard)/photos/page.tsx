/**
 * 사진 관리 페이지
 * WHY: 사진 업로드/분류/편집/매칭 통합 관리
 * HOW: Server Component -> PhotoClient
 * WHERE: /admin/photos
 */
import PhotoClient from './PhotoClient'

export const metadata = { title: 'TF Admin — 사진 관리' }

export default function PhotosPage() {
  return <PhotoClient />
}
