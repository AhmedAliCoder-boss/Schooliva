export function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Check your email address or login username and password. Usernames do not contain spaces, and role names such as \"School Admin\" cannot be used to sign in.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }
  if (normalized.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  if (normalized.includes("same_password")) {
    return "Choose a new password that is different from your current password.";
  }

  return "We could not complete authentication. Please try again.";
}