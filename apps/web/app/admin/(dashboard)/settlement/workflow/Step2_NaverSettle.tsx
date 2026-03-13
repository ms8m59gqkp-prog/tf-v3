/**
 * Step 2: 네이버 정산 엑셀 업로드
 * WHY: 네이버 paySettleDailyDetail 파싱
 * HOW: 브라우저 xlsx 파싱 → POST /naver/upload (JSON)
 * WHERE: WorkflowClient.tsx
 */
'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

interface Step2Props {
  onComplete: (batchId: string) => void
}

export default function Step2_NaverSettle({ onComplete }: Step2Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
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

      const batchId = crypto.randomUUID()
      const result = await api.post<{ inserted: number }>(
        '/api/admin/sales/naver/upload',
        { rows, batchId },
      )
      toast(`네이버 ${result.inserted}건 업로드`, 'success')
      onComplete(batchId)
    } catch (err) {
      toast(err instanceof APIError ? err.message : '업로드 실패', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">네이버 정산 엑셀(paySettleDailyDetail)을 업로드하세요</p>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      <Button loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" /> 네이버 정산 업로드
      </Button>
    </div>
  )
}
