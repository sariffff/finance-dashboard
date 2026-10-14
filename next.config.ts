import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    agentFeedback: true,
    serverActions: {
      // Statement PDFs are uploaded through a server action (default 1MB).
      // The upload action itself rejects files over 5MB.
      bodySizeLimit: "6mb",
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
