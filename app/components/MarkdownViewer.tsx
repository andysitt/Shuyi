'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import RenderMarkDown from './RenderMarkDown';
import PageNavigator, { Heading } from './PageNavigator';
import '../project/[owner]/[repo]/[docName]/index.css';
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

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ owner, repo, docName = '概述' }) => {
  console.log('!!!!!!!!!!!', owner, repo, docName);
  const router = useRouter();

  const [sidebar, setSidebar] = useState<string>('');
  const [mainContent, setMainContent] = useState<string>('');
  const [activePath, setActivePath] = useState<string>(docName);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchContent = useCallback(async (name: string) => {
    try {
      setHeadings([]); // Clear old headings immediately
      const response = await fetch(`/docs/${owner}/${repo}/${name}`);
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
  }, []);

  // Fetch sidebar only once
  useEffect(() => {
    fetchContent('_sidebar.md');
  }, [fetchContent]);

  // Fetch content based on URL path
  useEffect(() => {
    const path = activePath || '概述';
    fetchContent(path + '.md');
  }, [activePath, fetchContent]);

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
    const newUrl = `/project/${owner}/${repo}/${docName}`;
    router.push(newUrl);
  };

  return (
    <div className="markdown-viewer">
      <aside className="sidebar">
        <ul>
          {menuItems.map((item) => (
            <li
              key={item.path}
              className={encodeURIComponent(item.path.replace('.md', '')) === activePath ? 'active' : ''}
              onClick={() => handleMenuClick(item.path.replace('.md', ''))}
            >
              {item.title}
            </li>
          ))}
        </ul>
      </aside>
      <main ref={contentRef} className="main-content prose dark:prose-invert relative">
        <PageNavigator headings={headings} />
        <RenderMarkDown content={mainContent} />
      </main>
    </div>
  );
};

export default MarkdownViewer;
