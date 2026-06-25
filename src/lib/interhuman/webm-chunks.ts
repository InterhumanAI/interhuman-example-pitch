/**
 * Split a WebM byte stream into an init segment + Cluster frames so each
 * WebSocket message stays under Interhuman's 32 MB max message size.
 *
 * Interhuman's stream endpoint accepts a single self-contained WebM in one
 * binary frame, OR a sequence of frames where the FIRST frame carries the
 * init segment (EBML header + Segment header + Info + Tracks + any other
 * level-1 metadata) and subsequent frames are raw Cluster continuations.
 *
 * The hard part: Chrome's MediaRecorder muxes live, so the Segment and its
 * Clusters are written with *unknown* size (the size VINT is all-ones). We
 * can't trust size fields to find Cluster boundaries — we walk EBML elements,
 * and for an unknown-size element we scan its children until the next level-1
 * element ID appears. This is what naive byte-splitting got wrong (tripping
 * Interhuman's ih5004 malformed/truncated error): splitting mid-Cluster.
 *
 * No external imports so this stays unit-testable as plain JS.
 */

// Element IDs are stored *with* their length-marker bits (unlike sizes).
const ID_EBML_HEADER = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_CLUSTER = 0x1f43b675;

// Elements that live directly under Segment (EBML level 1). An unknown-size
// element ends when the next element of this set (or EOF) is encountered.
const LEVEL1_IDS = new Set<number>([
  0x114d9b74, // SeekHead
  0x1549a966, // Info
  0x1654ae6b, // Tracks
  0x1f43b675, // Cluster
  0x1c53bb6b, // Cues
  0x1043a770, // Chapters
  0x1254c367, // Tags
  0x1941a469, // Attachments
]);

export interface WebMSplit {
  /** Byte offset where the first Cluster begins (== init segment length). */
  firstClusterStart: number;
  /** Start offset of every Cluster element, in order. */
  clusterStarts: number[];
}

/** Number of bytes in a VINT given its first byte (1–8), or 0 if invalid. */
function vintLength(firstByte: number): number {
  for (let len = 1; len <= 8; len++) {
    if (firstByte & (0x80 >> (len - 1))) return len;
  }
  return 0;
}

/** Read an element ID (marker bits kept). Returns the id and the next offset. */
function readId(buf: Uint8Array, pos: number): { id: number; next: number } {
  const len = vintLength(buf[pos]);
  if (len === 0 || len > 4 || pos + len > buf.length) {
    throw new Error(`Invalid EBML id at ${pos}`);
  }
  let id = 0;
  for (let i = 0; i < len; i++) id = (id << 8) | buf[pos + i];
  return { id: id >>> 0, next: pos + len };
}

/**
 * Read an element data size (marker bit stripped). Returns size = null when
 * the element uses the "unknown size" encoding (all data bits set to 1).
 */
function readSize(buf: Uint8Array, pos: number): { size: number | null; next: number } {
  const len = vintLength(buf[pos]);
  if (len === 0 || pos + len > buf.length) {
    throw new Error(`Invalid EBML size at ${pos}`);
  }
  let value = buf[pos] & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) allOnes = false;
  }
  return { size: allOnes ? null : value, next: pos + len };
}

/**
 * Find where an unknown-size element ends: scan child elements (which carry
 * real sizes) until the next level-1 element ID, or EOF. Throws if a child
 * itself has an unknown size (unexpected — caller falls back to single frame).
 */
function scanToNextLevel1(buf: Uint8Array, start: number): number {
  let p = start;
  while (p < buf.length) {
    const { id, next: afterId } = readId(buf, p);
    if (LEVEL1_IDS.has(id)) return p; // boundary — don't consume it
    const { size, next: afterSize } = readSize(buf, afterId);
    if (size === null) {
      throw new Error(`Nested unknown-size element at ${p}`);
    }
    p = afterSize + size;
  }
  return buf.length;
}

/**
 * Locate the Cluster boundaries within the WebM stream. Returns only offsets —
 * the caller slices the *original* buffer so no bytes are ever dropped or
 * reconstructed. Throws on anything it doesn't recognize so callers can fall
 * back to sending the blob verbatim.
 */
