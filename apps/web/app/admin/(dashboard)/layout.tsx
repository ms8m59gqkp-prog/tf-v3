/**
 * 어드민 인증 레이아웃 (사이드바 + 헤더)
 * WHY: 모든 보호된 어드민 페이지에 인증 체크 + 공통 UI 제공
 * HOW: Server Component에서 쿠키 → verifySessionToken → 미인증 시 redirect
 * WHERE: /admin/(dashboard)/* 모든 하위 페이지
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import AdminSidebar from '@/components/AdminSidebar'
import AdminHeader from '@/components/AdminHeader'

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value

  if (!token || !verifySessionToken(token)) {
    redirect('/admin/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 사이드바 */}
      <AdminSidebar />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
