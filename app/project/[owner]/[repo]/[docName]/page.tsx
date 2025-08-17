'use client';

import MarkdownViewer from '@/app/components/MarkdownViewer';

const ProjectDocsPage = ({ params }: { params: { owner: string; repo: string; docName: string } }) => {
  const { owner, repo, docName } = params;
  return (
    <div className="w-full h-full">
      <MarkdownViewer owner={owner} repo={repo} docName={docName} />
    </div>
  );
};

export default ProjectDocsPage;
