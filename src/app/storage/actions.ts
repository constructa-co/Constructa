"use server";

import { caseStudyPhotoContentHash } from "@/lib/case-library/case-study-photo-behaviour";
import { validatePublicImage } from "@/lib/storage/public-image";
import { requireAuth } from "@/lib/supabase/auth-utils";

const PROFILE_IMAGE_PURPOSES = new Set(["branding", "case-study"]);

export async function uploadProfileImageAction(formData: FormData): Promise<{
  url?: string;
  error?: string;
}> {
  const file = formData.get("file");
  const purpose = formData.get("purpose");

  if (!(file instanceof File)) return { error: "No image was provided." };
  if (typeof purpose !== "string" || !PROFILE_IMAGE_PURPOSES.has(purpose)) {
    return { error: "Unsupported image purpose." };
  }

  try {
    const { user, supabase } = await requireAuth();
    const { contentType, extension } = await validatePublicImage(file);
    const objectId = purpose === "case-study"
      ? await caseStudyPhotoContentHash(file)
      : crypto.randomUUID();
    const path = `${user.id}/${purpose}/${objectId}.${extension}`;
    const { error } = await supabase.storage
      .from("proposal-photos")
      .upload(path, file, {
        cacheControl: "31536000",
        contentType,
        upsert: false,
      });

    const status = error && (error as { statusCode?: string | number; status?: number }).statusCode;
    const duplicateContent = purpose === "case-study" && String(status) === "409";
    if (error && !duplicateContent) return { error: "The image could not be uploaded." };
    // A content-addressed object in this authenticated user's folder can be
    // reused after a lost acknowledgement. The editor refuses a URL already
    // attached to the same example; no overwrite or duplicate object is needed.

    const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The image could not be uploaded.",
    };
  }
}
