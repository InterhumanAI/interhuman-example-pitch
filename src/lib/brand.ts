export const APP_NAME = "The Pitch Practice";
export const APP_DOMAIN = "thepitchpractice.com";
export const APP_URL = `https://${APP_DOMAIN}`;
export const APP_PACKAGE_NAME = "the-pitch-practice";
export const CHALLENGE_STATS_STORAGE_KEY = "thepitchpractice_challenge_stats";
export const VIDEO_STORAGE_DB_NAME = "thepitchpractice-videos";

export interface OperatorDetails {
  /** Legal name of the company that runs this deployment (the GDPR controller). */
  name: string;
  /** Company registration number, shown next to the name. */
  registration: string;
  address: string;
  /** General privacy / terms contact address. */
  contactEmail: string;
  /** Formally appointed data protection officer (GDPR Art. 37), or null if none. */
  dpo: { name: string; email: string } | null;
  /** Public list of the operator's sub-processors, or null if there isn't one. */
  subprocessorsUrl: string | null;
  /**
   * True when the operator is also the company that runs the Interhuman AI
   * analysis platform this app calls (i.e. it is not a separate third party).
   */
  isAnalysisProvider: boolean;
}

/**
 * The legal operator / data controller named in the Privacy Policy and Terms.
 *
 * IF YOU DEPLOY YOUR OWN COPY OF THIS APP: replace every field below with your
 * own company's details (and set `dpo` to null if you haven't appointed one,
 * `isAnalysisProvider` to false, and `subprocessorsUrl` to your own list), then
 * re-read the Privacy Policy and Terms and have them reviewed. Publishing
 * another company's details as your controller would be wrong.
 */
export const OPERATOR: OperatorDetails = {
  name: "Interhuman AI ApS",
  registration: "CVR 44393034",
  address: "Højbro Pl. 10, 1200 Copenhagen, Denmark",
  contactEmail: "contact@interhuman.ai",
  dpo: { name: "Ammon Larson", email: "contact@interhuman.ai" },
  subprocessorsUrl: "https://trust.interhuman.ai/subprocessors",
  isAnalysisProvider: true,
};
