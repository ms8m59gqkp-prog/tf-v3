# V2 검증 기준서 #7: 인증·보안 도메인

## 파일 구조

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `lib/auth.ts` | 109 | HMAC-SHA256 세션 서명/검증 |
| `proxy.ts` | 75 | Edge 미들웨어 (인증 + 레이트리밋) |
| `lib/ratelimit.ts` | 69 | Upstash Redis 슬라이딩 윈도우 |
| `api/admin/auth/login/route.ts` | 48 | 로그인 API |
| `api/admin/auth/logout/route.ts` | 24 | 로그아웃 API |
| `app/admin/login/page.tsx` | 286 | 로그인 UI (금색 테마, blur 카드) |

---

## 세션 인증 (HMAC-SHA256)

**SessionPayload 구조**:
```typescript
interface SessionPayload {
  userId: string    // 'admin'
  email: string     // ADMIN_ID
  createdAt: number // timestamp
  expiresAt: number // timestamp (7일 후)
}
```

**signSession 프로세스**:
```
1. payload = JSON.stringify({userId, email, createdAt, expiresAt})
2. payloadStr = Buffer.from(payload).toString('base64')
3. signature = HMAC-SHA256(payloadStr, SESSION_SECRET)
4. token = payloadStr + '.' + signature
```

**verifySession 프로세스**:
```
1. [payloadStr, signature] = token.split('.')
2. expectedSig = HMAC-SHA256(payloadStr, SESSION_SECRET)
3. timingSafeEqual(signature, expectedSig) — 타이밍 공격 방지
4. payload = JSON.parse(base64decode(payloadStr))
5. expiresAt > Date.now() 확인
```

**세션 TTL**: 7일 (`SESSION_DURATION = 7 * 24 * 60 * 60 * 1000`)
**시크릿 길이 요구**: ≥32자

---

## 쿠키 설정

| 속성 | 값 |
|------|-----|
| 이름 | `admin_session` |
| httpOnly | true |
| secure | production: true, dev: false |
| sameSite | strict |
| maxAge | 604800 (7일, 초 단위) |

---

## 레이트 리밋 설정

| 리미터 | 제한 | 기준 | 네임스페이스 |
|--------|------|------|------------|
| loginRateLimiter | 5회/1분 | IP | ratelimit:login |
| adminApiRateLimiter | 100회/1분 | 세션 | ratelimit:admin-api |
| publicApiRateLimiter | 10회/1분 | IP | ratelimit:public-api |

**알고리즘**: 슬라이딩 윈도우 (Upstash Redis)
**환경변수**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
**개발 모드**: Redis 미설정 시 null 반환 (리밋 비활성)

---

## 로그인 API 프로세스

```
1. Rate limit check (5/min, IP)
2. 크리덴셜 검증 (ADMIN_ID, ADMIN_PASSWORD — 환경변수 비교)
3. signSession('admin', id)
4. Set-Cookie: admin_session (httpOnly, strict, 7일)
5. Response: {success: true}
```

- **단일 관리자 계정**: 환경변수 기반 (DB 미사용)
- **비밀번호**: 평문 비교 (해싱 없음)
