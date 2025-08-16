'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import dynamic from 'next/dynamic';
import CodeBlockHeader from './CodeBlockHeader';

const MermaidRenderer = dynamic(() => import('./MermaidRender'), {
  ssr: false,
});

// Helper to extract text from HAST node
const getCodeString = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.children) {
    return node.children.map(getCodeString).join('');
  }
  return '';
};


function RenderMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, rehypeHighlight]}
      components={{
        pre: (props: any) => {
          const { node, children, ...rest } = props;
          const codeNode = node.children[0];

          if (codeNode && codeNode.tagName === 'code') {
            const className = codeNode.properties.className || [];
            const languageClass = className.find((cls: string) => cls.startsWith('language-'));
            const language = languageClass ? languageClass.replace('language-', '') : 'text';
            
            const codeString = getCodeString(codeNode);

            if (language === 'mermaid') {
              return <MermaidRenderer code={codeString} />;
            }

            return (
              <div className="code-block-wrapper not-prose my-4">
                <CodeBlockHeader language={language} code={codeString} />
                <pre {...rest} className={`${rest.className || ''} text-sm rounded-b-md mt-0`}>
                  {children}
                </pre>
              </div>
            );
          }
          
          // Fallback for any other pre tags
          return <pre {...rest}>{children}</pre>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default RenderMarkdown;
