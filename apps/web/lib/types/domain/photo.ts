/**
 * 사진 도메인 타입
 * WHY: V2 photos + photo_uploads 테이블과 1:1 대응
 * HOW: 인터페이스 정의
 * WHERE: 사진 관리 관련 코드에서 import
 */

export interface Photo {
  id: string
  orderItemId: string
  fileName: string
  fileUrl: string
  shotType?: string | null
  isEdited?: boolean | null
  editedUrl?: string | null
  sortOrder?: number | null
  createdAt?: string | null
}

export interface PhotoUpload {
  id: string
  fileName: string
  fileUrl: string
  fileSize?: number | null
  uploadedBy?: string | null
  isMatched?: boolean | null
  orderItemId?: string | null
  uploadedAt?: string | null
}
