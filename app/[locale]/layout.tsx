import type { Metadata } from 'next';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import '@/app/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  // 设置请求的语言环境
  setRequestLocale(locale);

  // 根据语言环境设置不同的元数据
  const metadataBase = new URL('https://shuyi.example.com'); // 替换为实际的网站URL

  return {
    metadataBase,
    title: locale === 'en' ? 'Shuyi - AI Code Analysis' : '述义-AI代码分析',
    description:
      locale === 'en'
        ? 'Using AI technology to deeply analyze GitHub repository structure, code quality and architecture patterns, and generate documentation'
        : '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式，并生成文档',
    keywords:
      locale === 'en'
        ? ['GitHub', 'Code Analysis', 'AI', 'Repository Analysis', 'Code Quality']
        : ['GitHub', '代码分析', 'AI', '仓库分析', '代码质量'],
    authors: [{ name: 'shijie' }],
    openGraph: {
      title: locale === 'en' ? 'Shuyi - AI Code Analysis' : '述义-AI代码分析',
      description:
        locale === 'en'
          ? 'Using AI technology to deeply analyze GitHub repository structure, code quality and architecture patterns, and generate documentation'
          : '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式，并生成文档',
      type: 'website',
    },
  };
}

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // 设置请求的语言环境
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Theme className="h-[100dvh]">{children}</Theme>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
