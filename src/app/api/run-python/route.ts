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
      const { exec } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `script_${Date.now()}.py`);
      fs.writeFileSync(filePath, cleanCode);
      
      return new Promise<NextResponse>((resolve) => {
        exec(`python "${filePath}"`, { timeout: 10000 }, (error: any, stdout: string, stderr: string) => {
          // Clean up
          try { fs.unlinkSync(filePath); } catch (e) {}
          
          if (error && !stderr) {
            stderr = error.message;
          }
          
          resolve(NextResponse.json({
            success: !error,
            stdout,
            stderr,
            output: (stdout || '') + (stderr ? `\n\n[ERRORS / STDERR]:\n${stderr}` : '')
          }));
        });
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
