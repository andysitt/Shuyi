import { Suspense } from 'react';
import AnalyzePageClient from '@/app/components/AnalyzePageClient';

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AnalyzePageClient />
    </Suspense>
  );
}