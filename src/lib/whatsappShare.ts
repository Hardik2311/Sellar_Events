export const buildWhatsAppShareText = (template: string, eventTitle: string, shareUrl: string) => {
  const filled = template
    .replace('{{eventTitle}}', eventTitle)
    .replace('{{link}}', shareUrl);
  return filled.includes(shareUrl) ? filled : `${filled}\n${shareUrl}`;
};

export const openWhatsAppShare = (text: string) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};