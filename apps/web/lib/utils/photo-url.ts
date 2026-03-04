/**
 * 사진 URL 헬퍼 (Phase 7 Storage 전환 대비)
 * WHY: 프론트엔드 사진 경로 하드코딩 금지, Phase 7은 환경변수만 변경
 * HOW: NEXT_PUBLIC_ 환경변수 + 순수 문자열 조합
 * WHERE: 프론트엔드 컴포넌트, 사진 서비스
 */

const PHOTO_BASE = process.env.NEXT_PUBLIC_PHOTO_BASE_URL ?? ''
const PHOTO_MODE = process.env.NEXT_PUBLIC_PHOTO_STORAGE_MODE ?? 'legacy'

/**
 * 상품 사진 URL을 생성한다.
 * PHOTO_MODE에 따라 Supabase Storage 또는 레거시 경로 반환.
 */
export function getPhotoUrl(productId: string, fileName: string): string {
  if (PHOTO_MODE === 'supabase') {
    return `${PHOTO_BASE}/photos/${productId}/${fileName}`
  }
  return `/uploads/photos/${productId}/${fileName}`
}
