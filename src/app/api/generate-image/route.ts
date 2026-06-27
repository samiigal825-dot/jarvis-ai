import { NextRequest, NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { prompt, hfToken } = await req.json();
    const HF_TOKEN = hfToken || process.env.HUGGINGFACE_API_KEY || '';

    if (!HF_TOKEN) {
      return NextResponse.json({ error: "HuggingFace API Key is missing." }, { status: 500 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const hf = new HfInference(HF_TOKEN);
    // Using a fast, high-quality image generation model
    const modelId = 'black-forest-labs/FLUX.1-schnell';

    const imageBlob = await hf.textToImage({
      model: modelId,
      inputs: prompt,
      parameters: {
        guidance_scale: 3.5,
      }
    });

    const blob = imageBlob as unknown as Blob;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:${blob.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    return NextResponse.json({ image: base64Image });
  } catch (err: any) {
    console.error('Image Generation API Error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
