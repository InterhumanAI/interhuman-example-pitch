/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["ws", "@vercel/blob", "undici"],
  },
};

export default nextConfig;
