import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for URL redirects and auth checks
 *
 * Unified Login: All portal login pages now redirect to /login
 * This middleware handles backwards compatibility.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ============================================================
  // UNIFIED LOGIN REDIRECTS
  // Old login pages redirect to new unified /login
  // ============================================================

  // Platform Admin login redirect
  if (pathname === '/platform-admin/login') {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', '/platform-admin/dashboard');
    return NextResponse.redirect(url);
  }

  // Network Admin login redirect (the main /network-admin page was the login)
  // Keep /network-admin for backward compatibility with slugged logins for now
  // Only redirect explicit /network-admin/login if it exists
  if (pathname === '/network-admin/login') {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', '/network-admin/dashboard');
    return NextResponse.redirect(url);
  }

  // Operator Portal login redirect
  if (pathname === '/operator-portal/login') {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', '/operator-portal/dashboard');
    return NextResponse.redirect(url);
  }

  // Partner Portal login redirect
  if (pathname === '/partner/login') {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', '/partner/dashboard');
    return NextResponse.redirect(url);
  }

  // Test Portal admin login redirect
  if (pathname === '/test-portal/admin' && !request.cookies.has('test_session')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', '/test-portal/dashboard');
    return NextResponse.redirect(url);
  }

  // ============================================================
  // LEGACY ADMIN REDIRECT
  // Old /admin route had hardcoded credentials - deprecated
  // ============================================================
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.redirect(new URL('/network-admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Legacy admin
    '/admin/:path*',
    // Portal login pages for unified login redirect
    '/platform-admin/login',
    '/network-admin/login',
    '/operator-portal/login',
    '/partner/login',
    '/test-portal/admin',
  ],
};
