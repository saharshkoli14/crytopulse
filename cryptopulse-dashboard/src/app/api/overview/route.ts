import { NextResponse } from "next/server";
import { getOverviewData } from "@/lib/getOverview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getOverviewData();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Overview API error:", err);
    return NextResponse.json(
      { error: "Failed to load overview data" },
      { status: 500 }
    );
  }
}