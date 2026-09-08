# 리전 이전 절차 (시드니 → 서울)

목표는 Supabase 프로젝트와 Vercel 함수를 모두 서울로 옮겨 TTFB를 줄이는 것입니다.

## 왜 옮기는가

2026-09-08 한국에서 측정한 값입니다.

| 요청 | 응답 | 처리 위치 |
|---|---|---|
| 정적 CSS | 16ms | `icn1` (서울 엣지) |
| HTML `/` | 273ms | `icn1::syd1` (서울 엣지 → 시드니 함수) |

차이 약 257ms가 서울↔시드니 왕복입니다. `vercel.json`의 `syd1`은 Supabase가 시드니라서 고른 값이므로, 함수만 옮기면 그룹 화면의 순차 DB 대기 8단계가 전부 국제 왕복이 되어 더 느려집니다. **둘을 함께 옮겨야 합니다.**

예상 결과는 TTFB 273ms → 50~100ms입니다.

## 옮기기 전에 준비할 것

무료 플랜은 프로젝트 리전을 바꿀 수 없어 **새 프로젝트를 만들고 데이터를 옮깁니다.**

- 새 Supabase 프로젝트 (리전 `ap-northeast-2`, 서울)
- 두 프로젝트의 DB 접속 문자열 (Supabase 대시보드 > Connect)
- GitHub OAuth App의 Client ID와 Client Secret
- Vercel 프로젝트 환경변수 수정 권한
- Supabase CLI (`brew install supabase/tap/supabase`)

## 진행 상황

### 끝난 것

새 프로젝트 `coding-test-verification-seoul` (`dzibporiiexvsndungkx`, `ap-northeast-2`)을 만들고 스키마와 데이터를 모두 옮겼습니다.

- 마이그레이션 13개 적용. `supabase_migrations.schema_migrations` 버전을 저장소 파일명과 일치시켰습니다.
- 스키마 대조: 컬럼 67, 제약 53, 정책 25, 인덱스 24, 컬럼 권한 128이 기존과 **완전히 동일**합니다. 함수 25개는 주석과 공백을 제외한 로직 지문이 양쪽 모두 `c928e854…`로 같습니다. 기존 프로젝트에는 저장소 파일보다 압축된 형식으로 적용된 함수가 있어 원문 자체는 다르지만 동작은 같습니다.
- 데이터 이관: `auth.users` 6, `auth.identities` 6, `profiles` 6, `groups` 1, `group_members` 6, `group_invite_codes` 1, `proofs` 6, `proof_reviews` 6. 값 단위 지문이 양쪽 모두 `6d7ef706…`로 **일치**합니다.
- 트리거가 이관을 깨뜨리지 않도록 `session_replication_role = replica`로 넣고 끝나면 `origin`으로 되돌렸습니다.
- `proof-evidence` 버킷이 비공개, 300KB 상한, JPEG·PNG·WebP 설정으로 만들어졌습니다.
- 사진 6개(합계 290,723바이트)를 옮겼습니다. 두 프로젝트에 임시 Edge Function을 올려 각자의 서비스 키로 내려받고 올리는 방식이라 버킷을 공개로 바꾸거나 키를 밖으로 꺼내지 않았습니다. 6개 모두 `proofs.evidence_path`와 연결됩니다.
- 보안 권고가 기존 프로젝트와 동일합니다. 새로 생긴 항목이 없습니다.
- 새 프로젝트도 JWT 서명이 ES256(비대칭)이라 `getClaims()`의 로컬 검증 최적화가 그대로 동작합니다.

### 전환 (2026-09-08)

운영이 새 프로젝트를 보도록 바꿨습니다.

