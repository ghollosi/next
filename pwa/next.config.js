/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Rewrite API calls to the backend
  // NOTE: Only rewrite actual API paths, not PWA page routes!
  // The platform-api.ts and network-admin-api.ts call the API directly via getApiUrl()
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://vsys-app:3000';
    return [
      // Core API endpoints only
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
        source: '/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
}

module.exports = nextConfig
