import { NextResponse } from "next/server";
import { progressManager } from "@/app/service/progress-manager";

export async function POST(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = params;

    if (!path || path.length === 0) {
      return NextResponse.json(
        { success: false, error: "Repository path is required" },
        { status: 400 }
      );
    }

    const repoPath = path.join('/');
    const repositoryUrl = `https://github.com/${repoPath}`;

    await progressManager.delete(repositoryUrl);

    return NextResponse.json({
      success: true,
      message: "Analysis cancelled",
    });
  } catch (error) {
    console.error("Failed to cancel analysis:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel analysis" },
      { status: 500 }
    );
  }
}
