-- CreateTable
CREATE TABLE "public"."analysis_results" (
    "id" SERIAL NOT NULL,
    "repository_url" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "structure" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "code_quality" JSONB NOT NULL,
    "llm_insights" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."markdown_docs" (
    "id" SERIAL NOT NULL,
    "project_path" TEXT NOT NULL,
    "doc_name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "content" TEXT NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markdown_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_repository_url_key" ON "public"."analysis_results"("repository_url");

-- CreateIndex
CREATE UNIQUE INDEX "markdown_docs_project_path_doc_name_language_is_draft_key" ON "public"."markdown_docs"("project_path", "doc_name", "language", "is_draft");
