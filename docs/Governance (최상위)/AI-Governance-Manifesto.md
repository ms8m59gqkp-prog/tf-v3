# 클로드코드교리 v2.0

**작성일**: 2026-02-24
**목적**: Claude Code 사용 시 필수 준수 규범 통합 문서
**출처**: 기존 교리(v1.2) + 6개월 실전 경험 기반 고급 워크플로우 통합
**버전 히스토리**:
- v1.0: 기본 코드 규칙 + 에이전트팀
- v1.1: 팀 모드 우선 원칙 추가
- v1.2: 코드 길이 제한 추가
- **v2.0: 스킬 자동활성화 시스템 + 개발문서 시스템 + 훅 파이프라인 + PM2 통합**

---

## 🧭 목차

1. [코드 변경 전 검증 프로토콜](#-i-코드-변경-전-검증-프로토콜-필수-준수)
2. [코딩 규칙 및 컨벤션](#-ii-코딩-규칙-및-컨벤션)
3. [스킬 자동활성화 시스템 ★NEW★](#-iii-스킬-자동활성화-시스템-new--핵심-업그레이드)
4. [개발문서 시스템 ★NEW★](#-iv-개발문서-시스템-new--컨텍스트-손실-방지)
5. [훅 파이프라인 ★NEW★](#-v-훅-파이프라인-new--자동-품질-보증)
6. [에이전트 팀 모드](#-vi-에이전트-팀-모드-필수)
7. [PM2 프로세스 관리 ★NEW★](#-vii-pm2-프로세스-관리-new)
8. [Claude Code 명령어 체계](#-viii-claude-code-명령어-체계)
9. [Supabase 인증 및 DB 관리](#-ix-supabase-인증-및-db-관리)
10. [프로젝트별 중요 사항](#-x-프로젝트별-중요-사항)
11. [절대 금지 사항](#-xi-절대-금지-사항)
12. [체크리스트](#-xii-체크리스트)
13. [문제 해결 패턴](#-xiii-문제-해결-패턴)
14. [핵심 원칙 요약](#-xiv-핵심-원칙-요약-암기-필수)
15. [명령어 치트시트](#-부록-주요-명령어-치트시트)

---

## 📜 I. 코드 변경 전 검증 프로토콜 (필수 준수)

### Rule 1: Git 히스토리 필수 확인

코드 변경 전 반드시:
- `git log --oneline {파일}` 로 변경 이력 확인
- `git show {이전커밋}:{파일}` 로 작동했던 버전 읽기
- 무엇이 언제 바뀌었는지 이해한 후 변경 시작

**위반 시:** 변경 금지. 반드시 히스토리부터 확인.

### Rule 2: 문제 증거 요구

"문제가 있다"는 보고를 받으면:
- 에러 로그 요청: "터미널 출력 전체를 보여주세요"
- 재현 단계 확인: "언제부터 안 됐나요? 이전엔 됐나요?"
- 증거 없이 추측 금지

**위반 시:** "증거를 먼저 확인하겠습니다" 응답 후 요청.

### Rule 3: 작동 코드 우선 원칙

"이전에 작동했다"는 증거가 있으면:
- 그 버전을 베이스라인으로 설정
- 새 코드가 아닌 복원부터 시도
- "개선"보다 "복구" 우선

**위반 시:** 즉시 작동했던 버전으로 롤백 제안.

### Rule 4: 단일 변경 원칙

한 번에 하나만:
- 모델 변경 OR 아키텍처 변경 (둘 다 X)
- 변경 → 테스트 → 검증 → 다음 변경
- 3개 이상 동시 변경 금지

**위반 시:** "먼저 X만 바꾸고 테스트해보겠습니다" 응답.

### Rule 5: 복잡도 증가 정당화

코드 복잡도를 늘릴 때 반드시 제시:
- 왜 간단한 방법이 안 되는가
- 복잡도 증가의 명확한 이점
- 대안 3가지와 비교

**위반 시:** 사용자에게 "간단한 방법 A vs 복잡한 방법 B" 선택지 제시.

### Rule 6: 추측 금지, 데이터 기반

"~일 것 같다", "아마 ~"는 금지:
- "테스트해보겠습니다" → 실제 테스트
- "확인이 필요합니다" → 로그/증거 요청
- "비교가 필요합니다" → A/B 비교 제안

**위반 시:** 발언 철회 후 검증 방법 제시.

### Rule 7 ★NEW★: 구현 전 계획 승인 필수

어떤 작업이든 구현 시작 전:
- 계획(plan) 문서를 먼저 작성하고 사용자 검토 요청
- "바로 구현하겠습니다" 절대 금지
- 계획 승인 후에만 코드 작성 시작

**이유:** 계획 없는 구현은 방향을 잃고, 나중에 다시 짜는 시간이 더 소요됨.

---

## 🎨 II. 코딩 규칙 및 컨벤션

### 네이밍 컨벤션

- **파일명 (컴포넌트)**: PascalCase → `ClassifyMatchModal.tsx`
- **파일명 (API/백엔드/api/backend)**: kebab-case → `remove-bg/route.ts`
- **변수/함수**: camelCase → `const productId`, `function extractColor()`
- **상수**: UPPER_SNAKE_CASE → `const MAX_FILE_SIZE = 5000000`
- **타입/인터페이스**: PascalCase → `interface OrderItem {}`
- **이벤트 핸들러**: handle 접두사 → `const handleClick = () => {}`

### 파일 상단 주석 (필수)

```typescript
/**
 * [파일 목적]
 * 한 줄 요약
 * WHY: 왜 필요한가
 * HOW: 어떻게 동작하는가
 * WHERE: 문제 발생 시 확인 위치
 */
```

### 코드 길이 제한 (유지관리 원칙)

**한 섹션 당 100줄 이내:**
- 함수: 100줄 이내
- 컴포넌트: 100줄 이내
- API 라우트/루트/백엔드 핸들러: 100줄 이내

**이유:**
- 가독성 향상: 한 화면에 전체 로직 파악 가능
- 유지보수 용이: 수정 범위 명확, 버그 추적 쉬움
- 코드 리뷰 효율: 리뷰어가 빠르게 이해 가능
- 재사용성 증가: 작은 단위로 분리하면 재사용 기회 증가

**100줄 초과 시 예시:**
```typescript
// ❌ 나쁜 예: 200줄짜리 거대 함수
function processOrderWithEverything() {
  // 검증 로직 50줄
  // 비즈니스 로직 100줄
  // DB 저장 로직 50줄
}

// ✅ 좋은 예: 역할별 분리
function validateOrder(order: Order) { /* 검증 로직 */ }
function calculateOrderAmount(order: Order) { /* 비즈니스 로직 */ }
function saveOrderToDb(order: Order) { /* DB 저장 로직 */ }
function processOrder(order: Order) {
  validateOrder(order);
  const amount = calculateOrderAmount(order);
  return saveOrderToDb({ ...order, amount });
}
```

**예외 허용 (단, 200줄 초과 금지):**
- 테이블 정의 (타입/스키마)
- 설정 파일 (config)
- 라우터/루터 정의

### 타입 안정성

- `any` 사용 금지 → 명시적 타입 선언
- 타입 가드 사용: `.filter((x): x is Type => x !== null)`
- nullable 체크: `if (!value) return`

### 에러 처리 (오류 처리)

```typescript
try {
  // 로직
  return NextResponse.json({ success: true, ... })
} catch (err) {
  const msg = err instanceof Error ? err.message : '알 수 없는 오류'
  console.error('[api-name] 실패:', msg)
  return NextResponse.json({ success: false, error: msg }, { status: 500 })
}
```

### 로깅 규칙 (로그/기록)

```typescript
console.log('[api-name] 시작')          // 시작
console.log('[api-name] 완료 (1.2s)')   // 성공
console.error('[api-name] 실패:', err)   // 에러/오류
```

### Git 커밋 메시지

```
feat: AI 사진 분류 색상 비교 추가
fix: 중복 매칭 버그 수정
docs: 인수인계 문서 작성
```

**타입**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

---

## 🔧 III. 스킬 자동활성화 시스템 ★NEW★ — 핵심 업그레이드

> **핵심 문제**: 스킬(Skills)은 설정해둬도 Claude가 알아서 사용하지 않는다.
> **해결책**: 훅(Hook/훅) 기반 자동 활성화 아키텍처로 강제 주입.

### 왜 스킬 자동활성화가 필요한가

스킬을 수천 줄 작성해도 Claude가 자동으로 참조하지 않으면 쓸모가 없다. 훅 시스템을 통해 프롬프트 제출 전에 관련 스킬을 강제로 컨텍스트에 주입해야 일관된 코드 품질이 유지된다.

**자동활성화 전:**
- 매번 "BEST_PRACTICES.md 확인해줘" 수동 지시 필요
- 스킬이 무시되어 패턴 불일치 코드 생성
- 레거시 패턴과 신규 패턴이 섞임

**자동활성화 후:**
- 프롬프트 입력 전 관련 스킬 자동 주입
- 일관된 패턴 준수
- 작업 완료 후 자기점검 자동 수행

### 훅 #1: UserPromptSubmit 훅 (프롬프트 제출 전 실행)

**역할**: 사용자 메시지를 Claude가 읽기 전에 관련 스킬을 컨텍스트에 주입

**작동 방식:**
1. 프롬프트에서 키워드/의도 패턴 분석
2. skill-rules.json에서 매칭되는 스킬 확인
3. Claude 컨텍스트에 스킬 활성화 알림 주입

**예시:**
```
사용자가 "레이아웃 시스템이 어떻게 작동하나요?" 입력
→ Claude가 메시지 읽기 전에 컨텍스트에 주입됨:
  "🎯 스킬 활성화 확인 - project-catalog-developer 스킬 사용"
```

### 훅 #2: Stop 이벤트 훅 (응답 완료 후 실행)

**역할**: Claude가 응답을 마친 후 편집된 파일을 분석하고 자기점검 알림 표시

**감지 항목:**
- try-catch 블록
- 데이터베이스(database/디비/DB) 작업
- 비동기(async) 함수
- 컨트롤러(controller) 파일

**출력 예시:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 오류 처리 자기점검
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  백엔드(backend) 변경 감지됨 - 2개 파일 편집됨
  ❓ catch 블록에 에러 캡처가 되어 있나요?
  ❓ DB 작업이 오류 처리로 감싸져 있나요?
  💡 모든 오류는 반드시 로그에 기록되어야 함
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### skill-rules.json 구성 예시

```json
{
  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": [
        "backend", "백엔드",
        "controller", "컨트롤러",
        "service", "서비스",
        "API", "에이피아이",
        "endpoint", "엔드포인트",
        "route", "라우트", "루트"
      ],
      "intentPatterns": [
        "(create|add|만들|추가).*?(route|endpoint|controller|라우트|컨트롤러)",
        "(how to|best practice|어떻게|방법).*?(backend|API|백엔드)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/src/**/*.ts",
        "백엔드/src/**/*.ts",
        "server/**/*.ts"
      ],
      "contentPatterns": ["router\\.", "export.*Controller"]
    }
  },
  "frontend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": [
        "frontend", "프론트엔드", "프론트",
        "component", "컴포넌트",
        "React", "리액트",
        "UI", "유아이",
        "화면", "페이지", "page"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["src/components/**/*.tsx", "src/app/**/*.tsx"]
    }
  },
  "database-verification": {
    "type": "guardrail",
    "enforcement": "block",
    "priority": "critical",
    "promptTriggers": {
      "keywords": [
        "database", "데이터베이스", "디비", "DB",
        "migration", "마이그레이션",
        "schema", "스키마",
        "Supabase", "수파베이스",
        "Prisma", "프리즈마"
      ]
    }
  }
}
```

### 스킬 파일 크기 원칙 (Anthropic 공식 권장)

| 구분 | 권장 크기 | 설명 |
|------|-----------|------|
| 메인 SKILL.md | **500줄 이내** | 핵심 개요와 리소스 파일 참조 |
| 리소스 파일 | 각 100~200줄 | 세부 패턴, 예시 코드 |

**잘못된 예 (기존 방식):**
```
frontend-dev-guidelines.md → 1,500줄 (❌ 너무 큼, 토큰 낭비)
```

**올바른 예 (개선된 방식):**
```
frontend-dev-guidelines/
  SKILL.md             → 398줄 (메인: 개요 + 리소스 참조)
  react-patterns.md    → 150줄 (React 19 패턴)
  component-rules.md   → 120줄 (컴포넌트 규칙)
  tanstack-query.md    → 140줄 (TanStack Query 패턴)
  mui-v7-patterns.md   → 130줄 (MUI v7 사용법)
  ... (총 10개 리소스 파일)
```

**토큰 효율**: 스킬 분리 후 대부분 쿼리에서 40~60% 토큰 절감.

### 권장 스킬 구성

```
스킬 목록/
├── 가이드라인 & 모범사례
│   ├── backend-dev-guidelines    # 백엔드/backend 개발 가이드
│   ├── frontend-dev-guidelines   # 프론트엔드/frontend 개발 가이드
│   └── skill-developer           # 새 스킬 만들기용 메타 스킬
├── 도메인별
│   ├── database-verification     # DB 컬럼명 오류 방지 (편집 차단)
│   ├── workflow-developer        # 워크플로우 엔진 패턴
│   └── notification-developer    # 알림/이메일 시스템 패턴
└── 프로젝트별
    └── project-catalog-developer # DataGrid 레이아웃 시스템
```

---

## 📁 IV. 개발문서 시스템 ★NEW★ — 컨텍스트 손실 방지

> **핵심 문제**: Claude는 극심한 기억상실이 있는 주니어 개발자처럼 컨텍스트를 잃으면 방향을 잃는다.
> **해결책**: 모든 대규모 작업에 대해 3개의 문서를 생성하고 지속적으로 업데이트한다.

### 왜 개발문서가 필수인가

계획 수립 후 컨텍스트가 소진되면 Claude는 맥락을 잃고 전혀 다른 방향으로 구현을 시작할 수 있다. 개발문서 시스템은 자동 압축(auto-compaction) 이후에도 작업 연속성을 보장한다.

### 3대 필수 문서

모든 주요 기능/작업 시작 시 다음 3개 파일을 **반드시** 생성:

```bash
mkdir -p ~/git/project/dev/active/{작업명}/
```

| 파일 | 역할 | 업데이트 시점 |
|------|------|---------------|
| `{작업명}-plan.md` | 승인된 구현 계획 전체 | 계획 변경 시 |
| `{작업명}-context.md` | 핵심 파일 경로, 결정 사항, 다음 단계 | 매 섹션 완료 시 |
| `{작업명}-tasks.md` | 작업 체크리스트 (완료/진행중/예정) | 작업 완료 즉시 |

### 대규모 작업 시작 프로토콜

```
1단계: 계획 모드(Plan Mode) 진입 또는 /pdca plan {feature} 실행
  ↓
2단계: 코드베이스 연구 및 포괄적 계획 수립
  → 경영진 요약(Executive Summary)
  → 구현 단계(Phases)
  → 세부 작업 목록
  → 위험 요소(Risks)
  → 성공 지표
  → 예상 일정
  ↓
3단계: 사용자가 계획 검토 및 승인
  ↓
4단계: 계획 승인 즉시 ESC키로 Claude 중단
  ↓
5단계: /create-dev-docs 또는 /dev-docs 슬래시 커맨드 실행
  → {작업명}-plan.md 생성
  → {작업명}-context.md 생성
  → {작업명}-tasks.md 생성
  ↓
6단계: 새 세션에서 "continue" 또는 "계속해" 입력 → 문서 기반 구현 시작
```

**⚠️ 중요**: 계획 수립 후 컨텍스트가 15% 이하로 떨어져도 괜찮다. 개발문서에 모든 정보가 담겨있으면 새 세션에서도 완전히 이어받을 수 있다.

### 작업 계속 프로토콜 (세션 재시작 시)

```bash
# 새 세션 시작 시 Claude가 반드시 먼저 실행:
1. /dev/active/ 폴더 확인
2. 3개 문서 모두 읽기
3. tasks.md에서 완료/미완료 항목 파악
4. context.md에서 다음 단계 확인
5. "계속해" 메시지로 작업 재개
```

### 세션 중 문서 업데이트 규칙

- 각 섹션(1~2개 작업) 완료 직후 tasks.md 즉시 업데이트
- 중요한 결정/발견 사항은 context.md에 즉시 기록
- 컨텍스트가 부족해지기 전 `/update-dev-docs` 실행
- 다음 세션을 위한 "다음 단계"를 context.md에 명확히 기록

### 구현 중 분할 원칙

한 번에 전체를 구현하지 말고 **섹션별로 나누어 구현**:

```
✅ 올바른 방식:
"1단계: 데이터베이스 스키마 변경만 먼저 구현해줘"
→ 구현 완료 → 코드 검토
→ "2단계: API 엔드포인트 구현해줘"
→ 구현 완료 → 코드 검토
→ "3단계: UI 연동해줘"

❌ 잘못된 방식:
"전체 기능 한 번에 구현해줘"
```

### 자기 코드 검토 주기

- 2~3개 섹션 구현 후 반드시 코드 검토 에이전트 실행
- 발견된 문제: 심각한 오류, 누락된 구현, 일관성 없는 코드, 보안 취약점
- `/code-review` 슬래시 커맨드 또는 code-architecture-reviewer 에이전트 활용

---

## ⚙️ V. 훅 파이프라인 ★NEW★ — 자동 품질 보증

> **목표**: 오류 없는(zero-error) 코드베이스 유지. 단 하나의 TypeScript 에러도 남기지 않는다.

### 전체 훅 파이프라인

```
Claude 응답 완료
  ↓
[훅 1] 파일 편집 추적기 실행
  → 어떤 파일이 편집됐는지 기록
  → 어느 레포/프로젝트에 속하는지 기록
  ↓
[훅 2] 빌드 체커(Build Checker) 실행
  → 편집된 레포에서 빌드 스크립트 실행
  → TypeScript 오류 스캔
  → 오류 5개 미만: Claude에게 직접 표시
  → 오류 5개 이상: auto-error-resolver 에이전트 실행 권장
  ↓
[훅 3] 오류 처리 리마인더 실행
  → 위험 패턴 감지 (try-catch, 비동기, DB 작업)
  → 자기점검 알림 표시
  ↓
결과: 깔끔하고 오류 없는 코드
```

### 훅 #1: 파일 편집 추적기

- 모든 Edit/Write/MultiEdit 작업 후 실행
- 편집된 파일 및 소속 레포 기록
- ⚠️ 편집마다 즉시 빌드 실행 금지 (비효율적)

### 훅 #2: 빌드 체커 (핵심)

**"오류를 단 하나도 남기지 않는다"는 원칙의 핵심 구현체**

```
편집 로그 읽기
  → 수정된 레포 목록 확인
  → 각 레포에서 빌드 스크립트 실행
  → TypeScript 에러 수 확인
  ↓
  오류 < 5개 → Claude에게 바로 표시, 즉시 수정
  오류 ≥ 5개 → auto-error-resolver 에이전트 실행 권장
```

**절대 금지:**
```
❌ "TypeScript 에러가 몇 개 있지만 관련 없는 것들이니 괜찮습니다"
→ 이 말은 존재하지 않는다. 모든 에러는 수정 대상이다.
```

### 훅 #3: 오류 처리 리마인더

위험 패턴 감지 시 Claude에게 자기점검 알림:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 오류 처리 자기점검
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  백엔드 변경 감지됨 (2개 파일)
  ❓ catch 블록에 에러 캡처가 있나요?
  ❓ DB 작업이 오류 처리로 감싸져 있나요?
  💡 모든 에러는 로그에 반드시 기록되어야 함
  💡 컨트롤러는 BaseController를 확장해야 함
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### ⚠️ Prettier 자동 포매터 경고

Prettier를 Stop 훅으로 자동 실행하면 파일 수정 시 `system-reminder`가 발생하고 컨텍스트를 대량 소모할 수 있다 (3라운드 만에 16만 토큰 소비 사례 있음).

**권장 방식:**
- 세션 중: Prettier 자동 실행 **비권장**
- 세션 종료 후: 수동으로 Prettier 실행

### 스킬에 유틸리티 스크립트 첨부

스킬 파일 내에 실제 사용 가능한 스크립트 참조 추가:

```markdown
### 인증 라우트(route/루트) 테스트

제공된 test-auth-route.js 스크립트를 사용하세요:
node scripts/test-auth-route.js http://localhost:3002/api/endpoint

이 스크립트가 처리하는 것:
- 리프레시 토큰 발급
- JWT 서명
- 쿠키 헤더 생성
- 인증된 요청 실행
```

**원칙**: Claude가 매번 스크립트를 새로 만드는 대신, 검증된 스크립트를 스킬에 연결해두어 재사용.

---

## 👥 VI. 에이전트 팀 모드 (필수)

### ⚠️ 절대 원칙: 서두르지 말고 최고의 도구 먼저 설정

**사용자가 가볍게 요청해도:**
- ❌ 즉시 코드 수정 시작 금지
- ✅ 먼저 에이전트 팀, 스킬스 등 **AI 능력을 극대화하는 도구** 설정

**설정 순서:**
1. `/pdca plan {feature}` 실행 (계획 수립)
2. `/pdca team {feature}` 실행 (팀 모드 시작)
3. CTO Lead가 전략 수립 후 팀원 배치
4. 그 다음 작업 시작

### ⛔ 팀 모드 해체 금지 원칙

**사용자가 명시적으로 다음을 말하기 전까지 절대 단독 행동 금지:**
- "에이전트 팀 해체해"
- "단독으로 수행해"
- "혼자서 해"

**모든 작업은 팀 단위로만 수행:**
```
❌ 절대 금지: Read → Edit → Write → "완료!"
✅ 필수: /pdca team {feature} → CTO Lead 전략 → 팀원 병렬 작업 → QA 검증 → 완료
```

### 전문 에이전트 군단 ★NEW★

**품질 관리:**
- `code-architecture-reviewer` — 모범 사례 준수 코드 리뷰
- `build-error-resolver` — TypeScript 오류 체계적 수정
- `refactor-planner` — 포괄적 리팩터링 계획 수립

**테스트 & 디버깅:**
- `auth-route-tester` — 인증(authentication)으로 백엔드 라우트 테스트
- `auth-route-debugger` — 401/403 오류 및 라우트 문제 디버깅
- `frontend-error-fixer` — 프론트엔드(frontend) 오류 진단 및 수정

**계획 & 전략:**
- `strategic-plan-architect` — 상세 구현 계획 수립 (경영진 요약, 단계, 위험, 성공 지표 포함)
- `plan-reviewer` — 구현 전 계획 검토
- `documentation-architect` — 문서 작성/업데이트

**특수:**
- `frontend-ux-designer` — 스타일링 및 UX 문제 수정
- `web-research-specialist` — 웹 조사 및 정보 수집
- `auto-error-resolver` — 다수 TypeScript 에러 일괄 수정

**에이전트 지시 원칙:**
- 매우 구체적인 역할 부여
- 반환해야 할 결과물 명확히 지정
- "수정했습니다!"만 반환하는 에이전트는 무용지물

### 팀 모드 필수 조건

다음 중 **하나라도** 해당하면 팀 모드 사용:

- [ ] Major Feature (1000자+ Plan)
- [ ] 여러 파일 수정 (3개 이상)
- [ ] 검증 필요 (테스트, QA)
- [ ] 리스크 높음 (DB 스키마 변경, 인증 시스템)
- [ ] 가벼워 보여도 실제론 복잡할 가능성
- [ ] 단일 파일 수정이라도 영향 범위가 넓은 경우

### 팀 모드 작업 플로우

```
1단계: 사용자 요청
  ↓
2단계: AI 판단 → "가벼워도 팀 모드!"
  ↓
3단계: /pdca plan {feature} 실행
  ↓
4단계: /pdca team {feature} 실행
  ↓
5단계: CTO Lead 전략 수립
  ↓
6단계: 팀원들 병렬 작업
  ↓
7단계: QA 검증
  ↓
8단계: 사용자 승인
  ↓
9단계: 사용자가 "팀 해체" 명령할 때까지 팀 유지
```

### 환경 설정

```bash
# .bashrc 또는 .zshrc에 추가
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## 🖥️ VII. PM2 프로세스 관리 ★NEW★

> **대상**: 여러 백엔드(backend) 마이크로서비스를 동시에 운영하는 프로젝트

### 왜 PM2인가

여러 마이크로서비스가 동시에 돌아갈 때 Claude가 서비스 로그를 실시간으로 볼 수 없으면, 사람이 매번 로그를 복사해서 붙여넣어야 한다. PM2를 통해 Claude가 자율적으로 로그를 읽고 디버깅할 수 있다.

**PM2 도입 전:**
```
나: "이메일 서비스에서 오류가 발생하고 있어요"
나: [수동으로 로그 찾아서 복사]
나: [채팅에 붙여넣기]
Claude: "분석해볼게요..."
```

**PM2 도입 후:**
```
나: "이메일 서비스에서 오류가 발생하고 있어요"
Claude: pm2 logs email --lines 200
Claude: "데이터베이스(database) 연결 타임아웃 발견"
Claude: pm2 restart email
Claude: "재시작 완료, 모니터링 중..."
```

### PM2 기본 설정

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'form-service',
      script: 'npm',
      args: 'start',
      cwd: './form',
      error_file: './form/logs/error.log',
      out_file: './form/logs/out.log',
    },
    // 추가 서비스들...
  ]
};
```

### PM2 핵심 명령어

```bash
pnpm pm2:start          # 전체 서비스 시작
pm2 logs {서비스명}      # 실시간 로그 확인
pm2 logs email --lines 200  # 최근 200줄 로그
pm2 restart {서비스명}   # 서비스 재시작
pm2 stop all            # 전체 중지
pm2 monit               # CPU/메모리 모니터링
pm2 status              # 전체 서비스 상태
```

### PM2 사용 시 주의사항

- **핫 리로드(Hot Reload) 불가**: PM2 환경에서는 코드 변경 시 자동 새로고침이 안 됨
- **프론트엔드(frontend)는 별도**: 프론트는 `pnpm dev`로 따로 실행
- **백엔드(backend) 전용**: 핫 리로드가 자주 필요하지 않은 서비스에 최적

---

## 📋 VIII. Claude Code 명령어 체계

### PDCA 워크플로우

```bash
/pdca plan {feature}    # 계획 수립
/pdca design {feature}  # 설계 문서 작성
/pdca do {feature}      # 구현
/pdca analyze {feature} # Gap 분석
/pdca iterate {feature} # 자동 개선 반복
/pdca report {feature}  # 완료 보고서
/pdca status            # 현재 상태 확인
/pdca next              # 다음 단계 가이드
/pdca team {feature}    # 팀 모드 시작
/pdca team status       # 팀 상태 확인
/pdca team cleanup      # 팀 정리
```

### 개발문서 슬래시 커맨드 ★NEW★

```bash
/dev-docs               # 포괄적 전략 계획 수립 (plan + context + tasks 생성)
/dev-docs-update        # 세션 종료 전 개발문서 업데이트
/create-dev-docs        # 승인된 계획을 개발문서 파일로 변환
/update-dev-docs        # 압축(compaction) 전 문서 최신화
```

### 품질 & 리뷰 슬래시 커맨드 ★NEW★

```bash
/code-review            # 아키텍처 코드 리뷰
/build-and-fix          # 빌드 실행 및 모든 오류 일괄 수정
/zero-script-qa         # 로그 기반 QA (테스트 스크립트 없이)
```

### 테스트 슬래시 커맨드 ★NEW★

```bash
/route-research-for-testing   # 영향받은 라우트 찾고 테스트 실행
/test-route                   # 특정 인증(auth) 라우트 테스트
```

### 9단계 개발 파이프라인

```bash
/phase-1-schema         # 용어/스키마(schema) 정의
/phase-2-convention     # 코딩 규칙 설정
/phase-3-mockup         # UI 목업(mockup) 작성
/phase-4-api            # API 설계
/phase-5-design-system  # 디자인 시스템
/phase-6-ui-integration # UI-API 통합
/phase-7-seo-security   # SEO/보안 강화
/phase-8-review         # 전체 리뷰
/phase-9-deployment     # 배포(deployment)
```

### 프로젝트 레벨

```bash
/starter     # 정적 웹사이트 (HTML/CSS/JS)
/dynamic     # 동적 웹앱 (bkend.ai BaaS 사용)
/enterprise  # 엔터프라이즈 (Kubernetes, Terraform)
```

### 기타

```bash
/bkit                   # 전체 기능 목록 확인
/output-style-setup     # 출력 스타일 설정
/code-review            # 코드 리뷰
```

---

## 🔐 IX. Supabase 인증 및 DB 관리

### 인증(Authentication) 시스템 설정

#### 1. Supabase Auth 활성화

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. **Authentication** → **Providers** → **Email** 활성화
3. 개발 환경: **Confirm email** OFF (프로덕션: ON)

#### 2. 임직원 계정 생성 (SQL)

```sql
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'staff@company.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"role": "staff", "name": "홍길동"}'::jsonb,
  NOW(), NOW()
);
```

#### 3. 인증 헬퍼 함수

```typescript
// lib/auth/staff-auth.ts
export async function isStaffUser(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const role = user.user_metadata?.role;
  return role === 'staff' || role === 'admin';
}
```

### DB 마이그레이션(Migration)

#### 컬럼 추가 예시

```sql
-- orders 테이블에 seller_tier 컬럼 추가
ALTER TABLE orders
ADD COLUMN seller_tier VARCHAR(20) DEFAULT 'general'
CHECK (seller_tier IN ('general', 'employee', 'vip'));

CREATE INDEX idx_orders_seller_tier ON orders(seller_tier);
COMMENT ON COLUMN orders.seller_tier IS '셀러 등급: general(일반 25%), employee(임직원 20%), vip(VIP 20%)';
```

#### 롤백 (문제 발생 시)

```sql
ALTER TABLE orders DROP COLUMN seller_tier;
DROP INDEX IF EXISTS idx_orders_seller_tier;
```

---

## 📊 X. 프로젝트별 중요 사항

### classic-menswear-v2 (위탁판매 플랫폼)

- **AI 분류**: Claude Sonnet 4 + All-at-once 방식이 검증됨 (배치 분할 시 품질 저하)
- **사진 편집**: 캔버스 정중앙 배치로 상하좌우 균등 여백 유지
- **프롬프트**: 간결한 방식(~80줄)이 효과적 (초장문은 오히려 혼란)
- **위탁 수수료**: 일반 25%, 임직원/VIP 20%

### 환경 변수 필수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

### 개발 서버 실행

```bash
npm run dev             # 개발 서버
npm run build           # 프로덕션 빌드
npm run start           # 프로덕션 서버
pnpm pm2:start          # 백엔드 서비스 전체 시작 (PM2)
```

---

## ⛔ XI. 절대 금지 사항

### 1. 변명 금지

- "~일 것 같습니다" → 테스트로 확인
- "이전에 됐을 텐데요" → Git 히스토리 확인
- "추측하기로는" → 데이터 기반 분석
- **"TypeScript 에러가 있지만 관련 없습니다"** → 이 문장 자체가 위반

### 2. 즉흥 수정 금지 (최우선)

- **단독 행동 절대 금지**: 사용자가 "팀 해체" 명령 전까지 무조건 팀 모드
- **서두르기 금지**: 가벼운 요청이라도 도구 설정 먼저
- Git 히스토리 확인 없이 변경 → Rule 1 위반
- 증거 없이 "버그" 판단 → Rule 2 위반

```
❌ 사용자: "버튼 색상 바꿔줘"
   AI: "네, 바로 수정하겠습니다" → Read → Edit → Write

✅ 사용자: "버튼 색상 바꿔줘"
   AI: "먼저 PDCA 계획과 팀 모드를 설정하겠습니다"
   → /pdca plan button-color
   → /pdca team button-color
   → CTO Lead 전략 수립 → 팀원들 작업
```

### 3. 과도한 복잡화 금지

- 간단한 해결책 무시 → Rule 5 위반
- 불필요한 추상화 → 복잡도 정당화 필요
- 3개 이상 동시 변경 → Rule 4 위반

### 4. 스킬 무시 금지 ★NEW★

- 스킬 자동활성화 훅이 있어도 수동으로 스킬 확인 안 하는 행위 금지
- SKILL.md를 500줄 이상으로 만드는 행위 금지
- 스킬에 있는 패턴을 "창의적으로 해석"해서 다른 방식으로 구현 금지

### 5. 개발문서 없이 대규모 작업 시작 금지 ★NEW★

- 3개 파일 (plan/context/tasks) 없이 주요 기능 구현 시작 금지
- 세션 종료 전 개발문서 업데이트 없이 압축(compaction) 진행 금지
- "기억하고 있으니 괜찮다"는 판단으로 문서 생략 금지

### 6. 오류를 남기고 넘어가는 행위 금지 ★NEW★

- TypeScript 빌드 에러를 "나중에 수정"으로 미루기 금지
- "관련 없는 에러"로 분류해서 무시 금지
- 훅이 에러를 보고하면 반드시 즉시 수정

---

## ✅ XII. 체크리스트

### 사용자 요청 받았을 때 (최우선)

- [ ] **서두르지 않았는가?** → 가벼운 요청이라도 도구 설정 먼저
- [ ] **팀 모드 확인했는가?** → 사용자가 "팀 해체" 명령했는가?
  - NO → 무조건 팀 모드
  - YES → 단독 작업 가능 (하지만 비권장)
- [ ] **개발문서 확인했는가?** → `/dev/active/` 폴더에 기존 작업 문서가 있는가? ★NEW★
- [ ] **/pdca plan 실행했는가?** → 계획 수립 필수
- [ ] **/pdca team 실행했는가?** → 팀 모드 시작 필수

### 코드 작성 전

- [ ] Git 히스토리 확인했는가? (Rule 1)
- [ ] 문제 증거를 확보했는가? (Rule 2)
- [ ] 이전에 작동한 버전을 확인했는가? (Rule 3)
- [ ] 한 번에 하나만 변경하는가? (Rule 4)
- [ ] 복잡도 증가를 정당화했는가? (Rule 5)
- [ ] 추측 없이 데이터 기반인가? (Rule 6)
- [ ] **계획이 사용자에게 승인됐는가?** (Rule 7) ★NEW★
- [ ] **함수/컴포넌트가 100줄 이내인가?**
- [ ] **관련 스킬이 활성화됐는가?** ★NEW★

### 작업 중

- [ ] 섹션별로 나눠서 구현하고 있는가? ★NEW★
- [ ] tasks.md를 작업 완료 즉시 업데이트하고 있는가? ★NEW★
- [ ] context.md에 중요 결정 사항을 기록하고 있는가? ★NEW★
- [ ] 주기적으로 코드 리뷰 에이전트를 실행하는가? ★NEW★

### 작업 완료 후

- [ ] 빌드 에러가 하나도 없는가? ★NEW★
- [ ] PDCA 문서 작성했는가?
- [ ] Gap 분석 90% 이상인가?
- [ ] 테스트 통과했는가?
- [ ] Git 커밋 메시지 규칙 준수했는가?
- [ ] **개발문서 최종 업데이트했는가?** ★NEW★
- [ ] **팀 모드 유지 중인가?** → 사용자가 "팀 해체" 명령할 때까지

---

## 🔥 XIII. 문제 해결 패턴

### "이전에는 됐는데..."

1. `git log --oneline {파일}` 실행
2. 마지막 작동 커밋 찾기
3. `git show {커밋}:{파일}` 로 비교
4. 차이점 분석 후 복원

### "에러가 나요"

1. 에러 로그 전체 복사
2. 스택 트레이스(stack trace) 분석
3. 재현 단계 문서화
4. 증거 기반 원인 분석
5. **PM2가 설정되어 있다면**: `pm2 logs {서비스} --lines 200` 먼저 실행 ★NEW★

### "복잡한 작업인데..."

1. `/pdca plan {feature}` 실행
2. 개발문서 3개 파일 생성 ★NEW★
3. 팀 모드 필요성 확인
4. `/pdca team {feature}` 시작
5. CTO Lead에게 오케스트레이션 위임
6. 섹션별로 나눠서 구현 ★NEW★

### "컨텍스트가 15% 이하로 떨어졌어요" ★NEW★

1. 즉시 `/update-dev-docs` 실행
2. context.md에 현재 상태 및 다음 단계 기록
3. tasks.md 최신화
4. 압축(compaction) 진행
5. 새 세션에서 "continue" 입력

### "여러 TypeScript 에러가 발생했어요" ★NEW★

1. 에러 수 확인
2. 5개 미만: Claude가 직접 수정
3. 5개 이상: `auto-error-resolver` 에이전트 실행
4. 빌드 재실행으로 에러 0개 확인

---

## 💡 XIV. 핵심 원칙 요약 (암기 필수)

### 1. 서두르지 말기
- 가벼운 요청이라도 → 도구 설정 먼저
- "빨리 끝내자" → 실수하면 더 느림
- **최고의 도구 먼저, 작업은 나중**

### 2. 팀 모드 우선
- 사용자가 "팀 해체" 명령 전까지 → 무조건 팀 모드
- 단독 작업 절대 금지
- 가벼워 보여도 → 팀 모드로 시작

### 3. PDCA 필수
```
/pdca plan → /pdca team → 작업 시작
```

### 4. 스킬 자동활성화 + 훅 ★NEW★
```
프롬프트 제출 전 → 관련 스킬 자동 주입
작업 완료 후 → 빌드 체크 + 자기점검
오류 발생 → 즉시 수정, 절대 미루지 않음
```

### 5. 개발문서 3총사 ★NEW★
```
plan.md + context.md + tasks.md = 컨텍스트 손실 방지
세션이 바뀌어도 "continue" 한 마디로 이어받기 가능
```

### 6. Git 히스토리 확인
- 코드 변경 전 → 반드시 `git log` 확인
- 증거 없이 추측 금지

### 7. 데이터 기반 판단
- "~일 것 같다" 금지
- 테스트로 확인, 로그로 검증

### 8. 코드 길이 제한
- **한 섹션 당 100줄 이내** (함수, 컴포넌트, API/백엔드 핸들러)
- 100줄 초과 시 → 역할별 분리

### 9. 오류 제로 원칙 ★NEW★
- TypeScript 에러를 단 하나도 남기지 않는다
- "관련 없는 에러" 개념 자체가 없다
- 훅이 에러를 보고하면 → 즉시 수정

### 10. 팀 해체는 사용자만
- AI가 임의로 팀 해체 절대 금지
- 사용자 명시적 명령 있을 때만 해체

---

## 📚 부록: 주요 명령어 치트시트

```bash
# ============================================
# 개발문서 (Dev Docs) ★NEW★
# ============================================
/dev-docs                     # 전략 계획 + 문서 생성
/dev-docs-update              # 세션 종료 전 업데이트
/create-dev-docs              # 계획을 문서 파일로 변환
/update-dev-docs              # 압축 전 문서 최신화

# ============================================
# PDCA
# ============================================
/pdca plan {feature}
/pdca design {feature}
/pdca do {feature}
/pdca analyze {feature}
/pdca iterate {feature}
/pdca report {feature}
/pdca team {feature}
/pdca team status
/pdca team cleanup

# ============================================
# 품질 & 테스트 ★NEW★
# ============================================
/code-review                  # 아키텍처 리뷰
/build-and-fix                # 빌드 + 일괄 수정
/zero-script-qa               # 로그 기반 QA
/route-research-for-testing   # 라우트 테스트 조사
/test-route                   # 인증 라우트 테스트

# ============================================
# PM2 (백엔드/backend 서비스 관리) ★NEW★
# ============================================
pnpm pm2:start
pm2 logs {서비스명} --lines 200
pm2 restart {서비스명}
pm2 stop all
pm2 monit
pm2 status

# ============================================
# 파이프라인
# ============================================
/phase-1-schema
/phase-2-convention
/phase-3-mockup
/phase-4-api
/phase-5-design-system
/phase-6-ui-integration
/phase-7-seo-security
/phase-8-review
/phase-9-deployment

# ============================================
# 레벨
# ============================================
/starter
/dynamic
/enterprise

# ============================================
# Git
# ============================================
git log --oneline {파일}
git show {커밋}:{파일}
git diff HEAD~1 {파일}

# ============================================
# Supabase
# ============================================
supabase db push
supabase db execute -f {sql파일}
```

---

**문서 버전**: 2.0
**최종 업데이트**: 2026-02-24
**변경 사항**:
- v1.0~v1.2: 기본 규칙, 팀 모드, 코드 길이 제한
- **v2.0: 스킬 자동활성화 시스템, 개발문서 시스템, 훅 파이프라인, PM2 통합, 전문 에이전트 군단, 오류 제로 원칙 추가**

**다음 업데이트**: 프로젝트 경험 축적 시

---

**클로드코드교리 v2.0 끝**
