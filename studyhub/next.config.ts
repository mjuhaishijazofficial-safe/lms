import type { NextConfig } from "next";

// Uploads travel through Server Actions and proxy.ts. Both cap request bodies (1 MB and 10 MB by default) and
// proxy.ts silently truncates larger bodies, so both limits sit above the largest allowed upload (MAX_UPLOAD_MB, max 55).
const BODY_LIMIT = "60mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: BODY_LIMIT },
    proxyClientMaxBodySize: BODY_LIMIT,
  },
};

export default nextConfig;
