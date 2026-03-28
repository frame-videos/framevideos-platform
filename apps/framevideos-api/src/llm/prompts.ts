// Prompt templates for AI content generation
// All prompts in English for best LLM performance

import type { PromptPair, VideoInfo } from './types.js';

function buildVideoContext(info: VideoInfo): string {
  const parts: string[] = [];

  if (info.title) parts.push(`Current title: "${info.title}"`);
  if (info.description) parts.push(`Current description: "${info.description}"`);
  if (info.categories?.length) parts.push(`Categories: ${info.categories.join(', ')}`);
  if (info.tags?.length) parts.push(`Tags: ${info.tags.join(', ')}`);
  if (info.performers?.length) parts.push(`Performers: ${info.performers.join(', ')}`);
  if (info.channel) parts.push(`Channel: ${info.channel}`);
  if (info.durationSeconds) {
    const min = Math.floor(info.durationSeconds / 60);
    const sec = info.durationSeconds % 60;
    parts.push(`Duration: ${min}m ${sec}s`);
  }

  return parts.join('\n');
}

export function generateVideoTitle(videoInfo: VideoInfo): PromptPair {
  return {
    system: `You are an SEO expert specializing in video content optimization. Generate compelling, SEO-optimized video titles that maximize click-through rates and search visibility. The title should be engaging, descriptive, and between 40-70 characters. Return ONLY the title text, nothing else.`,
    user: `Generate an SEO-optimized title for this video:\n\n${buildVideoContext(videoInfo)}\n\nReturn only the title, no quotes, no explanation.`,
  };
}

export function generateVideoDescription(videoInfo: VideoInfo): PromptPair {
  return {
    system: `You are an SEO expert specializing in video content descriptions. Write compelling meta descriptions that are between 150-300 characters, include relevant keywords naturally, and encourage clicks from search results. Return ONLY the description text, nothing else.`,
    user: `Write an SEO-optimized description (150-300 characters) for this video:\n\n${buildVideoContext(videoInfo)}\n\nReturn only the description, no quotes, no explanation.`,
  };
}

export function generateVideoKeywords(videoInfo: VideoInfo): PromptPair {
  return {
    system: `You are an SEO keyword research expert. Generate relevant keywords and key phrases for video content that will improve search visibility. Return a JSON array of 10-20 keyword strings. Return ONLY the JSON array, no markdown, no explanation.`,
    user: `Generate SEO keywords for this video:\n\n${buildVideoContext(videoInfo)}\n\nReturn ONLY a JSON array of strings, e.g. ["keyword1", "keyword2", ...]. No markdown code blocks.`,
  };
}

export function generateVideoFAQ(videoInfo: VideoInfo): PromptPair {
  return {
    system: `You are a content strategist. Generate FAQ (Frequently Asked Questions) entries for video content that improve SEO through structured data and provide value to users. Return a JSON array of 5 objects with "question" and "answer" fields. Return ONLY the JSON array, no markdown, no explanation.`,
    user: `Generate 5 FAQ entries for this video:\n\n${buildVideoContext(videoInfo)}\n\nReturn ONLY a JSON array like [{"question":"...","answer":"..."}]. No markdown code blocks.`,
  };
}

export function translateContent(
  text: string,
  fromLocale: string,
  toLocale: string,
): PromptPair {
  return {
    system: `You are a professional translator. Translate the given text accurately while maintaining the original tone, style, and meaning. Adapt cultural references when appropriate. Return ONLY the translated text, nothing else.`,
    user: `Translate the following text from ${fromLocale} to ${toLocale}:\n\n${text}\n\nReturn ONLY the translated text, no quotes, no explanation.`,
  };
}
