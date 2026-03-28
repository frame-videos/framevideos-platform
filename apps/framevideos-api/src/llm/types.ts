// Types for the LLM module

export type LlmProviderName = 'openai' | 'anthropic';

export interface LlmConfig {
  provider: LlmProviderName;
  apiKey: string;
  model: string;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'unknown';
}

export interface PromptPair {
  system: string;
  user: string;
}

export interface VideoInfo {
  title?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  performers?: string[];
  channel?: string;
  durationSeconds?: number;
  locale?: string;
}

export type OperationType =
  | 'generate_title'
  | 'generate_description'
  | 'generate_keywords'
  | 'generate_faq'
  | 'translate_content'
  | 'bulk_translate';
