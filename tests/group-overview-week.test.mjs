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
        members: [
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
  assert.match(html, /이번 주<\/h2>/);
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

test("멤버 이름 칸에 GitHub 아이디와 한 줄 소개를 함께 보여준다", () => {
  const html = render({ bio: "매일 한 문제" });
  assert.match(html, /title="멤버 · @member · 매일 한 문제"/);
});

test("형식이 잘못된 GitHub 아이디는 이름 칸에 넣지 않는다", () => {
  const html = render({ githubLogin: "Bad Login", bio: null });
  assert.match(html, /title="멤버"/);
});

test("날짜 셀 링크는 보고 있는 주를 유지한다", () => {
  const html = render();
  assert.match(
    html,
    /href="\/groups\/study\?proofMember=member&amp;proofDate=2026-09-01&amp;week=2026-08-31#proof-records"/,
  );
});
