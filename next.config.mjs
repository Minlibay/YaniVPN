/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ssh2 содержит нативный биндинг — не бандлим его webpack'ом
    serverComponentsExternalPackages: ["ssh2"],
  },
};

export default nextConfig;
