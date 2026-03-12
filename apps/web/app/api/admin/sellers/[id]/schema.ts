/**
 * PATCH /api/admin/sellers/[id] 입력 검증
 * WHY: 셀러 수정 시 허용 필드만 화이트리스트 (시스템 컬럼 수정 차단)
 * HOW: Zod — 각 필드 optional, 최소 1개 필수
 * WHERE: sellers/[id]/route.ts PATCH 핸들러
 */
import { z } from 'zod'
import { SELLER_STATUSES, SELLER_TIERS, CHANNEL_TYPES } from '@/lib/types/domain/seller'

export const UpdateSellerSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100).optional(),
  phone: z.string().regex(/^01[016789]\d{7,8}$/, '올바른 전화번호 형식이 아닙니다').optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다').max(200).optional(),
  sellerTier: z.enum(SELLER_TIERS).optional(),
  status: z.enum(SELLER_STATUSES).optional(),
  commissionRate: z.number().min(0).max(1, '수수료율은 0~1 사이여야 합니다').optional(),
  channelType: z.enum(CHANNEL_TYPES).optional(),
  bankName: z.string().max(50).optional(),
  bankAccount: z.string().max(50).optional(),
  bankHolder: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  nickname: z.string().max(50).optional(),
  marketingConsent: z.boolean().optional(),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  contractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  taggingCode: z.string().max(50).optional(),
}).refine(
  (d) => Object.values(d).some(v => v !== undefined),
  '수정할 필드를 1개 이상 입력해주세요',
)
