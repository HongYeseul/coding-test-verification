"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}
