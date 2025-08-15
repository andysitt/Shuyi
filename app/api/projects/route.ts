import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryUrl = searchParams.get("repositoryUrl");

    if (repositoryUrl) {
      // Get a single analysis result by repositoryUrl
      const result = await DatabaseAccess.getAnalysisResult(repositoryUrl);

      if (!result) {
        return NextResponse.json(
          { success: false, error: "项目未找到" },
          { status: 404 }
        );
      }

      const project = {
        id: result.id.toString(),
        repositoryUrl: result.repositoryUrl,
        name: result.metadata.name,
        description: result.metadata.description,
        stars: result.metadata.stars,
        language: result.metadata.language,
        createdAt: result.createdAt,
      };

      return NextResponse.json({
        success: true,
        project,
      });
    } else {
      // Get all analysis results
      const results = await DatabaseAccess.getAllAnalysisResults();

      // Transform data format
      const projects = results.map((result) => ({
        id: result.id.toString(),
        repositoryUrl: result.repositoryUrl,
        name: result.metadata.name,
        description: result.metadata.description,
        stars: result.metadata.stars,
        language: result.metadata.language,
        createdAt: result.createdAt,
      }));

      return NextResponse.json({
        success: true,
        projects,
      });
    }
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return NextResponse.json(
      { success: false, error: "获取项目列表失败" },
      { status: 500 }
    );
  }
}