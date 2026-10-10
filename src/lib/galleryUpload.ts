import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import { storage } from './firebase';
import type { GalleryMediaItem } from '../types/event.types';

// Gallery files never change once uploaded (new uploads get new names),
// so browsers and the CDN can cache them for a year.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const extensionFor = (item: GalleryMediaItem) => {
  if (item.type === 'video') return 'mp4';
  if (item.type === 'gif') return 'gif';
  return item.url.startsWith('data:image/webp') ? 'webp' : 'jpg';
};

/**
 * Uploads any gallery items that are still local (a compressed video file or a
 * data: URL) to `folder` in Storage and returns Firestore-ready items
 * ({ url, type } only). Items that already have a Storage URL are kept as-is.
 */
export const uploadGalleryMedia = async (
  items: GalleryMediaItem[],
  folder: string
): Promise<{ url: string; type: GalleryMediaItem['type'] }[]> => {
  const batch = Date.now();
  return Promise.all(
    items.map(async (item, i) => {
      if (!item.file && !item.url.startsWith('data:')) {
        return { url: item.url, type: item.type };
      }
      const fileRef = ref(storage, `${folder}/past-${batch}-${i}.${extensionFor(item)}`);
      if (item.file) {
        await uploadBytes(fileRef, item.file, {
          contentType: item.file.type || 'video/mp4',
          cacheControl: CACHE_CONTROL,
        });
      } else {
        await uploadString(fileRef, item.url, 'data_url', { cacheControl: CACHE_CONTROL });
      }
      return { url: await getDownloadURL(fileRef), type: item.type };
    })
  );
};
