const MAX_PUBLIC_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": {
    extension: "jpg",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    matches: (bytes: Uint8Array) =>
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
} as const;

export type PublicImageType = keyof typeof IMAGE_TYPES;

/** The limits in words, for the label beside an image picker. Kept beside the check so the two cannot drift. */
export const PUBLIC_IMAGE_LIMITS_HINT = "JPEG, PNG or WebP, up to 10 MB each";

/**
 * Why a file would be refused, from its size and declared type alone, or null.
 * The upload itself uses this, so a screen can say the same thing before it
 * sends anything. The contents are still checked when the file is uploaded.
 */
export function publicImageProblem(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "Choose a non-empty image file.";
  if (file.size > MAX_PUBLIC_IMAGE_BYTES) return "Images must be 10 MB or smaller.";
  if (!Object.prototype.hasOwnProperty.call(IMAGE_TYPES, file.type)) {
    return "Only JPEG, PNG and WebP images are supported.";
  }
  return null;
}

export async function validatePublicImage(file: File): Promise<{
  contentType: PublicImageType;
  extension: string;
}> {
  if (!(file instanceof File)) {
    throw new Error("Choose a non-empty image file.");
  }

  const problem = publicImageProblem(file);
  if (problem) throw new Error(problem);

  const contentType = file.type as PublicImageType;
  const expected = IMAGE_TYPES[contentType];

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!expected.matches(bytes)) {
    throw new Error("The file contents do not match the selected image type.");
  }

  return { contentType, extension: expected.extension };
}

export { MAX_PUBLIC_IMAGE_BYTES };
