import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['zh-CN', 'en'],

  // Used when no locale matches
  defaultLocale: 'zh-CN',
  
  localePrefix: 'as-needed' // Automatically hide the default locale prefix
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);