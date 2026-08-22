# JustTap Genie — Complete Production Multilingual RAG Chatbot

This package combines the working vectorless RAG dataset, customer chatbot,
multilingual middleware, voice input, and provider dashboard.

## Stack

- React + Vite frontend
- Express + TypeScript backend
- Existing vectorless dataset RAG
- 12k+ knowledge records from the included dataset
- English / Hindi / Marathi
- No LLM
- No Hugging Face
- No translation API
- No external translation dependency

## Important RAG rule

The existing RAG remains the knowledge engine.

For Hindi/Marathi:
1. Language middleware deterministically normalizes supported phrases.
2. The canonical English query is passed to the existing retriever/ranker.
3. Dataset matching/ranking remains unchanged.
4. The response layer localizes supported conversation/result patterns.

Follow-up fields such as location and requested time are handled by
`PendingRequest` and do NOT re-run RAG.

## Project

```text
justtap-genie-complete-production-multilingual/
├── backend/
│   ├── data/knowledge/       # real dataset
│   └── src/
│       ├── language/         # multilingual middleware
│       └── rag/              # existing vectorless RAG
└── frontend/
    └── src/main.tsx          # customer + provider UI
```

## Run backend

```powershell
cd backend
npm install
npm run build
npm run test:rag
npm run dev
```

## Run frontend

```powershell
cd frontend
npm install
npm run build
npm run dev
```

Frontend:
`http://localhost:5173`

Backend:
`http://localhost:4000`

Provider:
`http://localhost:5173/provider`

## Environment

Backend:

```env
PORT=4000
ADMIN_TOKEN=change-this
CORS_ORIGIN=http://localhost:5173
JUSTTAP_KNOWLEDGE_DIR=./data/knowledge
JUSTTAP_STATE_DIR=./data
```

Frontend:

```env
VITE_API_URL=http://localhost:4000
```

## Conversation tests

English:

```text
I want to book a plumber
Nagpur
Tomorrow evening
```

Hindi:

```text
मुझे प्लंबर बुक करना है
Nagpur
कल शाम
```

Marathi:

```text
मला प्लंबर बुक करायचा आहे
Nagpur
उद्या संध्याकाळी
```

Expected behavior:

```text
First message → RAG
Location      → PendingRequest, no RAG
Time          → PendingRequest, no RAG
Final         → completed response
```

## Limitation of API-free translation

This implementation is deliberately deterministic because the project uses
no LLM and no translation API. It supports the configured Hindi/Marathi
service, intent, booking, price, availability, emergency, complaint,
cancellation, and common conversational phrases. For unrestricted natural
language translation, a translation provider would be required.
