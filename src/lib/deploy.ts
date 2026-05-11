const repositoryUrl = encodeURIComponent(
  "https://github.com/InterhumanAI/interhuman-example-pitch"
);
const envDescription = encodeURIComponent(
  "Your Interhuman API key is required for pitch analysis. Supabase vars are optional for the leaderboard."
);
const envLink = encodeURIComponent(
  "https://docs.interhuman.ai/how-to/get-api-key"
);

export const VERCEL_DEPLOY_URL = `https://vercel.com/new/clone?repository-url=${repositoryUrl}&project-name=interhuman-example-pitch&repository-name=interhuman-example-pitch&env=INTERHUMAN_API_KEY&envDescription=${envDescription}&envLink=${envLink}`;
