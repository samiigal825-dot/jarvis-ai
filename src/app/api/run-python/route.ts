import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    // Create a temporary file to run the script
    const tempDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `script_${Date.now()}.py`);
    fs.writeFileSync(tempFile, cleanCode);

    let stdout = '';
    let stderr = '';
    
    try {
      // Run Python script
      // Try 'python' first, then fallback to 'python3'
      let cmd = `python "${tempFile}"`;
      try {
        const result = await execAsync(cmd, { timeout: 15000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        // Fallback to python3
        cmd = `python3 "${tempFile}"`;
        const result = await execAsync(cmd, { timeout: 15000 });
        stdout = result.stdout;
        stderr = result.stderr;
      }
    } catch (err: any) {
      stderr = err.message || String(err);
      stdout = err.stdout || '';
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (_) {}
      }
    }

    return NextResponse.json({
      success: true,
      stdout,
      stderr,
      output: stdout + (stderr ? `\n\n[ERRORS / STDERR]:\n${stderr}` : '')
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
