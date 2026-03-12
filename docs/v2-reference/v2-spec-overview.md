# V2 검증 기준서 #0: 시스템 개요

## 기술 스택
| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 15.x |
| 언어 | TypeScript | 5.x |
| DB | Supabase (PostgreSQL) | @supabase/supabase-js ^2.95.3 |
| 인증 | HMAC-SHA256 쿠키 세션 | 커스텀 구현 |
| 레이트리밋 | Upstash Redis | @upstash/ratelimit ^2.0.8 |
| SMS | Solapi (CoolSMS) | solapi ^5.5.4 |
| AI 분류 | Claude Vision | @anthropic-ai/sdk ^0.74.0 |
| 이미지 처리 | Sharp + PhotoRoom | sharp ^0.34.5 |
| 엑셀 | xlsx | ^0.18.5 |
| 차트 | Recharts | ^3.7.0 |

## 관리자 네비게이션 (8개 메뉴)
| 순서 | 메뉴명 | 경로 | 도메인 |
|------|--------|------|--------|
| 1 | 신청 관리 | /admin/consignments | 위탁 |
| 2 | 상품 관리 | /admin/products | 상품 |
| 3 | 사진 관리 | /admin/photos | 사진 |
| 4 | 정산 관리 | /admin/settlement | 정산 |
| 5 | 시세 조회 | /admin/database | DB |
| 6 | 주문 관리 | /admin/orders | 주문 |
| 7 | 매출 관리 | /admin/sales | 매출 |
| 8 | 알림 관리 | /admin/notifications | 알림 |

## 사이드바 컴포넌트
- **파일**: `app/admin/components/Sidebar.tsx` (228줄)
- **테마**: 골드(#c9a96e), 다크 배경(#111111~#161616)
- **기능**: 현재 경로 하이라이트 (usePathname), 그래디언트 아이콘, 버전 표시(v1.0.0)
- **활성 메뉴**: 금색 배경 + 금색 텍스트 + 점 표시, 전환 0.18s ease
- **하단**: "v1.0.0 · 관리자 전용"

## AdminLayout 컴포넌트
- **파일**: `app/admin/components/AdminLayout.tsx` (185줄)
- **Props**: `children`, `title: string`, `actions?: ReactNode`
- **구조**: 좌측 Sidebar(240px 고정) + 우측 메인(flex:1)
- **상단 헤더**: 타이틀(18px, 600 weight) + actions + 로그아웃 버튼
- **뒤로가기 방지**: history.pushState + popstate → 로그아웃 확인 모달
- **로그아웃 경고**: "로그아웃 확인" 모달 (아니오 회색 / 예 빨강)

## 관리자 대시보드
- **경로**: `/admin`
- **현재 동작**: `/admin/consignments`로 자동 리다이렉트 (대시보드 미구현)

## 로그인 페이지
- **파일**: `app/admin/login/page.tsx` (286줄)
- **디자인**: 검은색 그래디언트 배경 + 보라색 원형 장식 + 반투명 blur 카드 + 금색 테두리
- **로고**: 금색 배경 집 아이콘 + "Tradingfloor ADMIN PORTAL"
- **입력**: 아이디 + 비밀번호 (autoComplete)
- **에러**: 빨강 배경 + 아이콘
- **버튼**: 금색 그래디언트, 로딩 중 회전 스피너
