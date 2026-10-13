import { describe, expect, it } from "vitest";

import { isSupportedProfileImage } from "../../src/lib/security/profile-image";

describe("profile image content validation", () => {
  it("accepts JPEG, PNG, and WebP signatures only when the MIME type matches", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "photo.jpg", { type: "image/jpeg" });
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" });
    const webp = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])], "photo.webp", { type: "image/webp" });

    await expect(isSupportedProfileImage(jpeg)).resolves.toBe(true);
    await expect(isSupportedProfileImage(png)).resolves.toBe(true);
    await expect(isSupportedProfileImage(webp)).resolves.toBe(true);
  });

  it("rejects mismatched and unsupported image content", async () => {
    const mismatched = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.jpg", { type: "image/jpeg" });
    const unsupported = new File(["not an image"], "photo.png", { type: "image/png" });

    await expect(isSupportedProfileImage(mismatched)).resolves.toBe(false);
    await expect(isSupportedProfileImage(unsupported)).resolves.toBe(false);
  });
});
