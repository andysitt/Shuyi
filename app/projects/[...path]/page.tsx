'use client';

import Head from 'next/head';
import Script from 'next/script';
import './index.css';
import 'docsify/lib/themes/vue.css';
import { useEffect } from 'react';

const DocsifyPage = ({ params }: { params: { path: string[] } }) => {
  const { path } = params;

  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') return;

    // 初始化配置
    const initDocsify = () => {
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false });
      }

      window.$docsify = {
        homepage: '概述.md',
        name: '',
        repo: '',
        loadSidebar: true,
        basePath: `/docs/github.com|${path.join('|')}/`,
      };
    };

    initDocsify();

    // 动态加载 docsify
    const script = document.createElement('script');
    script.src = '//cdn.jsdelivr.net/npm/docsify@4';
    script.async = true;

    if (!document.querySelector('script[src*="docsify@4"]')) {
      document.body.appendChild(script);
    }

    return () => {
      const existingScript = document.querySelector('script[src*="docsify@4"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [path]);

  return (
    <>
      <Head>
        <title>Document - {path.join('/')}</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
        <meta name="description" content={`Documentation for ${path.join('/')}`} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
      </Head>

      {/* Styles are imported directly in the component */}

      <Script src="//cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js" strategy="lazyOnload" />
      <Script src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js" strategy="lazyOnload" />
      <Script src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js" strategy="lazyOnload" />
      <Script src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js" strategy="lazyOnload" />

      <main className="w-full h-screen">
        <div id="app"></div>
      </main>
    </>
  );
};

export default DocsifyPage;

// 扩展全局类型声明
declare global {
  interface Window {
    mermaid: any;
    $docsify: any;
  }
}
