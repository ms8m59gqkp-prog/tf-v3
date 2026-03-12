/**
 * 네이버 쇼핑 검색 API 게이트웨이 (L0 Infrastructure)
 * WHY: architecture-spec 4.2 — 서비스에서 fetch 직접 호출 금지
 * HOW: 네이버 Open API 래핑, 타임아웃 5초
 * WHERE: price-estimate.service.ts에서 import
 */
import { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } from '../env'
import { AppError } from '../errors'

const TIMEOUT_MS = 5_000
const API_URL = 'https://openapi.naver.com/v1/search/shop.json'

export interface NaverShopItem {
  title: string
  link: string
  image: string
  lprice: string
  hprice: string
  mallName: string
  productId: string
  productType: string
  brand: string
  maker: string
  category1: string
  category2: string
  category3: string
  category4: string
}

export interface NaverSearchResult {
  total: number
  start: number
  display: number
  items: NaverShopItem[]
}

/**
 * 네이버 쇼핑 검색 API 호출
 * @param query 검색어 (브랜드 + 모델명)
 * @param display 결과 수 (기본 20, 최대 100)
 */
export async function searchProducts(
  query: string,
  display = 20,
): Promise<NaverSearchResult> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      '네이버 쇼핑 API가 비활성화되어 있습니다 (NAVER_CLIENT_ID/SECRET 미설정)',
    )
  }

  const url = `${API_URL}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Naver API ${res.status}: ${body.slice(0, 200)}`)
    }

    return (await res.json()) as NaverSearchResult
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof AppError) throw e
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[naver-shopping] 검색 실패:', msg)
    throw new AppError('SERVICE_UNAVAILABLE', `네이버 검색 실패: ${msg}`)
  }
}
