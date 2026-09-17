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
 * Strip any Markdown artifacts the model produced despite the plain-text
 * instructions in the prompt. This is a deterministic safety net -- the
 * prompt rules alone are not reliable enough on their own, so every
 * response is normalized here before it reaches the user, regardless of
 * intent, category, or whether it used the services-overview template.
 */
function stripMarkdownArtifacts(text: string): string {
  return text
    // **bold** / __bold__ -> bold
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Markdown headings ("# Title", "## Title") -> plain line
    .replace(/^#{1,6}\s+/gm, '')
    // "* item" or "+ item" bullets -> "- item"
    .replace(/^(\s*)[*+](\s+)/gm, '$1-$2')
    // any remaining single-asterisk emphasis *word* -> word
    .replace(/\*([^*\n]+)\*/g, '$1')
    // "====" / "----" separator lines -> removed
    .replace(/^[=\-]{3,}\s*$/gm, '')
    // collapse 3+ blank lines left behind by the removals above
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
   * Detect a request for the complete JustTap services overview.
   *
   * This controls formatting only.
   * The knowledge context remains the source of truth for factual content.
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

- Answer using ONLY information supported by the knowledge context.
- Do not invent services, categories, features, prices, contact details, booking instructions, or other information.
- Do not introduce unrelated examples.
- Do not say that a service is unavailable unless the knowledge context explicitly supports that statement.
- Preserve the actual category names and service names from the knowledge context.
- Preserve the complete relevant service list when the knowledge context provides it.
- Do not use "..." when the complete information is available.
- Answer entirely in the requested language.
- Keep the answer clear and easy to read.
- Use short paragraphs where appropriate.
- Use bullets for groups of items.
- Use numbered items for services within a category.
- Numbering must restart at 1 for every category.

PLAIN-TEXT FORMAT RULES (apply to EVERY answer, not only the services overview):

- Do NOT use Markdown formatting anywhere in the response.
- Do NOT use "**" or "__" for bold or emphasis, even around a short title like "Login Instructions" or "To Book Plumber".
- Do NOT use Markdown headings.
- Do NOT use "#" for headings.
- Do NOT use "=" or "-" characters as separator lines.
- Do NOT generate "====" or "----" lines.
- Do NOT use "*" or "+" as a bullet character. Use "-" for bullets instead.
- Do NOT put "*" before category names, step titles, or section labels.
- Do NOT put a colon after category names.
- Do NOT put Markdown syntax around category names, step titles, or the main title.
- A short title line (e.g. "To Book Plumber", "Login Instructions") must be plain text, on its own line, with no "**", no "#", and no trailing colon.

GENERAL (NON-OVERVIEW) ANSWER STRUCTURE:

For step-by-step instructions (booking a service, logging in, troubleshooting, etc.), use exactly this shape:

Plain-text title line, no symbols around it

Short one- or two-line intro sentence if needed.

1. First step
2. Second step
3. Third step

Only add a second plain-text section title (e.g. "If you are having trouble logging in") followed by its own numbered or "-" bulleted list if the knowledge context actually supports that extra section. Never wrap that section title in "**" either.

For a complete services overview, use this exact STRUCTURE:

🌟 JustTap Services Overview

Short introductory paragraph.

- Home Services
  1. Plumber
  2. Electrician
  3. Carpenter
  4. AC Technician
  5. Painter

- Auto Services
  1. Bike Mechanic
  2. Car Mechanic
  3. Car Wash

- Domestic Services
  1. Maid Service
  2. Security Guard
  3. Gardener
  4. Cleaner

- Technical Services
  1. Software Developer
  2. Web Designer
  3. Mobile App Developer
  4. Computer Repair Technician
  5. Digital Marketing Expert

- Education Services
  1. Online Tutor
  2. Spoken English Trainer
  3. Computer Trainer
  4. Coaching Institute

- Business Services
  1. Accountant
  2. Tax Consultant
  3. CA
  4. Insurance Agent
  5. Financial Advisor

COMPLETE SERVICES REQUEST:
${completeServicesRequest ? 'YES - The user is requesting the complete services overview. Include all relevant categories and all services supported by the knowledge context.' : 'NO - Answer according to the specific user request rather than automatically producing the complete services overview. Follow the GENERAL (NON-OVERVIEW) ANSWER STRUCTURE above instead.'}

IMPORTANT:
The structures above are FORMAT EXAMPLES only.

Do NOT blindly copy the example's services.

Use the knowledge context as the source of truth for the actual categories, services, and steps.

For a complete services request:
1. Start with exactly:
   🌟 JustTap Services Overview
2. Add a short introductory paragraph supported by the knowledge context.
3. Put every category on its own bullet line:
   - Category Name
4. Put every service belonging to that category underneath it.
5. Number services starting from 1 for each category.
6. Preserve all relevant categories and services from the knowledge context.
7. Do not add unsupported categories or services.
8. Do not add any Markdown characters.
9. Do not add a separator after the title.
10. Do not add a conclusion unless it is explicitly supported by the knowledge context.

For any other request, follow the GENERAL (NON-OVERVIEW) ANSWER STRUCTURE and the PLAIN-TEXT FORMAT RULES above exactly, including for the title line and any "If you are having trouble..." style sub-section.

Return ONLY the final answer.
`.trim();

  const rawAnswer = await generate(prompt, input.language);
  return stripMarkdownArtifacts(rawAnswer);
}
