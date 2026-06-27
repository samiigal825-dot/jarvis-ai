import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { role, task } = await req.json();

    if (!role || !task) {
      return NextResponse.json({ error: "Role and task are required." }, { status: 400 });
    }

    // Use Pollinations API model
    const modelId = 'openai';

    let roleInstructions = "Perform the task thoroughly, analyze data if provided, and return a comprehensive summary of your findings or code.";
    if (role.toLowerCase() === 'manager') {
      roleInstructions = "You are the Project Manager. Break down the user's request into a clear, numbered 3-step execution plan. Do not execute the steps, just provide the plan.";
    } else if (role.toLowerCase() === 'developer') {
      roleInstructions = "You are the Lead Developer. Provide a complete, single-file HTML/JS/CSS implementation or Python script based on the task. Never hallucinate. Always output raw code wrapped in ```html or ```python.";
    } else if (role.toLowerCase() === 'qa') {
      roleInstructions = "You are the QA Engineer. Analyze the provided code or task, identify 3 potential edge cases or bugs, and suggest fixes.";
    } else if (role.toLowerCase() === 'data') {
      roleInstructions = "You are the Data Scientist. Analyze the dataset if provided, describe its structure, and generate a python snippet using pandas to extract insights.";
    } else if (role.toLowerCase() === 'image') {
      roleInstructions = "You are the UX/UI Designer. Describe an optimal layout and visual theme for this request in 3 bullet points.";
    }

    const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: roleInstructions },
          { role: 'user', content: task }
        ],
        temperature: 0.5
      })
    });
    
    const data = await res.json();
    if (!data || !data.choices || !data.choices[0]) {
      return NextResponse.json({ error: "Failed to generate response: " + JSON.stringify(data) }, { status: 500 });
    }
    const resultText = data.choices[0]?.message?.content || "";

    return NextResponse.json({ 
      result: resultText,
      agent: role,
      status: "success"
    });
  } catch (error: any) {
    console.error('Subagent Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
