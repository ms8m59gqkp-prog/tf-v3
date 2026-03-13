/**
 * 어드민 로그인 페이지
 * WHY: 관리자 인증 진입점
 * HOW: PW 폼 → POST /api/admin/auth/login → 대시보드 리다이렉트
 * WHERE: /admin/login
 */
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FormField from '@/components/FormField'
import Button from '@/components/Button'
import { api, APIError } from '@/lib/api/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!password.trim()) {
      setError('비밀번호를 입력해주세요')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/admin/auth/login', { password })
      router.push('/admin/dashboard')
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message)
      } else {
        setError('알 수 없는 오류가 발생했습니다')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="w-full max-w-sm rounded-2xl border border-amber-100/60 bg-white/80 p-8 shadow-xl backdrop-blur-lg">
        {/* 타이틀 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-amber-800">TF Admin</h1>
          <p className="mt-1 text-sm text-gray-500">관리자 로그인</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormField label="비밀번호" error={error}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full py-2.5"
          >
            로그인
          </Button>
        </form>
      </div>
    </div>
  )
}
