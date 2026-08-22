import { createRAG } from './engine.js';

const rag = createRAG();

const tests = [
  { language: 'en' as const, query: 'I want to book a plumber' },
  { language: 'en' as const, query: 'Book pipe repair for me' },
  { language: 'en' as const, query: 'How much does pipe repair cost?' },
  { language: 'en' as const, query: 'Can you book leakage repair tomorrow in Wardha Road?' },
  { language: 'en' as const, query: 'Book leakage repair for me, preferably next week in Wardha Road' },
  { language: 'en' as const, query: 'I need AC repair tomorrow in Sadar' },
  { language: 'en' as const, query: 'I want to book a carpenter' },
  { language: 'en' as const, query: 'I need AC repair tomorrow' },
  { language: 'en' as const, query: 'cancel my practice session' },
  { language: 'en' as const, query: 'What is JustTap?' },
  { language: 'hi' as const, query: 'मुझे प्लंबर बुक करना है' },
  { language: 'hi' as const, query: 'पाइप रिपेयर बुक करना है' },
  { language: 'mr' as const, query: 'मला प्लंबर बुक करायचा आहे' },
  { language: 'mr' as const, query: 'पाईप रिपेअर बुक करायचे आहे' },
];

for (const test of tests) {
  const result = rag.search(test.query, test.language, 'customer');

  console.log('\nQUERY:', test.query);
  console.log('LANGUAGE:', test.language);
  console.log('MATCHED:', result.matched);
  console.log('SCORE:', result.score);
  console.log('INTENT:', result.intent);
  console.log('SERVICE:', result.service);
  console.log('FAQ:', result.faqId);
  console.log('CANDIDATES:', result.candidates);
  console.log('ANSWER:', result.answer);
}

// Regression checks for the production retrieval bugs fixed in this version.
const regressionTests = [
  { language: 'en' as const, query: 'Can someone help with AC repair?' },
  { language: 'en' as const, query: 'I want a beauty service' },
  { language: 'en' as const, query: 'I need pipe repair' },
  { language: 'en' as const, query: 'I need AC gas refill' },
  { language: 'en' as const, query: 'I need tap repair' },
  { language: 'en' as const, query: 'Book a plumber' },
  { language: 'en' as const, query: 'cancel my practice session' },
  { language: 'hi' as const, query: 'मुझे प्लंबर बुक करना है' },
  { language: 'mr' as const, query: 'मला प्लंबर बुक करायचा आहे' },
];

console.log('\n--- REGRESSION TESTS ---');
for (const test of regressionTests) {
  const result = rag.search(test.query, test.language, 'customer');
  console.log(JSON.stringify({
    query: test.query,
    language: test.language,
    matched: result.matched,
    intent: result.intent,
    service: result.service,
    faqId: result.faqId,
    score: result.score,
  }));
}
