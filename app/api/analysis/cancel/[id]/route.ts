import { NextResponse } from "next/server";
import { DatabaseAccess } from "@/app/lib/db-access";

export async function POST(
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

    // 删除分析进度记录
    await DatabaseAccess.deleteAnalysisProgress(id);

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