// Tipos do módulo LLM — será implementado nos próximos sprints

export interface LlmRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  tokensUsed: number;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter';
}

export interface LlmProvider {
  name: string;
  generate(request: LlmRequest): Promise<LlmResponse>;
}
