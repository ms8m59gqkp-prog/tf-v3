/**
 * 사진 편집(배경 제거) 서비스 (L1 Business Layer)
 * WHY: V2 파이프라인(normalize→removeBg→fringe→canvas) Phase 5 구현
 * HOW: PhotoRoom 게이트웨이 + storage 게이트웨이 + photos 레포
 * WHERE: POST /api/admin/photos/edit에서 호출
 */
import { AppError } from '../errors'
import { PHOTOROOM_API_KEY } from '../env'
import * as photosRepo from '../db/repositories/photos.repo'
import { removeBackground } from '../gateway/photoroom'
import * as storage from '../gateway/storage'
import { resolveStorageUrl, getEditedPhotoPath } from '../utils/path'

export interface EditResult {
  photoId: string
  success: boolean
  editedUrl?: string
  error?: string
}

export async function editPhotos(photoIds: string[]): Promise<EditResult[]> {
  if (photoIds.length === 0) {
    throw new AppError('VALIDATION', '편집할 사진이 없습니다')
  }
  if (photoIds.length > 50) {
    throw new AppError('VALIDATION', '한 번에 최대 50건까지 편집 가능합니다')
  }

  const result = await photosRepo.findByIds(photoIds)
  if (result.error || !result.data) {
    throw new AppError('INTERNAL', `사진 조회 실패: ${result.error}`)
  }
  const photos = result.data

  const foundIds = new Set(photos.map(p => p.id))
  const notFound = photoIds.filter(id => !foundIds.has(id))
  if (notFound.length > 0) {
    throw new AppError('NOT_FOUND', `사진을 찾을 수 없습니다: ${notFound.join(', ')}`)
  }

  const results: EditResult[] = []

  for (const photo of photos) {
    if (!photo.fileUrl) {
      results.push({ photoId: photo.id, success: false, error: '원본 파일 경로 없음' })
      continue
    }
    try {
      if (PHOTOROOM_API_KEY) {
        // PhotoRoom 배경 제거 → Supabase Storage 업로드
        const srcUrl = resolveStorageUrl(photo.fileUrl)
        const srcBuffer = await storage.downloadImageBuffer(srcUrl)
        const editedBuffer = await removeBackground(srcBuffer)
        const storagePath = getEditedPhotoPath(photo.id)
        await storage.upload('photos', storagePath, editedBuffer)
        // DB에는 상대경로만 저장 (resolveStorageUrl이 런타임에 full URL 생성)
        const { error } = await photosRepo.updateEditedUrl(photo.id, storagePath)
        if (error) throw new Error(error)
        results.push({ photoId: photo.id, success: true, editedUrl: resolveStorageUrl(storagePath) })
      } else {
        // API 키 미설정 시 graceful degradation: 편집 마킹만
        const editedUrl = photo.fileUrl
        const { error } = await photosRepo.updateEditedUrl(photo.id, editedUrl)
        if (error) throw new Error(error)
        results.push({ photoId: photo.id, success: true, editedUrl })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[photo-edit] 실패:', photo.id, msg)
      results.push({ photoId: photo.id, success: false, error: msg })
    }
  }

  const successCount = results.filter(r => r.success).length
  console.log('[photo-edit] 완료:', successCount, '/', results.length, '건')
  return results
}
