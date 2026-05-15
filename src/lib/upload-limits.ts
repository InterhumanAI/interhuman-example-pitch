/** Interhuman API max upload size */
export const MAX_UPLOAD_SIZE_MB = 32;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

/** Vercel serverless hard body limit */
export const VERCEL_PLATFORM_MAX_MB = 4.5;

/** Safe target after multipart FormData overhead */
export const VERCEL_UPLOAD_MAX_MB = 4;
export const VERCEL_UPLOAD_MAX_BYTES = VERCEL_UPLOAD_MAX_MB * 1024 * 1024;

/** Warn in recorder UI when raw blob exceeds this before upload compression */
export const LARGE_RECORDING_WARNING_BYTES = 8 * 1024 * 1024;
