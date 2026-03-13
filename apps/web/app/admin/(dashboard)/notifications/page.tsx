/**
 * 알림 관리 페이지
 * WHY: 알림 발송 이력 조회 및 수동 발송 관리
 * HOW: Server Component -> NotificationClient
 * WHERE: /admin/notifications
 */
import NotificationClient from './NotificationClient'

export const metadata = { title: 'TF Admin — 알림' }

export default function NotificationsPage() {
  return <NotificationClient />
}
