import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    // Clean code markup if the AI wrapped it in ```python ... ```
    let cleanCode = code;
    const codeBlockMatch = code.match(/```python\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanCode = codeBlockMatch[1];
    } else {
      cleanCode = code.replace(/```[\s\S]*?```/g, '').trim();
    }

    try {
      // Run Python script using Piston API for serverless compatibility
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'python',
          version: '3.10.0',
          files: [{ name: 'main.py', content: cleanCode }]
        })
      });

      if (!res.ok) {
        throw new Error('Failed to execute code on remote server.');
      }

      const data = await res.json();
      
      const stdout = data.run?.stdout || '';
      const stderr = data.run?.stderr || '';
      const output = data.run?.output || '';

      return NextResponse.json({
        success: true,
        stdout,
        stderr,
        output: output + (stderr ? `\n\n[ERRORS / STDERR]:\n${stderr}` : '')
      });
    } catch (err: any) {
      return NextResponse.json({ 
        success: false, 
        error: err.message, 
        output: `[EXECUTION ERROR]:\n${err.message}` 
      }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
