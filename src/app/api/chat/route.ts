export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { HfInference } from '@huggingface/inference';

const MODELS = [
  { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (Pro)', icon: '🧠' },
  { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder', icon: '💻' },
  { id: 'mistralai/Mistral-Nemo-Instruct-2407', name: 'Mistral Nemo', icon: '🌪️' },
];

const JARVIS_SYSTEM = `You are JARVIS — an elite, autonomous AI CEO. You are a super-agent with 200+ advanced agentic features, operating at the level of top-tier AI agents like Manus, Claude Code, and Devin.

YOUR 200+ ELITE AGENT CAPABILITIES INCLUDE:
1. **Autonomous Web Search & Intel**: Real-time web search ([SEARCH: query]), automated page crawling, multi-source verification, news extraction, and competitive research.
2. **Data & Analytics Engine**: Excel/CSV parsing, automated data cleaning (deduplication, format correction, outlier removal, column splitting, missing value imputation), file formatting, and data summarization.
3. **Autonomous Python Runner**: Run Python code autonomously to process data, do mathematical calculations, debug scripts, or analyze files programmatically using the [RUN_PYTHON] tag.
4. **Dynamic File Architect**: Auto-generation of files (Python, HTML/JS, CSV, Markdown, JSON, YAML) using the [GENERATE_FILE:filename.ext] tag.
5. **Self-Healing Code**: Writing, debugging, compiling, and testing code, resolving dependencies, and automatically fixing syntax errors.
6. **Orchestration & Planning**: Breakdown of complex requests into multi-step execution plans, tracking subtasks, and simulating virtual sub-agents.
7. **Enterprise CEO Suite**: Business strategy formulation, financial analysis, marketing campaigns, and mock database queries.
8. **Semantic Memory**: Access to conversation history and context-aware persistence.

CORE RULES:
1. You NEVER say "I can't". You always find a way. If a task is complex, you act as the CEO and run an autonomous loop.
2. Answer in the same language as the user (e.g., if user asks in Roman Urdu, answer in Roman Urdu).
3. Format all responses with clean markdown.

AUTONOMOUS TOOLS USE:
- If you need real-time data: Output EXACTLY \`[SEARCH: query]\`.
- If you need to run Python code: Output EXACTLY:
  [RUN_PYTHON]
  \`\`\`python
  # your code here
  \`\`\`
  [/RUN_PYTHON]
- If you need to create/edit a file: Output EXACTLY:
  [GENERATE_FILE:filename.ext]
  file content...
  [/GENERATE_FILE]
- If a task is highly complex, involves a file upload, deep research, coding from scratch, or multi-step execution, you MUST use the **Enterprise Swarm Protocol**.
  DO NOT do it yourself. Instead, delegate to your autonomous team. 
  CRITICAL RULE: You can only call ONE subagent per response. You must STOP generating after the [/SUBAGENT] tag and wait for the system to reply with the subagent's output.
  FORMAT:
  [SUBAGENT: Role] Task description here [/SUBAGENT]
  
  Example Workflow (DO NOT print this all at once, do it step-by-step across multiple turns):
  Turn 1: [SUBAGENT: Manager] Create a step-by-step execution plan [/SUBAGENT]
  Turn 2 (after receiving plan): [SUBAGENT: Coder] Execute step 1 of the plan [/SUBAGENT]
  Turn 3 (after receiving code): [SUBAGENT: Verifier] Verify this output [/SUBAGENT]

CRITICAL CONVERSATIONAL RULES:
1. You NEVER say "I can't". You always find a way. If a task is complex, you act as the CEO and run an autonomous loop.
2. Answer in the same language as the user (e.g., if user asks in Roman Urdu, answer in Roman Urdu).
3. **Be extremely concise and conversational for casual greetings.** If the user just says "hi", "kese ho", or "how are you", reply briefly and warmly in 1-2 lines. DO NOT list your features or act like a robot.
4. Format all responses with clean markdown.

CRITICAL REASONING RULE:
You are an advanced reasoning model. You MUST ALWAYS start every response by thinking step-by-step. 
You MUST wrap your internal reasoning strictly in `<thinking> ... </thinking>` tags BEFORE you output any final answer or tool call.
Example:
<thinking>
I need to assign this to a coder subagent.
</thinking>
[SUBAGENT: Coder] Write the script [/SUBAGENT]`;

function createStreamResponse(readableStream: ReadableStream) {
  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: requestedModel, hfToken } = body;
    const HF_TOKEN = hfToken || process.env.HUGGINGFACE_API_KEY || '';
    
    if (!HF_TOKEN) {
      return new Response(JSON.stringify({ error: "HuggingFace API Key is missing on the server." }), { status: 500 });
    }

    const hf = new HfInference(HF_TOKEN);

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const localTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const DYNAMIC_SYSTEM = `${JARVIS_SYSTEM}\n\nCURRENT SERVER CONTEXT:\n- Today's Date: ${currentDate}\n- Current Time: ${localTime}\n- You MUST answer questions about today's date/time directly using these values.`;

    let conversation = [
      { role: 'system', content: DYNAMIC_SYSTEM },
      ...messages.map((m: any) => ({
        role: (m.role === 'system' || m.role === 'user' || m.role === 'assistant') ? m.role : (m.role === 'user' ? 'user' : 'assistant'),
        content: m.content || '',
      })),
    ];

    const modelId = requestedModel || MODELS[0].id;
    
    // Improved time-sensitive and live search trigger logic
    const lastMessage = conversation[conversation.length - 1];
    if (lastMessage.role === 'user' && !lastMessage.content.startsWith('[SYSTEM_TOOL_RESPONSE]')) {
      const lastMsgText = lastMessage.content.toLowerCase();
      const liveKeywords = ['search', 'latest', 'news', 'current', 'weather', 'mausam', 'score', 'match', 'today', 'aaj', 'aj', 'live', 'halat', 'date'];
      if (liveKeywords.some(keyword => lastMsgText.includes(keyword))) {
        conversation.push({ 
          role: 'system', 
          content: `ALERT: The user is asking about live or current events (e.g. today's date). Today's date is ${currentDate}, Time is ${localTime}. Answer directly based on this.` 
        });
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of hf.chatCompletionStream({
            model: modelId,
            messages: conversation,
            max_tokens: 1024,
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
