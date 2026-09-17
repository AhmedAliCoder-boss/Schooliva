export function isSafeRelativePath(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("//") || value.startsWith("\\\\")) return false;
  if (!value.startsWith("/")) return false;

  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost" && !value.includes("\0");
  } catch {
    return false;
  }
}

export function getSafeSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL must be set in production for secure auth redirects.");
    }
    return "http://localhost:3000";
  }

  try {
    const parsed = new URL(configured);
    if (!parsed.protocol.startsWith("http")) throw new Error("Invalid site origin");
    return parsed.origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL is not a valid absolute origin.");
  }
}

export function validateUpload({
  mimeType,
  size,
  allowedMimeTypes,
  maxBytes,
}: {
  mimeType?: string | null;
  size?: number;
  allowedMimeTypes: string[];
  maxBytes: number;
}) {
  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    return { valid: false, reason: "Unsupported file type." };
  }

  if (typeof size === "number" && size > maxBytes) {
    return { valid: false, reason: "File exceeds the allowed size limit." };
  }

  return { valid: true, reason: "ok" };
}
