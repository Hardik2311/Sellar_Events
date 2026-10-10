import type { BufferTarget } from 'mediabunny';

// mediabunny is only downloaded when an organizer actually adds a video.
const loadMediabunny = () => import('mediabunny');

// In-browser video compression for the "From past nights" gallery, using the
// browser's own hardware encoders (WebCodecs) through mediabunny.
//
// Output: H.264 MP4 (plays everywhere), long edge capped at 1280px (720p),
// at most 30fps, constant-quality encoding where the browser supports it,
// AAC audio (Opus where AAC can't be encoded, e.g. Firefox).

/** Clips longer than this are cut to the first MAX_VIDEO_SECONDS. */
export const MAX_VIDEO_SECONDS = 60;
/** Anything bigger than this is refused before decoding (keeps phones from running out of memory). */
export const MAX_SOURCE_VIDEO_BYTES = 500 * 1024 * 1024;

const MAX_LONG_EDGE = 1280;
const MAX_FRAME_RATE = 30;
// 0 = very low … 1 = very high. 0.65 keeps fast motion and stage lighting clean at
// 720p (≈2 Mbps when the browser falls back to bitrate-based encoding).
const VIDEO_QUALITY = 0.65;

export type VideoCompressionErrorCode = 'unsupported' | 'no-video' | 'too-large' | 'failed';

export class VideoCompressionError extends Error {
  readonly code: VideoCompressionErrorCode;
  constructor(code: VideoCompressionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface CompressedVideo {
  blob: Blob;
  width: number;
  height: number;
  /** Length of the output in seconds. */
  durationSeconds: number;
  /** True when the clip was longer than MAX_VIDEO_SECONDS and was cut. */
  trimmed: boolean;
}

/** Whether this browser can encode H.264 at all (WebCodecs). */
export const canCompressVideo = async () => {
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) return false;
  try {
    const { canEncodeVideo } = await loadMediabunny();
    return await canEncodeVideo('avc', { width: 1280, height: 720 });
  } catch {
    return false;
  }
};

const toEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export const compressVideo = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<CompressedVideo> => {
  if (file.size > MAX_SOURCE_VIDEO_BYTES) {
    throw new VideoCompressionError('too-large', 'Videos must be under 500 MB.');
  }
  if (!(await canCompressVideo())) {
    throw new VideoCompressionError('unsupported', 'This browser can’t compress videos.');
  }

  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget: BufferTargetClass,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
    getFirstEncodableAudioCodec,
  } = await loadMediabunny();

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new VideoCompressionError('no-video', 'This file has no video in it.');

    const sourceDuration = await input.computeDuration();
    const trimmed = sourceDuration > MAX_VIDEO_SECONDS;
    const durationSeconds = Math.min(sourceDuration, MAX_VIDEO_SECONDS);

    // Scale so the long edge is at most 1280px; never upscale.
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(track.displayWidth, track.displayHeight));
    const width = toEven(track.displayWidth * scale);
    const height = toEven(track.displayHeight * scale);

    // Only cap the frame rate when the source is faster than 30fps (e.g. 60fps phone video).
    let frameRate: number | undefined;
    try {
      const stats = await track.computePacketStats(120);
      if (stats.averagePacketRate > MAX_FRAME_RATE + 1) frameRate = MAX_FRAME_RATE;
    } catch {
      frameRate = undefined;
    }

    const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus']);

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }), // moov first, so playback starts before the download ends
      target: new BufferTargetClass(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      trim: trimmed ? { start: 0, end: MAX_VIDEO_SECONDS } : undefined,
      video: {
        codec: 'avc',
        width,
        height,
        fit: 'contain',
        frameRate,
        quality: new Quality(VIDEO_QUALITY),
        forceTranscode: true,
      },
      audio: audioCodec
        ? { codec: audioCodec, numberOfChannels: 2, quality: new Quality('medium'), forceTranscode: true }
        : { discard: true },
      tags: {}, // drop location and device metadata from phone videos
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new VideoCompressionError('unsupported', 'This video format can’t be compressed in this browser.');
    }

    if (onProgress) conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)));
    await conversion.execute();

    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new VideoCompressionError('failed', 'Compression produced no output.');
    let blob = new Blob([buffer], { type: 'video/mp4' });

    // If the original is already a small, web-playable MP4 that needed no cutting
    // or resizing, keep whichever of the two is smaller.
    if (!trimmed && scale === 1 && !frameRate && file.type === 'video/mp4' && file.size <= blob.size) {
      blob = file;
    }

    return { blob, width, height, durationSeconds, trimmed };
  } catch (err) {
    if (err instanceof VideoCompressionError) throw err;
    console.error('Video compression failed:', err);
    throw new VideoCompressionError('failed', 'This video couldn’t be compressed. Try a different file.');
  } finally {
    input.dispose();
  }
};
