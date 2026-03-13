/**
 * 상품 테이블 컴포넌트
 * WHY: 상품 목록을 일관된 테이블 UI로 표시
 * HOW: TableShell<StProduct> + Column 정의
 * WHERE: ProductClient.tsx
 */
'use client'

import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import type { StProduct } from '@/lib/types/domain/product'

interface ProductTableProps {
  rows: StProduct[]
  loading: boolean
  onRowClick: (row: StProduct) => void
}

const TYPE_LABELS: Record<string, string> = {
  consignment: '위탁',
  inventory: '재고',
}

export default function ProductTable({ rows, loading, onRowClick }: ProductTableProps) {
  const columns: Column<StProduct>[] = [
    { key: 'productName', header: '상품명' },
    { key: 'brand', header: '브랜드', render: (r) => r.brand ?? '-' },
    {
      key: 'salePrice',
      header: '판매가',
      render: (r) => `${r.salePrice.toLocaleString()}원`,
    },
    {
      key: 'isActive',
      header: '상태',
      render: (r) => (
        <StatusBadge
          status={r.isActive === false ? 'rejected' : 'confirmed'}
          size="sm"
        />
      ),
    },
    {
      key: 'productType',
      header: '유형',
      render: (r) => (r.productType ? TYPE_LABELS[r.productType] ?? r.productType : '-'),
    },
    {
      key: 'createdAt',
      header: '생성일',
      render: (r) => r.createdAt?.slice(0, 10) ?? '-',
    },
  ]

  return (
    <TableShell<StProduct>
      columns={columns}
      rows={rows}
      keyField="id"
      loading={loading}
      onRowClick={onRowClick}
      emptyMessage="상품이 없습니다"
    />
  )
}
