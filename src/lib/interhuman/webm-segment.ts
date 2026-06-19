// Splits the WebM init segment (header up to the first Cluster element
// 0x1F43B675) so subsequent chunks can be re-prepended with the init segment
// and decoded standalone by Interhuman.

export async function extractInitSegment(blob: Blob): Promise<Uint8Array | null> {
  const buffer = await blob.arrayBuffer();
  const view = new Uint8Array(buffer);

  for (let i = 0; i < view.length - 3; i++) {
    if (
      view[i] === 0x1f &&
      view[i + 1] === 0x43 &&
      view[i + 2] === 0xb6 &&
      view[i + 3] === 0x75
    ) {
      if (i === 0) return null;
      return view.slice(0, i);
    }
  }
  return null;
}

export function prependInitSegment(initSeg: Uint8Array, chunk: Uint8Array): Uint8Array {
  const combined = new Uint8Array(initSeg.length + chunk.length);
  combined.set(initSeg, 0);
  combined.set(chunk, initSeg.length);
  return combined;
}

export function findClusterOffset(view: Uint8Array): number {
  for (let i = 0; i < view.length - 3; i++) {
    if (
      view[i] === 0x1f &&
      view[i + 1] === 0x43 &&
      view[i + 2] === 0xb6 &&
      view[i + 3] === 0x75
    ) {
      return i;
    }
  }
  return -1;
}
