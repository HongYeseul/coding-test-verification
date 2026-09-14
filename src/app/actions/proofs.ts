"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getRequiredText, withStatus } from "@/lib/form";
import { problemLink, PROBLEM_URL_ERROR } from "@/lib/proof-input";
import {
  createProofRecord,
  type ProofRecordResult,
} from "@/lib/proof-record";

export async function createProofRecordAction(input: {
  groupId: string;
  groupSlug: string;
  evidencePath: string;
  recordKey: string;
  title: string;
  problemUrl: string;
  solutionCode?: string;
  tags?: string;
  /** 기상·착석 스터디의 기록값입니다. 쓰지 않는 그룹은 null입니다. */
  recordMinutes?: number | null;
}): Promise<ProofRecordResult> {
  const {
    groupSlug,
    solutionCode = "",
    tags = "",
    recordMinutes = null,
    ...record
  } = input;
  if (!SLUG_PATTERN.test(groupSlug))
    return { error: "인증 내용을 확인해주세요." };
  const { supabase, user } = await requireUser();
  const result = await createProofRecord(supabase, user.id, {
    ...record,
    solutionCode,
    tags,
    recordMinutes,
  });
  if (result.error) return result;
  revalidatePath(`/groups/${groupSlug}`);
  return result;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLATFORMS = [
  "CODEFORCES",
  "PROGRAMMERS",
  "LEETCODE",
  "ATCODER",
  "HACKERRANK",
  "CODEWARS",
] as const;

export async function createPlatformAccountAction(formData: FormData) {
  const platform = getRequiredText(formData, "platform");
  const handle = getRequiredText(formData, "handle");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  if (
    !PLATFORMS.includes(platform as (typeof PLATFORMS)[number]) ||
    handle.length < 1 ||
    handle.length > 100
  ) {
    redirect(withStatus(groupPath, "error", "플랫폼과 계정명을 확인해주세요."));
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("platform_accounts").insert({
    user_id: user.id,
    platform,
    handle,
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "이미 등록된 플랫폼 계정입니다."
        : "플랫폼 계정을 등록하지 못했습니다.";
    redirect(withStatus(groupPath, "error", message));
  }

  revalidatePath(groupPath);
  redirect(withStatus(groupPath, "message", "플랫폼 계정을 등록했습니다."));
}

export async function createProofAction(formData: FormData) {
  const groupId = getRequiredText(formData, "groupId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const platformAccountId = getRequiredText(formData, "platformAccountId");
  const problemKey = getRequiredText(formData, "problemKey");
  const problemTitle = getRequiredText(formData, "problemTitle");
  const problemUrl = getRequiredText(formData, "problemUrl");
  const acceptedAtText = getRequiredText(formData, "acceptedAt");
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  const link = problemLink(problemUrl);
  if (!link) {
    redirect(withStatus(groupPath, "error", PROBLEM_URL_ERROR));
  }

  const acceptedAt = new Date(`${acceptedAtText}:00+09:00`);
  if (
    !UUID_PATTERN.test(groupId) ||
    !UUID_PATTERN.test(platformAccountId) ||
    problemKey.length < 1 ||
    problemKey.length > 160 ||
    problemTitle.length > 160 ||
    Number.isNaN(acceptedAt.getTime()) ||
    acceptedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    redirect(withStatus(groupPath, "error", "풀이 정보를 확인해주세요."));
  }

  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.status !== "ACTIVE") {
    redirect(
      withStatus(
        "/dashboard",
        "error",
        "활성 멤버만 도장을 찍을 수 있습니다.",
      ),
    );
  }

  const { data: account } = await supabase
    .from("platform_accounts")
    .select("id")
    .eq("id", platformAccountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    redirect(
      withStatus(groupPath, "error", "본인의 플랫폼 계정을 선택해주세요."),
    );
  }

  const { error } = await supabase.from("proofs").insert({
    group_id: groupId,
    user_id: user.id,
    platform_account_id: platformAccountId,
    problem_key: problemKey,
    problem_url: link.url,
    problem_title: problemTitle || null,
    accepted_at: acceptedAt.toISOString(),
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "이미 등록한 문제입니다."
        : "도장을 찍지 못했습니다.";
    redirect(withStatus(groupPath, "error", message));
  }

  revalidatePath(groupPath);
  redirect(
    withStatus(groupPath, "message", "풀이를 검수 대기로 등록했습니다."),
  );
}

/**
 * 응원을 남기거나 거둡니다. 하트 하나라 성공 메시지는 띄우지 않고 화면만 다시 그립니다.
 * 본인 기록·취소 중인 기록·남의 그룹은 RLS가 막고, 여기서는 입력 모양만 확인합니다.
 */
export async function toggleCheerAction(formData: FormData) {
  const proofId = getRequiredText(formData, "proofId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const cheered = getRequiredText(formData, "cheered") === "true";
  if (!UUID_PATTERN.test(proofId) || !SLUG_PATTERN.test(groupSlug)) return;

  const { supabase, user } = await requireUser();
  const { error } = cheered
    ? await supabase
        .from("proof_cheers")
        .delete()
        .eq("proof_id", proofId)
        .eq("user_id", user.id)
    : // 이미 있으면 그대로 둡니다. 두 번 눌러도 응원은 하나입니다.
      await supabase
        .from("proof_cheers")
        .upsert(
          { proof_id: proofId, user_id: user.id },
          { onConflict: "proof_id,user_id", ignoreDuplicates: true },
        );
  const groupPath = `/groups/${groupSlug}`;
  // 모달을 열어 둔 사이 기록이 취소되면 정책이 거절합니다. 조용히 되돌아가면
  // 사용자는 버튼이 고장 난 줄 압니다.
  if (error) {
    redirect(
      withStatus(groupPath, "error", "응원을 남기지 못했습니다. 기록 상태를 확인해주세요."),
    );
  }
  revalidatePath(groupPath);
}

export async function reviewProofAction(formData: FormData) {
  const proofId = getRequiredText(formData, "proofId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const decision = getRequiredText(formData, "decision");
  const note = getRequiredText(formData, "note");
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  if (
    !UUID_PATTERN.test(proofId) ||
    !["APPROVED", "REJECTED"].includes(decision) ||
    note.length > 500
  ) {
    redirect(withStatus(groupPath, "error", "검수 내용을 확인해주세요."));
  }

  const { supabase, user } = await requireUser();
  const { data: proof } = await supabase
    .from("proofs")
    .select("group_id, user_id, verification_status")
    .eq("id", proofId)
    .maybeSingle();
  const { data: membership } = proof
    ? await supabase
        .from("group_members")
        .select("role, status")
        .eq("group_id", proof.group_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  if (
    !proof ||
    proof.user_id === user.id ||
    proof.verification_status !== "PENDING" ||
    membership?.status !== "ACTIVE" ||
    !["OWNER", "REVIEWER"].includes(membership.role)
  ) {
    redirect(
      withStatus(
        groupPath,
        "error",
        "다른 멤버의 검수 대기 풀이만 검수할 수 있습니다.",
      ),
    );
  }
  const { error } = await supabase.from("proof_reviews").insert({
    proof_id: proofId,
    reviewer_id: user.id,
    decision,
    note: note || null,
  });

  if (error) {
    redirect(withStatus(groupPath, "error", "검수를 마치지 못했습니다."));
  }

  revalidatePath(groupPath);
  redirect(withStatus(groupPath, "message", "검수 결과를 반영했습니다."));
}

export async function deleteProofAction(formData: FormData) {
  const proofId = getRequiredText(formData, "proofId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  if (!UUID_PATTERN.test(proofId) || !SLUG_PATTERN.test(groupSlug)) {
    redirect(withStatus("/dashboard", "error", "삭제할 풀이를 확인해주세요."));
  }
  const groupPath = `/groups/${groupSlug}`;
  const { supabase, user } = await requireUser(groupPath);
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("slug", groupSlug)
    .maybeSingle();
  const { data: member } = group
    ? await supabase
        .from("group_members")
        .select("status")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  if (!group || member?.status !== "ACTIVE") {
    redirect(withStatus(groupPath, "error", "풀이를 삭제할 권한이 없습니다."));
  }
  const args = { target_group_id: group.id, target_proof_id: proofId };
  const { data: cancellation, error: beginError } = await supabase.rpc(
    "begin_proof_cancellation",
    args,
  );
  if (beginError)
    redirect(
      withStatus(
        groupPath,
        "error",
        "검수 대기이거나 자동 인정된 본인 기록만 취소할 수 있습니다.",
      ),
    );
  if (cancellation) {
    if (cancellation.evidence_path) {
      try {
        await supabase.storage
          .from("proof-evidence")
          .remove([cancellation.evidence_path]);
      } catch {
        // 응답이 유실됐더라도 DB에서 사진 삭제 여부를 확인합니다.
      }
    }
    const { error: finishError } = await supabase.rpc(
      "finish_proof_cancellation",
      args,
    );
    if (finishError) {
      revalidatePath(groupPath);
      redirect(
        withStatus(
          groupPath,
          "error",
          "사진을 지우지 못했습니다. 기록의 ‘삭제 다시 시도’를 눌러주세요.",
        ),
      );
    }
  }
  revalidatePath(groupPath);
  redirect(
    withStatus(
      groupPath,
      "message",
      "검수 요청이 취소됐습니다. 사진과 업로드 기록을 삭제했습니다.",
    ),
  );
}
