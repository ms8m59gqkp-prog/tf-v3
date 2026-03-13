/**
 * 네이버 정산 업로드 클라이언트
 * WHY: 네이버 ERP 정산 데이터를 업로드하여 매출 연동
 * HOW: FileReader CSV 파싱 → POST /api/admin/sales/naver/upload
 * WHERE: sales/erp/page.tsx
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import Button from '@/components/Button'

export default function ErpClient() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<number | null>(null)

  const handleUpload = useCallback(async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || submitting) return

    setSubmitting(true)
    try {
      const text = await file.text()
      const rows = parseCsvRows(text)
      if (rows.length === 0 || rows.length > 5000) {
        toast(`행 수 오류: ${rows.length}건 (1~5000 허용)`, 'error')
        return
      }

      const batchId = crypto.randomUUID()
      const res = await api.post<{ inserted: number }>('/api/admin/sales/naver/upload', {
        rows,
        batchId,
      })
      setLastResult(res.inserted)
      toast(`네이버 정산 ${res.inserted}건 업로드 완료`, 'success')
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      toast('네이버 정산 업로드 실패', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, toast])

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">네이버 정산 업로드</h3>
        <div className="flex items-end gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            className="flex-1 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-amber-700 hover:file:bg-amber-100"
          />
          <Button onClick={handleUpload} loading={submitting} disabled={!fileName} className="gap-1">
            <FileSpreadsheet className="h-4 w-4" /> 업로드
          </Button>
        </div>
      </section>

      {lastResult !== null && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          최근 업로드: {lastResult}건 등록 완료
        </div>
      )}
    </div>
  )
}

/** CSV 텍스트를 Record 배열로 변환 (placeholder) */
function parseCsvRows(text: string): Record<string, unknown>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? '' })
    return row
  })
}
