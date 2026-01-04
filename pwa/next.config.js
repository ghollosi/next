/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Rewrite API calls to the backend
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      {
        source: '/pwa/:path*',
        destination: `${apiUrl}/pwa/:path*`,
      },
      {
        source: '/operator/:path*',
        destination: `${apiUrl}/operator/:path*`,
      },
      {
        source: '/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
}

module.exports = nextConfig
