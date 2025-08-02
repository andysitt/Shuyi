import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function POST(
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

    // 更新分析状态为已取消
    await DatabaseAccess.updateAnalysisProgress(idNum, {
      status: "failed",
      details: "用户取消了分析",
    });

    return NextResponse.json({
      success: true,
      message: "分析已取消",
    });
  } catch (error) {
    console.error("取消分析失败:", error);
    return NextResponse.json(
      { success: false, error: "取消分析失败" },
      { status: 500 }
    );
  }
}
