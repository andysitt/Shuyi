import createMiddleware from 'next-intl/middleware';
import { routing } from './app/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Handle locales for all paths
    '/(zh-CN|en-US)/:path*',

    // Enable redirects that add missing locales
    // (e.g. `/pathnames` -> `/en/pathnames`)
    // But exclude API routes, static files, and other special paths
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
