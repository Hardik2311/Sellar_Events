export interface ShareEventParams {
  shareUrl: string;
  isPrivate?: boolean;
  eventId?: string;
  onRegenerateCode?: (eventId: string) => Promise<string>;
}

// One-click share: uses the native share sheet if available, otherwise
// falls back to copying the link (with the access code baked in for
// private events). No intermediate modal.
export const shareEventLink = async ({
  shareUrl,
  isPrivate,
  eventId,
  onRegenerateCode,
}: ShareEventParams): Promise<'shared' | 'copied' | 'failed'> => {
  if (!shareUrl) {
    console.warn('Share link blocked: url is empty');
    return 'failed';
  }

  let message = shareUrl;
  if (isPrivate && eventId && onRegenerateCode) {
    const newCode = await onRegenerateCode(eventId);
    message = `Use code ${newCode} to access this event: ${shareUrl}`;
  }

  const shareData = isPrivate ? { text: message } : { url: shareUrl };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return 'shared';
      }
      console.warn('Native share blocked: navigator.canShare() returned false for', shareData);
    } catch (err) {
      const error = err as Error;
      if (error?.name === 'AbortError') return 'failed';
      console.error('Native share failed:', error?.name, error?.message);
    }
  }

  try {
    await navigator.clipboard.writeText(message);
    return 'copied';
  } catch (err) {
    console.error('Copy link fallback failed:', err);
    return 'failed';
  }
};