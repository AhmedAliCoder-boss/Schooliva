export function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email ya updated login username aur password check karein. Username mein space nahi hota; account ka role name (jaise School Admin) login username nahi hota.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Pehle apni email confirm karein, phir sign in karein.";
  }
  if (normalized.includes("rate limit")) {
    return "Bahut zyada attempts ho gaye. Thodi der baad try karein.";
  }
  if (normalized.includes("same_password")) {
    return "Naya password purane password se different hona chahiye.";
  }

  return "Authentication complete nahi ho saki. Dobara try karein.";
}