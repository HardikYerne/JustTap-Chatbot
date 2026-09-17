
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

// Predefined KB answers that need a version in every supported response
// language, since they're returned verbatim (no generation/translation
// step) to preserve exact structure. Add a language here whenever a new
// predefined answer ID needs to support it.
//
// DRAFT TRANSLATIONS: the hi/mr text below was drafted for structure/
// correctness of the fix, not verified by a native speaker for tone --
// please have someone review the actual wording before this goes live.
const predefinedAnswers: Record<string, Record<string, string>> = {
  svc_overview_001: {
    en: `**🌟 JustTap Services Overview**

JustTap provides a variety of services across different categories. Here's an overview of the services we offer:

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
  5. Financial Advisor`,
    hi: `**🌟 JustTap Services Overview**

JustTap अलग-अलग categories में कई services प्रदान करता है। यहाँ उपलब्ध services का संक्षिप्त overview है:

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
  5. Financial Advisor`,
    mr: `**🌟 JustTap Services Overview**

JustTap विविध categories मध्ये अनेक services प्रदान करते. येथे उपलब्ध services चा संक्षिप्त overview आहे:

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
  5. Financial Advisor`
  }
};

export async function runAnswerChain(input: GroundedAnswerInput): Promise<string> {
  const strongMatch =
    input.hits.length > 0 &&
    input.topScore >= input.minRelevanceScore;

  // Return predefined KB answers directly.
  // This preserves their exact structure and avoids LLM paraphrasing.
  //
  // Picks the version matching input.language from predefinedAnswers above
  // instead of returning input.hits[0].answer directly -- the KB record's
  // own answer field is English-only, so returning it verbatim regardless
  // of language meant a Hindi/Marathi conversation always got an English
  // reply for this one answer, even though every other reply (small talk,
  // the general LLM-generated branch below) correctly used the requested
  // language. Falls back to English if a language isn't drafted yet, same
  // fallback pattern safeFallbacks already uses below.
  if (
    strongMatch &&
    input.hits[0]?.id &&
    predefinedAnswers[input.hits[0].id]
  ) {
    const versions = predefinedAnswers[input.hits[0].id];
    const responseLanguage = input.language.toLowerCase().split(/[-_]/)[0];
    return versions[responseLanguage] ?? versions.en;
  }

  if (strongMatch) {
    const context = input.hits
      .map(
        (hit, index) =>
          `[${index + 1}] intent=${hit.intent}; category=${hit.category}; service=${hit.sub_service ?? ''}; Q=${hit.question}; A=${hit.answer}`
      )
      .join('\n');

  const prompt = `
Detected language: ${input.language}

User intent: ${input.intent}

User category: ${input.category}

Original user question:

${input.message}

Normalized English query:

${input.normalizedMessage}

Knowledge context:

${context}

Answer the user using ONLY the supplied knowledge context.

Important:

- Do not invent information.
- Use only information supported by the supplied knowledge context.
- Do not introduce unrelated services, categories, examples, details, or assumptions.
- Do not add information from general knowledge.
- Do not omit relevant information from the supplied knowledge context.
- Do not change the meaning of the supplied knowledge context.
- Do not say that a service is unavailable unless the knowledge context explicitly states that it is unavailable.

- Answer entirely in the requested response language.
- For Hindi responses, write explanatory sentences in Hindi script.
- For Marathi responses, write explanatory sentences in Marathi script.
- For English responses, write explanatory sentences in English.
- Keep "JustTap" unchanged.
- Keep every service name and category name exactly as provided in the knowledge context.
- Do not translate, transliterate, rename, shorten, merge, or otherwise modify service names or category names.

- Use the same structured response format for every answer.

- Start every response with one short, relevant heading.
- The heading must use Markdown bold syntax: **Heading**.
- Do not use #, ##, ###, or other Markdown heading syntax.
- After the heading, present the information point-by-point.
- Use "-" for explanatory points or lists.
- Use numbered lists when explaining ordered steps or procedures.
- Keep paragraphs short.
- Do not write long blocks of text when the information can be presented as points.

- For a specific service:
  - Create a short heading using the exact service name.
  - Answer only the user's current request about that service.
  - Provide only information relevant to that service.
  - Present the information point-by-point.
  - Do not mention, list, recommend, or append any other service or category unless the user explicitly asks for them.
  - Do not append the complete services overview.

- For a specific category:
  - Create a heading using the category name.
  - Provide only that category's supported services.
  - Present services point-by-point or as a numbered list when appropriate.

- For a booking request:
  - Create a short booking-related heading using the exact requested service name.
  - Answer only the user's booking request for that service.
  - Provide only the booking information supported by the knowledge context.
  - If the knowledge context provides ordered booking steps, use a numbered list.
  - Do not add unsupported booking steps.
  - Do not mention, list, recommend, or append any other service or category unless the user explicitly asks for them.

  - Use numbered lists for services under each category.
  - Include the complete relevant list from the knowledge context.
  - Do not add booking, pricing, cancellation, or unrelated information unless explicitly requested.

- Preserve the exact service names and category names from the knowledge context.
- Do not invent, rename, merge, reorder, or remove services.
- Do not use "..." when the knowledge context contains the complete list.
- Use "-" for categories.
- Use numbered lists for services under each category.
- Include the complete relevant list from the knowledge context.
- Do not add booking, pricing, cancellation, or unrelated information unless explicitly requested.
- For Hindi:
  - Write the explanatory content in Hindi.
  - Keep service names and category names exactly as provided in the knowledge context.

- For Marathi:
  - Write the explanatory content in Marathi.
  - Keep service names and category names exactly as provided in the knowledge context.

- For English:
  - Write the complete response in English.

`.trim();

    return generate(prompt, input.language);
  }

  // No sufficiently specific KB record. Use a deterministic safe response
  // instead of an LLM-generated fallback. This prevents unsupported topics
  // (especially login/account access) from producing variable or invented
  // steps, and makes the response safe to cache across devices.
  //
  // GROUNDING NOTE: this list used to only cover 5 known topics (find/
  // book/cancel/reschedule/providers) and left every other topic --
  // including login/account access, which the KB has no records for at
  // all -- with no scripted guardrail. That gap is exactly what produced
  // two different, partly invented answers (including a fabricated
  // "two-factor authentication" step) to the same "how to login" question.
  // The rule below is now restrictive by default: for anything not on
  // this specific list, the model must say it doesn't have exact
  // information rather than describe steps it has no source for.
  const safeFallbacks: Record<string, string> = {
    en: "I don't have exact information about that JustTap topic yet. The JustTap support team can help you with the exact details.",
    hi: "मेरे पास अभी इस JustTap विषय की सटीक जानकारी नहीं है। JustTap की सहायता टीम आपको सही जानकारी देने में मदद कर सकती है।",
    mr: "माझ्याकडे सध्या या JustTap विषयाची अचूक माहिती नाही. JustTap ची सहाय्य टीम तुम्हाला योग्य माहिती देण्यात मदत करू शकते."
  };

  // These are the only generic instructions we can safely provide without
  // a matching KB record. They contain no invented product details.
  if (input.intent === 'knowledge' && /login|account|password|credential/i.test(input.normalizedMessage)) {
    return safeFallbacks[input.language] ?? safeFallbacks.en;
  }

  if (input.intent === 'unknown_query') {
    return safeFallbacks[input.language] ?? safeFallbacks.en;
  }

  return safeFallbacks[input.language] ?? safeFallbacks.en;
}
