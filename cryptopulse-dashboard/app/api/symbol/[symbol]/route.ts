import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : null;
}

function pickErrorMessage(payload: unknown): string | null {
  const r = asRecord(payload);
  const err = r?.error;
  return typeof err === "string" ? err : null;
}

export async function GET(req: Request, ctx: { params: { symbol: string } }) {
  try {
    const { symbol } = ctx.params;
    const url = new URL(req.url);

    // forward query params as-is
    const base = process.env.DATA_API_BASE_URL;
    if (!base) {
      return NextResponse.json(
        { ok: false, error: "Missing env DATA_API_BASE_URL" },
        { status: 500 }
      );
    }

    // Example backend endpoint:
    // `${DATA_API_BASE_URL}/symbol/BTCUSD?tf=1m&limit=500`
    const backend = new URL(
      `${base.replace(/\/+$/, "")}/symbol/${encodeURIComponent(symbol)}`
    );

    url.searchParams.forEach((v, k) => backend.searchParams.set(k, v));

    const r = await fetch(backend.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const payload: unknown = await r.json().catch(() => null);

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: pickErrorMessage(payload) ?? `Backend error (${r.status})`,
          raw: payload,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}