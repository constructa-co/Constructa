import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  upload: vi.fn(async (_path: string, _file: File, _options: { upsert: boolean }) => ({ error: null as null | { statusCode: string; message: string } })),
  auth: vi.fn(),
}));
vi.mock("@/lib/storage/public-image", () => ({ validatePublicImage: vi.fn(async () => ({ contentType: "image/png", extension: "png" })) }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.auth }));
import { uploadProfileImageAction } from "./actions";
function request(bytes: string, name = "photo.png", purpose = "case-study") {
  const data = new FormData(); data.set("file", new File([bytes], name, { type: "image/png" })); data.set("purpose", purpose); return data;
}
beforeEach(() => {
  mocks.upload.mockReset().mockResolvedValue({ error: null });
  mocks.auth.mockResolvedValue({ user: { id: "owner-a" }, supabase: { storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://assets.example.test/${path}` } }) }) } } });
});
describe("case-study content-addressed uploads", () => {
  it("reuses a user-scoped content path across names and calls", async () => {
    const one = await uploadProfileImageAction(request("same bytes", "first.png"));
    const two = await uploadProfileImageAction(request("same bytes", "renamed.png"));
    expect(two.url).toBe(one.url);
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^owner-a\/case-study\/[a-f0-9]{64}\.png$/);
    expect(mocks.upload.mock.calls[1][0]).toBe(mocks.upload.mock.calls[0][0]);
  });
  it("reuses a known content object after a conflict without overwriting it", async () => {
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "409", message: "Already exists" } });
    const reply = await uploadProfileImageAction(request("same bytes"));
    expect(reply.url).toMatch(/owner-a\/case-study\/[a-f0-9]{64}\.png$/);
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ upsert: false });
  });
  it("still refuses other storage errors", async () => {
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "403", message: "Forbidden" } });
    expect(await uploadProfileImageAction(request("same bytes"))).toEqual({ error: "The image could not be uploaded." });
  });
});
