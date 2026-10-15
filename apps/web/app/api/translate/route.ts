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

const UPSTREAM_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateWithGoogle(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    `&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetchWithTimeout(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!response?.ok) return "";
  try {
    return decodeGoogleChunks(await response.json());
  } catch {
    return "";
  }
}

/** Free fallback (Google's endpoint is frequently rate limited from shared hosting such as HF Spaces). */
async function translateWithMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (text.length > 480) return "";
  const src = sourceLang === "auto" ? (/[\u3040-\u30ff]/.test(text) ? "ja" : /[\u4e00-\u9fff]/.test(text) ? "zh-CN" : "en") : sourceLang;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${src}|${targetLang}`)}`;
  const response = await fetchWithTimeout(url);
  if (!response?.ok) return "";
  try {
    const payload = (await response.json()) as { responseStatus?: number; responseData?: { translatedText?: string } };
    if (Number(payload.responseStatus) !== 200) return "";
    const out = String(payload.responseData?.translatedText ?? "").trim();
    return out && out.toLowerCase() !== text.toLowerCase() && !/MYMEMORY WARNING/i.test(out) ? out : "";
  } catch {
    return "";
  }
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

    const translation = (await translateWithGoogle(text, sourceLang, targetLang)) || (await translateWithMyMemory(text, sourceLang, targetLang));
    if (!translation) {
      return NextResponse.json({ success: false, error: "translate unavailable" }, { status: 502 });
    }
    return NextResponse.json({ success: true, translation });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "translate failed" },
      { status: 500 },
    );
  }
}

