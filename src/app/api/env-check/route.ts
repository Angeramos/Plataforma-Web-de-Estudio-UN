import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  const present = key.length > 0;
  const looksLikeSk = present && key.startsWith("sk-");

  return NextResponse.json({
    present,
    looksLikeSk,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
