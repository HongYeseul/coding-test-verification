import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isPhotoPath,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  parseTags,
  problemLink,
  PROBLEM_URL_ERROR,
  TAG_ERROR,
} from "@/lib/proof-input";
import {
  isRecordKind,
  MAX_RECORD_MINUTES,
  nowClockMinutes,
  recordKindLabels,
} from "@/lib/record-goal";

/** DB의 solution_code CHECK와 함께 바꿉니다. */
export const MAX_SOLUTION_CODE_LENGTH = 20000;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProofRecordInput = {
  groupId: string;
  /** 사진 없이 등록하는 그룹에서는 빈 문자열입니다. */
  evidencePath: string;
  /** 사진이 없을 때 재시도가 기록을 하나만 만들도록 클라이언트가 붙이는 열쇠입니다. */
  recordKey: string;
  title: string;
  problemUrl: string;
  /** 코딩 스터디에서 사진 대신 남기는 풀이 코드입니다. */
  solutionCode: string;
  /** 쉼표로 나눠 적는 주제입니다. 예: "해시, 정렬" */
  tags: string;
  /** 기상·착석 스터디가 남기는 기록값입니다. 시각이든 시간이든 분 하나입니다. */
  recordMinutes: number | null;
  /** 착석 도장을 찍은 시각입니다. 퇴근 도장을 찍으면 그 차이가 시간이 됩니다. */
  startMinutes: number | null;
};

export type ProofRecordResult = { error?: string; autoApproved?: boolean };

/**
 * 인증 기록 한 건을 만듭니다.
 * 화면의 서버 액션과 확장 프로그램용 Route Handler가 같은 규칙을 쓰도록 한곳에 둡니다.
 * 권한은 여기서도 확인하지만 최종 방어선은 언제나 RLS입니다.
 */
