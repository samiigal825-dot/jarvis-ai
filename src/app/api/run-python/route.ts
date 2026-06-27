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
          if (error && error.message.includes('command not found')) {
            // Try python3 if python is not found
            exec(`python3 "${filePath}"`, { timeout: 10000 }, (err3: any, out3: string, errOut3: string) => {
              try { fs.unlinkSync(filePath); } catch (e) {}
              if (err3 && !errOut3) errOut3 = err3.message;
              resolve(NextResponse.json({
                success: !err3,
                stdout: out3,
                stderr: errOut3,
                output: (out3 || '') + (errOut3 ? `\n\n[ERRORS / STDERR]:\n${errOut3}` : '')
              }));
            });
          } else {
            try { fs.unlinkSync(filePath); } catch (e) {}
            if (error && !stderr) stderr = error.message;
            resolve(NextResponse.json({
              success: !error,
              stdout,
              stderr,
              output: (stdout || '') + (stderr ? `\n\n[ERRORS / STDERR]:\n${stderr}` : '')
            }));
          }
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
