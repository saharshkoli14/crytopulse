import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { symbol: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const horizon = searchParams.get("horizon") ?? "60";
    const symbol = decodeURIComponent(params.symbol);

    // ✅ point to your venv python
    const pyExe = path.join(process.cwd(), "..", "ingest", ".venv", "Scripts", "python.exe");

    // ✅ point to your repo root ml script
    const script = path.join(process.cwd(), "..", "ml", "predict.py");

    const args = [script, symbol, horizon];

    const out = await new Promise<string>((resolve, reject) => {
      const p = spawn(pyExe, args, {
        cwd: path.join(process.cwd(), ".."), // repo root
        env: { ...process.env }, // keep env vars
      });

      let stdout = "";
      let stderr = "";

      p.stdout.on("data", (d) => (stdout += d.toString()));
      p.stderr.on("data", (d) => (stderr += d.toString()));

      p.on("close", (code) => {
        if (code !== 0) return reject(new Error(stderr || `python exited ${code}`));
        resolve(stdout.trim());
      });
    });

    // predict.py prints JSON
    return NextResponse.json(JSON.parse(out));
  } catch (e: any) {
    return NextResponse.json(
      { error: "Python script failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
