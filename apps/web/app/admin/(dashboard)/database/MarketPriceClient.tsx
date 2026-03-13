/**
 * 시세 CRUD 클라이언트
 * WHY: 시세 데이터 조회 + 필터 + 등록
 * HOW: useApi GET + 필터 + 인라인 등록 폼 + TableShell
 * WHERE: database/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import TableShell, { type Column } from '@/components/TableShell'
import Pagination from '@/components/Pagination'
import Button from '@/components/Button'
import FormField from '@/components/FormField'

interface MP { id: string; brand: string; category: string; price: number; size: string | null; condition: string | null; source: string | null; createdAt: string }
interface ListRes { items: MP[]; total: number }
const PAGE_SIZE = 20
const IC = 'rounded-md border border-gray-300 px-3 py-2 text-sm'
const COLS: Column<MP>[] = [
  { key: 'brand', header: '브랜드' }, { key: 'category', header: '카테고리' },
  { key: 'price', header: '가격', render: (r) => r.price.toLocaleString() },
  { key: 'size', header: '사이즈', render: (r) => r.size ?? '-' },
  { key: 'condition', header: '상태', render: (r) => r.condition ?? '-' },
  { key: 'source', header: '출처', render: (r) => r.source ?? '-' },
  { key: 'createdAt', header: '등록일', render: (r) => r.createdAt?.slice(0, 10) ?? '' },
]
const EMPTY_FORM = { brand: '', category: '', price: '', size: '', condition: '', source: '' }

export default function MarketPriceClient() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ brand: '', category: '', condition: '', source: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  const { data, isLoading, mutate } = useApi<ListRes>(`/api/admin/market-prices?${params}`)

  const updateFilter = useCallback((key: string, value: string) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }, [])

  const handleSubmit = useCallback(async () => {
    const p = Number(form.price)
    if (!form.brand || !form.category || !Number.isFinite(p) || p <= 0 || submitting) return
    setSubmitting(true)
    try {
      const payload = { brand: form.brand, category: form.category, price: p,
        ...(form.size && { size: form.size }), ...(form.condition && { condition: form.condition }), ...(form.source && { source: form.source }) }
      await api.post('/api/admin/market-prices', payload)
      toast('시세 등록 완료', 'success'); setForm(EMPTY_FORM); setShowForm(false); await mutate()
    } catch { toast('시세 등록 실패', 'error') }
    finally { setSubmitting(false) }
  }, [form, submitting, toast, mutate])
  const setField = useCallback((key: string, value: string) => { setForm((prev) => ({ ...prev, [key]: value })) }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {([['brand', '브랜드'], ['category', '카테고리'], ['condition', '상태'], ['source', '출처']] as const).map(([key, ph]) => (
          <input key={key} value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)}
            placeholder={ph} className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        ))}
        <Button variant="secondary" onClick={() => setShowForm((p) => !p)} className="gap-1"><Plus className="h-4 w-4" /> 시세 등록</Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          {([['brand', '브랜드 *'], ['category', '카테고리 *'], ['price', '가격 *', 'number'], ['size', '사이즈'], ['condition', '상태'], ['source', '출처']] as const).map(([k, label, type]) => (
            <FormField key={k} label={label}>
              <input className={IC} type={type ?? 'text'} min={type === 'number' ? '0' : undefined}
                value={form[k]} onChange={(e) => setField(k, e.target.value)} />
            </FormField>
          ))}
          <div className="col-span-3 flex justify-end"><Button onClick={handleSubmit} loading={submitting}>등록</Button></div>
        </div>
      )}

      <TableShell<MP> columns={COLS} rows={data?.items ?? []} keyField="id" loading={isLoading} emptyMessage="시세 데이터가 없습니다" />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
    </div>
  )
}
