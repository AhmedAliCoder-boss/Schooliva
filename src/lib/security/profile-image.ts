export async function isSupportedProfileImage(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return (file.type === "image/jpeg" && isJpeg)
    || (file.type === "image/png" && isPng)
    || (file.type === "image/webp" && isWebp);
}
