import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { githubHandle } from "../src/lib/profile.ts";

const source = readFileSync(
  new URL("../src/components/group-overview.tsx", import.meta.url),
  "utf8",
).replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
const compiled = ts.transpileModule(
  `
  const { React, shiftWeek, githubHandle } = globalThis.__overviewImports;
  const Link = (props) => React.createElement("a", props);
  const RefreshOverviewButton = () => null;
  ${source}
  export { GroupOverview };
`,
  {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

const { shiftWeek } = await import("../src/lib/group-overview.ts");
globalThis.__overviewImports = { React, shiftWeek, githubHandle };
const { GroupOverview } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function render({
  weekStart = "2026-08-31",
  currentWeekStart = "2026-09-07",
  firstWeekStart = "2026-08-24",
  proofFilterQuery = "",
  githubLogin = "member",
  bio = null,
  members = null,
} = {}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return renderToStaticMarkup(
    React.createElement(GroupOverview, {
      data: {
        today: "2026-09-09",
        weekStart,
        weekEnd: days[6],
        currentWeekStart,
        firstWeekStart,
        days,
        members: members ?? [
          {
            userId: "member",
            displayName: "멤버",
            githubLogin,
            bio,
            role: "MEMBER",
            todaySubmitted: 0,
            weekApproved: 1,
            totalApproved: 3,
            pending: 0,
            featuredProofId: null,
            featuredDate: null,
            days: [
              { date: days[1], approved: 1, pending: 0, rejected: 0 },
            ],
          },
        ],
      },
      currentUserId: "member",
      groupSlug: "study",
      proofFilterQuery,
    }),
  );
}

test("과거 주에서는 앞뒤 주 이동 링크와 이번 주 복귀를 함께 보여준다", () => {
  const html = render({ weekStart: "2026-08-24", firstWeekStart: "2026-08-17" });
  assert.match(html, /href="\/groups\/study\?week=2026-08-17"[^>]*aria-label="이전 주 보기"/);
  assert.match(html, /href="\/groups\/study\?week=2026-08-31"[^>]*aria-label="다음 주 보기"/);
  assert.match(html, /href="\/groups\/study"[^>]*>이번 주로</);
});

test("이번 주로 돌아가는 링크에는 주를 붙이지 않는다", () => {
  const html = render();
  assert.match(html, /href="\/groups\/study"[^>]*aria-label="다음 주 보기"/);
  assert.doesNotMatch(html, /week=2026-09-07/);
});

test("이번 주에서는 다음 주로 이동할 수 없다", () => {
  const html = render({ weekStart: "2026-09-07" });
  assert.match(html, /aria-disabled="true"[^>]*aria-label="다음 주 보기 \(이동할 주 없음\)"/);
  assert.doesNotMatch(html, /이번 주로/);
  // 표 제목은 읽기 전용으로 두고 주 표시는 이동 컨트롤 옆에 둡니다.
  assert.match(html, /sr-only[^>]*>이번 주 인증 현황<\/h2>/);
  assert.match(html, /font-\[650\]">이번 주</);
  assert.match(html, /9\.7 — 9\.13/);
});

test("그룹이 만들어진 주보다 이전으로는 이동할 수 없다", () => {
  const html = render({ weekStart: "2026-08-24" });
  assert.match(html, /aria-disabled="true"[^>]*aria-label="이전 주 보기 \(이동할 주 없음\)"/);
});

test("주간 이동 링크는 적용한 풀이 기록 필터를 유지한다", () => {
  const html = render({ proofFilterQuery: "proofStatus=pending" });
  assert.match(html, /href="\/groups\/study\?proofStatus=pending&amp;week=2026-08-24"/);
  assert.match(html, /href="\/groups\/study\?proofStatus=pending"[^>]*>이번 주로</);
});

test("멤버 이름 옆에 GitHub 아이디를 함께 보여준다", () => {
  const html = render();
  assert.match(html, /class="[^"]*font-mono[^"]*">@member</);
});

test("한 줄 소개는 이름 칸에 마우스를 올렸을 때 나오는 카드로만 보여준다", () => {
  const html = render({ bio: "매일 한 문제" });
  assert.match(html, /role="tooltip"[^>]*group-hover\/member:block[^>]*>매일 한 문제</);
});

test("한 줄 소개가 없으면 소개 카드를 만들지 않는다", () => {
  const html = render();
  // 머리글의 정렬 안내와 구분하기 위해 멤버 카드 전용 클래스로 확인합니다.
  assert.doesNotMatch(html, /group-hover\/member:block/);
});

test("형식이 잘못된 GitHub 아이디는 이름 칸에 넣지 않는다", () => {
  const html = render({ githubLogin: "Bad Login" });
  assert.doesNotMatch(html, /font-mono/);
});

/** 이름 칸에 그려진 닉네임을 화면에 나온 순서대로 모읍니다. */
function memberOrder(html) {
  return [
    ...html.matchAll(/class="block truncate text-\[12px\] sm:text-\[15px\]">([^<]*)</g),
  ].map((match) => match[1]);
}

function member(displayName, weekApproved, totalApproved) {
  return {
    userId: displayName,
    displayName,
    githubLogin: null,
    bio: null,
    role: "MEMBER",
    todaySubmitted: 0,
    weekApproved,
    totalApproved,
    pending: 0,
    featuredProofId: null,
    featuredDate: null,
    days: [],
  };
}

test("멤버는 선택한 주의 승인이 많은 순으로 놓는다", () => {
  const html = render({
    members: [
      member("alpha", 0, 0),
      member("beta", 2, 0),
      member("gamma", 1, 9),
    ],
  });
  assert.deepEqual(memberOrder(html), ["beta", "gamma", "alpha"]);
});

test("주간 승인이 같으면 누적 승인이 많은 멤버를 위에 놓는다", () => {
  const html = render({
    members: [
      member("alpha", 0, 0),
      member("zulu", 0, 5),
    ],
  });
  assert.deepEqual(memberOrder(html), ["zulu", "alpha"]);
});

test("주간과 누적이 모두 같으면 한국어 닉네임순으로 놓는다", () => {
  const html = render({
    members: [
      member("zulu", 0, 0),
      member("홍예슬", 0, 0),
      member("alpha", 0, 0),
    ],
  });
  assert.deepEqual(memberOrder(html), ["홍예슬", "alpha", "zulu"]);
});

test("멤버 열 머리글에 정렬 기준을 적고 동점 규칙은 마우스를 올리면 보여준다", () => {
  const html = render({ weekStart: "2026-09-07" });
  assert.match(html, /· 이번 주 승인순</);
  assert.match(
    html,
    /role="tooltip"[^>]*group-hover\/sort:block[^>]*>이번 주 승인이 많은 순서입니다\. 같으면 누적 승인이 많은 순서, 그다음 닉네임순입니다\.</,
  );
});

test("지난 주를 볼 때는 정렬 기준 표시도 선택한 주로 바뀐다", () => {
  const html = render();
  assert.match(html, /· 선택한 주 승인순</);
});

test("날짜 셀 링크는 보고 있는 주를 유지한다", () => {
  const html = render();
  assert.match(
    html,
    /href="\/groups\/study\?proofMember=member&amp;proofDate=2026-09-01&amp;week=2026-08-31#proof-records"/,
  );
});
