/**
 * 어드민 헤더
 * WHY: 현재 페이지명 표시 + 로그아웃
 * HOW: pathname 기반 제목 + logout API 호출
 * WHERE: app/admin/(dashboard)/layout.tsx
 */
'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { api, APIError } from '@/lib/api/client'

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': '대시보드',
  '/admin/consignments': '위탁 관리',
  '/admin/orders': '주문 관리',
  '/admin/settlement': '정산',
  '/admin/photos': '사진 관리',
  '/admin/products': '상품 관리',
  '/admin/notifications': '알림',
  '/admin/sales': '매출',
  '/admin/database': '시세 DB',
}

export default function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const title = Object.entries(PAGE_TITLES).find(
    ([path]) => pathname.startsWith(path),
  )?.[1] ?? 'TF Admin'

  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.post('/api/admin/auth/logout', {})
      router.push('/admin/login')
    } catch (e) {
      setLoggingOut(false)
      if (!(e instanceof APIError)) throw e
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <LogOut size={16} />
        로그아웃
      </button>
    </header>
  )
}
