import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { HfInference } from "@huggingface/inference";

// 1. Define State
export const GraphState = MessagesAnnotation;

// 2. Define Models
export const createModel = (modelName: string = "openai") => {
  return {
    invoke: async (messages: any[]) => {
      const formattedMessages = messages.map(m => ({
        role: m.getType() === 'human' ? 'user' : (m.getType() === 'system' ? 'system' : 'assistant'),
        content: m.content
      }));
      
      const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          temperature: 0.5
        })
      });
      
      const data = await res.json();
      if (!data || !data.choices || !data.choices[0]) {
        return new AIMessage({ content: `[API Error] ${JSON.stringify(data)}` });
      }
      return new AIMessage({ content: data.choices[0]?.message?.content || "" });
    },
    stream: async function* (messages: any[]) {
      const formattedMessages = messages.map(m => ({
        role: m.getType() === 'human' ? 'user' : (m.getType() === 'system' ? 'system' : 'assistant'),
        content: m.content
      }));
      
      const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          temperature: 0.5,
          stream: true
        })
      });
      
      if (!res.body) return;
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
                  yield new AIMessage({ content });
                }
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    }
  };
};

// 3. Define Nodes (Agents)
const createAgentNode = (roleName: string, systemPrompt: string) => {
  return async (state: typeof MessagesAnnotation.State, config: any) => {
    const model = createModel();
    
    const messages = [
      new SystemMessage(systemPrompt),
      ...state.messages,
    ];
    
    const response = await model.invoke(messages);
    return { messages: [new AIMessage({ content: `[${roleName}] ${response.content}` })] };
  };
};

const SYSTEM_PROMPTS = {
  Research: "You are the JARVIS Research Agent. Your job is to search the web and documentation to provide accurate context. Use [SEARCH:query] to search the web.",
  Developer: `You are the JARVIS Developer Agent. You write production-ready code in a single file format. 
CRITICAL RULES:
1. Always fulfill the user's explicit request. Do NOT output a generic template.
2. Every UI must include: responsive design, modern typography, glassmorphism, gradients, animations, loading states, error states, and dark mode.
3. Design quality must match top-tier platforms like Stripe or Vercel.
4. ALWAYS use this format:

[GENERATE_FILE:index.html]
<!DOCTYPE html>
<html>
<head>
<style>
/* Professional CSS */
</style>
</head>
<body>
<!-- Professional UI based on user request -->
<script>
/* Full JavaScript */
</script>
</body>
</html>
[/GENERATE_FILE]`,
  QA: "You are the JARVIS QA Agent. You review code for bugs and edge cases.",
  Data: "You are the JARVIS Data Agent. You parse and analyze CSV and Excel data. To run python data analysis, use:\n\n[RUN_PYTHON]\nimport pandas as pd\n...\n[/RUN_PYTHON]",
  Image: "You are the JARVIS Image Agent. You generate image prompts and use [GENERATE_IMAGE:prompt] to create visuals.",
  Coordinator: "You are the JARVIS CEO (Coordinator). You analyze the user's request and decide which agent to call next. If the task is fully complete, you reply directly with the final output. If you need an agent, you output exactly: CALL_<AGENT_NAME>. Available: RESEARCH, DEVELOPER, QA, DATA, IMAGE."
};

const researchAgent = createAgentNode("Research", SYSTEM_PROMPTS.Research);
const developerAgent = createAgentNode("Developer", SYSTEM_PROMPTS.Developer);
const qaAgent = createAgentNode("QA", SYSTEM_PROMPTS.QA);
const dataAgent = createAgentNode("Data", SYSTEM_PROMPTS.Data);
const imageAgent = createAgentNode("Image", SYSTEM_PROMPTS.Image);

const coordinatorAgent = async (state: typeof MessagesAnnotation.State, config: any) => {
  const token = config?.configurable?.hfToken;
  if (!token) throw new Error("HuggingFace API Key is required");

  // Changed to openai to use Pollinations free tier
  const model = createModel(token, "openai"); 
  
  const messages = [
    new SystemMessage(SYSTEM_PROMPTS.Coordinator),
    ...state.messages,
  ];
  const response = await model.invoke(messages);
  return { messages: [new AIMessage({ content: response.content })] };
};

// 4. Define Routing Logic
const routeDecision = (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const content = lastMessage.content.toString();
  
  if (content.includes("CALL_RESEARCH")) return "research";
  if (content.includes("CALL_DEVELOPER")) return "developer";
  if (content.includes("CALL_QA")) return "qa";
  if (content.includes("CALL_DATA")) return "data";
  if (content.includes("CALL_IMAGE")) return "image";
  
  return "__end__";
};

// 5. Build Graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("coordinator", coordinatorAgent)
  .addNode("research", researchAgent)
  .addNode("developer", developerAgent)
  .addNode("qa", qaAgent)
  .addNode("data", dataAgent)
  .addNode("image", imageAgent)
  .addEdge("__start__", "coordinator")
  .addConditionalEdges("coordinator", routeDecision)
  .addEdge("research", "coordinator")
  .addEdge("developer", "coordinator")
  .addEdge("qa", "coordinator")
  .addEdge("data", "coordinator")
  .addEdge("image", "coordinator");

export const jarvisGraph = workflow.compile();
