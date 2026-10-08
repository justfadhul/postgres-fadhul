// Compressed download size of the PGlite engine (worker script, .wasm and .data),
// as served by GitHub Pages. scripts/check-size.mjs measures the build and fails
// if this figure drifts by more than 10%, so the warning shown to the learner
// stays true.
export const ENGINE_DOWNLOAD_BYTES = 5_900_000

export function formatMB(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}
