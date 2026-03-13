/**
 * 엑셀 대량 등록 버튼
 * WHY: 위탁 일괄 접수 (V2 기능 유지)
 * HOW: file input → xlsx 파싱 → POST /bulk
 * WHERE: ConsignmentClient.tsx
 */
'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'

interface ExcelUploadButtonProps {
  onSuccess: () => void
}

export default function ExcelUploadButton({ onSuccess }: ExcelUploadButtonProps) {
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

      const result = await api.post<{ created: number }>(
        '/api/admin/consignments/bulk',
        { rows },
      )
      toast(`${result.created}건 등록 완료`, 'success')
      onSuccess()
    } catch (err) {
      const msg = err instanceof APIError ? err.message : '업로드 실패'
      toast(msg, 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="secondary"
        loading={uploading}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        엑셀 등록
      </Button>
    </>
  )
}
