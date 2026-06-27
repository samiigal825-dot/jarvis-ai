import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { HfInference } from "@huggingface/inference";

// 1. Define State
export const GraphState = MessagesAnnotation;

// 2. Define Models
export const createModel = (token: string, modelName: string = "Qwen/Qwen2.5-Coder-32B-Instruct") => {
  const hf = new HfInference(token);
  return {
    invoke: async (messages: any[]) => {
      const hfMessages = messages.map(m => ({
        role: m.getType() === 'human' ? 'user' : (m.getType() === 'system' ? 'system' : 'assistant'),
        content: m.content
      }));
      const res = await hf.chatCompletion({ model: modelName, messages: hfMessages, max_tokens: 2048, temperature: 0.5 });
      return new AIMessage({ content: res.choices[0].message.content || "" });
    },
    stream: async function* (messages: any[]) {
      const hfMessages = messages.map(m => ({
        role: m.getType() === 'human' ? 'user' : (m.getType() === 'system' ? 'system' : 'assistant'),
        content: m.content
      }));
      for await (const chunk of hf.chatCompletionStream({ model: modelName, messages: hfMessages, max_tokens: 2048, temperature: 0.5 })) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield new AIMessage({ content });
        }
      }
    }
  };
};

// 3. Define Nodes (Agents)
const createAgentNode = (roleName: string, systemPrompt: string) => {
  return async (state: typeof MessagesAnnotation.State, config: any) => {
    const token = config?.configurable?.hfToken || process.env.HUGGINGFACE_API_KEY || '';
    if (!token) throw new Error("HuggingFace Token is required.");
    
    const model = createModel(token);
    
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
  Developer: "You are the JARVIS Developer Agent. You write production-ready code in a single file format. You never hallucinate success. ALWAYS use this format:\n\n[GENERATE_FILE:index.html]\n<!DOCTYPE html>\n<html>...</html>\n[/GENERATE_FILE]",
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
  const token = config?.configurable?.hfToken || process.env.HUGGINGFACE_API_KEY || '';
  const model = createModel(token, "Qwen/Qwen2.5-Coder-32B-Instruct"); 
  
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
