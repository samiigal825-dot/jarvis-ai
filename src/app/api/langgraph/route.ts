import { NextRequest } from 'next/server';
import { jarvisGraph } from '@/lib/agents/graph';
import { HumanMessage } from '@langchain/core/messages';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), { status: 400 });
    }

    // Convert raw messages to LangChain format
    const lcMessages = messages.map((m: any) => new HumanMessage({ content: m.content }));

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const events = await jarvisGraph.stream(
            { messages: lcMessages },
            { configurable: {}, streamMode: "messages" }
          );

          for await (const [message, _metadata] of events) {
            if (message.content) {
              const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
              controller.enqueue(encoder.encode(contentStr));
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
