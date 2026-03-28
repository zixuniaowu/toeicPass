import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const MAX_TEXT_LENGTH = 4000;

type TranslateBody = {
  text?: string;
  targetLang?: string;
  sourceLang?: string;
};

function decodeGoogleChunks(payload: unknown): string {
  const root = Array.isArray(payload) ? payload : [];
  const chunks = Array.isArray(root[0]) ? (root[0] as unknown[]) : [];
  return chunks
    .map((item) => String((item as unknown[])[0] ?? ""))
    .join("")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
    const text = String(body.text ?? "").trim();
    const targetLang = String(body.targetLang ?? "").trim() || "ja";
    const sourceLang = String(body.sourceLang ?? "").trim() || "auto";

    if (!text) {
      return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ success: false, error: "text too long" }, { status: 413 });
    }

    const endpoint =
      "https://translate.googleapis.com/translate_a/single?client=gtx" +
      `&sl=${encodeURIComponent(sourceLang)}` +
      `&tl=${encodeURIComponent(targetLang)}` +
      "&dt=t&q=" +
      encodeURIComponent(text);

    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `translate failed (${response.status})` }, { status: 502 });
    }

    const payload = (await response.json()) as unknown;
    const translation = decodeGoogleChunks(payload);
    return NextResponse.json({ success: true, translation });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "translate failed" },
      { status: 500 },
    );
  }
}

