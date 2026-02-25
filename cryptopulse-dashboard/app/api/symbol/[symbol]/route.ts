import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

type Params = { symbol: string };

export async function GET(req: Request, { params }: { params: Params }): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);

    const mode = (searchParams.get("mode") ?? "D").toUpperCase(); // A or D
    const horizon = Number(searchParams.get("horizon") ?? "60");
    const thr = Number(searchParams.get("thr") ?? "0.0035");

    const symbol = String(params.symbol || "").toUpperCase();

    // ✅ build command args exactly like your local calls
    const args: string[] = [path.join("ml", "predict.py"), symbol, String(horizon), "--mode", mode];

    // only include thr for D mode
    if (mode === "D") {
      args.push("--thr", String(thr));
    }

    const pythonExe =
      process.env.PYTHON_EXE ||
      (process.platform === "win32" ? ".\\.venv-ml\\Scripts\\python.exe" : "./.venv-ml/bin/python");

    const cwd = process.cwd();

    const output = await new Promise<string>((resolve, reject) => {
      const p = spawn(pythonExe, args, { cwd });

      let stdout = "";
      let stderr = "";

      p.stdout.on("data", (d) => (stdout += d.toString()));
      p.stderr.on("data", (d) => (stderr += d.toString()));

      p.on("error", reject);

      p.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `predict.py exited with code ${code}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });

    // predict.py prints JSON
    const parsed = JSON.parse(output);

    // ✅ always return a proper Response type
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Prediction failed",
      },
      { status: 500 }
    );
  }
}