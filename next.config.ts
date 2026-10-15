import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    agentFeedback: true,
    serverActions: {
      // Statement PDFs are uploaded through a server action (default 1MB).
      // The upload actions reject files over 4MB (Vercel caps request
      // bodies at 4.5MB).
      bodySizeLimit: "4.5mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
