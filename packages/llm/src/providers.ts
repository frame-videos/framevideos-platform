// Pre-configured LLM provider presets
// Most providers expose an OpenAI-compatible chat completions endpoint

export interface LlmProviderPreset {
  id: string;
  name: string;
  baseUrl?: string; // undefined = built-in (openai/anthropic native SDK format)
  models: string[];
  defaultModel: string;
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.1-70b-versatile',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    models: ['meta-llama/Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo'],
    defaultModel: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b'],
    defaultModel: 'mistral-large-latest',
  },
  {
    id: 'custom',
    name: 'Personalizado',
    models: [],
    defaultModel: '',
  },
];
