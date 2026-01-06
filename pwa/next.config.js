/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Rewrite API calls to the backend
  async rewrites() {
    // Use vsys-api for Docker network, localhost for local development
    const apiUrl = process.env.API_URL || 'http://vsys-api:3000';
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
        source: '/partner-portal/:path*',
        destination: `${apiUrl}/partner-portal/:path*`,
      },
      {
        source: '/operator-portal/:path*',
        destination: `${apiUrl}/operator-portal/:path*`,
      },
      {
        source: '/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
}

module.exports = nextConfig
