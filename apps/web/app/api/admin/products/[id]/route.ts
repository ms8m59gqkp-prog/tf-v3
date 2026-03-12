/**
 * GET /api/admin/products/[id] — 상품 단건 조회
 * PATCH /api/admin/products/[id] — 상품 수정
 * DELETE /api/admin/products/[id] — 상품 비활성화 (soft delete)
 * WHY: 상품 상세 조회 + 부분 수정 + 삭제
 * HOW: withAdmin → UUID 검증 → product.getById/update/remove → ok
 * WHERE: admin/products/detail 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateProductSchema } from './schema'
import * as productService from '@/lib/services/product.service'

export const GET = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await productService.getById(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const PATCH = withAdmin<{ id: string }>(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await productService.update(id, parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const DELETE = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await productService.remove(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
