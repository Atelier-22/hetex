// Hetex AI — Web Search Tool (interface only, Phase 1)
//
// No search provider is connected yet. This exists so the chat service and
// future tool-calling loop have a stable shape to call against. It must
// never return fabricated results — if no provider is configured, callers
// get an explicit "not available" response, not fake sources.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  available: boolean;
  results: WebSearchResult[];
  reason?: string;
}

export async function webSearch(query: string): Promise<WebSearchResponse> {
  const provider = process.env.WEB_SEARCH_PROVIDER;

  if (!provider) {
    return {
      available: false,
      results: [],
      reason:
        "No web search provider is configured. Set WEB_SEARCH_PROVIDER (and its API key) to enable this tool.",
    };
  }

  // Future: dispatch to a real provider (e.g. Brave Search API, Tavily, Bing)
  // based on `provider`, same registry pattern as the AI provider layer.
  throw new Error(`Web search provider "${provider}" is not implemented yet.`);
}
