# JustTap Support Backend

## Dataset-driven vectorless RAG

This backend uses the supplied JustTap knowledge dataset and does **not** use an LLM or vector database.

The canonical runtime source is:

- `data/knowledge/justtap_knowledge.csv`
- 97,322 active knowledge records
- 3 languages: English, Hindi, Marathi
- 33 categories
- 166 inferred sub-services
- customer/provider audience partition

### Important dataset detail

The supplied CSV has an empty `subService` column for the generated records. The loader therefore derives the sub-service from the first meaningful keyword phrase when appropriate. For example:

- `pipe repair` -> Plumbing -> pipe repair
- `leakage repair` -> Plumbing -> leakage repair
- `AC repair` -> AC & Cooling -> AC repair

The loader does not invent service facts; it derives the taxonomy from the dataset itself.

## Fixed retrieval flow

1. Language normalization
2. Intent detection
3. Dataset-learned service/category resolution
4. Category and sub-service retrieval
5. Intent retrieval
6. Selective-token inverted-index retrieval
7. Language and audience filtering
8. Service compatibility scoring
9. Location/time relevance scoring
10. Reranking and confidence gate
11. Dataset-backed answer or localized fallback

### Service resolution

Service detection now distinguishes:

- **Category-level request:** `book a carpenter`
- **Sub-service request:** `book pipe repair`

A broad service request does not require sub-service token overlap. A specific sub-service request is restricted to that sub-service.

Aliases are learned from dataset keywords and are matched as whole tokens. This prevents short aliases such as `ac` from matching unrelated words such as `practice`.

### Indexed retrieval

The generic inverted index only keeps selective tokens below a document-frequency threshold. Common terms such as `book`, `service`, and `price` are handled through structured intent/category indexes instead of producing near-full-dataset candidate sets.

### Exact matching

Exact question matches go through ranking rather than returning the first file-order record.

### Audience

Audience is a hard constraint. Provider queries do not silently fall back to customer knowledge.

### Language

Language is a hard retrieval constraint. If a localized generic discovery FAQ is unavailable, the backend returns a localized routing response rather than answering from another language.

## API

`POST /api/support/chat`

```json
{
  "sessionId": "session-123",
  "message": "I want to book a plumber",
  "language": "en",
  "audience": "customer"
}
```

## Run

```powershell
npm install
npm run build
npm run start
```

For development:

```powershell
npm run dev
```

Backend listens on port `4000` by default.

## RAG test

After `npm install`, run:

```powershell
npm run test:rag
```
