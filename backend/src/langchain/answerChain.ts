import { generate } from '../services/huggingface.js';

import { SearchHit } from '../models/types.js';

export type GroundedAnswerInput = {
  message: string;
  normalizedMessage: string;
  language: string;
  intent: string;
  category: string;
  hits: SearchHit[];
  topScore: number;
  minRelevanceScore: number;
};

export async function runAnswerChain(
  input: GroundedAnswerInput
): Promise<string> {
  const strongMatch =
    input.hits.length > 0 &&
    input.topScore >= input.minRelevanceScore;

  // No sufficiently strong knowledge match.
  // Do not allow the LLM to invent an answer.
  if (!strongMatch) {
    const safeFallbacks: Record<string, string> = {
      en: "I don't have exact information about that JustTap topic yet. The JustTap support team can help you with the exact details.",
      hi: "मेरे पास अभी इस JustTap विषय की सटीक जानकारी नहीं है। JustTap की सहायता टीम आपको सही जानकारी देने में मदद कर सकती है।",
      mr: "माझ्याकडे सध्या या JustTap विषयाची अचूक माहिती नाही. JustTap ची सहाय्य टीम तुम्हाला योग्य माहिती देण्यात मदत करू शकते."
    };

    return safeFallbacks[input.language] ?? safeFallbacks.en;
  }

  const context = input.hits
    .map(
      (hit, index) =>
        `[${index + 1}]
ID: ${hit.id}
Intent: ${hit.intent}
Category: ${hit.category}
Sub-service: ${hit.sub_service ?? ''}
Question: ${hit.question}
Answer:
${hit.answer}`
    )
    .join('\n\n');

  /*
   * Detect a request for the COMPLETE JustTap services overview.
   *
   * This controls formatting only.
   * The knowledge context still controls all factual content.
   */
  const completeServicesRequest =
    input.category.toLowerCase() === 'services' &&
    /service|services|provide|provided|offer|offers|offered|overview|all/i.test(
      `${input.message} ${input.normalizedMessage}`
    ) &&
    !/price|pricing|cost|book|booking|cancel|cancellation|reschedule/i.test(
      `${input.message} ${input.normalizedMessage}`
    );

  const prompt = `
You are the grounded answer-generation component of the JustTap chatbot.

Your task is to answer the user's question using ONLY the supplied knowledge context.

==================================================
SOURCE OF TRUTH
==================================================

- The supplied knowledge context is the ONLY source of factual information.
- Do not use outside knowledge.
- Do not invent information.
- Do not assume information that is not present.
- Do not introduce unrelated services.
- Do not introduce unrelated categories.
- Do not introduce unrelated examples.
- Do not add unsupported booking instructions.
- Do not add unsupported pricing information.
- Do not add unsupported contact information.
- Do not add unsupported application instructions.
- Do not say that a service is unavailable unless the knowledge context explicitly says so.
- Do not omit relevant information supported by the knowledge context.
- Do not change the factual meaning of the knowledge context.

==================================================
LANGUAGE RULES
==================================================

Requested response language:
${input.language}

- Answer entirely in the requested response language.
- Do not mix languages.
- Do not leave English sentences inside a Hindi, Marathi, or other non-English response.
- Use the appropriate script for the requested language.
- Proper nouns such as "JustTap" may remain unchanged.
- Service names may remain in their original form when they are the names provided by the knowledge context.

==================================================
GENERAL RESPONSE STRUCTURE
==================================================

- Keep the answer concise but complete.
- Use a clear and structured format.
- Start with a short relevant heading when appropriate.
- Make the main heading bold.
- Use short paragraphs.
- Group related information into logical sections.
- Use bold labels when appropriate.
- Use Markdown formatting correctly.
- Do not put the entire answer into one paragraph.

==================================================
CATEGORY AND SERVICE HIERARCHY
==================================================

When the knowledge context contains multiple service categories:

CATEGORY FORMAT:
- Each category must be a bullet point.
- The category name must be bold.

Example:

- **Home Services**

SERVICE FORMAT:
- Services belonging to a category must appear underneath that category.
- Each service must be a numbered item.
- Numbering starts from 1 for every new category.

Example:

- **Home Services**
  1. Plumber
  2. Electrician
  3. Carpenter

Then the next category:

- **Auto Services**
  1. Bike Mechanic
  2. Car Mechanic
  3. Car Wash

IMPORTANT:
- Category = bullet point + bold.
- Service = numbered list underneath the category.
- Do NOT use "+" for services.
- Do NOT use "-" for individual services.
- Do NOT convert services into a paragraph.
- Do NOT place services on the same line as the category.
- Do NOT use a colon after the category name.
- Restart numbering at 1 for every category.
- Keep every service on its own line.
- Keep every service under its correct category.

==================================================
COMPLETE SERVICES OVERVIEW
==================================================

${completeServicesRequest
  ? `
The user is asking for the COMPLETE JustTap services overview.

Use this exact response structure:

**🌟 JustTap Services Overview**

[Short introductory paragraph]

- **[Category Name]**
  1. [Service]
  2. [Service]
  3. [Service]

- **[Category Name]**
  1. [Service]
  2. [Service]
  3. [Service]

- **[Category Name]**
  1. [Service]
  2. [Service]
  3. [Service]

RULES FOR THE COMPLETE SERVICES OVERVIEW:

- The heading MUST be exactly:
  **🌟 JustTap Services Overview**
- The 🌟 emoji is part of the heading.
- Do not remove or replace the 🌟 emoji.
- Every relevant category from the knowledge context must be included.
- Every relevant service belonging to each category must be included.
- Do not stop after the first category.
- Do not show only Home Services or only one category.
- Preserve the complete relevant service list.
- Do not invent additional categories or services.
- Do not merge categories.
- Do not rename categories.
- Do not move a service to another category.
- Use the exact hierarchy described above.
- Do not add booking or pricing paragraphs unless those facts are explicitly supported and directly relevant to the user's question.
`
  : `
For this request, use the general structured response rules.

If categories are present in the relevant knowledge context, preserve those categories and use the category/service hierarchy described above.

Do not force the complete-services heading when the user is asking about only one specific service or another specific topic.
`}

==================================================
KNOWLEDGE CONTEXT
==================================================

${context}

==================================================
USER QUESTION
==================================================

Original user question:
${input.message}

Normalized query:
${input.normalizedMessage}

User intent:
${input.intent}

User category:
${input.category}

==================================================
FINAL GENERATION RULE
==================================================

Generate ONLY the final answer to the user.

Do not explain these rules.
Do not mention the knowledge context.
Do not mention that you are an AI.
Do not mention prompting or formatting rules.

The knowledge context determines WHAT information you may provide.

The response structure rules determine HOW you must present that information.

Follow both strictly.
`.trim();

  return generate(prompt, input.language);
}