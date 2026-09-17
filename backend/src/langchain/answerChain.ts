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
 * Remove Markdown artifacts that the model may generate
 * even when plain-text output is requested.
 *
 * This is only a formatting cleanup layer.
 * It does not change the factual content of the answer.
 */
function stripMarkdownArtifacts(text: string): string {
  return text
    // **bold** -> bold
    .replace(/\*\*(.+?)\*\*/g, '$1')

    // __bold__ -> bold
    .replace(/__(.+?)__/g, '$1')

    // Markdown headings:
    // # Heading
    // ## Heading
    // ### Heading
    .replace(/^#{1,6}\s+/gm, '')

    // Horizontal separator lines:
    // =====
    // -----
    // *****
    .replace(/^\s*(?:={3,}|-{3,}|\*{3,}|_{3,})\s*$/gm, '')

    // Markdown bullet:
    // * item -> - item
    // + item -> - item
    .replace(/^(\s*)[*+]\s+/gm, '$1- ')

    // Remaining single emphasis:
    // *word* -> word
    .replace(/\*([^*\n]+)\*/g, '$1')

    // Remaining underscores used as emphasis:
    .replace(/_([^_\n]+)_/g, '$1')

    // Remove trailing Markdown horizontal formatting
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
   * Detect only a COMPLETE services overview request.
   *
   * Specific requests such as:
   * "how can I book plumber"
   * must NOT be treated as an overview request.
   */
  const requestText =
    `${input.message} ${input.normalizedMessage}`.toLowerCase();

  const completeServicesRequest =
    input.category.toLowerCase() === 'services' &&
    /\b(all|complete|overview|what services|services offered|services provided|provide services|offer services)\b/i.test(
      requestText
    ) &&
    !/\b(price|pricing|cost|book|booking|cancel|cancellation|reschedule)\b/i.test(
      requestText
    );

  const prompt = `
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

GENERAL RULES:

- Answer ONLY the user's current question.
- Use ONLY information supported by the knowledge context.
- Do not invent information.
- Do not invent services, categories, features, prices, contact details, booking instructions, application steps, or other information.
- Do not introduce unrelated examples.
- Do not introduce unrelated services.
- Do not say that something is unavailable unless the knowledge context explicitly supports that statement.
- Preserve the actual names and terminology from the knowledge context.
- Answer entirely in the requested language.
- Keep the answer focused and easy to read.
- Do not automatically provide the complete services overview.
- Only provide a complete services overview when the current user request explicitly asks for it.

PLAIN-TEXT FORMAT:

- Return plain text only.
- Do NOT use Markdown.
- Do NOT use **.
- Do NOT use __.
- Do NOT use # headings.
- Do NOT use Markdown heading syntax.
- Do NOT use ===== or ---- separators.
- Do NOT create horizontal separator lines.
- Do NOT use * as a bullet.
- Do NOT use + as a bullet.
- Use - for bullet points when a list is needed.
- Do not put symbols around titles.
- Do not put symbols around category names.
- Do not add decorative formatting.
- Do not add unnecessary conclusions.

SPECIFIC REQUEST RULE:

If the user asks about one specific service, answer about that service only.

For example:

User:
how can I book plumber

Your answer must focus ONLY on the plumber booking request.

Do NOT respond with:
- Home Services
- Auto Services
- Domestic Services
- Technical Services
or a complete list of JustTap services.

Only provide booking steps if those steps are actually supported by the knowledge context.

If the knowledge context does not contain the requested booking procedure, do not invent a procedure.

STEP-BY-STEP FORMAT:

When the knowledge context contains supported steps for the user's request, format them like this:

Title

Short introduction if supported.

1. First supported step
2. Second supported step
3. Third supported step

Do not create steps that are not present in the knowledge context.

`;

  /*
   * IMPORTANT:
   * Only add the complete-services instructions when the user
   * actually asks for the complete services overview.
   *
   * This prevents the LLM from copying the overview structure
   * into questions such as "how can I book plumber".
   */
  const overviewInstructions = completeServicesRequest
    ? `

COMPLETE SERVICES OVERVIEW:

The current user request IS a complete JustTap services overview request.

Use this structure:

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

IMPORTANT:

- The title MUST be exactly:
  🌟 JustTap Services Overview

- Do NOT use ** around the title.
- Do NOT use # around the title.
- Do NOT use ===== after the title.
- Do NOT use any separator line.
- Every category must begin with:
  - Category Name
- Every service must be on its own numbered line.
- Numbering restarts at 1 for every category.
- Include ALL categories supported by the knowledge context.
- Include ALL services supported by the knowledge context.
- Do not add unsupported categories.
- Do not add unsupported services.
- Do not stop the list early.
- Do not use "...".
- Do not add a booking paragraph unless the knowledge context explicitly supports it.
- Do not copy services from this example unless they are present in the knowledge context.

The structure above controls FORMAT ONLY.
The knowledge context controls the actual factual content.

`
    : `

NON-OVERVIEW REQUEST:

The current request is NOT a complete services overview.

Answer ONLY the specific user question.

Do NOT use the "🌟 JustTap Services Overview" structure.

Do NOT list all JustTap services.

Do NOT add unrelated categories.

Do NOT add unrelated services.

Follow the specific-request rules above.

`;

  const finalPrompt = `${prompt}${overviewInstructions}
Return ONLY the final answer.
`.trim();

  const rawAnswer = await generate(finalPrompt, input.language);

  return stripMarkdownArtifacts(rawAnswer);
}