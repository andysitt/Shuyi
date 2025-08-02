-- 创建analysis_results表
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    repository_url TEXT UNIQUE NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    metadata JSONB NOT NULL,
    structure JSONB NOT NULL,
    dependencies JSONB NOT NULL,
    code_quality JSONB NOT NULL,
    llm_insights JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- 创建analysis_progress表
CREATE TABLE IF NOT EXISTS analysis_progress (
    id SERIAL PRIMARY KEY,
    repository_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- 创建索引
CREATE INDEX IF NOT EXISTS idx_analysis_results_repository_url ON analysis_results(repository_url);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at ON analysis_results(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_progress_repository_url ON analysis_progress(repository_url);
CREATE INDEX IF NOT EXISTS idx_analysis_progress_status ON analysis_progress(status);