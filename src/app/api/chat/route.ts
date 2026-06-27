export const runtime = 'edge';

import { NextRequest } from 'next/server';

// ─── HuggingFace Models (auto-rotate on failure) ───
const MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 72B', icon: '🧠' },
  { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2', icon: '🦙' },
  { id: 'microsoft/Phi-3.5-mini-instruct', name: 'Phi 3.5', icon: '⚡' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2', icon: '💎' },
];

// ─── Jarvis System Prompt ───
const JARVIS_SYSTEM = `You are JARVIS — an elite, all-purpose AI assistant. You are the CEO, developer, analyst, writer, and researcher — all in one. You handle EVERYTHING the user asks.

CORE RULES:
1. You NEVER say "I can't" — you always find a way through reasoning and analysis.
2. You answer in the SAME LANGUAGE the user uses (Urdu/Hindi → reply in Urdu/Hindi, English → English).
3. Be concise but complete. No unnecessary filler.
4. Use markdown formatting: **bold**, *italic*, \`code\`, tables, lists, headers.
5. If the user asks you to create, edit, or generate a file (like CSV, Python, HTML), output the raw content inside these EXACT tags:
[GENERATE_FILE:filename.ext]
file content goes here...
[/GENERATE_FILE]

CAPABILITIES:
- Generate downloadable files (CSV, TXT, MD, Code)
- Edit/modify data (change values, add rows, fix errors)
- Write and debug code in any language
- Data analysis, statistics, and insights`;

function createStreamResponse(readableStream: ReadableStream) {
  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: requestedModel } = body;
    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
    }

    const conversation = [
      { role: 'system', content: JARVIS_SYSTEM },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : 
          (m.parts ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : ''),
      })),
    ];

    const modelOrder = requestedModel 
      ? [requestedModel, ...MODELS.map(m => m.id).filter(id => id !== requestedModel)]
      : MODELS.map(m => m.id);

    let lastError = '';

    for (const modelId of modelOrder) {
      try {
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HF_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelId,
              messages: conversation,
              max_tokens: 4096,
              temperature: 0.7,
              stream: true,
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${modelId}: ${response.status} - ${errText}`;
          console.warn(`Model ${modelId} failed:`, lastError);
          continue; 
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const decoder = new TextDecoder();
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith('data: ')) continue;
                  
                  const data = trimmed.slice(6);
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                    // Skip malformed
                  }
                }
              }
            } catch (err) {
              console.error('Stream error:', err);
            } finally {
              controller.close();
            }
          },
        });

        return createStreamResponse(stream);
      } catch (err: any) {
        lastError = `${modelId}: ${err.message}`;
        console.warn(`Model ${modelId} error:`, err.message);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ error: `All models failed. Last error: ${lastError}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(JSON.stringify({ models: MODELS }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
