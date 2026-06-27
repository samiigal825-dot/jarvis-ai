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
          const events = jarvisGraph.streamEvents(
            { messages: lcMessages },
            { version: "v1", configurable: { hfToken: token } }
          );

          for await (const event of events) {
            if (event.event === "on_chat_model_stream") {
              const chunk = event.data?.chunk?.content;
              if (chunk) {
                // Send raw chunk to client
                controller.enqueue(encoder.encode(chunk));
              }
            } else if (event.event === "on_chain_end" && event.name === "coordinator") {
              // Coordinator finished thinking
            } else if (event.event === "on_chain_end" && ["research", "developer", "qa"].includes(event.name)) {
              // Tell client that a subagent just finished a task
              controller.enqueue(encoder.encode(`\n\n[SYSTEM_TOOL_RESPONSE] ${event.name.toUpperCase()} Agent finished task.\n`));
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
