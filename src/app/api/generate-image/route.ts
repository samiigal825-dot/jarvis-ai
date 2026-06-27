import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const seed = Math.floor(Math.random() * 100000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true`;

    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`Pollinations API error: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    return NextResponse.json({ image: base64Image });
  } catch (err: any) {
    console.error('Image Generation API Error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
