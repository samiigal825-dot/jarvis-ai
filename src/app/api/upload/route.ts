import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const uploadDir = getUploadDir();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      fileName: safeName,
      filePath: filePath,
      size: buffer.length,
      type: file.type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
