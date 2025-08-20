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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
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

  const handleAnchorClick = (e: React.MouseEvent<HTMLSpanElement>, headingId: string) => {
    e.preventDefault();
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      const newUrl = `${window.location.pathname}#${headingId}`;
      window.history.replaceState(window.history.state, '', newUrl);
    }
  };

  return (
    <div className="group fixed top-8 right-8 z-50">
      <div className="p-2 bg-popover bg-opacity-80 backdrop-blur-sm rounded-md shadow-lg cursor-pointer">
        <MenuIcon />
      </div>
      <div className=" bg-background absolute top-0 right-0 mt-10 w-auto bg-popover rounded-md shadow-xl  transition-opacity duration-300 invisible group-hover:visible pt-2 pb-2">
        <ul className="py-1 px-0 m-0">
          {headings
            .filter((i) => i.level === 2)
            .map((heading) => (
              <li key={heading.id} className=" list-none hover:bg-muted px-2">
                <span
                  onClick={(e) => handleAnchorClick(e, heading.id)}
                  className="block text-sm text-muted-foreground  px-2 py-2 cursor-pointer w-max"
                >
                  {heading.text}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export default PageNavigator;
