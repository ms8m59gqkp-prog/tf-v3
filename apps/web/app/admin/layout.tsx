/**
 * 어드민 최상위 레이아웃 (메타데이터 전용)
 * WHY: /admin 하위 공통 메타데이터 + children 래퍼
 * HOW: metadata export + children 렌더링만 수행
 * WHERE: /admin/* 모든 하위 페이지
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TF Admin',
  description: 'TF V3 관리자 패널',
}

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
