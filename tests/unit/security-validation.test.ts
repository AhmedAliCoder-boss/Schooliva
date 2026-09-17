import { describe, expect, it } from "vitest";
import { getSafeSiteOrigin, isSafeRelativePath, validateUpload } from "../../src/lib/security/validation";

describe("security validation", () => {
  it.each(["/dashboard", "/auth/callback?next=%2Fdashboard", "/reports#fees"]) (
    "accepts safe relative path %s",
    (path) => expect(isSafeRelativePath(path)).toBe(true),
  );

  it.each(["https://evil.example", "//evil.example", "\\\\evil.example", "dashboard", "/\0bad"]) (
    "rejects unsafe redirect %s",
    (path) => expect(isSafeRelativePath(path)).toBe(false),
  );

  it("uses the configured origin without preserving a path", () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://schooliva.example/app";
    expect(getSafeSiteOrigin()).toBe("https://schooliva.example");
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("rejects unsupported and oversized uploads", () => {
    expect(validateUpload({ mimeType: "text/html", size: 10, allowedMimeTypes: ["application/pdf"], maxBytes: 100 }).valid).toBe(false);
    expect(validateUpload({ mimeType: "application/pdf", size: 101, allowedMimeTypes: ["application/pdf"], maxBytes: 100 }).valid).toBe(false);
  });
});
