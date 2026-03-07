/**
 * 파일 경로 유틸리티
 * WHY: V2 photo_uploads 패턴 기반 파일 경로 생성
 * HOW: Supabase Storage 경로 규칙에 따른 경로 생성
 * WHERE: 사진 업로드/다운로드에서 사용
 */

export function getProductPhotoPath(productNumber: string, fileName: string): string {
  return `products/${productNumber}/${fileName}`
}

export function getConsignmentImagePath(consignmentId: string, fileName: string): string {
  return `consignments/${consignmentId}/${fileName}`
}

export function getInspectionImagePath(orderItemId: string, fileName: string): string {
  return `inspections/${orderItemId}/${fileName}`
}

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : ''
}

export function isImageFile(fileName: string): boolean {
  const ext = getFileExtension(fileName)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
}
