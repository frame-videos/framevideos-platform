// @frame-videos/llm — LLM integration module

export type {
  LlmProviderName,
  LlmConfig,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  PromptPair,
  VideoInfo,
  OperationType,
} from './types.js';

export { callLlm } from './client.js';

export {
  generateVideoTitle,
  generateVideoDescription,
  generateVideoKeywords,
  generateVideoFAQ,
  translateContent,
} from './prompts.js';

export { OPERATION_COSTS } from './costs.js';
