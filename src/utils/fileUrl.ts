/**
 * Helper to append the active auth token to protected file URLs
 * when opening them in a new tab or rendering anchor links.
 */
export function getAuthenticatedFileUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';

  // Only append token for sensitive financial uploads
  if (!rawUrl.startsWith('/uploads/loans/') && !rawUrl.startsWith('/uploads/savings/')) {
    return rawUrl;
  }

  if (typeof window === 'undefined') {
    return rawUrl;
  }

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('memberToken') ||
    sessionStorage.getItem('memberPreviewToken');

  if (!token) {
    return rawUrl;
  }

  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}token=${encodeURIComponent(token)}`;
}
