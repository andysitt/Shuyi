'use client';

import MarkdownViewer from '@/app/components/MarkdownViewer';

const ProjectDocsPage = ({ params }: { params: { owner: string; repo: string } }) => {
  const { owner, repo } = params;
  return (
    <div className="w-full h-full">
      <MarkdownViewer owner={owner} repo={repo} docName={'概述'} />
    </div>
  );
};

export default ProjectDocsPage;
