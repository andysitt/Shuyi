'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

export default function LanguageSwitcher() {
  const t = useTranslations('Navigation');
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  const toggleLanguage = () => {
    const newLocale = currentLocale === 'zh-CN' ? 'en-US' : 'zh-CN';
    const newPath = pathname?.replace(/^\/(zh-CN|en-US)/, '') || '/';
    router.push(`/${newLocale}${newPath}`);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleLanguage}
        className="flex items-center justify-center w-14 h-7 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('switchLanguage')}
      >
        {currentLocale === 'zh-CN' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="28" viewBox="0 0 56 28" className="w-full h-full">
            <title>Language toggle: Chinese active</title>
            <rect x="1" y="1" width="54" height="26" rx="13" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="2" y="2" width="26" height="24" rx="12" fill="currentColor" />
            <text
              x="15"
              y="17.2"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
              fontSize="9"
              textAnchor="middle"
              fill="#fff"
            >
              中
            </text>
            <text
              x="41"
              y="17.2"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
              fontSize="8"
              textAnchor="middle"
              fill="currentColor"
              opacity="0.7"
            >
              EN
            </text>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="28" viewBox="0 0 56 28" className="w-full h-full">
            <title>Language toggle: English active</title>
            <rect x="1" y="1" width="54" height="26" rx="13" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="28" y="2" width="26" height="24" rx="12" fill="currentColor" />
            <text
              x="15"
              y="17.2"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
              fontSize="9"
              textAnchor="middle"
              fill="currentColor"
              opacity="0.7"
            >
              中
            </text>
            <text
              x="41"
              y="17.2"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
              fontSize="8"
              textAnchor="middle"
              fill="#fff"
            >
              EN
            </text>
          </svg>
        )}
      </button>
    </div>
  );
}
