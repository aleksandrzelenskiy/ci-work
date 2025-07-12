/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // ставим с запасом: 100 мегабайт
      bodySizeLimit: '100mb',
    },
  },
};

module.exports = nextConfig;
