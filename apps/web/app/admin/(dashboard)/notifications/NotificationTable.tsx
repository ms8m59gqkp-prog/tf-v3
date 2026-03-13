/**
 * 알림 로그 테이블
 * WHY: 알림 발송 이력을 일관된 테이블 UI로 표시
 * HOW: TableShell + StatusBadge + 액션 버튼(재발송/삭제)
 * WHERE: NotificationClient
 */
'use client'

import { useMemo } from 'react'
import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import Button from '@/components/Button'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { NotificationLog } from '@/lib/types/domain/notification'

interface Props {
  rows: NotificationLog[]
  loading: boolean
  onResend: (id: string) => void
  onDelete: (id: string) => void
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificationTable({ rows, loading, onResend, onDelete }: Props) {
  const columns = useMemo<Column<NotificationLog>[]>(() => [
    { key: 'phone', header: '전화번호' },
    { key: 'message', header: '메시지', render: (r) => truncate(r.message, 30) },
    { key: 'triggerEvent', header: '트리거' },
    {
      key: 'status', header: '상태',
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: 'createdAt', header: '발송일',
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: 'actions', header: '액션',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="!px-2 !py-1" onClick={() => onResend(r.id)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="danger" className="!px-2 !py-1" onClick={() => onDelete(r.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [onResend, onDelete])

  return (
    <TableShell
      columns={columns}
      rows={rows}
      keyField="id"
      loading={loading}
      emptyMessage="알림 이력이 없습니다"
    />
  )
}
