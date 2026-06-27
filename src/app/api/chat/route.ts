export const maxDuration = 60; // Use default Node.js runtime with 60s timeout instead of Edge

import { NextRequest } from 'next/server';

// ─── HuggingFace Models ───
const MODELS = [
  { id: 'meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B', icon: '🦙' },
  { id: 'mistralai/Mistral-Nemo-Instruct-2407', name: 'Mistral Nemo', icon: '🌪️' },
  { id: 'microsoft/Phi-3.5-mini-instruct', name: 'Phi 3.5', icon: '⚡' },
];

const JARVIS_SYSTEM = `You are JARVIS — an elite, autonomous AI CEO. You possess advanced agentic capabilities.

CORE RULES:
1. You NEVER say "I can't". You always find a way.
2. Answer in the same language as the user.
3. Format with markdown. 

AUTONOMOUS TOOLS:
If you need real-time information from the internet, you can search the web by outputting EXACTLY this tag:
[SEARCH: your search query]
When you output this, the system will pause, perform the search, and provide you with the results.

If you need to create or edit files (CSV, Python, Excel, TXT, etc.), output EXACTLY this tag:
[GENERATE_FILE:filename.ext]
file content goes here...
[/GENERATE_FILE]

If the user gives you raw data, analyze it, format it, and if necessary, generate a clean file using the [GENERATE_FILE] tag.
You are a true autonomous agent. Think step-by-step.`;

function createStreamResponse(readableStream: ReadableStream) {
  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}

// Simple DuckDuckGo HTML Scraper for Free Search (No API Key needed)
async function performWebSearch(query: string) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const text = await res.text();
    // Basic regex extraction of search result snippets
    const snippets = [...text.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].replace(/(<([^>]+)>)/gi, "").trim())
      .slice(0, 5)
      .join('\\n- ');
    return snippets ? `Search Results for "${query}":\\n- ${snippets}` : "No results found.";
  } catch (e) {
    return "Search failed.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: requestedModel } = body;
    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';

    let conversation = [
      { role: 'system', content: JARVIS_SYSTEM },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
      })),
    ];

    const modelId = requestedModel || MODELS[0].id;
    
    // Check if the last user message implicitly needs a search
    const lastMsg = conversation[conversation.length - 1].content.toLowerCase();
    if (lastMsg.includes('search') || lastMsg.includes('latest') || lastMsg.includes('news') || lastMsg.includes('current')) {
      conversation.push({ role: 'system', content: 'Hint: You may want to use [SEARCH: query] to get up-to-date information for this request.' });
    }

    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages: conversation, max_tokens: 4096, stream: true }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `API Error: ${await response.text()}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) controller.enqueue(encoder.encode(content));
              } catch (err: any) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        } catch (err) {
          console.error('Stream reading error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return createStreamResponse(stream);
  } catch (err: any) {
    console.error('API Error:', err);
    return new Response(
      JSON.stringify({ error: `System Error: ${err.message || String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(JSON.stringify({ models: MODELS }), { headers: { 'Content-Type': 'application/json' } });
}
