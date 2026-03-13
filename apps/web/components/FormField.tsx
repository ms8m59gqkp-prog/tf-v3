/**
 * 폼 필드 (라벨+입력+에러)
 * WHY: 폼 UI 일관성
 * HOW: label + input + error 메시지 조합
 * WHERE: 로그인, 검수, 가격조정 폼
 */

import { type ReactNode } from 'react'

interface FormFieldProps {
  label: string
  error?: string
  children: ReactNode
}

export default function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
