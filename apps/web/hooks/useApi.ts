/**
 * SWR 기반 API 훅
 * WHY: GET 캐싱 + 에러/로딩 상태 통합
 * HOW: SWR + lib/api/client.ts fetcher
 * WHERE: 모든 데이터 조회 페이지
 */
'use client'

import useSWR, { type KeyedMutator } from 'swr'
import { useState, useCallback } from 'react'
import { api, APIError } from '@/lib/api/client'

/* ── SWR fetcher ──────────────────────────────────── */

function fetcher<T>(url: string): Promise<T> {
  return api.get<T>(url)
}

/* ── useApi: GET 캐싱 ─────────────────────────────── */

interface UseApiReturn<T> {
  data: T | undefined
  error: APIError | undefined
  isLoading: boolean
  mutate: KeyedMutator<T>
}

export function useApi<T>(url: string | null): UseApiReturn<T> {
  const { data, error, isLoading, mutate } = useSWR<T, APIError>(
    url,
    fetcher<T>,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  return { data, error, isLoading, mutate }
}

/* ── useMutation: POST/PATCH/DELETE ───────────────── */

type MutationMethod = 'post' | 'patch' | 'delete'

interface UseMutationReturn<TReq, TRes> {
  trigger: (body?: TReq) => Promise<TRes>
  isMutating: boolean
  error: APIError | undefined
}

export function useMutation<TReq extends Record<string, unknown>, TRes>(
  method: MutationMethod,
  url: string,
): UseMutationReturn<TReq, TRes> {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<APIError | undefined>(undefined)

  const trigger = useCallback(async (body?: TReq): Promise<TRes> => {
    setIsMutating(true)
    setError(undefined)
    try {
      const result = method === 'delete'
        ? await api.delete<TRes>(url)
        : await api[method]<TRes>(url, body ?? {})
      return result
    } catch (e) {
      const apiError = e instanceof APIError
        ? e
        : new APIError(e instanceof Error ? e.message : '알 수 없는 오류', 0)
      setError(apiError)
      throw apiError
    } finally {
      setIsMutating(false)
    }
  }, [method, url])

  return { trigger, isMutating, error }
}
