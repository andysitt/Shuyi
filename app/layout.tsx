import type { Metadata } from 'next';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitHub仓库智能分析器',
  description: '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式',
  keywords: ['GitHub', '代码分析', 'AI', '仓库分析', '代码质量'],
  authors: [{ name: 'GitHub Analyzer Team' }],
  openGraph: {
    title: 'GitHub仓库智能分析器',
    description: '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="dark">
        <Theme className="h-[100dvh]">{children}</Theme>
      </body>
    </html>
  );
}
