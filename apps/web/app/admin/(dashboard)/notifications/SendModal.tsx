/**
 * 알림 발송 모달 (단일/대량)
 * WHY: 수동 SMS 발송 지원
 * HOW: 탭 전환(단일/대량) + POST send/bulk-send
 * WHERE: NotificationClient "알림 발송" 버튼
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import FormField from '@/components/FormField'
import { useToast } from '@/components/Toast'
import { api, APIError } from '@/lib/api/client'

interface Props { open: boolean; onClose: () => void; onSent: () => void }
type Mode = 'single' | 'bulk'
const PHONE_RE = /^01[016789]\d{7,8}$/
const INPUT_CLS = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

export default function SendModal({ open, onClose, onSent }: Props) {
  const [mode, setMode] = useState<Mode>('single')
  const [phone, setPhone] = useState('')
  const [phones, setPhones] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  function reset() { setPhone(''); setPhones(''); setMessage(''); setMode('single') }

  async function handleSubmit() {
    if (submitting) return
    if (!message.trim() || message.length > 2000) { toast('메시지를 1~2000자로 입력해 주세요', 'error'); return }
    let phoneList: string[] = []
    if (mode === 'single') {
      if (!PHONE_RE.test(phone)) { toast('올바른 전화번호를 입력해 주세요', 'error'); return }
    } else {
      phoneList = phones.split('\n').map((p) => p.trim()).filter(Boolean)
      if (phoneList.length === 0 || phoneList.length > 50) { toast('전화번호를 1~50개 입력해 주세요', 'error'); return }
      const bad = phoneList.find((p) => !PHONE_RE.test(p))
      if (bad) { toast(`올바르지 않은 번호: ${bad}`, 'error'); return }
    }
    setSubmitting(true)
    try {
      if (mode === 'single') {
        await api.post('/api/admin/notifications/send', { phone, message })
      } else {
        await api.post('/api/admin/notifications/bulk-send', { phones: phoneList, message })
      }
      toast('발송 완료', 'success'); reset(); onSent(); onClose()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '발송 실패', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="알림 발송">
      <div className="mb-4 flex gap-2">
        <Button variant={mode === 'single' ? 'primary' : 'secondary'} onClick={() => setMode('single')}>단일 발송</Button>
        <Button variant={mode === 'bulk' ? 'primary' : 'secondary'} onClick={() => setMode('bulk')}>대량 발송</Button>
      </div>

      {mode === 'single' ? (
        <FormField label="전화번호">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" className={INPUT_CLS} />
        </FormField>
      ) : (
        <FormField label="전화번호 (줄바꿈 구분, 최대 50개)">
          <textarea value={phones} onChange={(e) => setPhones(e.target.value)} rows={4} placeholder={"01012345678\n01098765432"} className={INPUT_CLS} />
        </FormField>
      )}

      <div className="mt-3">
        <FormField label="메시지">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="발송할 메시지를 입력하세요 (최대 2000자)" className={INPUT_CLS} />
        </FormField>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button loading={submitting} onClick={handleSubmit}>발송</Button>
      </div>
    </Modal>
  )
}
