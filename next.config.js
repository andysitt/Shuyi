const withNextIntl = require('next-intl/plugin')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['simple-git'],
  },
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
  },
  webpack(config) {
    // 添加对SVG文件的支持
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    config.resolve.fallback = {
      path: require.resolve('path-browserify'),
    };
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
