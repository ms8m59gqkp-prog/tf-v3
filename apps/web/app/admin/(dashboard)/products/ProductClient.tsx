/**
 * 상품 관리 메인 클라이언트
 * WHY: 상품 목록 + 통계 + CRUD + 필터 통합
 * HOW: useApi + 하위 컴포넌트 조합
 * WHERE: products/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import StatCard from '@/components/StatCard'
import Pagination from '@/components/Pagination'
import Button from '@/components/Button'
import ProductFilters, { type ProductFilterValues } from './ProductFilters'
import ProductTable from './ProductTable'
import ProductFormModal from './ProductFormModal'
import ProductDetailModal from './ProductDetailModal'
import type { StProduct } from '@/lib/types/domain/product'

interface ListResponse { items: StProduct[]; total: number }
interface Summary { totalActive: number; totalInactive: number }

const PAGE_SIZE = 20
const INIT_FILTERS: ProductFilterValues = { search: '', brand: '', isActive: '' }

export default function ProductClient() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ProductFilterValues>(INIT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (filters.search) params.set('search', filters.search)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.isActive) params.set('isActive', filters.isActive)

  const { data, isLoading, mutate } = useApi<ListResponse>(`/api/admin/products?${params}`)
  const { data: summary } = useApi<Summary>('/api/admin/products/summary')

  const handleFilterChange = useCallback((f: ProductFilterValues) => {
    setFilters(f)
    setPage(1)
  }, [])

  const handleMutated = useCallback(() => { mutate() }, [mutate])

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="활성 상품" value={summary?.totalActive ?? '-'} />
        <StatCard title="비활성 상품" value={summary?.totalInactive ?? '-'} />
      </div>

      {/* 필터 + 등록 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProductFilters filters={filters} onChange={handleFilterChange} />
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />상품 등록
        </Button>
      </div>

      {/* 테이블 */}
      <ProductTable
        rows={data?.items ?? []}
        loading={isLoading}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      {/* 페이지네이션 */}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />

      {/* 등록 모달 */}
      {formOpen && (
        <ProductFormModal open mode="create" onClose={() => setFormOpen(false)} onSuccess={handleMutated} />
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <ProductDetailModal
          productId={selectedId}
          open
          onClose={() => setSelectedId(null)}
          onMutated={handleMutated}
        />
      )}
    </div>
  )
}
