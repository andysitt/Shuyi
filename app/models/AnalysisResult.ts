import mongoose, { Schema, Document } from "mongoose";
import {
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
  LLMInsights,
} from "@/app/types";

export interface IAnalysisResult extends Document {
  repositoryUrl: string;
  owner: string;
  repo: string;
  metadata: RepositoryMetadata;
  structure: RepositoryStructure;
  dependencies: DependencyInfo[];
  codeQuality: CodeQualityMetrics;
  llmInsights: LLMInsights | string;
  createdAt: Date;
  updatedAt: Date;
  status: "completed" | "failed";
}

const AnalysisResultSchema: Schema = new Schema({
  repositoryUrl: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  metadata: { type: Object, required: true },
  structure: { type: Object, required: true },
  dependencies: { type: Array, required: true },
  codeQuality: { type: Object, required: true },
  llmInsights: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["completed", "failed"], default: "completed" },
});

export default mongoose.models.AnalysisResult ||
  mongoose.model<IAnalysisResult>("AnalysisResult", AnalysisResultSchema);
