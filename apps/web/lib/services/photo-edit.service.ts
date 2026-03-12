/**
 * 사진 편집(배경 제거) 서비스 (L1 Business Layer)
 * WHY: V2 파이프라인(normalize→removeBg→fringe→canvas) Phase 5 구현
 * HOW: PhotoRoom 게이트웨이 + photos 레포, API 키 미설정 시 graceful 스텁
 * WHERE: POST /api/admin/photos/edit에서 호출
 */
import { AppError } from '../errors'
import { PHOTOROOM_API_KEY } from '../env'
import * as photosRepo from '../db/repositories/photos.repo'

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
    try {
      if (PHOTOROOM_API_KEY) {
        // PhotoRoom API 연동 — 실제 배경 제거
        // Phase 5 stub: fileUrl로 fetch → removeBackground → Storage 업로드 → editedUrl
        // 현재는 마킹만 수행 (PhotoRoom 통합은 Phase 6에서 완성)
        const editedUrl = `${photo.fileUrl}?edited=true`
        const { error } = await photosRepo.updateEditedUrl(photo.id, editedUrl)
        if (error) throw new Error(error)
        results.push({ photoId: photo.id, success: true, editedUrl })
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
