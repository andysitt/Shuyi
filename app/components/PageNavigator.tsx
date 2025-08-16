'use client';

import React from 'react';

export interface Heading {
  level: number;
  text: string;
  id: string;
}

interface PageNavigatorProps {
  headings: Heading[];
}

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const PageNavigator: React.FC<PageNavigatorProps> = ({ headings }) => {
  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="group fixed top-28 right-8 z-50">
      <div className="p-2 bg-white bg-opacity-80 backdrop-blur-sm rounded-md shadow-lg cursor-pointer">
        <MenuIcon />
      </div>
      <div className="absolute top-0 right-0 mt-10 w-64 bg-white rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 invisible group-hover:visible pt-2 pb-2">
        <div className="font-semibold text-sm text-gray-700 px-4 py-2 border-b">On this page</div>
        <ul className="py-1">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className="block text-sm text-gray-600 hover:bg-gray-100 px-4 py-2"
                style={{ paddingLeft: `${heading.level}rem` }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PageNavigator;
