import mongoose, { Schema, Document } from "mongoose";

export interface IAnalysisProgress extends Document {
  repositoryUrl: string;
  status: "pending" | "analyzing" | "completed" | "failed";
  progress: number;
  stage: string;
  details: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisProgressSchema: Schema = new Schema({
  repositoryUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "analyzing", "completed", "failed"],
    default: "pending",
  },
  progress: { type: Number, default: 0 },
  stage: { type: String, required: true },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.AnalysisProgress ||
  mongoose.model<IAnalysisProgress>("AnalysisProgress", AnalysisProgressSchema);
