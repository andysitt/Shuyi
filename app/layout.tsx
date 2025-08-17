import type { Metadata } from 'next';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: '述义-AI代码分析',
  description: '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式，并生成文档',
  keywords: ['GitHub', '代码分析', 'AI', '仓库分析', '代码质量'],
  authors: [{ name: 'GitHub Analyzer Team' }],
  openGraph: {
    title: '述义-AI代码分析',
    description: '使用AI技术深入分析GitHub仓库结构、代码质量和架构模式，并生成文档',
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
