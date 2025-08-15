import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "进度ID不能为空" },
        { status: 400 }
      );
    }

    // 获取分析进度
    const progress = await DatabaseAccess.getAnalysisProgressById(id);

    if (!progress) {
      return NextResponse.json(
        { success: false, error: "未找到分析进度或已过期" },
        { status: 404 }
      );
    }

    // The progress object from Redis is already in the desired format.
    return NextResponse.json({
      success: true,
      progress: progress,
    });
  } catch (error) {
    console.error("获取分析进度失败:", error);
    return NextResponse.json(
      { success: false, error: "获取分析进度失败" },
      { status: 500 }
    );
  }
}