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

## 옮기는 순서

작업 중에는 로그인과 풀이 등록을 멈춥니다. 데이터가 작아 30분 안에 끝납니다.

### 1. 현재 데이터 백업

```bash
supabase db dump --db-url "<기존 프로젝트 연결 문자열>" --data-only -f backup-data.sql
supabase db dump --db-url "<기존 프로젝트 연결 문자열>" -f backup-schema.sql
```

사진 6개도 내려받습니다. Storage > `proof-evidence`에서 폴더째 다운로드합니다.

### 2. 새 프로젝트에 스키마 적용

저장소의 마이그레이션을 순서대로 올립니다.

```bash
supabase link --project-ref <새 프로젝트 ref>
supabase db push
```

`supabase_migrations.schema_migrations`에 13개 버전이 모두 들어갔는지 확인합니다.

### 3. 데이터 넣기

트리거가 그대로면 이관이 깨집니다.

- `handle_new_user`: `auth.users`를 넣으면 `profiles`가 자동 생성돼 중복 충돌
- `create_owner_membership`: `groups`를 넣으면 `OWNER` 멤버가 자동 생성돼 중복 충돌
- `apply_proof_review`: `proof_reviews`를 넣으면 `PENDING`이 아니라며 예외

그래서 복제 모드로 트리거를 끄고 넣습니다.

```sql
begin;
set session_replication_role = replica;
-- 여기서 backup-data.sql의 INSERT를 실행합니다.
set session_replication_role = origin;
commit;
```

넣는 순서는 `auth.users` → `auth.identities` → `profiles` → `groups` → `group_members` → `group_invite_codes` → `proofs` → `proof_reviews` → `storage.objects`입니다.

### 4. 사진 올리기

`proof-evidence` 버킷에 1단계에서 내려받은 파일을 **같은 경로 그대로** 올립니다. 경로는 `<group_id>/<user_id>/<파일명>` 형식이며 `proofs.evidence_path`와 정확히 일치해야 화면에 뜹니다.

### 5. GitHub 로그인 연결

- 새 프로젝트에서 Authentication > Providers > GitHub 활성화, Client ID와 Secret 입력
- GitHub OAuth App의 Authorization callback URL을 새 주소로 바꿉니다: `https://<새 ref>.supabase.co/auth/v1/callback`
- Authentication > URL Configuration에 Site URL(운영 주소)과 Redirect URLs(`https://coding-test-verification.vercel.app/auth/callback**`, `http://localhost:3000/auth/callback**`)를 등록합니다

### 6. Vercel 환경변수와 리전

Production 환경변수를 새 프로젝트 값으로 바꿉니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<새 ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<새 publishable key>
```

`vercel.json`의 리전을 서울로 바꾸고 배포합니다.

```json
{ "regions": ["icn1"] }
```

**환경변수를 먼저 바꾸고 배포해야 합니다.** 순서가 바뀌면 서울 함수가 시드니 DB를 보게 되어 아주 느려집니다.

## 검증

이관 직후 아래 건수가 이전과 같아야 합니다(2026-09-08 기준).

| 대상 | 건수 |
|---|---|
| `auth.users` | 6 |
| `auth.identities` | 6 |
| `public.profiles` | 6 |
| `public.groups` | 1 |
| `public.group_members` | 6 |
| `public.proofs` | 6 |
| `public.proof_reviews` | 6 |
| `public.group_invite_codes` | 1 |
| `storage.objects` (`proof-evidence`) | 6 (합계 290,723 bytes) |

값도 함께 봅니다.

- 닉네임 6개: `홍예슬`, `예비백수`, `김준석`, `angyeongjin`, `Apeirogon99`, `swprk`
- `profiles.github_login`이 모두 채워져 있고 소문자인지
- 그룹 `coding-study`의 `OWNER`가 `홍예슬`이고 나머지 5명이 `REVIEWER`·`ACTIVE`인지
- 승인 5건, 반려 1건인지
- 브라우저에서 GitHub 로그인 → 그룹 화면 → 사진이 보이는지

TTFB도 다시 잽니다. `x-vercel-id`가 `icn1::icn1`로 바뀌어야 합니다.

```bash
curl -s -o /dev/null -w "%{time_starttransfer}\n" https://coding-test-verification.vercel.app/
```

## 되돌리기

새 프로젝트에 문제가 생기면 Vercel 환경변수를 기존 값으로 되돌리고 `vercel.json`을 `syd1`로 바꿔 배포하면 즉시 복구됩니다. **기존 프로젝트는 검증이 끝날 때까지 지우지 않습니다.** 일시정지(Pause)도 하지 않습니다.

이전 기간에 새로 올라온 기록이 있으면 되돌릴 때 유실되므로, 작업은 아무도 쓰지 않는 시간에 합니다.

## 자동화하지 못한 이유

- Supabase 커넥터가 이 프로젝트 하나에만 묶여 있습니다. `create_project`·`list_projects`가 없고 모든 도구에 프로젝트 지정 인자가 없어, 새 프로젝트를 만들거나 거기에 SQL을 실행할 수 없습니다.
- GitHub OAuth Client Secret과 DB 비밀번호는 자격증명이라 대신 입력하지 않습니다.
- Storage 파일 내려받기와 올리기에는 관리자 키가 필요합니다.
- Vercel MCP는 `hongyeseuls-projects` 스코프 권한이 없어(`list_teams` 빈 배열, `get_project` 403) 환경변수와 리전을 대신 바꿀 수 없습니다.
