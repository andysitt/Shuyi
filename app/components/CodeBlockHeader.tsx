'use client';

import React, { useState } from 'react';
import { X, CopyIcon, CheckIcon } from 'lucide-react';

interface CodeBlockHeaderProps {
  language: string;
  code: string;
  onClose?: () => void;
}

const CodeBlockHeader: React.FC<CodeBlockHeaderProps> = ({ language, code, onClose }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-between bg-secondary text-secondary-foreground px-4 py-2 rounded-t-md">
      <span className="text-xs font-sans">{language}</span>
      <div className=" flex-grow"></div>
      <button onClick={handleCopy} className="flex items-center gap-1 text-xs hover:text-[#888]">
        {isCopied ? <CheckIcon /> : <CopyIcon />}
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
      {onClose && (
        <button onClick={onClose} className="flex items-center gap-1 text-xs hover:text-[#888]">
          <X />
        </button>
      )}
    </div>
  );
};

export default CodeBlockHeader;
