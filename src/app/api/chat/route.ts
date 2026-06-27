export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { HfInference } from '@huggingface/inference';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: requestedModel } = body;
    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';
    
    if (!HF_TOKEN) {
      return new Response(JSON.stringify({ error: "HuggingFace API Key is missing on the server." }), { status: 500 });
    }

    const hf = new HfInference(HF_TOKEN);

    let conversation = [
      { role: 'system', content: JARVIS_SYSTEM },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
      })),
    ];

    const modelId = requestedModel || MODELS[0].id;
    
    const lastMsg = conversation[conversation.length - 1].content.toLowerCase();
    if (lastMsg.includes('search') || lastMsg.includes('latest') || lastMsg.includes('news') || lastMsg.includes('current')) {
      conversation.push({ role: 'system', content: 'Hint: You may want to use [SEARCH: query] to get up-to-date information for this request.' });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of hf.chatCompletionStream({
            model: modelId,
            messages: conversation,
            max_tokens: 4096,
            temperature: 0.7,
          })) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err: any) {
          console.error("HF Inference Error:", err);
          controller.enqueue(encoder.encode(`\\n\\n⚠️ **API Error:** ${err.message}`));
        } finally {
          controller.close();
        }
      }
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
