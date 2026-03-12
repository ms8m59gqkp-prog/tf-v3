/**
 * 사진 업로드 메타데이터 등록 서비스 (L1 Business Layer)
 * WHY: 프론트엔드에서 Storage 직접 업로드 후 DB에 메타 등록
 * HOW: photo_uploads 레포 경유 bulk insert
 * WHERE: POST /api/admin/photos/upload에서 호출
 */
import { AppError } from '../errors'
import * as photoUploadsRepo from '../db/repositories/photo-uploads.repo'
import type { PhotoUpload } from '../types/domain/photo'

export interface UploadedFile {
  fileName: string
  fileUrl: string
  fileSize: number
}

export async function upload(
  params: { files: UploadedFile[] },
): Promise<PhotoUpload[]> {
  const { files } = params

  if (files.length === 0) {
    throw new AppError('VALIDATION', '업로드할 파일이 없습니다')
  }

  const inputs = files.map(file => ({
    file_name: file.fileName,
    file_url: file.fileUrl,
    file_size: file.fileSize,
  }))

  const result = await photoUploadsRepo.bulkCreate(inputs)
  if (result.error !== null) {
    throw new AppError('INTERNAL', `사진 업로드 등록 실패: ${result.error}`)
  }

  console.log('[photo-upload] 완료:', result.data.length, '건 등록')
  return result.data
}
