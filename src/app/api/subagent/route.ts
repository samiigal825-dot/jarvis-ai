import { NextRequest, NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { role, task, hfToken } = await req.json();
    const HF_TOKEN = hfToken || process.env.HUGGINGFACE_API_KEY || '';

    if (!HF_TOKEN) {
      return NextResponse.json({ error: "HuggingFace API Key is missing." }, { status: 500 });
    }

    if (!role || !task) {
      return NextResponse.json({ error: "Role and task are required." }, { status: 400 });
    }

    const hf = new HfInference(HF_TOKEN);
    // Using an intelligent model for the subagent
    const modelId = 'meta-llama/Llama-3.3-70B-Instruct';

    let roleInstructions = "Perform the task thoroughly, analyze data if provided, and return a comprehensive summary of your findings or code.";
    if (role.toLowerCase() === 'manager') {
      roleInstructions = "You are the Project Manager. Break down the user's request into a clear, numbered 3-step execution plan. Do not execute the steps, just provide the plan.";
    } else if (role.toLowerCase() === 'verifier') {
      roleInstructions = "You are the QA Verifier. Your job is to aggressively review the provided output for bugs, omissions, or logical errors. If you find ANY errors, explain them clearly so the Coder can fix them. If it is 100% perfect, explicitly state 'VERIFIED: NO ERRORS'.";
    } else if (role.toLowerCase() === 'coder' || role.toLowerCase() === 'analyst') {
      roleInstructions = "You are the Expert. Execute the task perfectly. Provide complete code or analysis as requested. Do not leave placeholders.";
    }

    const systemPrompt = `You are a highly capable AI Subagent specializing as a ${role.toUpperCase()}. 
Your objective is to execute the following task delegated to you by JARVIS (the CEO Agent).
${roleInstructions}
Do NOT use <thinking> tags. Just provide the final output.`;

    const conversation = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];

    let output = '';
    for await (const chunk of hf.chatCompletionStream({
      model: modelId,
      messages: conversation,
      max_tokens: 2048,
      temperature: 0.5,
    })) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        output += content;
      }
    }

    return NextResponse.json({ result: output });
  } catch (err: any) {
    console.error('Subagent API Error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
