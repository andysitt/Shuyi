import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['zh-CN', 'en-US'],
  defaultLocale: 'zh-CN',
  localePrefix: 'as-needed', // 自动隐藏默认语言前缀
});

export const config = {
  matcher: [
    // 启用国际化路由
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