export async function createProofRecord(
  supabase: SupabaseClient,
  userId: string,
  input: ProofRecordInput,
): Promise<ProofRecordResult> {
  const groupId = input.groupId;
  const evidencePath = input.evidencePath.trim();
  const recordKey = input.recordKey.trim();
  const title = input.title.trim();
  const problemUrl = input.problemUrl.trim();
  // 코드는 앞뒤 빈 줄만 털고 들여쓰기는 그대로 둡니다.
  const solutionCode = input.solutionCode.trim();
  const tags = parseTags(input.tags);
  const link = problemUrl ? problemLink(problemUrl) : null;
  const recordMinutes = input.recordMinutes;
  const startMinutes = input.startMinutes;

  if (
    !UUID_PATTERN.test(groupId) ||
    title.length > 160 ||
    solutionCode.length > MAX_SOLUTION_CODE_LENGTH ||
    (evidencePath
      ? !isPhotoPath(evidencePath, groupId, userId)
      : !UUID_PATTERN.test(recordKey))
  ) {
    return { error: "인증 내용을 확인해주세요." };
  }

  const [
    { data: member, error: memberError },
    { data: group, error: groupError },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("groups")
      .select("auto_approve, requires_photo, is_coding_study, record_kind")
      .eq("id", groupId)
      .maybeSingle(),
  ]);
  // 조회가 실패한 것과 멤버가 아닌 것을 구분합니다.
  // 뭉뚱그리면 일시적인 장애가 '활성 멤버가 아님'으로 잘못 보고됩니다.
  if (memberError || groupError)
    return { error: "그룹 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." };
  if (member?.status !== "ACTIVE" || !group)
    return { error: "활성 멤버만 도장을 찍을 수 있습니다." };
  const recordKind = isRecordKind(group.record_kind) ? group.record_kind : "NONE";
  if (
    recordMinutes !== null &&
    (!Number.isInteger(recordMinutes) ||
      recordMinutes < 0 ||
      recordMinutes > MAX_RECORD_MINUTES)
  )
    return { error: "기록한 시각이나 시간을 확인해주세요." };
  if (recordKind === "NONE" && recordMinutes !== null)
    return { error: "이 그룹은 시각이나 시간을 기록하지 않습니다." };
  if (
    startMinutes !== null &&
    (!Number.isInteger(startMinutes) ||
      startMinutes < 0 ||
      startMinutes > MAX_RECORD_MINUTES)
  )
    return { error: "착석한 시각을 확인해주세요." };
  if (startMinutes !== null && recordKind !== "DURATION")
    return { error: "착석 도장은 시간을 기록하는 그룹에서만 찍습니다." };
  // 착석 도장이거나 직접 적은 시간이거나 하나입니다. 둘을 함께 보내면 어느 쪽이
  // 그날의 시간인지 정할 수 없습니다.
  if (startMinutes !== null && recordMinutes !== null)
    return { error: "착석 도장과 시간을 함께 보낼 수 없습니다." };
  // 시각은 서버가 정합니다. 화면이 보여준 값은 안내일 뿐이고, 남는 것은 등록 시각입니다.
  // 브라우저 값을 믿으면 시계를 돌려 이른 기상으로 꾸밀 수 있고,
  // 시각을 보내지 않는 확장 프로그램도 같은 규칙으로 통과합니다.
  const storedMinutes =
    recordKind === "CLOCK" ? nowClockMinutes() : recordMinutes;
  // 착석 스터디는 도장 두 번으로 시간을 잽니다. 착석 도장도 직접 적은 시간도
  // 없으면 남길 것이 없습니다.
  // 착석 시각도 서버가 정합니다. 착석 도장은 언제나 '지금'이라, 화면이 보낸 값을 믿으면
  // 시계를 돌려 앉아 있던 시간을 늘릴 수 있습니다. 시각(CLOCK)과 같은 규칙입니다.
  const storedStart = startMinutes === null ? null : nowClockMinutes();
  if (recordKind === "DURATION" && !storedMinutes && startMinutes === null)
    return {
      error: `착석 도장을 찍거나 ${recordKindLabels[recordKind]}을 적어야 합니다.`,
    };
  // 코드나 기록값을 남기면 사진을 생략할 수 있습니다.
  if (
    !evidencePath &&
    !solutionCode &&
    storedMinutes === null &&
    startMinutes === null &&
    group.requires_photo
  )
    return { error: "이 그룹은 사진이나 풀이 코드가 필요합니다." };
  if ((problemUrl || solutionCode) && !group.is_coding_study)
    return { error: "이 그룹은 문제 링크와 풀이 코드를 사용하지 않습니다." };
  if (problemUrl && !link) return { error: PROBLEM_URL_ERROR };
  // 개수를 넘으면 말없이 버리지 않고 알려줍니다. 태그는 통째로 하나씩 뜻이 있습니다.
  if (
    tags.length > MAX_TAGS ||
    tags.some((tag) => tag.length > MAX_TAG_LENGTH)
  )
    return { error: TAG_ERROR };

  // 자동 인정 그룹은 등록하는 순간 인정으로 시작하고 검수자가 반려할 때만 내려갑니다.
  const autoApproved = Boolean(group.auto_approve);
  const { error } = await supabase.from("proofs").insert({
    group_id: groupId,
    user_id: userId,
    evidence_path: evidencePath || null,
    problem_key: evidencePath ? evidencePath.split("/")[2] : recordKey,
    problem_title: title || null,
    problem_url: link?.url ?? null,
    solution_code: solutionCode || null,
    record_minutes: storedMinutes,
    start_minutes: storedStart,
    tags: tags.length ? tags : null,
    verification_status: autoApproved ? "AUTO_APPROVED" : "PENDING",
    accepted_at: new Date().toISOString(),
  });

  if (error) {
    // 하루는 한 구간이라 트리거가 둘째 기록을 막습니다. DB 문장을 그대로 보이지
    // 않게 하고 다음에 할 일을 알려줍니다.
    if (
      error.code === "P0001" &&
      error.message.includes("오늘은 이미 기록이 있습니다")
    )
      return {
        error: "오늘은 이미 도장을 찍었습니다. 시간은 퇴근 도장으로 채웁니다.",
      };
    // 응답 유실 후 같은 내용으로 재시도해도 기록은 한 번만 생성합니다.
    const duplicate = supabase
      .from("proofs")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .neq("verification_status", "CANCELING");
    const { data: existing } =
      error.code === "23505"
        ? await (evidencePath
            ? duplicate.eq("evidence_path", evidencePath)
            : duplicate.is("evidence_path", null).eq("problem_key", recordKey)
          ).maybeSingle()
        : { data: null };
    if (!existing)
      return { error: "인증 기록을 저장하지 못했습니다. 다시 시도해주세요." };
  }

  return { autoApproved };
}
