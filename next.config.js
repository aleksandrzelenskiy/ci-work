/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      // ставим с запасом: 100 мегабайт
      bodySizeLimit: '100mb',
    },
  },
};

module.exports = nextConfig;
