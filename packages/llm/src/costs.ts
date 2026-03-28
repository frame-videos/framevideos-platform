// Credit costs per AI operation

import type { OperationType } from './types.js';

export const OPERATION_COSTS: Record<OperationType, number> = {
  generate_title: 2,
  generate_description: 3,
  generate_keywords: 2,
  generate_faq: 5,
  translate_content: 3, // per locale
  bulk_translate: 2, // per item per locale
} as const;