export function splitWebm(bytes: Uint8Array): WebMSplit {
  let pos = 0;

  // EBML header (always a known size).
  const ebml = readId(bytes, pos);
  if (ebml.id !== ID_EBML_HEADER) {
    throw new Error("Not a WebM stream (missing EBML header)");
  }
  const ebmlSize = readSize(bytes, ebml.next);
  if (ebmlSize.size === null) throw new Error("Unknown-size EBML header");
  pos = ebmlSize.next + ebmlSize.size;

  // Segment header (size is typically unknown for live recordings).
  const seg = readId(bytes, pos);
  if (seg.id !== ID_SEGMENT) throw new Error("Missing Segment element");
  const segSize = readSize(bytes, seg.next);
  const segBodyStart = segSize.next;
  const segEnd = segSize.size === null ? bytes.length : segBodyStart + segSize.size;

  const clusterStarts: number[] = [];
  let p = segBodyStart;

  while (p < segEnd && p < bytes.length) {
    const elemStart = p;
    const { id, next: afterId } = readId(bytes, p);
    const { size, next: afterSize } = readSize(bytes, afterId);

    let elemEnd: number;
    if (size === null) {
      // Unknown size — only Clusters are expected to use this. Find its end by
      // scanning children to the next level-1 boundary.
      elemEnd = scanToNextLevel1(bytes, afterSize);
    } else {
      elemEnd = afterSize + size;
    }

    if (id === ID_CLUSTER) clusterStarts.push(elemStart);

    p = elemEnd;
  }

  if (clusterStarts.length === 0) {
    throw new Error("No Cluster elements found");
  }

  return { firstClusterStart: clusterStarts[0], clusterStarts };
}

export interface BuildFramesOptions {
  /**
   * Soft cap per frame. Frames stay well under Interhuman's 32 MB hard limit.
   * Clusters are never split, so a single oversized Cluster may exceed this
   * (still expected to be far below 32 MB at normal bitrates).
   */
  maxFrameBytes?: number;
}

const DEFAULT_MAX_FRAME_BYTES = 4 * 1024 * 1024; // 4 MB — comfortably < 32 MB

/**
 * Build the ordered list of binary frames to send by slicing the *original*
 * buffer at Cluster boundaries — never reconstructing it. This guarantees the
 * frames concatenate back to the exact input bytes (no dropped Cues/trailing
 * metadata, which is what produces Interhuman's ih5004 truncated error).
 *
 * Frame 0 spans [0 .. first cut) so it carries the init segment plus the first
 * batch of Clusters (a valid, playable WebM prefix). Each later frame begins on
 * a Cluster boundary, and the final frame always runs to bytes.length so every
 * trailing byte is included. Cut points are chosen greedily so each frame stays
 * under maxFrameBytes (a single Cluster larger than the cap still ships whole).
 *
 * Returns [bytes] unchanged when the stream can't be parsed or fits in one
 * frame — preserving the proven single-send path for short recordings.
 */
export function buildWebmFrames(
  bytes: Uint8Array,
  opts: BuildFramesOptions = {},
): Uint8Array[] {
  const max = opts.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;

  // Small enough for one message → send verbatim, exactly as before.
  if (bytes.byteLength <= max) return [bytes];

  let split: WebMSplit;
  try {
    split = splitWebm(bytes);
  } catch {
    return [bytes];
  }

  // Candidate cut points: every Cluster start after the first, plus the end of
  // the buffer. A frame is bytes[cutStart .. cutEnd). The init segment rides in
  // the first frame because the first cut never precedes the first Cluster.
  const boundaries = [...split.clusterStarts.slice(1), bytes.byteLength];

  const frames: Uint8Array[] = [];
  let frameStart = 0;
  let prev = 0; // last boundary that fit within the cap

  for (const b of boundaries) {
    if (b - frameStart > max && prev > frameStart) {
      // Adding up to b would overflow — cut at the previous boundary instead.
      frames.push(bytes.slice(frameStart, prev));
      frameStart = prev;
    }
    prev = b;
  }
  // Flush the remainder (always runs to bytes.length → nothing dropped).
  frames.push(bytes.slice(frameStart, bytes.byteLength));

  return frames;
}
