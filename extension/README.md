# 도장 확장 프로그램

프로그래머스·LeetCode·NeetCode에서 정답을 맞히면 선택한 GitHub 공개 저장소에 풀이를 자동으로 올립니다.
스터디 가입 없이 사용할 수 있습니다. Vercel 기록 API와 Supabase DB·Storage로 풀이를 보내지 않으며,
Supabase는 GitHub 로그인에만 사용합니다.

## 설치와 사용

1. [릴리스 페이지](https://github.com/HongYeseul/coding-test-verification/releases/latest)에서 `dojang-extension-v*.zip`을 받아 압축을 풉니다.
2. 크롬의 `chrome://extensions`에서 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**로 `dojang-extension` 폴더를 선택합니다.
4. 도장 아이콘을 눌러 **GitHub로 로그인**하고 공개 저장소를 선택합니다. 로그인 창 때문에 팝업이 닫히면 아이콘을 다시 누릅니다.
5. 지원하는 사이트에서 문제를 제출합니다. 정답이면 풀이가 자동으로 올라가고 결과 카드에 저장소 링크가 표시됩니다.

팝업과 정답 카드에서 저장소를 선택하거나 새 공개 저장소를 만들 수 있습니다.
연결 전에는 정답 카드에서 로그인과 저장소 선택을 마치면 해당 풀이를 바로 올립니다.
업로드에 실패하면 카드에서 **다시 올리기** 또는 **GitHub 다시 연결**을 누릅니다.
정답을 맞히기 전에 이미 연 페이지를 다시 조회하거나 제출 기록을 가져오지 않습니다.
대회 제출과 실행(Run) 결과는 업로드하지 않습니다.

업데이트할 때는 압축을 새 폴더에 풀고 기존 설치 폴더를 교체한 뒤 확장 관리 화면에서 새로고침합니다.
웹스토어 등록 전이므로 자동 갱신되지 않습니다.

## 저장되는 파일

한 문제의 코드와 README를 함께 올립니다. 같은 문제를 다시 풀면 같은 파일의 변경 이력으로 남고,
파일 내용이 같으면 커밋하지 않습니다. 빈 저장소에 처음 올릴 때는 초기화 커밋이 추가될 수 있습니다.

```text
프로그래머스/42746. 가장 큰 수/solution.py
프로그래머스/42746. 가장 큰 수/README.md
LeetCode/two-sum/solution.cpp
LeetCode/two-sum/README.md
NeetCode/duplicate-integer/solution.py
NeetCode/duplicate-integer/README.md
```

README에는 문제 제목·플랫폼·난이도·원문 링크를 적습니다. 프로그래머스 연습 문제와 LeetCode는
현재 열린 문제의 본문도 마크다운으로 변환하고 출처를 붙입니다. 본문에 포함된 예시·제한사항·표·코드
블록·이미지 링크를 보존합니다. 힌트·에디토리얼·다른 사람의 풀이·채점용 테스트케이스는 수집하지 않습니다.
NeetCode 본문은 수집하지 않습니다.

본문이 없거나 읽기에 실패하거나 30,000자를 넘으면 본문만 생략합니다. 다른 문제로 화면이 바뀌어
제출한 문제의 제목 영역을 찾을 수 없는 경우에도 본문을 생략합니다.

## 본문 게시 조건

프로그래머스는 공식 안내에 따라 **코딩테스트 연습** 분류이고 별도 저작권 표시가 없는 문제만
출처와 함께 올립니다. 기업 과제관·선발관 문제의 설명은 올리지 않습니다.

LeetCode는 문제 본문의 재게시를 허용하는 공식 안내를 확인하지 못했습니다. 출처 표기가 게시 허락을
대신하지는 않습니다. 공개 저장소에 올리는 콘텐츠의 이용 조건은 [LeetCode 이용약관](https://leetcode.com/terms/)을 확인해주세요.
별도 저작권 표시가 있는 본문은 생략합니다.

## 로그인과 권한

Supabase가 GitHub 로그인을 중계합니다. 사용자는 각자 본인의 GitHub 계정으로 로그인하며,
개발자의 Supabase 프로젝트를 함께 사용합니다. Supabase Auth에 사용자 계정이 만들어지지만
스터디 그룹을 조회하거나 풀이·사진·도장 기록을 저장하지 않습니다.

`public_repo` 권한으로 쓰기 가능한 공개 저장소를 선택합니다. 이 권한은 선택한 저장소 하나로
제한되지 않고 GitHub 계정의 공개 저장소 전체에 적용됩니다. 비공개 저장소는 선택하지 않습니다.
GitHub 토큰은 확장의 `chrome.storage.local`에 보관하고 콘텐츠 스크립트에는 전달하지 않습니다.
저장소 API는 background에서 호출합니다.

로그아웃하면 확장에 저장한 세션·토큰·저장소 선택을 지웁니다. GitHub 측 권한까지 취소하려면
[Authorized OAuth Apps](https://github.com/settings/applications)에서 해당 앱의 권한을 철회합니다.

확장 ID는 manifest의 `key`로 고정합니다. 이를 바꾸면 로그인 복귀 주소도 달라집니다.
Supabase의 Redirect URLs에는 다음 주소를 등록합니다.

```text
https://pkpabpnpecgcpakaehojnphgeajoieih.chromiumapp.org/*
```

## 개발과 릴리스

저장소의 `extension/`을 그대로 로드하거나, 별도 사본은 `bash extension/install.sh`로 준비합니다.
관리자 키는 확장에 넣지 않습니다. Supabase 프로젝트 주소와 publishable key만 사용합니다.

기능을 바꾸면 다음 검사를 실행합니다.

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

릴리스에는 manifest 버전·이번 버전의 `RELEASE_NOTES.md`·`src/lib/release-notes.ts`를 함께 갱신합니다.

```bash
bash extension/release.sh            # 배포용 ZIP 생성
bash extension/release.sh --publish  # 현재 커밋의 태그와 GitHub 릴리스 생성
```
