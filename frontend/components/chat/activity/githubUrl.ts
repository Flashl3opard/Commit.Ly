/**
 * Only ever returns an https://github.com/... URL — GitHub URLs are
 * external, untrusted-origin data as far as the frontend is concerned
 * (Chat Service already validates this server-side, but the UI never
 * trusts that alone). Any other scheme/host returns null.
 */
export function safeGithubUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
