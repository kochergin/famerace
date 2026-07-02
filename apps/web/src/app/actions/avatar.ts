"use server";

import { revalidatePath } from "next/cache";
import { DomainError, media } from "@famerace/core";
import { requireCurrentUser } from "@/lib/session";

export async function uploadAvatarAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  try {
    const user = await requireCurrentUser();
    const target = formData.get("target") === "creator" ? ("creator" as const) : ("user" as const);
    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "No file received" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { url } = await media.storeAvatar(user.id, { bytes, declaredMime: file.type }, target);
    revalidatePath("/", "layout"); // avatars appear in the header and across boards
    return { url };
  } catch (error) {
    return { error: error instanceof DomainError ? error.message : "Upload failed — try another image" };
  }
}
