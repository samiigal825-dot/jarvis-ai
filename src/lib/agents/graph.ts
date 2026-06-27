import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, SystemMessage } from "@langchain/core/messages";

// 1. Define State
export const GraphState = MessagesAnnotation;

// 2. Define Models
export const createModel = (token: string, modelName: string = "meta-llama/Llama-3.3-70B-Instruct") => {
  return new ChatOpenAI({
    modelName: modelName,
    openAIApiKey: token,
    configuration: {
      baseURL: "https://api-inference.huggingface.co/v1/"
    },
    maxTokens: 2048,
    temperature: 0.5,
  });
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
  Research: "You are the JARVIS Research Agent. Your job is to search the web and documentation to provide accurate context.",
  Developer: "You are the JARVIS Developer Agent. You write production-ready code in a single file format. You never hallucinate success. Output [GENERATE_FILE:index.html] with the full code.",
  QA: "You are the JARVIS QA Agent. You review code for bugs and edge cases.",
  Data: "You are the JARVIS Data Agent. You parse and analyze CSV and Excel data, and modify it accurately. Output any changed files using [GENERATE_FILE].",
  Image: "You are the JARVIS Image Agent. You generate image prompts and use [GENERATE_IMAGE:prompt] to create visuals.",
  Coordinator: "You are the JARVIS CEO (Coordinator). You analyze the user's request and decide which agent to call next. If the task is fully complete, you reply directly with the final output. If you need an agent, you output exactly: CALL_<AGENT_NAME>. Available: RESEARCH, DEVELOPER, QA, DATA, IMAGE."
};

const researchAgent = createAgentNode("Research", SYSTEM_PROMPTS.Research);
const developerAgent = createAgentNode("Developer", SYSTEM_PROMPTS.Developer);
const qaAgent = createAgentNode("QA", SYSTEM_PROMPTS.QA);
const dataAgent = createAgentNode("Data", SYSTEM_PROMPTS.Data);
const imageAgent = createAgentNode("Image", SYSTEM_PROMPTS.Image);

const coordinatorAgent = async (state: typeof MessagesAnnotation.State, config: any) => {
  const token = config?.configurable?.hfToken || process.env.HUGGINGFACE_API_KEY;
  const model = createModel(token, "meta-llama/Llama-3.3-70B-Instruct"); 
  
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
