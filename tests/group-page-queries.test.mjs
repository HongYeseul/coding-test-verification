import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function renderGroup(
  t,
  { status = "ACTIVE", role = "OWNER", proofs = [] } = {},
) {
  const calls = [];
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
            profiles: [{ id: "user", display_name: "멤버" }],
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
    rpc() {
      return Promise.resolve({ data: null, error: null });
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
    const Link='a', Image='img', PhotoProofForm='form', StatusMessage='div', GroupOverview='section', CancelProofButton='button';
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
      searchParams: Promise.resolve({}),
    });
  return { calls, render };
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
