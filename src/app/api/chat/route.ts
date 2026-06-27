export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { HfInference } from '@huggingface/inference';

const MODELS = [
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', icon: '🧠' },
  { id: 'Qwen/Qwen2.5-Coder-7B-Instruct', name: 'Qwen 2.5 Coder 7B', icon: '💻' },
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

====================================
CORE BEHAVIOR RULES
====================================
1. Never hallucinate.
2. Never claim success without evidence.
3. Never say:
   - Deployment successful
   - Preview ready
   - File generated
   - Image created
   Unless the underlying tool confirms success.
4. Think step-by-step.
5. Research before coding.
6. Produce only production-ready code.
7. All outputs must be machine executable.

====================================
WEB APPLICATION GENERATION RULES
====================================
When user asks for:
- website, dashboard, landing page, admin panel, SaaS app, CRM, ERP, calculator, portfolio, ecommerce, analytics
Always generate: ONE COMPLETE index.html file.
Never separate CSS or JS unless user explicitly requests.
Use:
<!DOCTYPE html>
<html>
<head>
<style>
/* Professional CSS */
</style>
</head>
<body>
<!-- Professional UI -->
<script>
/* Full JavaScript */
</script>
</body>
</html>

====================================
UI QUALITY RULES
====================================
Every generated UI must include:
✓ responsive design ✓ mobile-first layout ✓ professional spacing ✓ glassmorphism ✓ gradients ✓ shadows ✓ animations ✓ hover effects ✓ loading states ✓ error states ✓ empty states ✓ icons ✓ accessibility ✓ dark mode ✓ modern typography ✓ smooth transitions
Never create ugly interfaces. Design quality must match: ChatGPT, Claude, Linear, Stripe, Vercel, Notion.

====================================
FILE RULES
====================================
All code outputs must use:
[GENERATE_FILE:index.html]
code here
[/GENERATE_FILE]
After generation:
[OPEN_PREVIEW:index.html]
CRITICAL: DO NOT wrap the code inside with markdown backticks. Write RAW code directly inside the tags.

====================================
PREVIEW RULES
====================================
Never simulate preview. Never describe preview in text. Always render actual HTML. Preview must use iframe.

====================================
CSV / EXCEL RULES
====================================
If user uploads CSV:
1. Parse file.
2. Modify file.
3. Save new file.
4. Return downloadable file using [GENERATE_FILE:updated_filename.csv]
Never output CSV as plain text.

====================================
IMAGE GENERATION RULES
====================================
When user requests image: Call image generation tool [GENERATE_IMAGE: prompt]. Never pretend image exists. Never output fake images.

====================================
TERMINAL RULES
====================================
Use real sandbox execution.
Allowed: npm install, npm run dev, python, pip, node.
Wait for execution result. Return logs. Use [RUN_PYTHON] tag for scripts.

====================================
AGENT RULES
====================================
Available agents: Research Agent, Developer Agent, QA Agent, Security Agent
Subagents may only return JSON:
{ "status":"success", "files":["index.html"] }
or
{ "status":"failed", "error":"message" }
Workflow stops on failure. Use format: [SUBAGENT: Role] Task description [/SUBAGENT]

====================================
FINAL RESPONSE FORMAT
====================================
STATUS: SUCCESS/FAILED
FILES:
- index.html
PREVIEW: AUTO_OPEN
NEXT_ACTION: Ready for further instructions.

- If you need real-time data: Output EXACTLY [SEARCH: query].
- If you need to run Python code: Output EXACTLY:
  [RUN_PYTHON]
  print("hello")
  [/RUN_PYTHON]
  CRITICAL: DO NOT use markdown backticks inside the RUN_PYTHON tags.

Answer in the same language as the user. Format all responses with clean markdown.

CRITICAL REASONING RULE (DO NOT IGNORE):
YOU WILL BE HEAVILY PENALIZED IF YOU DO NOT USE <thinking> TAGS. You MUST ALWAYS start every response by thinking step-by-step. 
You MUST wrap your internal reasoning strictly in <thinking> ... </thinking> tags BEFORE you output any final answer, file, or tool call.
Example:
<thinking>
I need to assign this to a coder subagent or write a single HTML file.
</thinking>
[GENERATE_FILE:index.html] ... [/GENERATE_FILE]`;

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

    const modelId = requestedModel || 'openai';
    
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
          const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelId,
              messages: conversation,
              temperature: 0.7,
              stream: true
            })
          });
          
          if (!res.body) {
            controller.close();
            return;
          }
          
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.replace('data: ', ''));
                  if (data && data.choices && data.choices[0]) {
                    const content = data.choices[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  }
                } catch (e) {
                  // ignore
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode('\n\n[Error: Connection interrupted. Please try again.]'));
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
