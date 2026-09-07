import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Monaco Editor to be transpiled
  transpilePackages: ["@monaco-editor/react"],
};

export default nextConfig;
