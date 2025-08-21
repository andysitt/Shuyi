'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import RenderMarkDown from './RenderMarkDown';
import PageNavigator, { Heading } from './PageNavigator';
import './markdownViewer.css';
import 'highlight.js/styles/a11y-dark.css';

interface MarkdownViewerProps {
  owner: string;
  repo: string;
  docName?: string;
}

interface MenuItem {
  title: string;
  path: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ owner, repo, docName }) => {
  const t = useTranslations('Docs');
  const [sidebar, setSidebar] = useState<string>('');
  const [mainContent, setMainContent] = useState<string>('');
  const [activePath, setActivePath] = useState<string>(docName || '');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const currentLocale = useLocale();

  const fetchContent = useCallback(
    async (name: string) => {
      try {
        setHeadings([]); // Clear old headings immediately
        const response = await fetch(`/docs/${owner}/${repo}/${name}?lang=${currentLocale}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${name}`);
        }
        const text = await response.text();
        if (name === '_sidebar.md') {
          setSidebar(text);
        } else {
          setMainContent(text);
          setActivePath(name.replace('.md', ''));
        }
      } catch (error) {
        console.error(error);
        if (docName !== '_sidebar.md') {
          setMainContent(`# Error\n\nCould not load content for \"${docName}\".`);
        }
      }
    },
    [owner, repo, docName, currentLocale],
  );

  // Fetch sidebar only once
  useEffect(() => {
    fetchContent('_sidebar.md');
  }, [fetchContent]);

  // Fetch content based on URL path
  useEffect(() => {
    if (menuItems && menuItems[0]) {
      fetchContent(activePath ? activePath + '.md' : menuItems[0].path);
    }
  }, [activePath, fetchContent, menuItems]);

  // Parse sidebar markdown into menu items
  useEffect(() => {
    if (sidebar) {
      const items: MenuItem[] = sidebar
        .split('\n')
        .map((line) => {
          const match = line.match(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/);
          if (match) {
            return { title: match[1], path: match[2] };
          }
          return null;
        })
        .filter((item): item is MenuItem => item !== null);
      setMenuItems(items);
    }
  }, [sidebar]);

  // Extract headings from rendered content for on-page navigation
  useEffect(() => {
    if (!mainContent || !contentRef.current) return;
    const timeoutId = setTimeout(() => {
      if (!contentRef.current) return;
      const headingElements = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const extractedHeadings: Heading[] = Array.from(headingElements).map((el) => ({
        level: parseInt(el.tagName.substring(1), 10),
        text: (el as HTMLElement).innerText,
        id: el.id,
      }));
      setHeadings(extractedHeadings);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [mainContent]);

  const handleMenuClick = (docName: string) => {
    setActivePath(docName);
    const newUrl = `/project/${owner}/${repo}/${docName}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const newDocName = window.location.pathname.split('/').pop() || t('overview');
      setActivePath(newDocName);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [t]);

  return (
    <div className="markdown-viewer">
      <aside className="sidebar">
        <ul>
          {menuItems.map((item) => (
            <li
              key={item.path}
              className={
                encodeURIComponent(item.path.replace('.md', '')) === activePath ||
                item.path.replace('.md', '') === activePath
                  ? 'active'
                  : ''
              }
              onClick={() => handleMenuClick(item.path.replace('.md', ''))}
            >
              {item.title}
            </li>
          ))}
        </ul>
      </aside>
      <main ref={contentRef} className="main-content prose  dark:prose-invert relative">
        <PageNavigator headings={headings} />
        <RenderMarkDown content={mainContent} owner={owner} repo={repo} />
      </main>
    </div>
  );
};

export default MarkdownViewer;
