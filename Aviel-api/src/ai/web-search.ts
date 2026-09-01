import * as cheerio from "cheerio";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 5;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function normaliseHref(href: string): string {
  if (!href) return "";

  const absolute = href.startsWith("//") ? `https:${href}` : href;

  try {
    const parsed = new URL(absolute, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    return redirected ?? parsed.toString();
  } catch {
    return "";
  }
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8_000) }
    );

    if (!response.ok) return [];

    const $ = cheerio.load(await response.text());
    const results: WebSearchResult[] = [];

    $(".result").each((_, element) => {
      if (results.length >= MAX_RESULTS) return false;

      const anchor = $(element).find(".result__a").first();
      const title = anchor.text().trim();
      const url = normaliseHref(anchor.attr("href") ?? "");
      const snippet = $(element).find(".result__snippet").first().text().trim();

      if (title && url) results.push({ title, url, snippet });
      return undefined;
    });

    return results;
  } catch (err) {
    console.error(
      "Web search failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "";

  const list = results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`
    )
    .join("\n");

  return `Web search results:\n${list}\n\nUse these results where they help, and cite the number and title of any result you rely on. Ignore them if they are not relevant.`;
}
