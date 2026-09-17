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
- The user may ask for a complete JustTap services overview.

- When the user asks for the complete services overview, use EXACTLY this structure:

**🌟 JustTap Services Overview**

JustTap provides a variety of services across different categories. Here's an overview of the services we offer:

- **Home Services**
  1. Plumber
  2. Electrician
  3. Carpenter
  4. AC Technician
  5. Painter

- **Auto Services**
  1. Bike Mechanic
  2. Car Mechanic
  3. Car Wash

- **Domestic Services**
  1. Maid Service
  2. Security Guard
  3. Gardener
  4. Cleaner

- **Technical Services**
  1. Software Developer
  2. Web Designer
  3. Mobile App Developer
  4. Computer Repair Technician
  5. Digital Marketing Expert

- **Education Services**
  1. Online Tutor
  2. Spoken English Trainer
  3. Computer Trainer
  4. Coaching Institute

- **Business Services**
  1. Accountant
  2. Tax Consultant
  3. CA
  4. Insurance Agent
  5. Financial Advisor

IMPORTANT FORMAT RULES:

- Do NOT generate a line made of "=" characters.
- Do NOT generate "====".
- Do NOT generate horizontal separators.
- Do NOT put "*" before a category except as part of the required Markdown bold syntax.
- Every category MUST start with "- **Category Name**".
- Every service MUST be on its own numbered line.
- Numbering MUST restart from 1 for every category.
- Do NOT combine multiple services into one line.
- Do NOT use "+" for services.
- Do NOT use "*" as a bullet.
- Do NOT convert the categories into paragraphs.
- Do NOT add extra headings.
- Do NOT add a conclusion after the final service unless the knowledge context explicitly requires it.
- Do NOT write "To book any..." unless that information is supported by the knowledge context.
- Do NOT use "..." when the complete list of services is available.
- Preserve all categories and services available in the knowledge context.
- The example above defines ONLY the formatting. The actual categories and services MUST come from the supplied knowledge context.
`.trim();

  return generate(prompt, input.language);
}