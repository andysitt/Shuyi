'use client';

import React, { useState } from 'react';

interface CodeBlockHeaderProps {
  language: string;
  code: string;
}

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5"></path>
    </svg>
  );

const CodeBlockHeader: React.FC<CodeBlockHeaderProps> = ({ language, code }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-between bg-gray-800 text-white px-4 py-2 rounded-t-md">
      <span className="text-xs font-sans">{language}</span>
      <button onClick={handleCopy} className="flex items-center gap-1 text-xs">
        {isCopied ? <CheckIcon /> : <CopyIcon />}
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

export default CodeBlockHeader;
