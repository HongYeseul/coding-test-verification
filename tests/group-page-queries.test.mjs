import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function renderGroup(
  t,
  {
    status = "ACTIVE",
    role = "OWNER",
    proofs = [],
    searchParams = {},
    profiles = [{ id: "user", display_name: "멤버" }],
    overview = null,
  } = {},
) {
  const calls = [];
  const rpcCalls = [];
  const supabase = {
    from(table) {
      const filters = [];
      let single = false;
      const query = {
        select() {
          return query;
        },
        eq(...args) {
          filters.push(["eq", ...args]);
          return query;
        },
        neq(...args) {
          filters.push(["neq", ...args]);
          return query;
        },
        in(...args) {
          filters.push(["in", ...args]);
          return query;
        },
        gt() {
          return query;
        },
        gte(...args) {
          filters.push(["gte", ...args]);
          return query;
        },
        lt(...args) {
          filters.push(["lt", ...args]);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        then(resolve, reject) {
          calls.push({ table, filters, single });
          const rows = {
            groups: { id: "group", slug: "study", name: "스터디" },
            group_members: single
              ? { role, status }
              : [{ user_id: "user", role, status }],
            proofs,
            profiles,
            proof_reviews: [],
            platform_accounts: [],
            group_invite_codes: null,
          };
          return Promise.resolve({ data: rows[table], error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    },
    rpc(name, args) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: overview, error: null });
    },
  };
  globalThis.__groupPageImports = {
    requireUser: async () => ({ supabase, user: { id: "user" } }),
    redirect(path) {
      throw Error(`redirect:${path}`);
    },
    notFound() {
      throw Error("not found");
    },
  };
  t.after(() => {
    delete globalThis.__groupPageImports;
  });
  const source = readFileSync(
    new URL("../src/app/groups/[slug]/page.tsx", import.meta.url),
    "utf8",
  ).replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
  const compiled = ts.transpileModule(
    `
    const { requireUser, redirect, notFound } = globalThis.__groupPageImports;
    const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
    const Link='a', Image='img', PhotoProofForm='form', StatusMessage='div', GroupOverview='section', CancelProofButton='button', InvitePopover='div';
    const approveMembershipAction=()=>{}, rotateInviteCodeAction=()=>{}, setMemberRoleAction=()=>{}, deleteProofAction=()=>{}, reviewProofAction=()=>{};
    const firstQueryValue=(value)=>value, getSiteUrl=()=>"https://example.invalid";
    ${source}
  `,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const page = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${t.name}`
  );
  const render = () =>
    page.default({
      params: Promise.resolve({ slug: "study" }),
      searchParams: Promise.resolve(searchParams),
    });
  return { calls, rpcCalls, render };
}

function weekOverview({
  weekStart = "2026-08-31",
  currentWeekStart = "2026-09-07",
} = {}) {
  return {
    today: "2026-09-07",
    weekStart,
    weekEnd: "2026-09-06",
    currentWeekStart,
    firstWeekStart: "2026-08-24",
    days: [],
    members: [],
  };
}

test("초대코드 조회는 프로필 조회가 끝날 때까지 기다리지 않는다", async (t) => {
  const { calls, render } = await renderGroup(t);
  await render();
  assert.ok(
    calls.findIndex((c) => c.table === "group_invite_codes") <
      calls.findIndex((c) => c.table === "profiles"),
  );
});

test("플랫폼 기록이 없으면 플랫폼 계정 조회를 생략한다", async (t) => {
  const { calls, render } = await renderGroup(t);
  await render();
  assert.equal(
    calls.some((c) => c.table === "platform_accounts"),
    false,
  );
});

test("비활성 멤버는 그룹 본문 조회 전에 차단한다", async (t) => {
  const { calls, render } = await renderGroup(t, { status: "PENDING" });
  await assert.rejects(render, /redirect:\/dashboard/);
  assert.deepEqual(
    calls.map((c) => c.table),
    ["groups", "group_members"],
  );
});

test("일반 멤버는 초대코드를 조회하지 않는다", async (t) => {
  const { calls, render } = await renderGroup(t, { role: "MEMBER" });
  await render();
  assert.equal(
    calls.some((c) => c.table === "group_invite_codes"),
    false,
  );
});

test("화면에 표시할 풀이의 플랫폼 계정만 조회한다", async (t) => {
  const { calls, render } = await renderGroup(t, {
    proofs: [
      {
        id: "proof",
        user_id: "user",
        platform_account_id: "account",
        problem_key: "problem",
        accepted_at: "2026-09-05T00:00:00Z",
        verification_status: "PENDING",
      },
    ],
  });
  await render();
  const accountQuery = calls.find((c) => c.table === "platform_accounts");
  assert.deepEqual(accountQuery.filters, [["in", "id", ["account"]]]);
});

test("현황판 조건을 풀이 기록 서버 조회에 적용한다", async (t) => {
  const { calls, render } = await renderGroup(t, {
    searchParams: {
      proofMember: "user",
      proofStatus: "pending",
      proofDate: "2026-09-05",
    },
  });
  await render();
  const proofQuery = calls.find((call) => call.table === "proofs");
  assert.deepEqual(proofQuery.filters, [
    ["eq", "group_id", "group"],
    ["eq", "user_id", "user"],
    ["eq", "verification_status", "PENDING"],
    ["gte", "created_at", "2026-09-04T15:00:00.000Z"],
    ["lt", "created_at", "2026-09-05T15:00:00.000Z"],
  ]);
});

test("이름 검색은 일치하는 활성 사용자만 조회한다", async (t) => {
  const { calls, render } = await renderGroup(t, {
    searchParams: { proofQuery: "멤" },
  });
  await render();
  const proofQuery = calls.find((call) => call.table === "proofs");
  assert.deepEqual(proofQuery.filters, [
    ["eq", "group_id", "group"],
    ["in", "user_id", ["user"]],
  ]);
});

test("일치하지 않는 사용자 검색은 풀이를 조회하지 않는다", async (t) => {
  const { calls, render } = await renderGroup(t, {
    searchParams: { proofQuery: "없는 사용자" },
  });
  await render();
  assert.equal(
    calls.some((call) => call.table === "proofs"),
    false,
  );
});

test("선택한 주를 현황판 조회 인자로 넘긴다", async (t) => {
  const { rpcCalls, render } = await renderGroup(t, {
    searchParams: { week: "2026-09-02" },
    overview: weekOverview(),
  });
  await render();
  assert.deepEqual(rpcCalls, [
    {
      name: "get_group_overview",
      args: { target_group_id: "group", target_week_start: "2026-09-02" },
    },
  ]);
});

test("형식이 잘못된 주는 현황판 조회에서 무시한다", async (t) => {
  const { rpcCalls, render } = await renderGroup(t, {
    searchParams: { week: "2026-9-2" },
    overview: weekOverview({ weekStart: "2026-09-07" }),
  });
  await render();
  assert.equal(rpcCalls[0].args.target_week_start, null);
});

test("주간 기간 필터는 선택한 주의 마지막 날까지만 조회한다", async (t) => {
  const { calls, render } = await renderGroup(t, {
    searchParams: { week: "2026-08-31", proofPeriod: "week" },
    overview: weekOverview(),
  });
  await render();
  const proofQuery = calls.find((call) => call.table === "proofs");
  assert.deepEqual(proofQuery.filters, [
    ["eq", "group_id", "group"],
    ["gte", "created_at", "2026-08-30T15:00:00.000Z"],
    ["lt", "created_at", "2026-09-06T15:00:00.000Z"],
  ]);
});

test("이번 주를 보는 중에는 주소에 주를 남기지 않는다", async (t) => {
  const { render } = await renderGroup(t, {
    overview: weekOverview({ weekStart: "2026-09-07" }),
  });
  const tree = await render();
  assert.equal(findOverview(tree).props.proofFilterQuery, "");
});

test("과거 주에서도 적용한 필터를 주간 이동 링크에 유지한다", async (t) => {
  const { render } = await renderGroup(t, {
    searchParams: { week: "2026-08-31", proofStatus: "pending" },
    overview: weekOverview(),
  });
  const tree = await render();
  assert.equal(
    findOverview(tree).props.proofFilterQuery,
    "proofStatus=pending",
  );
});

function findOverview(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "section" && node.props?.data) return node;
  const children = [
    ...(Array.isArray(node.children) ? node.children : []),
    ...(Array.isArray(node.props?.children) ? node.props.children : []),
  ];
  for (const child of children.flat(Infinity)) {
    const found = findOverview(child);
    if (found) return found;
  }
  return null;
}
