import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RSSItem = {
  title: string;
  description: string;
  link: string;
  date: string;
  source: string;
};

type NewsArticle = {
  id: string;
  title: string;
  description: string;
  source: string;
  date: string;
  sentences: Array<{ id: number; text: string }>;
};

// Decode HTML entities
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// Split text into sentences
function splitSentences(text: string, lang: string): string[] {
  if (lang === "ja") {
    return text
      .split(/(?<=[。！？!?])\s*/)
      .map((s) => decodeEntities(s.trim()))
      .filter((s) => s.length > 5 && s.length < 400);
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => decodeEntities(s.trim()))
    .filter((s) => s.length > 10 && s.length < 300);
}

// Extract article text from BBC HTML page
function extractArticleText(html: string): string[] {
  const sentences: string[] = [];

  // BBC articles use <p> tags inside article body
  // Try data-component="text-block" paragraphs first (newer BBC layout)
  const textBlockRegex = /data-component="text-block"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = textBlockRegex.exec(html)) !== null) {
    const clean = match[1].replace(/<[^>]*>/g, "").trim();
    if (clean.length > 15) {
      sentences.push(...splitSentences(clean, "en"));
    }
  }

  // Fallback: try article body paragraphs
  if (sentences.length < 3) {
    const articleRegex = /<article[\s\S]*?<\/article>/;
    const articleMatch = html.match(articleRegex);
    if (articleMatch) {
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
      let pMatch;
      while ((pMatch = pRegex.exec(articleMatch[0])) !== null) {
        const clean = pMatch[1].replace(/<[^>]*>/g, "").trim();
        if (clean.length > 15 && !clean.startsWith("Getty") && !clean.startsWith("Image")) {
          sentences.push(...splitSentences(clean, "en"));
        }
      }
    }
  }

  // Fallback 2: general paragraph extraction
  if (sentences.length < 3) {
    const pRegex = /<p[^>]*class="[^"]*(?:story|article|content|body)[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(html)) !== null) {
      const clean = pMatch[1].replace(/<[^>]*>/g, "").trim();
      if (clean.length > 15) {
        sentences.push(...splitSentences(clean, "en"));
      }
    }
  }

  // Deduplicate
  return [...new Set(sentences)];
}

// Parse RSS XML to extract items with links
function parseRSSItems(xml: string, source: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

    const title = (titleMatch?.[1] || titleMatch?.[2] || "").replace(/<[^>]*>/g, "").trim();
    const desc = (descMatch?.[1] || descMatch?.[2] || "").replace(/<[^>]*>/g, "").trim();
    const link = (linkMatch?.[1] || "").trim();
    const date = dateMatch?.[1] || "";

    if (!title || !link) continue;

    items.push({ title, description: desc, link, date, source });
  }
  return items;
}

// Free RSS feeds
const RSS_FEEDS_EN = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World News" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC Technology" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC Science" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC Business" },
];

const RSS_FEEDS_JA = [
  { url: "https://www3.nhk.or.jp/rss/news/cat0.xml", source: "NHK ニュース" },
  { url: "https://www3.nhk.or.jp/rss/news/cat1.xml", source: "NHK 社会" },
  { url: "https://www3.nhk.or.jp/rss/news/cat3.xml", source: "NHK 科学・医療" },
  { url: "https://www3.nhk.or.jp/rss/news/cat5.xml", source: "NHK 国際" },
];

// Extract article text from Japanese NHK HTML page
function extractJapaneseArticleText(html: string): string[] {
  const sentences: string[] = [];

  // NHK articles use <p> and <div> with specific classes
  const contentRegex = /<(?:p|div)[^>]*class="[^"]*(?:content--detail-body|body|article)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/g;
  let match;
  while ((match = contentRegex.exec(html)) !== null) {
    const clean = match[1].replace(/<[^>]*>/g, "").trim();
    if (clean.length > 10) {
      sentences.push(...splitSentences(clean, "ja"));
    }
  }

  // Fallback: general paragraph extraction
  if (sentences.length < 3) {
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(html)) !== null) {
      const clean = pMatch[1].replace(/<[^>]*>/g, "").trim();
      if (clean.length > 15 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(clean)) {
        sentences.push(...splitSentences(clean, "ja"));
      }
    }
  }

  return [...new Set(sentences)];
}

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang") || "en";
  const feeds = lang === "ja" ? RSS_FEEDS_JA : RSS_FEEDS_EN;
  try {
    // Step 1: Fetch all RSS feeds in parallel
    const feedResults = await Promise.allSettled(
      feeds.map(async (feed) => {
        const res = await fetch(feed.url, {
          cache: "no-store",
          headers: { "User-Agent": "LangBoost/1.0" },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSSItems(xml, feed.source);
      })
    );

    const allItems: RSSItem[] = [];
    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    // Sort by date (newest first) and pick top articles
    const selected = allItems
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      })
      .slice(0, 5);

    // Step 2: Fetch full article content in parallel
    const articleResults = await Promise.allSettled(
      selected.map(async (item, idx): Promise<NewsArticle | null> => {
        try {
          const res = await fetch(item.link, {
            next: { revalidate: 1800 },
            headers: { "User-Agent": "LangBoost/1.0" },
          });
          if (!res.ok) return null;
          const html = await res.text();
          const fullSentences = lang === "ja"
            ? extractJapaneseArticleText(html)
            : extractArticleText(html);

          // Use full article if we got enough sentences, otherwise fallback to RSS
          let sentences: string[];
          if (fullSentences.length >= 3) {
            // Keep all extracted sentences (typically 5-30 per article)
            sentences = fullSentences;
          } else {
            // Fallback: use title + description
            sentences = splitSentences(`${item.title}${lang === "ja" ? "\u3002" : ". "}${item.description}`, lang);
          }

          if (sentences.length < 2) return null;

          return {
            id: `news-${item.source.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
            title: item.title,
            description: item.description.substring(0, 200),
            source: item.source,
            date: item.date ? new Date(item.date).toLocaleDateString() : new Date().toLocaleDateString(),
            sentences: sentences.map((text, i) => ({ id: i + 1, text })),
          };
        } catch {
          return null;
        }
      })
    );

    const articles: NewsArticle[] = [];
    for (const result of articleResults) {
      if (result.status === "fulfilled" && result.value) {
        articles.push(result.value);
      }
    }

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json({ articles: [], error: "Failed to fetch news" }, { status: 500 });
  }
}
