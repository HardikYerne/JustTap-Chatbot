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

/**
 * Clean Markdown artifacts from the LLM response.
 * This changes formatting only, not the factual content.
 */
function stripMarkdownArtifacts(text: string): string {
  return text
    // **bold** -> bold
    .replace(/\*\*(.+?)\*\*/g, '$1')

    // __bold__ -> bold
    .replace(/__(.+?)__/g, '$1')

    // Markdown headings -> plain text
    .replace(/^#{1,6}\s+/gm, '')

    // Markdown bullet styles -> normal "-"
    .replace(/^(\s*)[*+]\s+/gm, '$1- ')

    // Single emphasis -> plain text
    .replace(/\*([^*\n]+)\*/g, '$1')

    // Remove horizontal separators
    .replace(/^\s*(?:={3,}|-{3,}|\*{3,}|_{3,})\s*$/gm, '')

    // Remove trailing whitespace
    .replace(/[ \t]+$/gm, '')

    // Collapse excessive blank lines
    .replace(/\n{3,}/g, '\n\n')

    .trim();
}

export async function runAnswerChain(
  input: GroundedAnswerInput
): Promise<string> {
  const strongMatch =
    input.hits.length > 0 &&
    input.topScore >= input.minRelevanceScore;

  /*
   * No sufficiently strong knowledge match.
   * Do not allow the LLM to invent an answer.
   */
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
   * Detect whether the user actually wants the COMPLETE
   * JustTap services overview.
   *
   * Specific requests such as:
   * "how can I book plumber"
   * "i want to book mechanic"
   * "tell me about painter"
   *
   * must NOT trigger the overview.
   */
  const requestText =
    `${input.message} ${input.normalizedMessage}`.toLowerCase();

  const completeServicesRequest =
    input.category.toLowerCase() === 'services' &&
    /\b(all|complete|overview|what services|services offered|services provided|provide services|offer services)\b/i.test(
      requestText
    ) &&
    !/\b(book|booking|price|pricing|cost|cancel|cancellation|reschedule|plumber|electrician|carpenter|painter|mechanic|maid|cleaner|gardener|security|developer|designer|tutor|accountant|tax|insurance|financial)\b/i.test(
      requestText
    );

  /*
   * Base instructions apply to EVERY response.
   */
  const basePrompt = `
You are the JustTap knowledge assistant.

SOURCE OF TRUTH:

Use ONLY the supplied knowledge context for factual information.

User language:
${input.language}

User intent:
${input.intent}

User category:
${input.category}

Original user question:
${input.message}

Normalized query:
${input.normalizedMessage}

Knowledge context:
${context}

IMPORTANT RESPONSE RULES:

- Answer ONLY the user's current question.
- Use ONLY information supported by the supplied knowledge context.
- Do not invent information.
- Do not invent services.
- Do not invent categories.
- Do not invent booking steps.
- Do not invent application features.
- Do not invent prices.
- Do not invent contact details.
- Do not invent instructions.
- Do not introduce unrelated examples.
- Do not introduce unrelated services.
- Ignore retrieved information that is unrelated to the user's current question.
- Do not automatically provide a complete services overview.
- Only provide all services when the user explicitly asks for all/complete services.
- If the user asks about one specific service, focus only on that service.
- Answer entirely in the requested language.
- Keep the response concise and directly relevant.

PLAIN TEXT FORMAT:

- Return plain text only.
- Do NOT use Markdown.
- Do NOT use **.
- Do NOT use __.
- Do NOT use # headings.
- Do NOT use ===== separators.
- Do NOT use horizontal separator lines.
- Do NOT use * as bullets.
- Do NOT use + as bullets.
- Use "-" for bullets when a bullet list is necessary.
- Use numbered steps only when the knowledge context actually contains supported steps.
- Do not add decorative formatting.
- Do not add unsupported conclusions.

SPECIFIC SERVICE REQUEST:

If the user asks about a specific service, answer about that service only.

If the user asks to book a specific service:

- Answer only about that requested service.
- Use booking information only if it exists in the knowledge context.
- Do not list all services.
- Do not provide a services overview.
- Do not invent application booking steps.
- Do not mention unrelated categories or services.

For example:

User:
how can I book plumber

The answer must focus ONLY on the plumber booking request.

If the knowledge context does not contain the booking procedure, say that the exact booking procedure is not available in the supplied JustTap information rather than inventing steps.

`;

  /*
   * Overview instructions are added ONLY when the current
   * user request is actually a complete services request.
   */
  const overviewPrompt = completeServicesRequest
    ? `

COMPLETE SERVICES OVERVIEW:

The user explicitly requested the complete JustTap services overview.

Use this exact response structure:

🌟 JustTap Services Overview

Short introductory paragraph.

- Category Name
  1. First service
  2. Second service
  3. Third service

- Next Category Name
  1. First service
  2. Second service
  3. Third service

RULES FOR THE OVERVIEW:

- The first line MUST be exactly:
  🌟 JustTap Services Overview

- Do NOT put ** around the title.
- Do NOT put # before the title.
- Do NOT put ===== after the title.
- Do NOT add a separator.
- Every category must start with "- Category Name".
- Every service must be on its own numbered line.
- Numbering must restart at 1 for every category.
- Include all categories supported by the knowledge context.
- Include all services supported by the knowledge context.
- Do not invent categories.
- Do not invent services.
- Do not use "...".
- Do not add booking instructions unless explicitly supported by the knowledge context.
- Do not add unrelated information.

The structure controls FORMAT ONLY.
The knowledge context controls the actual factual content.

`
    : `

NON-OVERVIEW REQUEST:

The user did NOT request the complete services overview.

Do NOT use the services overview format.

Do NOT list all JustTap services.

Do NOT reproduce unrelated categories.

Do NOT reproduce unrelated services.

Answer ONLY the user's current question.

`;

  const prompt = `${basePrompt}${overviewPrompt}
Return ONLY the final answer.
`.trim();

  const rawAnswer = await generate(prompt, input.language);

  return stripMarkdownArtifacts(rawAnswer);
}