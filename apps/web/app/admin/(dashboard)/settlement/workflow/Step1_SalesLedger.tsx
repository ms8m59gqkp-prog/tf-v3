/**
 * Step 1: 매출장 엑셀 업로드
 * WHY: 매출 데이터를 파싱하여 DB에 적재
 * HOW: 브라우저 xlsx 파싱 → POST /sales/upload (JSON)
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

interface Step1Props {
  onComplete: (sessionId: string) => void
}

export default function Step1_SalesLedger({ onComplete }: Step1Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const { toast } = useToast()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { read, utils } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (rows.length === 0) {
        toast('빈 엑셀입니다', 'error')
        return
      }

      setPreview(rows.slice(0, 5))
      const sessionId = crypto.randomUUID()
      const result = await api.post<{ inserted: number }>(
        '/api/admin/sales/upload',
        { rows, sessionId },
      )
      toast(`${result.inserted}건 업로드 완료`, 'success')
      onComplete(sessionId)
    } catch (err) {
      toast(err instanceof APIError ? err.message : '업로드 실패', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">매출장 엑셀 파일을 업로드하세요</p>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      <Button loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" /> 매출장 업로드
      </Button>

      {preview.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-xs font-medium text-gray-500">미리보기 (상위 5건)</p>
          <pre className="overflow-x-auto text-xs text-gray-700">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
