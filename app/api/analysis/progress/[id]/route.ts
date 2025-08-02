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
        { success: false, error: "无效的进度ID" },
        { status: 400 }
      );
    }

    // 获取分析进度
    const progress = await DatabaseAccess.getAnalysisProgressById(idNum);

    if (!progress) {
      return NextResponse.json(
        { success: false, error: "未找到分析进度" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: {
        id: progress.id,
        repositoryUrl: progress.repositoryUrl,
        status: progress.status,
        progress: progress.progress,
        stage: progress.stage,
        details: progress.details,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    console.error("获取分析进度失败:", error);
    return NextResponse.json(
      { success: false, error: "获取分析进度失败" },
      { status: 500 }
    );
  }
}
