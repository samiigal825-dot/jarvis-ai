import { NextRequest } from 'next/server';
import { jarvisGraph } from '@/lib/agents/graph';
import { HumanMessage } from '@langchain/core/messages';

export async function POST(req: NextRequest) {
  try {
    const { messages, hfToken } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), { status: 400 });
    }

    const token = hfToken || process.env.HUGGINGFACE_API_KEY;
    if (!token) {
      return new Response(JSON.stringify({ error: "HuggingFace API Key is missing" }), { status: 500 });
    }

    // Convert raw messages to LangChain format
    const lcMessages = messages.map((m: any) => new HumanMessage({ content: m.content }));

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const events = await jarvisGraph.stream(
            { messages: lcMessages },
            { configurable: { hfToken: token }, streamMode: "messages" }
          );

          for await (const [message, _metadata] of events) {
            if (message.content) {
              controller.enqueue(encoder.encode(message.content));
            }
          }
        } catch (err: any) {
          console.error("LangGraph Streaming Error:", err);
          controller.enqueue(encoder.encode(`\n\n⚠️ **Graph Error:** ${err.message}`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (err: any) {
    console.error('LangGraph API Error:', err);
    return new Response(
      JSON.stringify({ error: `System Error: ${err.message || String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
