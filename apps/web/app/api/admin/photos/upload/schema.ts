/**
 * POST /api/admin/photos/upload 요청 스키마
 * WHY: 사진 업로드 메타데이터 검증
 * HOW: Zod
 * WHERE: photos/upload/route.ts
 */
import { z } from 'zod'

export const PhotoUploadSchema = z.object({
  files: z.array(z.object({
    fileName: z.string()
      .min(1, '파일명은 필수입니다')
      .max(255, '파일명이 너무 깁니다')
      .regex(/^[a-zA-Z0-9가-힣._\- ()]+$/, '허용되지 않는 문자가 포함되어 있습니다'),
    fileUrl: z.string()
      .url('유효한 URL이 아닙니다')
      .startsWith('https://', 'HTTPS URL만 허용됩니다')
      .refine(
        (url) => {
          try {
            const host = new URL(url).hostname
            return !host.match(/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/)
          } catch { return false }
        },
        '내부 네트워크 URL은 허용되지 않습니다',
      ),
    fileSize: z.number().int().positive('파일 크기는 양수여야 합니다'),
  })).min(1, '최소 1개 파일이 필요합니다').max(50, '최대 50개까지 업로드 가능합니다'),
})
