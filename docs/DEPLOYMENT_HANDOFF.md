# 배포 인수인계

마지막 확인: 2026-09-05

## 운영 연결

- GitHub: `HongYeseul/coding-test-verification` (Public, `main`)
- Vercel: `hongyeseuls-projects/coding-test-verification`
- Vercel 프로젝트 ID: `prj_F67rErRW8oBwkLTComzHn4g23qzi`
- 운영 URL: https://coding-test-verification.vercel.app
- Supabase 프로젝트: `lfukmjprduxmesciplrx` (`coding-test-verification`, Free)
- Supabase 리전: Sydney (`ap-southeast-2`)
- Vercel 함수 리전: `vercel.json`의 Sydney (`syd1`) 한 곳. Hobby 무료 플랜을 유지합니다.
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
- `20260905030000_group_overview.sql`
- `20260905040000_cancel_proof_safely.sql`
- `20260905050000_photo_storage_limit.sql`

적용 버전은 `supabase_migrations.schema_migrations`에도 등록합니다. 기존 마이그레이션을 재실행하지 않고 새 마이그레이션부터 적용합니다.

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
- 플랫폼 계정 없이 JPG·PNG·WebP 원본을 20MB까지 선택합니다. 긴 변 최대 1,920px, 150KB 목표로 압축하며 필요하면 1,600px·1,280px까지 줄입니다. 미리보기에서 글자를 확인한 후 업로드하며 새 파일의 저장 상한은 브라우저와 Storage 버킷 모두 300KB입니다. 기존 사진과 검수·취소는 유지합니다. 제목은 선택이고 사진 속 문제명·날짜 자동 추출은 하지 않습니다.
- 실제 DB에서 코드 공유·재발급·시도 제한, 승인 전 접근 차단, 사진 제출·검수·삭제 권한을 검증했습니다. SQL 테스트는 `supabase/tests/invite_codes_and_photos.sql`에 있으며 데이터는 롤백합니다.
- 검수 취소는 본인의 PENDING 기록만 가능하며, CANCELING 상태에서 사진 삭제를 확인한 뒤 기록을 삭제합니다. 삭제 실패 시 같은 버튼으로 재시도하고 현황판 집계에서는 제외합니다.
- `tests/cancel-proof-action.test.mjs`는 반복 취소·Storage 실패·응답 유실을 검증합니다. `supabase/tests/cancel_proof.sql`은 실제 DB의 취소 권한과 검수 차단을 검증하고 롤백합니다. SQL 테스트의 사진 삭제는 Storage 메타데이터 경로 변경으로 모사합니다.
- 기존 플랫폼 계정 기록과 대상 계정 초대 링크는 유지합니다. 공식 API 자동 확인과 영상 업로드 화면은 현재 범위에 포함하지 않습니다.

환경변수 설정 방법과 Storage 경로 계약은 [README.md](../README.md)를 참고합니다. 관리자 키, OAuth Client Secret, DB 비밀번호, 인증 토큰은 저장소에 추가하지 않습니다.

## 그룹 현황판

- 그룹 화면 상단에 오늘 참여 인원·주간 승인·검수 대기와 멤버별 주간 달력을 표시합니다.
- `get_group_overview`는 호출자의 ACTIVE 멤버십을 확인하고 RLS를 적용해 전체 기록을 집계합니다. 날짜는 한국시간의 인증 등록일이며 주간 범위는 월~일입니다.
- 현재 ACTIVE 멤버만 집계하고 인증이 없는 멤버도 0건으로 표시합니다. 새로고침 버튼으로 다른 멤버의 변경을 갱신합니다.
- 최근 50개 풀이 기록은 현재 그룹 전체 작성자의 기록이며, 현황판 집계에는 이 개수 제한을 적용하지 않습니다.
- 회귀 테스트: `supabase/tests/group_overview.sql`의 1,000건 초과 집계, 주간 경계, 상태 구분, 비로그인·가입 대기·탈퇴·타 그룹 접근 차단.
- 스터디 소통 채널은 카카오톡입니다. 카카오톡 알림, 공동 목표, 응원 반응, 연속 참여 집계는 아직 구현하지 않았습니다.

## 화면 전환과 무료 운영

- DB 프로젝트·리전·인증·사진은 이전하지 않습니다. Vercel 함수만 기존 DB와 가까운 `syd1`에 배포합니다.
- 목록과 그룹 화면에 `loading.tsx`가 있으며 데이터 조회 중 로딩 화면을 표시합니다.
- 초대코드는 본문과 병렬 조회하고 플랫폼 계정은 표시할 풀이에서 참조한 계정만 조회합니다. ACTIVE 멤버십 검사와 RLS는 유지합니다.
- 유료 이미지 변환·관측 도구·추가 DB를 사용하지 않습니다. Vercel Hobby는 비상업적 개인 용도이며 무료 사용량 초과 시 제한될 수 있습니다.
- Supabase Free의 주요 한도는 DB 500MB, 파일 1GB, egress 5GB와 cached egress 5GB입니다. 한도와 사용량은 운영 대시보드에서 확인하며 자동 유료 전환은 신청하지 않습니다.
