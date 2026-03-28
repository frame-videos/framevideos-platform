// LLM Client — multi-provider support via direct fetch (no SDKs)
// Supports: OpenAI, Anthropic, Groq, Together, Mistral, and any OpenAI-compatible endpoint
// Compatible with Cloudflare Workers runtime

import type { LlmConfig, LlmRequest, LlmResponse } from './types.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface OpenAIResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  model: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  stop_reason: string;
}

function mapFinishReason(reason: string): LlmResponse['finishReason'] {
  const map: Record<string, LlmResponse['finishReason']> = {
    stop: 'stop',
    end_turn: 'stop',
    length: 'length',
    max_tokens: 'length',
    content_filter: 'content_filter',
  };
  return map[reason] ?? 'unknown';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAnthropic(config: LlmConfig, request: LlmRequest): Promise<LlmResponse> {
  // Anthropic expects system as a top-level param, not in messages
  const systemMessage = request.messages.find((m) => m.role === 'system');
  const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: config.model,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
  };

  if (systemMessage) {
    body['system'] = systemMessage.content;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const textBlock = data.content.find((c) => c.type === 'text');

  if (!textBlock) {
    throw new Error('Anthropic returned no text content');
  }

  return {
    text: textBlock.text,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    model: data.model,
    finishReason: mapFinishReason(data.stop_reason),
  };
}

/** Default base URLs for known OpenAI-compatible providers */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  together: 'https://api.together.xyz/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

/**
 * Call an OpenAI-compatible endpoint.
 * Works with OpenAI, Groq, Together, Mistral, Ollama, vLLM, LiteLLM, custom endpoints, etc.
 */
async function callOpenAICompatible(config: LlmConfig, request: LlmRequest): Promise<LlmResponse> {
  const url = config.baseUrl || PROVIDER_BASE_URLS[config.provider];
  if (!url) {
    throw new Error(`No base URL configured for provider "${config.provider}". Set a custom URL.`);
  }

  const body = {
    model: config.model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: request.maxTokens ?? config.maxTokens ?? 2048,
    temperature: request.temperature ?? config.temperature ?? 0.7,
  };

  const providerLabel = config.provider === 'custom'
    ? (config.providerName || 'Custom')
    : config.provider;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${providerLabel} API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error(`${providerLabel} returned no choices`);
  }

  return {
    text: choice.message.content,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? config.model,
    finishReason: mapFinishReason(choice.finish_reason ?? 'stop'),
  };
}

/**
 * Call the LLM with retry + exponential backoff.
 * Retries on 429, 500, 502, 503, 529 errors.
 */
export async function callLlm(config: LlmConfig, request: LlmRequest): Promise<LlmResponse> {
  let caller: (cfg: LlmConfig, req: LlmRequest) => Promise<LlmResponse>;

  // Anthropic has its own message format; everything else is OpenAI-compatible
  if (config.provider === 'anthropic') {
    caller = callAnthropic;
  } else {
    caller = callOpenAICompatible;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await caller(config, request);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on transient errors
      const isRetryable =
        lastError.message.includes('429') ||
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('529') ||
        lastError.message.includes('overloaded');

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        break;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('LLM call failed after retries');
}
