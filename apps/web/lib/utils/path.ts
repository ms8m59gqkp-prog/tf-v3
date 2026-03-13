/**
 * 파일 경로 유틸리티
 * WHY: V2 photo_uploads 패턴 기반 파일 경로 생성 + Storage URL 해석
 * HOW: Supabase Storage 경로 규칙에 따른 경로 생성, 환경변수 분기
 * WHERE: 사진 업로드/다운로드/표시에서 사용
 */
import { PHOTO_STORAGE_MODE, PHOTO_BASE_URL } from '../env'

export function getProductPhotoPath(productNumber: string, fileName: string): string {
  return `products/${productNumber}/${fileName}`
}

export function getConsignmentImagePath(consignmentId: string, fileName: string): string {
  return `consignments/${consignmentId}/${fileName}`
}

export function getInspectionImagePath(orderItemId: string, fileName: string): string {
  return `inspections/${orderItemId}/${fileName}`
}

/** 편집된 사진 Storage 경로 (SSOT) */
export function getEditedPhotoPath(photoId: string): string {
  return `edited/${photoId}.png`
}

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : ''
}

export function isImageFile(fileName: string): boolean {
  const ext = getFileExtension(fileName)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
}

/**
 * Storage 상대경로 → 전체 URL 해석 (D-02 결정: path.ts SSOT)
 * WHY: DB에는 상대경로만 저장, 런타임에 환경변수 기반으로 full URL 생성
 * HOW: NEXT_PUBLIC_PHOTO_STORAGE_MODE에 따라 Supabase URL / 로컬 경로 분기
 */
export function resolveStorageUrl(storagePath: string): string {
  if (!storagePath) return ''
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/')
  if (PHOTO_STORAGE_MODE === 'supabase') return `${PHOTO_BASE_URL}/${encoded}`
  return `/uploads/${encoded}`
}
