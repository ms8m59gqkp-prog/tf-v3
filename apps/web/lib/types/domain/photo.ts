/**
 * 사진 분류 및 배치 도메인 타입
 * WHY: 사진 분류 배치 작업의 상태 추적 및 결과 표현
 * HOW: PhotoStatus, ClassifiedGroup, BatchProgress 인터페이스
 * WHERE: photo 서비스, batch.repo에서 참조
 */

export type PhotoStatus = 'pending' | 'classified' | 'failed'
export type ShotType = 'flat' | 'model' | 'detail' | 'tag'

export const BATCH_STATUSES = ['running', 'completed', 'partial', 'failed'] as const
export type BatchStatus = typeof BATCH_STATUSES[number]

export interface ClassifiedFile {
  id: string
  batchId: string
  originalFilename: string
  storagePath: string
  shotType: ShotType
  productNumber?: string
  confidence?: number
  status: PhotoStatus
  errorMessage?: string
  classifiedAt?: string
  createdAt: string
}

export interface ClassifiedGroup {
  productNumber: string
  files: ClassifiedFile[]
  primaryImage?: string
  shotTypes: ShotType[]
  totalFiles: number
}

export interface BatchProgress {
  id: string
  batchId: string
  totalFiles: number
  processedFiles: number
  successCount: number
  failCount: number
  status: BatchStatus
  startedAt: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}
