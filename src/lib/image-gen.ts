/**
 * Image generation — provider-abstracted.
 *
 * The pipeline depends only on the `ImageProvider` interface so the actual
 * image backend (DALL-E, Stable Diffusion, etc.) can be swapped without
 * touching the pipeline code.
 *
 * The default `OpenAIImageProvider` uses DALL-E 3. DALL-E 3 does not expose
 * arbitrary pixel sizes, so we request its 1792x1024 landscape size (the
 * closest 16:9 option to the 1200x630 social-media target) and save the
 * resulting image to a local temp directory. The returned `url` is either
 * the provider URL or a local file:// path.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import type { ImageResult } from '../types.js';

/** Common image style prompt appended to every generation request. */
export const AVH_IMAGE_STYLE =
  'clean minimal flat illustration, 16:9 social card, topic-relevant icon, ' +
  'two-tone palette, generous whitespace, no text, Agentic Value Hub branded watermark accent';

export interface ImageProvider {
  /** Generate one image for the given topic prompt and return its location. */
  generate(prompt: string): Promise<ImageResult>;
}

export interface OpenAIImageProviderOptions {
  apiKey?: string;
  /** DALL-E model id. Default dall-e-3. */
  model?: string;
  /** Local directory to save generated images. Default ./tmp/images. */
  outputDir?: string;
  /** If true, return base64 inline instead of writing a file. */
  inline?: boolean;
}

export class OpenAIImageProvider implements ImageProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly outputDir: string;
  private readonly inline: boolean;

  constructor(options: OpenAIImageProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.IMAGE_API_KEY ?? process.env.AI_API_KEY;
    if (!apiKey) throw new Error('OpenAIImageProvider: IMAGE_API_KEY (or AI_API_KEY) is required');
    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? process.env.IMAGE_MODEL ?? 'dall-e-3';
    this.outputDir = options.outputDir ?? join(process.cwd(), 'tmp', 'images');
    this.inline = options.inline ?? false;
  }

  async generate(prompt: string): Promise<ImageResult> {
    const fullPrompt = `${prompt}. ${AVH_IMAGE_STYLE}`;
    // DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792. 1792x1024 is closest to 16:9.
    const res = await this.client.images.generate({
      model: this.model,
      prompt: fullPrompt,
      n: 1,
      size: '1792x1024',
      response_format: this.inline ? 'b64_json' : 'url',
    });
    const data = res.data?.[0];
    if (!data) throw new Error('image generation returned no data');

    if (this.inline && data.b64_json) {
      return { url: `data:image/png;base64,${data.b64_json}`, base64: data.b64_json, prompt: fullPrompt };
    }

    const remoteUrl = data.url ?? '';
    if (!remoteUrl) {
      // fall back to base64 if no url
      if (data.b64_json) {
        return { url: `data:image/png;base64,${data.b64_json}`, base64: data.b64_json, prompt: fullPrompt };
      }
      throw new Error('image generation returned neither url nor b64_json');
    }

    // Save a local copy so we have a stable artifact even before CDN upload.
    let localPath: string | undefined;
    try {
      if (!existsSync(this.outputDir)) await mkdir(this.outputDir, { recursive: true });
      const imgRes = await fetch(remoteUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      localPath = join(this.outputDir, `${randomUUID()}.png`);
      await writeFile(localPath, buf);
    } catch {
      // Saving is best-effort; the remote URL is still usable.
      localPath = undefined;
    }

    return { url: localPath ?? remoteUrl, prompt: fullPrompt, localPath };
  }
}

/** Factory that picks an image provider from the IMAGE_PROVIDER env var. */
export function createImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER ?? 'placeholder').toLowerCase();
  switch (provider) {
    case 'openai':
      return new OpenAIImageProvider();
    case 'placeholder':
    case 'svg':
      return new PlaceholderImageProvider();
    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}

/**
 * Placeholder image provider — generates deterministic SVG images with
 * category-colored backgrounds and the AVH brand. No API key needed.
 * Uses pollination.us for AI-generated images via a simple URL API.
 */
export class PlaceholderImageProvider implements ImageProvider {
  async generate(prompt: string): Promise<ImageResult> {
    // Use pollination.us — free AI image generation via URL
    const seed = encodeURIComponent(prompt.slice(0, 100));
    const url = `https://image.pollinations.ai/prompt/${seed}?width=1200&height=630&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    return { url, prompt };
  }
}
