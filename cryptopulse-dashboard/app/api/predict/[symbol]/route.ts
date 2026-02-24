import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

export const runtime = "nodejs";

function asNumber(v: string | null, fallback: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function asMode(v: string | null) {
  const m = (v || "D").toUpperCase();
  return m === "A" || m === "D" ? m : "D";
}

/**
 * Walk upward from a starting directory to find the repo root
 * by locating ml/predict.py.
 */
function findRepoRoot(startDir: string, maxUp = 8): string | null {
  let dir = startDir;
  for (let i = 0; i <= maxUp; i++) {
    const candidate = path.join(dir, "ml", "predict.py");
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await context.params;
  const symbol = (rawSymbol || "").toUpperCase();

  const url = new URL(req.url);
  const horizon = asNumber(url.searchParams.get("horizon"), 60);
  const mode = asMode(url.searchParams.get("mode"));
  const thr = asNumber(url.searchParams.get("thr"), 0.0035);
  const asofRows = asNumber(url.searchParams.get("asof_rows"), 250);

  // 🔥 Robust root detection (no assumptions about process.cwd)
  const cwd = process.cwd();
  const repoRoot = findRepoRoot(cwd) ?? findRepoRoot(path.resolve(cwd, "..")) ?? null;

  if (!repoRoot) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not locate repo root (ml/predict.py not found).",
        cwd,
        hint: "Start `npm run dev` from inside `cryptopulse-dashboard` or repo root.",
      },
      { status: 500 }
    );
  }

  const scriptPath = path.join(repoRoot, "ml", "predict.py");
  const pyExe = path.join(repoRoot, ".venv-ml", "Scripts", "python.exe");

  // Validate paths before spawn (prevents ENOENT crash)
  const existsScript = fs.existsSync(scriptPath);
  const existsPy = fs.existsSync(pyExe);

  if (!existsScript || !existsPy) {
    return NextResponse.json(
      {
        ok: false,
        error: "Required file not found.",
        repoRoot,
        cwd,
        scriptPath,
        existsScript,
        pyExe,
        existsPy,
        fix: [
          "Make sure .venv-ml exists at repo root: <repo>/.venv-ml/Scripts/python.exe",
          "If your venv is elsewhere, move/copy it to repo root or recreate it there.",
        ],
      },
      { status: 500 }
    );
  }

  const args: string[] = [
    scriptPath,
    symbol,
    String(horizon),
    "--mode",
    mode,
    "--thr",
    String(thr),
    "--asof_rows",
    String(asofRows),
  ];

  return await new Promise((resolve) => {
    const child = spawn(pyExe, args, { cwd: repoRoot });

    let stdout = "";
    let stderr = "";

    // ✅ handle spawn error (prevents uncaughtException)
    child.on("error", (err: any) => {
      resolve(
        NextResponse.json(
          {
            ok: false,
            error: "Failed to spawn python process",
            message: err?.message ?? String(err),
            repoRoot,
            cwd,
            pyExe,
            scriptPath,
            args,
          },
          { status: 500 }
        )
      );
    });

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (code !== 0) {
        resolve(
          NextResponse.json(
            {
              ok: false,
              error: "predict.py exited with non-zero code",
              code,
              repoRoot,
              cwd,
              stderr: stderr || null,
              stdout: stdout || null,
              pyExe,
              scriptPath,
              args,
            },
            { status: 500 }
          )
        );
        return;
      }

      try {
        const obj = JSON.parse(stdout.trim());
        resolve(NextResponse.json({ ok: true, ...obj }));
      } catch {
        resolve(
          NextResponse.json(
            {
              ok: false,
              error: "predict.py output was not valid JSON",
              repoRoot,
              cwd,
              stdout: stdout.trim(),
              stderr: stderr || null,
            },
            { status: 500 }
          )
        );
      }
    });
  });
}