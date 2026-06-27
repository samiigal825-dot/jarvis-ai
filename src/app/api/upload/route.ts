import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

function getUploadDir() {
  const dir = process.env.VERCEL ? '/tmp/uploads' : path.join(process.cwd(), '.data', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    let extractedText = '';

    // If it's Excel or CSV, parse it directly to text for the AI
    if (safeName.endsWith('.xlsx') || safeName.endsWith('.csv') || safeName.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      extractedText = xlsx.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    } else if (safeName.endsWith('.txt') || safeName.endsWith('.json') || safeName.endsWith('.md')) {
      extractedText = buffer.toString('utf-8');
    }

    return NextResponse.json({
      success: true,
      fileName: safeName,
      size: buffer.length,
      type: file.type,
      extractedData: extractedText.slice(0, 50000) // limit to 50k chars for prompt
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
