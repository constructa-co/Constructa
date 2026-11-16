import { describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_IMAGE_BYTES,
  PUBLIC_IMAGE_LIMITS_HINT,
  publicImageProblem,
  validatePublicImage,
} from "./public-image";

function imageFile(bytes: number[], type: string, name = "upload.bin") {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validatePublicImage", () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0xe0], "image/jpeg", "jpg"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", "png"],
    [
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      "image/webp",
      "webp",
    ],
  ])("accepts a valid %s upload", async (bytes, type, extension) => {
    await expect(validatePublicImage(imageFile(bytes, type))).resolves.toEqual({
      contentType: type,
      extension,
    });
  });

  it("rejects a MIME and signature mismatch", async () => {
    const spoofed = imageFile([0xff, 0xd8, 0xff], "image/png", "fake.png");
    await expect(validatePublicImage(spoofed)).rejects.toThrow(
      "file contents do not match",
    );
  });

  it("rejects unsupported active content", async () => {
    const svg = imageFile([0x3c, 0x73, 0x76, 0x67], "image/svg+xml", "logo.svg");
    await expect(validatePublicImage(svg)).rejects.toThrow(
      "Only JPEG, PNG and WebP",
    );
  });

  it("rejects oversized images before reading their contents", async () => {
    const oversized = new File(
      [new Uint8Array(MAX_PUBLIC_IMAGE_BYTES + 1)],
      "oversized.png",
      { type: "image/png" },
    );

    await expect(validatePublicImage(oversized)).rejects.toThrow("10 MB or smaller");
  });
});

describe("publicImageProblem", () => {
  it("passes each supported type up to and including the size limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(publicImageProblem({ size: 1, type })).toBeNull();
      expect(publicImageProblem({ size: MAX_PUBLIC_IMAGE_BYTES, type })).toBeNull();
    }
  });

  it.each([
    [{ size: 0, type: "image/png" }, "Choose a non-empty image file."],
    [{ size: MAX_PUBLIC_IMAGE_BYTES + 1, type: "image/png" }, "Images must be 10 MB or smaller."],
    [{ size: 1, type: "image/gif" }, "Only JPEG, PNG and WebP images are supported."],
    [{ size: 1, type: "" }, "Only JPEG, PNG and WebP images are supported."],
    [{ size: 1, type: "toString" }, "Only JPEG, PNG and WebP images are supported."],
  ])("says why %j is refused", (file, message) => {
    expect(publicImageProblem(file)).toBe(message);
  });

  it("gives the wording the upload itself gives", async () => {
    const gif = imageFile([0x47, 0x49, 0x46], "image/gif", "moving.gif");
    await expect(validatePublicImage(gif)).rejects.toThrow(publicImageProblem(gif)!);
  });

  it("states the limit the check enforces", () => {
    expect(MAX_PUBLIC_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(PUBLIC_IMAGE_LIMITS_HINT).toBe("JPEG, PNG or WebP, up to 10 MB each");
  });
});
