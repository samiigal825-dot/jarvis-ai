import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const text = await res.text();
    
    // Basic regex extraction of search result snippets
    const snippets = [...text.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].replace(/(<([^>]+)>)/gi, "").trim())
      .slice(0, 5) // top 5 results
      .join('\\n\\n');

    if (!snippets) {
      return NextResponse.json({ results: 'No specific results found. Try rephrasing the search.' });
    }

    return NextResponse.json({ results: snippets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
