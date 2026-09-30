"use server";

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
    const path = `${user.id}/${purpose}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("proposal-photos")
      .upload(path, file, {
        cacheControl: "31536000",
        contentType,
        upsert: false,
      });

    if (error) return { error: "The image could not be uploaded." };

    const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The image could not be uploaded.",
    };
  }
}
