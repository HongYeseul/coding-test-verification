import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/proofs/[id]/evidence">,
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user) return new Response(null, { status: 401, headers });
  const { data: proof } = await supabase
    .from("proofs")
    .select("group_id, evidence_path")
    .eq("id", id)
    .maybeSingle();
  if (!proof?.evidence_path)
    return new Response(null, { status: 404, headers });
  const { data: member } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", proof.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (member?.status !== "ACTIVE")
    return new Response(null, { status: 404, headers });
  const { data, error } = await supabase.storage
    .from("proof-evidence")
    .createSignedUrl(proof.evidence_path, 60);
  if (error || !data) return new Response(null, { status: 404, headers });
  return new Response(null, {
    status: 302,
    headers: { ...headers, Location: data.signedUrl },
  });
}
