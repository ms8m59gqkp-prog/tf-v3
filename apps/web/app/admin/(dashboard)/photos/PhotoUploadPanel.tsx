/**
 * 사진 업로드 + AI 분류 패널
 * WHY: 사진 메타데이터 등록 및 AI 분류 실행
 * HOW: 폼 입력 -> POST /api/admin/photos/upload, classify
 * WHERE: PhotoClient 업로드 탭
 */
'use client'

import { useState } from 'react'
import { Upload, Sparkles } from 'lucide-react'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { useToast } from '@/components/Toast'
import { api, APIError } from '@/lib/api/client'
import type { PhotoUpload } from '@/lib/types/domain/photo'

interface Props {
  onUploadComplete: (photos: PhotoUpload[]) => void
}

interface ClassifyResult {
  classified: number
}

export default function PhotoUploadPanel({ onUploadComplete }: Props) {
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const { toast } = useToast()

  async function handleUpload() {
    if (submitting || !fileName.trim() || !fileUrl.trim()) return
    setSubmitting(true)
    try {
      const result = await api.post<PhotoUpload[]>('/api/admin/photos/upload', {
        files: [{
          fileName: fileName.trim(),
          fileUrl: fileUrl.trim(),
          fileSize: fileSize ? Math.max(0, Number(fileSize)) : undefined,
        }],
      })
      onUploadComplete(result)
      setFileName('')
      setFileUrl('')
      setFileSize('')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '업로드 실패', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClassify() {
    if (classifying) return
    setClassifying(true)
    try {
      const result = await api.post<ClassifyResult>(
        '/api/admin/photos/classify',
        { images: [], options: { maxRetries: 1 } },
      )
      toast(`${result.classified}건 분류 완료`, 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : 'AI 분류 실패', 'error')
    } finally {
      setClassifying(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-800">사진 메타데이터 등록</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="파일명">
          <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)}
            placeholder="photo_001.jpg" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </FormField>
        <FormField label="파일 URL (HTTPS)">
          <input type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..." className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </FormField>
        <FormField label="파일 크기 (bytes)">
          <input type="number" min="0" value={fileSize} onChange={(e) => setFileSize(e.target.value)}
            placeholder="0" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </FormField>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleUpload} loading={submitting} disabled={!fileName.trim() || !fileUrl.trim()}>
          <Upload className="mr-1.5 h-4 w-4" /> 등록
        </Button>
        <Button variant="secondary" onClick={handleClassify} loading={classifying}>
          <Sparkles className="mr-1.5 h-4 w-4" /> AI 분류 실행
        </Button>
      </div>
    </div>
  )
}
