import { NextRequest, NextResponse } from 'next/server';

// ─── HuggingFace Models (auto-rotate on failure) ───
const MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 72B', icon: '🧠' },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', icon: '🌀' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1', icon: '🦙' },
  { id: 'microsoft/Phi-3.5-mini-instruct', name: 'Phi 3.5', icon: '⚡' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2', icon: '💎' },
];

const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';

// ─── Jarvis System Prompt ───
const JARVIS_SYSTEM = `You are JARVIS — an elite, all-purpose AI assistant. You are the CEO, developer, analyst, writer, and researcher — all in one. You handle EVERYTHING the user asks.

CORE RULES:
1. You NEVER say "I can't" — you always find a way through reasoning and analysis.
2. You answer in the SAME LANGUAGE the user uses (Urdu/Hindi → reply in Urdu/Hindi, English → English).
3. When creating files (Excel, CSV, etc.), output them as properly formatted data that the system will convert to downloadable files.
4. For code: always use proper syntax highlighting with language tags in code blocks.
5. For data analysis: be thorough, find patterns, give insights.
6. Be concise but complete. No unnecessary filler.
7. Use markdown formatting: **bold**, *italic*, \`code\`, tables, lists, headers.
8. When given a file to analyze/edit, work with the actual data — don't just describe what you'd do.
9. When reasoning through complex problems, break them into clear steps.
10. You are direct, professional, and incredibly capable.

CAPABILITIES:
- Read & analyze any uploaded file (Excel, CSV, JSON, TXT, images, ZIP)
- Generate downloadable files (Excel, CSV, PDF, ZIP)
- Edit/modify CSV and Excel data (change values, add rows, fix errors)
- Analyze images (describe, OCR, read charts)
- Search the web for current information
- Write and debug code in any language
- Create documents, reports, and summaries
- Data analysis, statistics, and insights
- Translation and multi-language support

When you need to create a downloadable file, use this format:
[GENERATE_FILE:filename.ext]
(file content here)
[/GENERATE_FILE]`;

// ─── Stream helper ───
function createStreamResponse(readableStream: ReadableStream) {
  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: requestedModel } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Build conversation with system prompt
    const conversation = [
      { role: 'system', content: JARVIS_SYSTEM },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : 
          (m.parts ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : ''),
      })),
    ];

    // Try models in order (start with requested or default)
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
          continue; // Try next model
        }

        // Stream the response
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
                      // Send as SSE format compatible with our frontend
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                    // Skip malformed JSON chunks
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

    // All models failed
    return NextResponse.json(
      { error: `All models failed. Last error: ${lastError}` },
      { status: 502 }
    );
  } catch (err: any) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// Return available models
export async function GET() {
  return NextResponse.json({ models: MODELS });
}
