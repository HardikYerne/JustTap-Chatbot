# Multilingual Architecture

```text
Frontend
  │ message + language + sessionId
  ▼
Express Chat API
  │
  ├── PendingRequest?
  │      └── collect location/time → no RAG
  │
  └── new request
         ▼
  LanguageService
         ▼
  Canonical English query
         ▼
  Existing Vectorless RAG
         ▼
  Dataset result
         ▼
  Response localization
         ▼
  Frontend
```

The RAG dataset and ranking engine remain the knowledge source. The language
layer is deterministic and does not call an LLM or external translation API.
