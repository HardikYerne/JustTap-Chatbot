
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
    en: `🌟 JustTap Services Overview

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
    hi: `🌟 JustTap Services Overview

JustTap अलग-अलग श्रेणियों में कई सेवाएँ प्रदान करता है। यहाँ हमारी सेवाओं का अवलोकन है:

- होम सर्विसेज
  1. Plumber
  2. Electrician
  3. Carpenter
  4. AC Technician
  5. Painter

- ऑटो सर्विसेज
  1. Bike Mechanic
  2. Car Mechanic
  3. Car Wash

- डोमेस्टिक सर्विसेज
  1. Maid Service
  2. Security Guard
  3. Gardener
  4. Cleaner

- टेक्निकल सर्विसेज
  1. Software Developer
  2. Web Designer
  3. Mobile App Developer
  4. Computer Repair Technician
  5. Digital Marketing Expert

- एजुकेशन सर्विसेज
  1. Online Tutor
  2. Spoken English Trainer
  3. Computer Trainer
  4. Coaching Institute

- बिजनेस सर्विसेज
  1. Accountant
  2. Tax Consultant
  3. CA
  4. Insurance Agent
  5. Financial Advisor`,
    mr: `🌟 JustTap Services Overview

JustTap विविध श्रेणींमध्ये अनेक सेवा प्रदान करते. आम्ही देत असलेल्या सेवांचा आढावा:

- होम सर्व्हिसेस
  1. Plumber
  2. Electrician
  3. Carpenter
  4. AC Technician
  5. Painter

- ऑटो सर्व्हिसेस
  1. Bike Mechanic
  2. Car Mechanic
  3. Car Wash

- डोमेस्टिक सर्व्हिसेस
  1. Maid Service
  2. Security Guard
  3. Gardener
  4. Cleaner

- टेक्निकल सर्व्हिसेस
  1. Software Developer
  2. Web Designer
  3. Mobile App Developer
  4. Computer Repair Technician
  5. Digital Marketing Expert

- एज्युकेशन सर्व्हिसेस
  1. Online Tutor
  2. Spoken English Trainer
  3. Computer Trainer
  4. Coaching Institute

- बिझनेस सर्व्हिसेस
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
- For Hindi responses, write the complete answer in Hindi script.
- For Marathi responses, write the complete answer in Marathi script.
- For English responses, write the complete answer in English.
- Do not leave unnecessary English words inside Hindi or Marathi responses.
- Proper nouns that have no suitable translation may remain unchanged.
- The app name "JustTap" must remain unchanged.

- Keep the answer concise but complete.
- Use a clear, readable plain-text structure.
- Do not use Markdown bold syntax such as **text**.
- Do not use Markdown italic syntax such as *text*.
- Do not use Markdown heading syntax such as #, ##, or ###.
- Do not use separator lines such as ====, ----, or ****.
- Do not use + as a list marker.

- For a complete services overview, use this structure:
  🌟 JustTap Services Overview

  Short introductory sentence.

  - Category Name
    1. Service
    2. Service
    3. Service

- Keep one blank line between categories.
- Use the hyphen character (-) for category bullets.
- Use numbered lists for services under each category.
- Include the complete relevant service list from the knowledge context.
- Do not append booking, pricing, cancellation, or unrelated information to an overview unless the user explicitly asks for it.

- For a specific service, answer only about that service.
- For a booking request, answer only the booking-related information supported by the knowledge context.
- Do not append the complete services overview to a specific-service or booking response.

- If the user asks for a specific category, provide only that category and its supported services.
- Preserve the exact service names and categories from the knowledge context.
- Do not invent, rename, merge, reorder, or remove services.
- Do not use "..." when the knowledge context contains the complete list.

- For the JustTap Services Overview, write the heading exactly as:
  🌟 JustTap Services Overview
- Do not put ** around the heading.
- Do not put a separator under the heading.
- Preserve emojis explicitly supported by the knowledge context.

- If the user asks about a specific category, provide only that category and its supported services.
- If the user asks about a specific service, answer only with information supported by the knowledge context.

- If the user asks how to do something, provide the supported instructions as numbered steps.
- If the user asks about a problem, use these sections only when supported by the knowledge context:
  **Problem**
  **Relevant**

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
