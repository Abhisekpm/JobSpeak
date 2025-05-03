import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure paths don't have trailing slashes (matches Netlify expectations)
  trailingSlash: false,
  // Helps with deployments, especially for nested paths
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
