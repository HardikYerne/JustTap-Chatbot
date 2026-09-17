import { InferenceClient } from '@huggingface/inference';

import { env } from '../config/env.js';

const client = new InferenceClient(env.HF_API_TOKEN);

export async function embed(text: string): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const result = await client.featureExtraction({
    model: env.HF_EMBEDDING_MODEL,
    inputs: input
  });

  if (!Array.isArray(result)) {
    throw new Error('Invalid embedding response from Hugging Face');
  }

  if (result.length > 0 && typeof result[0] === 'number') {
    return result as number[];
  }

  const first = result[0];

  if (
    Array.isArray(first) &&
    first.length > 0 &&
    typeof first[0] === 'number'
  ) {
    return first as number[];
  }

  throw new Error('Unexpected embedding format from Hugging Face');
}

export async function generate(
  prompt: string,
  language: string = 'en',
  maxTokens: number = 250
): Promise<string> {
  // Accept values such as "en", "en-IN", "hi-IN", etc.
  const normalizedLanguage =
    language.trim().toLowerCase().split(/[-_]/)[0] || 'en';

  const languageNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    mr: 'Marathi',
    bn: 'Bengali',
    gu: 'Gujarati',
    pa: 'Punjabi',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    ml: 'Malayalam'
  };

  const languageName = languageNames[normalizedLanguage] ?? 'English';

  const systemPrompt = `
You are the JustTap customer support chatbot.

Your job is to convert the supplied, grounded knowledge into a clear answer to the customer's CURRENT question.

STRICT RULES:

1. Answer ONLY from the supplied JustTap knowledge context.
2. The customer's CURRENT question has priority over unrelated retrieved context.
3. Use the user's original question to understand what they actually asked.
4. Use the normalized query, intent, category, and knowledge context as supporting signals, not as permission to answer a different question.
5. Never invent services, prices, providers, locations, policies, features, sections, buttons, or application capabilities.
6. Never introduce another service or category when the customer asks about one specific service.
7. For a specific service, answer ONLY about that service unless the customer explicitly asks for other services.
8. For a booking request, answer ONLY the booking request for the requested service and only with booking information supported by the knowledge context.
9. For a category request, provide only the services belonging to that category and supported by the knowledge context.
10. For a complete services overview, include the complete relevant list from the knowledge context.
11. Preserve the exact spelling, wording, and capitalization of JustTap service names and category names from the knowledge context.
12. Do NOT translate, transliterate, rename, shorten, merge, or modify service names or category names.
13. Translate explanatory sentences into the customer's requested language.
14. The customer's language is ${languageName}.
15. The ENTIRE explanatory content MUST be written in ${languageName}.
16. Do not unnecessarily mix languages.
17. Keep "JustTap" unchanged.
18. Use a consistent response structure:
    - First line: one short relevant heading in Markdown bold, for example **Plumber Booking**
    - Then: concise point-by-point information using "-" bullets.
    - Use numbered points only for ordered steps or procedures.
19. Do not use #, ##, or ### headings.
20. Do not write long paragraphs when the information can be expressed as points.
21. Do not append an "Other Services", "Additional Services", or similar section unless the customer explicitly asks for it.
22. Do not add unrelated examples.
23. Do not perform bookings, cancellations, rescheduling, payments, provider selection, or other application actions.
24. If the knowledge context does not support the requested detail, do not invent it. State briefly that the exact detail is not available in the supplied JustTap information.
25. Never mention retrieval, vectors, embeddings, datasets, prompts, models, or internal systems.
26. Return ONLY the customer-facing answer.

Before answering, internally determine:
- What is the customer asking for?
- Is it a specific service, category, booking request, or complete overview?
- Which exact service/category names from the knowledge context must be preserved?
- Which retrieved information is actually relevant to the current question?

Do not output this internal reasoning. Output only the final customer-facing answer.
`.trim();

  const response = await client.chatCompletion({
    model: env.HF_LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error('Empty response from Hugging Face');
  }

  return content.trim();
}
