'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import dynamic from 'next/dynamic';
import CodeBlockHeader from './CodeBlockHeader';
import hljs from 'highlight.js';
import 'highlight.js/styles/a11y-dark.css';

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

const SnippetModal = ({
  isOpen,
  onClose,
  fileUrl,
  hash,
}: {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  hash: string;
}) => {
  const [snippet, setSnippet] = useState('');
  const [lang, setLang] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef(null);

  useEffect(() => {
    if (isOpen && fileUrl) {
      const fetchSnippet = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Assume default branch is 'main'. This might need to be more dynamic in a real app.
          const fullPath = fileUrl.replace(/^(\/[^\/]+\/[^\/]+)/, '$1/blob/main');
          const response = await fetch(
            `/api/github/snippet?fileUrl=${encodeURIComponent(fullPath)}&hash=${encodeURIComponent(hash)}`,
          );
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to fetch snippet');
          }
          const data = await response.json();
          setSnippet(data.snippet);
          setLang(data.lang);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSnippet();
    }
  }, [isOpen, fileUrl, hash]);
  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [snippet]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 h-full">
      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {snippet && (
        <div className="code-block-wrapper not-prose my-4 h-[60%] absolute top-[50%] translate-y-[-50%] w-[80%] flex flex-col">
          <CodeBlockHeader language={fileUrl + hash} code={snippet} onClose={onClose} />
          <pre className={`text-sm rounded-b-md mt-0 flex-shrink overflow-hidden`}>
            <code ref={codeRef} className={`hljs language-${lang} p-4 block overflow-scroll h-full`}>
              {snippet}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};

function RenderMarkdown({ content, owner, repo }: { content: string; owner: string; repo: string }) {
  const [modalState, setModalState] = useState({ isOpen: false, fileUrl: '', hash: '' });

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const url = new URL(href, window.location.origin);
    const isRelative = url.hostname === window.location.hostname;
    const isGithubLink = !(href.startsWith('http') || href.startsWith('//'));

    if (isRelative && isGithubLink) {
      const realHref = `\\${owner}\\${repo}\\${href}`;
      const realUrl = new URL(realHref, window.location.origin);
      e.preventDefault();
      setModalState({ isOpen: true, fileUrl: realUrl.pathname, hash: url.hash });
    }
  };

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
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
                    <span className="hljs mb-0 p-4 block min-h-full overflow-auto">{children}</span>
                  </pre>
                </div>
              );
            }

            // Fallback for any other pre tags
            return <pre {...rest}>{children}</pre>;
          },
          a: (props: any) => {
            const { href, children, ...rest } = props;
            const isExternal = href.startsWith('http');
            return (
              <a
                href={href}
                {...rest}
                onClick={(e) => handleLinkClick(e, href)}
                {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      <SnippetModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, fileUrl: '', hash: '' })}
        fileUrl={modalState.fileUrl}
        hash={modalState.hash}
      />
    </>
  );
}

export default RenderMarkdown;
