# 배포 인수인계

마지막 확인: 2026-09-13

## 운영 연결

- GitHub: `HongYeseul/coding-test-verification` (Public, `main`)
- Vercel: `hongyeseuls-projects/coding-test-verification`
- Vercel 프로젝트 ID: `prj_F67rErRW8oBwkLTComzHn4g23qzi`
- 운영 URL: https://coding-test-verification.vercel.app
- Supabase 프로젝트: `dzibporiiexvsndungkx` (`coding-test-verification-seoul`, Free)
- Supabase 리전: Seoul (`ap-northeast-2`)
- Vercel 함수 리전: `vercel.json`의 Seoul (`icn1`) 한 곳. Hobby 무료 플랜을 유지합니다.
- GitHub OAuth 앱: https://github.com/settings/applications/3837795

`main` push 시 Vercel Production에 자동 배포됩니다. GitHub OAuth 제공자는 활성화되어 있으며 Client Secret은 Supabase에만 저장했습니다. Vercel Production에 프로젝트 URL, Publishable Key, 사이트 URL을 등록했습니다. Preview에는 운영 DB 환경변수를 등록하지 않았습니다.

## 인증 주소

- Supabase Site URL: `https://coding-test-verification.vercel.app`
- GitHub OAuth callback: `https://dzibporiiexvsndungkx.supabase.co/auth/v1/callback`. OAuth App은 콜백을 10개까지 등록할 수 있어 리전 이전 중에는 구·신 두 개를 같이 두었습니다. 삭제된 프로젝트를 가리키는 콜백이 아직 하나 남아 있는데, 동작하지 않으므로 정리만 하면 됩니다.
- 허용된 앱 callback: `https://coding-test-verification.vercel.app/auth/callback**`, `http://localhost:3000/auth/callback**`

초대 링크에서 로그인하거나 로그인이 만료되면 원래 경로로 복귀합니다. 초대 대상 확인에는 `auth.identities`의 GitHub 계정과 확인된 이메일을 사용합니다.

## 데이터베이스

SQL Editor 또는 Supabase MCP의 `apply_migration`으로 아래 마이그레이션에 해당하는 스키마와 함수를 적용했습니다.

- `20260904000000_initial_schema.sql`
- `20260905000000_core_workflows.sql`
- `20260905010000_verified_identity_and_roles.sql`
- `20260905020000_invite_codes_and_photos.sql`
- `20260905030000_group_overview.sql`
- `20260905040000_cancel_proof_safely.sql`
- `20260905050000_photo_storage_limit.sql`
- `20260905060000_group_overview_featured_photo.sql`
- `20260907000000_group_overview_week_range.sql`
- `20260907010000_problem_links.sql`
- `20260907020000_member_profiles.sql`
- `20260907030000_group_overview_activity_order.sql`
- `20260907040000_group_overview_stable_order.sql`
- `20260908000000_group_problem_titles.sql`
- `20260909000000_auto_approve_proofs.sql`
- `20260909010000_public_group_board.sql`
- `20260909020000_group_directory_activity.sql`
- `20260909030000_drop_list_group_directory.sql`
- `20260910000000_study_day_starts_at_3am.sql`
- `20260911000000_group_proof_settings.sql`
- `20260913000000_solution_code.sql`
- `20260913010000_drop_legacy_create_group.sql`
- `20260913020000_proof_tags.sql`

적용 버전은 `supabase_migrations.schema_migrations`에도 등록합니다. 기존 마이그레이션을 재실행하지 않고 새 마이그레이션부터 적용합니다.

### create_group 시그니처 교체 (완료)

3인자 `create_group`을 쓰는 화면을 배포한 뒤 구버전 2인자 함수를 지웠습니다. 지금은 `create_group(text, text, boolean)` 하나만 남아 있습니다.

배포 전에 지우면 구버전 화면의 그룹 만들기가 막히므로, 두 시그니처를 잠시 함께 두었다가 배포 후에 정리하는 순서를 지켰습니다. `20260909030000_drop_list_group_directory.sql`과 같은 규칙입니다. 앞으로도 RPC 시그니처를 바꿀 때는 이 순서를 지킵니다.

`20260911000000`의 백필은 기존 그룹을 모두 코딩 테스트 스터디로 옮겼습니다. 적용 시점에 그룹 1개·활성 멤버 7명·인증 17건이 있었고 기록은 그대로 유지됐습니다.

## 확장 프로그램

`extension/`의 크롬 확장은 웹앱과 같은 GitHub OAuth를 씁니다. 확장을 배포하려면 Supabase의 Authentication > URL Configuration에 `https://<확장-ID>.chromiumapp.org/*`를 추가해야 합니다. 아직 등록하지 않았습니다.

확장의 `config.js`에는 `appUrl`, `supabaseUrl`, publishable key만 넣습니다. 관리자 키는 넣지 않습니다.
