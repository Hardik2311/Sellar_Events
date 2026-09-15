// canvas.toDataURL() is synchronous — decoding it straight to a Blob here
// (rather than the async canvas.toBlob()) keeps ticket-image sharing inside
// the original click's transient user-activation window, which
// navigator.share() requires.
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

// Shares a ticket image, falling back to a text-only share if the browser
// doesn't support sharing files. Deliberately does NOT race navigator.share()
// against a timeout — Promise.race doesn't cancel the underlying browser
// share call, so "giving up" early on a slow/hung share still leaves it
// running internally, and the browser then rejects the *next* share attempt
// immediately with "Only one share can be in progress at once", making every
// subsequent click silently fail. Just awaiting the real promise (as before)
// is what actually works reliably.
export const shareTicketImage = async (
  dataUrl: string,
  filename: string,
  mime: string,
  textFallback: { title: string; text: string }
): Promise<void> => {
  if (typeof navigator.share !== 'function') return;
  const file = new File([dataUrlToBlob(dataUrl)], filename, { type: mime });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      await navigator.share(textFallback);
    }
  } catch {
    /* user cancelled, or share isn't available right now — nothing more we can do */
  }
};
