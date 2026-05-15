/** Safe, filterable console logs for pitch upload/analysis (no secrets). */
const PREFIX = "[PitchAnalyze]";

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const pitchAnalyzeLog = {
  info(message: string, data?: Record<string, unknown>) {
    if (data !== undefined) {
      console.info(PREFIX, message, data);
    } else {
      console.info(PREFIX, message);
    }
  },

  warn(message: string, data?: Record<string, unknown>) {
    if (data !== undefined) {
      console.warn(PREFIX, message, data);
    } else {
      console.warn(PREFIX, message);
    }
  },

  error(message: string, data?: Record<string, unknown>) {
    if (data !== undefined) {
      console.error(PREFIX, message, data);
    } else {
      console.error(PREFIX, message);
    }
  },

  formatMb,
};
