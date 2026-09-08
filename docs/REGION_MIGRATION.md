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
- 새 프로젝트도 JWT 서명이 ES256(비대칭)이라 `getClaims()`의 로컬 검증 최적화가 그대로 동작합니다.

기존 프로젝트는 **그대로 살아 있고 운영도 아직 기존 프로젝트를 봅니다.**

### 남은 것

아래는 자격증명이나 파일 업로드가 필요해 직접 하셔야 합니다. **순서대로** 진행합니다.

**1. 사진 6개 옮기기**

기존 프로젝트 Storage > `proof-evidence`에서 폴더째 내려받아 새 프로젝트의 같은 버킷에 **같은 경로 그대로** 올립니다. 경로가 `proofs.evidence_path`와 정확히 같아야 화면에 뜹니다. 합계 290,723바이트입니다.

메타데이터 행은 일부러 넣지 않았습니다. 파일을 올리면 Supabase가 알아서 만들며, 미리 넣으면 업로드가 충돌합니다.

**2. GitHub 로그인 연결**

- 새 프로젝트 Authentication > Providers > GitHub 활성화, 기존과 같은 Client ID·Secret 입력
- GitHub OAuth App의 callback URL을 `https://dzibporiiexvsndungkx.supabase.co/auth/v1/callback`로 변경
- Authentication > URL Configuration에 Site URL `https://coding-test-verification.vercel.app`, Redirect URLs `https://coding-test-verification.vercel.app/auth/callback**`와 `http://localhost:3000/auth/callback**` 등록

**3. Vercel 환경변수 교체**

Production의 `NEXT_PUBLIC_SUPABASE_URL`을 `https://dzibporiiexvsndungkx.supabase.co`로, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 새 프로젝트의 publishable key로 바꿉니다.

**4. 리전 전환 배포**

3번까지 끝난 뒤에 `vercel.json`을 `{ "regions": ["icn1"] }`로 바꿔 배포합니다. **순서를 바꾸면 서울 함수가 시드니 DB를 보게 되어 지금보다 느려집니다.**

## 되돌리기

새 프로젝트에 문제가 생기면 Vercel 환경변수를 기존 값으로 되돌리고 `vercel.json`을 `syd1`로 바꿔 배포하면 즉시 복구됩니다. **기존 프로젝트는 검증이 끝날 때까지 지우지 않습니다.** 일시정지(Pause)도 하지 않습니다.

이전 기간에 새로 올라온 기록이 있으면 되돌릴 때 유실되므로, 작업은 아무도 쓰지 않는 시간에 합니다.

## 자동화하지 못한 이유

- Supabase 커넥터가 두 개 붙어 있습니다. 하나는 기존 프로젝트에 고정돼 있고, 다른 하나는 `create_project`와 프로젝트 지정 `execute_sql`을 제공합니다. 프로젝트 생성·스키마 적용·데이터 이관은 후자로 처리했습니다.
- GitHub OAuth Client Secret과 DB 비밀번호는 자격증명이라 대신 입력하지 않습니다.
- Storage 파일 내려받기와 올리기에는 관리자 키가 필요합니다.
- Vercel MCP는 `hongyeseuls-projects` 스코프 권한이 없어(`list_teams` 빈 배열, `get_project` 403) 환경변수와 리전을 대신 바꿀 수 없습니다.
