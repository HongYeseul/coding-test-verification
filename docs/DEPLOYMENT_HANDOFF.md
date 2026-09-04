# 배포 인수인계

마지막 확인: 2026-09-05

## 운영 연결

- GitHub: `HongYeseul/coding-test-verification` (Private, `main`)
- Vercel: `hongyeseuls-projects/coding-test-verification`
- Vercel 프로젝트 ID: `prj_F67rErRW8oBwkLTComzHn4g23qzi`
- 운영 URL: https://coding-test-verification.vercel.app
- Supabase 프로젝트: `lfukmjprduxmesciplrx` (`coding-test-verification`, Free)
- Supabase 리전: Sydney (`ap-southeast-2`)
- GitHub OAuth 앱: https://github.com/settings/applications/3837795

`main` push 시 Vercel Production에 자동 배포됩니다. GitHub OAuth 제공자는 활성화되어 있으며 Client Secret은 Supabase에만 저장했습니다. Vercel Production에 프로젝트 URL, Publishable Key, 사이트 URL을 등록했습니다. Preview에는 운영 DB 환경변수를 등록하지 않았습니다.

## 인증 주소

- Supabase Site URL: `https://coding-test-verification.vercel.app`
- GitHub OAuth callback: `https://lfukmjprduxmesciplrx.supabase.co/auth/v1/callback`
- 허용된 앱 callback: `https://coding-test-verification.vercel.app/auth/callback**`, `http://localhost:3000/auth/callback**`

초대 링크에서 로그인하거나 로그인이 만료되면 원래 경로로 복귀합니다. 초대 대상 확인에는 `auth.identities`의 GitHub 계정과 확인된 이메일을 사용합니다.

## 데이터베이스

SQL Editor에서 아래 마이그레이션에 해당하는 스키마와 함수를 적용했습니다.

- `20260904000000_initial_schema.sql`
- `20260905000000_core_workflows.sql`
- `20260905010000_verified_identity_and_roles.sql`
- `20260905020000_invite_codes_and_photos.sql`

네 버전을 `supabase_migrations.schema_migrations`에도 등록했습니다. 기존 마이그레이션을 재실행하지 않고 새 마이그레이션부터 적용합니다.

그룹 생성·초대 수락·가입 승인·검수자 지정 함수가 연결되어 있습니다. 그룹 데이터는 ACTIVE 멤버만 조회하며, 작성자 본인의 풀이 검수는 차단됩니다.

## 로컬 실행과 검증

Node.js 24에서 `pnpm test`, `pnpm check`를 실행합니다. 로컬 `.env.local`에는 현재 프로젝트의 공개 연결값이 설정되어 있으며 Git에서 제외됩니다.

- 실제 Supabase에서 초대 대상 위조, PENDING 데이터 접근, 비소유자 승인, 자기 검수 차단 확인
- 가입 승인, 검수자 역할 지정, 다른 멤버의 풀이 검수 확인
- 비활성 소유자 권한 차단 확인
- DB 시나리오 테스트 데이터 전체 롤백
- 비로그인 공개 키 요청의 그룹 조회 거부(401) 확인
- 로그인 복귀 URL 검증 테스트 및 lint·타입 검사·빌드 통과
- 운영 브라우저에서 GitHub 로그인, 대시보드 진입, 그룹 생성과 ACTIVE 소유자 화면 확인

## 사진 등록과 초대코드

- 5자리 공유 코드로 가입 신청 후 소유자가 승인합니다. 7일 만료, 재발급 시 이전 코드 무효화, 사용자당 15분에 5회 입력 제한을 적용합니다.
- 플랫폼 계정 없이 JPG·PNG·WebP 사진을 6MB까지 업로드합니다. 제목은 선택이며, 사진 속 문제명·날짜 자동 추출은 하지 않습니다.
- 실제 DB에서 코드 공유·재발급·시도 제한, 승인 전 접근 차단, 사진 제출·검수·삭제 권한을 검증했습니다. SQL 테스트는 `supabase/tests/invite_codes_and_photos.sql`에 있으며 데이터는 롤백합니다.
- 기존 플랫폼 계정 기록과 대상 계정 초대 링크는 유지합니다. 공식 API 자동 확인과 영상 업로드 화면은 현재 범위에 포함하지 않습니다.

환경변수 설정 방법과 Storage 경로 계약은 [README.md](../README.md)를 참고합니다. 관리자 키, OAuth Client Secret, DB 비밀번호, 인증 토큰은 저장소에 추가하지 않습니다.
