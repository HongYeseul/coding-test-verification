import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const proofId = "00000000-0000-4000-8000-000000000041";
const userId = "00000000-0000-4000-8000-000000000011";
const groupId = "00000000-0000-4000-8000-000000000021";
const evidencePath = `${groupId}/${userId}/00000000-0000-4000-8000-000000000031.png`;

async function fixture(t, { storageFails = false, responseLost = false } = {}) {
  const state = {
    storageFails,
    proof: {
      id: proofId,
      group_id: groupId,
      user_id: userId,
      verification_status: "PENDING",
      evidence_path: evidencePath,
    },
    photo: true,
  };
  const supabase = {
    from(table) {
      let deletion = false;
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        delete() {
          deletion = true;
          return query;
        },
        async maybeSingle() {
          return {
            data:
              table === "groups"
                ? { id: groupId }
                : table === "group_members"
                  ? { status: "ACTIVE" }
                  : state.proof,
            error: null,
          };
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              const row = state.proof;
              if (deletion) state.proof = null;
              return { data: row ? [row] : [], error: null };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name) {
      if (name === "begin_proof_cancellation") {
        if (!state.proof) return { data: null, error: null };
        state.proof.verification_status = "CANCELING";
        return { data: state.proof, error: null };
      }
      if (name === "finish_proof_cancellation") {
        if (state.photo)
          return { error: { message: "사진 삭제를 다시 시도해주세요." } };
        state.proof = null;
        return { error: null };
      }
      throw Error(`예상하지 못한 RPC: ${name}`);
    },
    storage: {
      from() {
        return {
          async remove() {
            if (state.storageFails)
              return { data: null, error: { message: "Storage unavailable" } };
            state.photo = false;
            if (responseLost) throw Error("Storage response lost");
            return { data: [{ name: evidencePath }], error: null };
          },
        };
      },
    },
  };
  const imports = {
    requireUser: async () => ({ supabase, user: { id: userId } }),
    revalidatePath() {},
    redirect(location) {
      throw Object.assign(new Error("redirect"), { location });
    },
    getRequiredText: (data, key) => String(data.get(key) ?? "").trim(),
    withStatus: (path, key, value) =>
      `${path}?${new URLSearchParams({ [key]: value })}`,
  };
  globalThis.__cancelProofTestImports = imports;
  t.after(() => {
    delete globalThis.__cancelProofTestImports;
  });
  let source = readFileSync(
    new URL("../src/app/actions/proofs.ts", import.meta.url),
    "utf8",
  );
  source = source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
  source = `const {requireUser,revalidatePath,redirect,getRequiredText,withStatus}=globalThis.__cancelProofTestImports;\n${source}`;
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const actions = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Math.random()}`
  );
  async function cancel() {
    const form = new FormData();
    form.set("proofId", proofId);
    form.set("groupSlug", "test-group");
    try {
      await actions.deleteProofAction(form);
    } catch (error) {
      if (!error.location) throw error;
      return new URL(error.location, "https://example.invalid");
    }
    throw Error("취소 응답 없음");
  }
  return { state, cancel };
}

test("같은 취소 요청을 다시 보내도 완료된 삭제를 오류로 표시하지 않는다", async (t) => {
  const { state, cancel } = await fixture(t);
  const first = await cancel();
  assert.equal(first.searchParams.has("error"), false);
  assert.equal(state.proof, null);
  assert.equal(state.photo, false);
  const retry = await cancel();
  assert.equal(
    retry.searchParams.has("error"),
    false,
    retry.searchParams.get("error"),
  );
});

test("사진 삭제에 실패하면 재시도할 기록과 사진 경로가 남는다", async (t) => {
  const { state, cancel } = await fixture(t, { storageFails: true });
  const failed = await cancel();
  assert.equal(failed.searchParams.has("error"), true);
  assert.equal(state.photo, true);
  assert.ok(
    state.proof?.evidence_path,
    "사진 정리에 실패했는데 업로드 기록까지 사라짐",
  );
  assert.equal(state.proof.verification_status, "CANCELING");
  state.storageFails = false;
  const retry = await cancel();
  assert.equal(retry.searchParams.has("error"), false);
  assert.equal(state.photo, false);
  assert.equal(state.proof, null);
});

test("사진 삭제 응답이 유실되어도 DB 확인 후 기록 삭제를 완료한다", async (t) => {
  const { state, cancel } = await fixture(t, { responseLost: true });
  const result = await cancel();
  assert.equal(result.searchParams.has("error"), false);
  assert.equal(state.photo, false);
  assert.equal(state.proof, null);
});
