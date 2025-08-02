import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证ID格式
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return NextResponse.json(
        { success: false, error: "无效的分析ID" },
        { status: 400 }
      );
    }

    // 获取分析结果
    const result = await DatabaseAccess.getAnalysisResultById(idNum);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "未找到分析结果" },
        { status: 404 }
      );
    }

    // 转换数据格式
    const analysisData = {
      metadata: result.metadata,
      structure: result.structure,
      dependencies: result.dependencies,
      codeQuality: result.codeQuality,
      llmInsights: result.llmInsights,
    };

    return NextResponse.json({
      success: true,
      data: analysisData,
    });
  } catch (error) {
    console.error("获取分析结果失败:", error);
    return NextResponse.json(
      { success: false, error: "获取分析结果失败" },
      { status: 500 }
    );
  }
}
