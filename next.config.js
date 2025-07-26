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
}

module.exports = nextConfig