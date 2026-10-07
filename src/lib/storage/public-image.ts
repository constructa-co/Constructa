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

export async function validatePublicImage(file: File): Promise<{
  contentType: PublicImageType;
  extension: string;
}> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a non-empty image file.");
  }

  if (file.size > MAX_PUBLIC_IMAGE_BYTES) {
    throw new Error("Images must be 10 MB or smaller.");
  }

  const contentType = file.type as PublicImageType;
  const expected = IMAGE_TYPES[contentType];
  if (!expected) {
    throw new Error("Only JPEG, PNG and WebP images are supported.");
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!expected.matches(bytes)) {
    throw new Error("The file contents do not match the selected image type.");
  }

  return { contentType, extension: expected.extension };
}

export { MAX_PUBLIC_IMAGE_BYTES };
