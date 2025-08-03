'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  code: string;
}

export default function MermaidRenderer({ code }: MermaidRendererProps) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    mermaid
      .render(`mermaid-${Math.random().toString(36).substring(2)}`, code)
      .then(({ svg }) => setSvg(svg))
      .catch((err) => console.error('Mermaid render error:', err));
  }, [code]);

  return (
    <div
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
