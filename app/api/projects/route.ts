import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function GET() {
  try {
    // 获取所有分析结果
    const results = await DatabaseAccess.getAllAnalysisResults();

    // 转换数据格式
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
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return NextResponse.json(
      { success: false, error: "获取项目列表失败" },
      { status: 500 }
    );
  }
}
