/**
 * Aligo SMS API 게이트웨이 (L0 Infrastructure)
 * WHY: architecture-spec 4.2 — 서비스에서 fetch 직접 호출 금지
 * HOW: Aligo SMS API 래핑, 일일 상한 + 타임아웃
 * WHERE: notification.service.ts에서 import
 */
import { ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER } from '../env'
import { AppError } from '../errors'

const TIMEOUT_MS = 5_000
const DAILY_SMS_LIMIT = 500
const THROTTLE_MS = 100
const API_URL = 'https://apis.aligo.in/send/'

let dailyCount = 0
let dailyResetDate = ''
let lastSentAt = 0

function resetDailyIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (dailyResetDate !== today) {
    dailyCount = 0
    dailyResetDate = today
  }
}

export interface AligoResult {
  resultCode: string
  message: string
  msgId?: string
}

export async function sendSMS(params: {
  phone: string
  message: string
}): Promise<AligoResult> {
  if (!ALIGO_API_KEY || !ALIGO_USER_ID || !ALIGO_SENDER) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'SMS 기능이 비활성화되어 있습니다 (ALIGO 환경변수 미설정)',
    )
  }

  resetDailyIfNeeded()
  if (dailyCount >= DAILY_SMS_LIMIT) {
    console.error('[aligo] 일일 SMS 상한 초과:', dailyCount)
    throw new AppError('RATE_LIMIT', `일일 SMS 발송 상한(${DAILY_SMS_LIMIT}건) 초과`)
  }

  const now = Date.now()
  const wait = THROTTLE_MS - (now - lastSentAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))

  const body = new URLSearchParams({
    key: ALIGO_API_KEY,
    user_id: ALIGO_USER_ID,
    sender: ALIGO_SENDER,
    receiver: params.phone,
    msg: params.message,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)
    lastSentAt = Date.now()
    dailyCount += 1

    if (!res.ok) throw new Error(`Aligo API ${res.status}`)

    const json = await res.json() as {
      result_code: string
      message: string
      msg_id?: string
    }
    return {
      resultCode: json.result_code,
      message: json.message,
      msgId: json.msg_id,
    }
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[aligo] SMS 발송 실패:', msg)
    throw new AppError('SERVICE_UNAVAILABLE', `SMS 발송 실패: ${msg}`)
  }
}
