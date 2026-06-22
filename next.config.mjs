import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// @vercel/blob's package.json "browser" field maps undici to this fetch-based
// stub. We apply it manually because Next doesn't honor that field.
const undiciBrowserStub = path.join(
  path.dirname(require.resolve("@vercel/blob")),
  "undici-browser.js",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ws stays external (Node-only, used by the server WS analyze route).
    serverComponentsExternalPackages: ["ws"],
  },
  webpack: (config) => {
    // @vercel/blob/client (used for client-direct uploads) transitively imports
    // undici, whose modern `#x in this` syntax webpack's parser can't read.
    // undici is Node-only; in the browser the SDK uses global fetch. Alias it
    // to the SDK's browser stub so real undici never gets parsed.
    //
    // This must apply on ALL compilers (client, server, edge) — a "use client"
    // module is still walked by the server/edge passes for RSC references, and
    // those would otherwise hit the unparseable undici.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      undici$: undiciBrowserStub,
      undici: undiciBrowserStub,
    };
    return config;
  },
};

export default nextConfig;
