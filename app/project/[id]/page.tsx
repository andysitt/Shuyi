'use client';

import Head from 'next/head';
import Script from 'next/script';
import Link from 'next/link';
import { useEffect } from 'react';

const DocsifyPage = ({ params }: { params: { id: string } }) => {
  const { id } = params;

  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') return;

    // 初始化配置
    const initDocsify = () => {
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false });
      }

      window.$docsify = {
        name: '',
        repo: '',
        loadSidebar: true,
        basePath: `/docs/${id}/`,
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
  }, [id]);

  return (
    <>
      <Head>
        <title>Document - {id}</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
        <meta name="description" content={`Documentation for ${id}`} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, minimum-scale=1.0"
        />
      </Head>

      <link
        rel="stylesheet"
        href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css"
      />
      <link
        rel="stylesheet"
        href="//cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.css"
      />

      <Script
        src="//cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"
        strategy="lazyOnload"
      />
      <Script
        src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"
        strategy="lazyOnload"
      />
      <Script
        src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js"
        strategy="lazyOnload"
      />
      <Script
        src="//cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js"
        strategy="lazyOnload"
      />

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
