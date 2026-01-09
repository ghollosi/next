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
      // Platform admin API routes (login, etc.)
      {
        source: '/platform-admin/login',
        destination: `${apiUrl}/platform-admin/login`,
      },
      {
        source: '/platform-admin/admins/:path*',
        destination: `${apiUrl}/platform-admin/admins/:path*`,
      },
      {
        source: '/platform-admin/networks/:path*',
        destination: `${apiUrl}/platform-admin/networks/:path*`,
      },
      {
        source: '/platform-admin/settings/:path*',
        destination: `${apiUrl}/platform-admin/settings/:path*`,
      },
      {
        source: '/platform-admin/stripe/:path*',
        destination: `${apiUrl}/platform-admin/stripe/:path*`,
      },
      // Network admin API routes
      {
        source: '/network-admin/login',
        destination: `${apiUrl}/network-admin/login`,
      },
      {
        source: '/network-admin/auth/:path*',
        destination: `${apiUrl}/network-admin/auth/:path*`,
      },
      {
        source: '/network-admin/locations/:path*',
        destination: `${apiUrl}/network-admin/locations/:path*`,
      },
      {
        source: '/network-admin/partner-companies/:path*',
        destination: `${apiUrl}/network-admin/partner-companies/:path*`,
      },
      {
        source: '/network-admin/operators/:path*',
        destination: `${apiUrl}/network-admin/operators/:path*`,
      },
      {
        source: '/network-admin/drivers/:path*',
        destination: `${apiUrl}/network-admin/drivers/:path*`,
      },
      {
        source: '/network-admin/wash-events/:path*',
        destination: `${apiUrl}/network-admin/wash-events/:path*`,
      },
      {
        source: '/network-admin/prices/:path*',
        destination: `${apiUrl}/network-admin/prices/:path*`,
      },
      {
        source: '/network-admin/dashboard/:path*',
        destination: `${apiUrl}/network-admin/dashboard/:path*`,
      },
      {
        source: '/network-admin/settings/:path*',
        destination: `${apiUrl}/network-admin/settings/:path*`,
      },
      {
        source: '/network-admin/reports/:path*',
        destination: `${apiUrl}/network-admin/reports/:path*`,
      },
      {
        source: '/network-admin/invoices/:path*',
        destination: `${apiUrl}/network-admin/invoices/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
