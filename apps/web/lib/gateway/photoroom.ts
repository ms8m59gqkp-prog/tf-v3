/**
 * PhotoRoom 배경 제거 API 게이트웨이 (L0 Infrastructure)
 * WHY: architecture-spec 4.2 — 서비스에서 fetch 직접 호출 금지
 * HOW: PhotoRoom Segment API v1 래핑, 타임아웃 15초
 * WHERE: photo-edit.service.ts에서 import
 */
import { PHOTOROOM_API_KEY } from '../env'
import { AppError } from '../errors'

const TIMEOUT_MS = 15_000
const API_URL = 'https://sdk.photoroom.com/v1/segment'

/**
 * 이미지 배경 제거 (투명 PNG 반환)
 * @param imageBuffer 원본 이미지 바이너리
 * @returns 배경 제거된 PNG Buffer
 */
export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  if (!PHOTOROOM_API_KEY) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'PhotoRoom API가 비활성화되어 있습니다 (PHOTOROOM_API_KEY 미설정)',
    )
  }

  const formData = new FormData()
  const arrayBuf = imageBuffer.buffer.slice(
    imageBuffer.byteOffset,
    imageBuffer.byteOffset + imageBuffer.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([arrayBuf], { type: 'image/png' })
  formData.append('image_file', blob, 'image.png')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': PHOTOROOM_API_KEY },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.status === 402) {
      throw new AppError('SERVICE_UNAVAILABLE', 'PhotoRoom 크레딧이 소진되었습니다')
    }
    if (res.status === 429) {
      throw new AppError('RATE_LIMIT', 'PhotoRoom API 요청 한도를 초과했습니다')
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`PhotoRoom API ${res.status}: ${body.slice(0, 200)}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof AppError) throw e
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[photoroom] 배경 제거 실패:', msg)
    throw new AppError('SERVICE_UNAVAILABLE', `배경 제거 실패: ${msg}`)
  }
}