- **Supabase Authentication > Providers > GitHub**: 활성화하고 기존 Client ID `Ov23liIwWdivH1MGoMkG`를 넣었습니다. Client Secret은 소유자가 직접 입력했습니다.
- **Supabase Authentication > URL Configuration**: Site URL `https://coding-test-verification.vercel.app`, Redirect URLs `https://coding-test-verification.vercel.app/auth/callback**`와 `http://localhost:3000/auth/callback**`.
- **GitHub OAuth App**: 기존 콜백을 지우지 않고 `https://dzibporiiexvsndungkx.supabase.co/auth/v1/callback`을 **추가**했습니다. OAuth App은 콜백을 10개까지 등록할 수 있어서, 구·신 프로젝트가 동시에 로그인 가능한 상태가 유지되고 롤백 시 GitHub 설정을 되돌릴 필요가 없습니다. 와일드카드 매칭은 켜지 않았습니다.
- **Vercel 환경변수(Production)**: `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 새 프로젝트 값으로 교체했습니다. `NEXT_PUBLIC_SITE_URL`은 그대로입니다.
- **`vercel.json`**: `syd1` → `icn1`. 환경변수는 다음 배포부터 적용되므로 이 커밋 하나로 DB 전환과 리전 전환이 같은 배포에 함께 실렸습니다.

### 결과

`x-vercel-id`가 `icn1::syd1` → `icn1::icn1`로 바뀌었습니다.

측정 당시 네트워크가 이전 측정 때보다 느려서 절대값끼리는 비교할 수 없습니다. 엣지 캐시에서 바로 나오는 정적 자산을 기준선으로 두고 **함수가 더하는 시간**으로 비교합니다.

| 항목 | 이전 (`icn1::syd1`) | 지금 (`icn1::icn1`) |
|---|---|---|
| 정적 자산 (엣지 HIT) | 16ms | 62ms (기준선) |
| HTML `/` | 273ms | 179ms (중앙값, n=20) |
| **함수가 더하는 시간** | **약 257ms** | **약 117ms** |

정적으로 프리렌더되는 `/dashboard`가 207ms로 함수가 렌더하는 `/`와 사실상 같습니다. 함수 렌더가 더 이상 정적 서빙보다 눈에 띄게 느리지 않다는 뜻입니다.

남은 117ms는 국제 왕복이 아니라 함수 자체의 렌더 시간과 서울 안에서의 DB 왕복입니다. 더 줄이려면 그룹 화면의 순차 DB 대기를 줄이는 쪽을 봐야 합니다.

### 검증

운영에서 확인한 것입니다.

- GitHub 로그인 → 대시보드 → 그룹 화면까지 통과. 이미 인가된 앱이라 동의 화면 없이 넘어갑니다.
- 멤버 6명, 기록 6건(승인 5·반려 1), 문제 링크 1건, 멤버 관리 목록이 이전과 같습니다.
- 증빙 사진이 새 프로젝트가 발급한 서명 URL로 열립니다(1548×402 PNG).
- 프로필 저장 동작. 값을 바꾸지 않고 같은 값으로 저장해 `profiles.updated_at`만 갱신되는 것을 확인했습니다.
- 새 프로젝트 행 수가 이관 전과 동일합니다: `auth.users` 6, `auth.identities` 6, `profiles` 6, `groups` 1, `group_members` 6, `group_invite_codes` 1, `proofs` 6, `proof_reviews` 6, `storage.objects` 6.

### 정리할 것

사진을 옮기려고 임시 Edge Function을 배포했다가 내용을 비우고 `verify_jwt`를 켜 401을 반환하게 해뒀습니다. 동작하지 않지만 대시보드에서 지워두면 깔끔합니다. MCP에 Edge Function 삭제 도구가 없어 대시보드에서 지워야 합니다.

- 기존 프로젝트: `migrate-export`
- 새 프로젝트: `migrate-import`

Vercel 대시보드에서 Speed Insights를 켜야 합니다. `@vercel/speed-insights` 패키지만으로는 수집이 시작되지 않습니다.

## 되돌리기

새 프로젝트에 문제가 생기면 Vercel 환경변수를 기존 값으로 되돌리고 `vercel.json`을 `syd1`로 바꿔 배포하면 복구됩니다. GitHub OAuth App은 기존 콜백을 남겨뒀으므로 손댈 필요가 없습니다. **기존 프로젝트는 검증이 끝날 때까지 지우지 않습니다.** 일시정지(Pause)도 하지 않습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://lfukmjprduxmesciplrx.supabase.co
```

전환 이후 새로 올라온 기록은 되돌릴 때 유실됩니다. 되돌릴 일이 생기면 새 프로젝트에서 그 기간의 행을 먼저 확인합니다.

세션은 이관하지 않았습니다. 프로젝트마다 JWT 서명 키가 달라서 전환 시점에 전원 로그아웃되고 다시 로그인해야 합니다.

## 자동화하지 못한 이유

- Supabase 커넥터가 두 개 붙어 있습니다. 하나는 기존 프로젝트에 고정돼 있고, 다른 하나는 `create_project`와 프로젝트 지정 `execute_sql`을 제공합니다. 프로젝트 생성·스키마 적용·데이터 이관은 후자로 처리했습니다.
- GitHub OAuth Client Secret과 DB 비밀번호는 자격증명이라 대신 입력하지 않습니다.
- Storage 파일 내려받기와 올리기에는 관리자 키가 필요합니다.
- Vercel MCP에는 환경변수를 다루는 도구가 없고 `hongyeseuls-projects` 스코프에도 접근하지 못합니다. 환경변수는 대시보드를 브라우저로 조작해 입력하고, 저장 버튼만 소유자가 눌렀습니다.
