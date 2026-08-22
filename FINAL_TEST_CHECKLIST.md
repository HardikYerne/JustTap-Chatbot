# Final Test Checklist

## 1. Backend build

```powershell
cd backend
npm install
npm run build
```

Expected: no TypeScript errors.

## 2. RAG test

```powershell
npm run test:rag
```

Expected startup:

```text
[RAG] Loaded ... knowledge records
[RAG] Indexed ... tokens
```

Then test English, Hindi, and Marathi cases.

## 3. Start

```powershell
npm run dev
```

## 4. Frontend

```powershell
cd ../frontend
npm install
npm run build
npm run dev
```

Open:

```text
http://localhost:5173
```

Provider:

```text
http://localhost:5173/provider
```

## 5. Conversation test

English:
- I want to book a plumber
- Nagpur
- Tomorrow evening

Hindi:
- मुझे प्लंबर बुक करना है
- Nagpur
- कल शाम

Marathi:
- मला प्लंबर बुक करायचा आहे
- Nagpur
- उद्या संध्याकाळी

## 6. Price test

```text
How much does pipe repair cost?
```

Expected: dataset-driven price response or price-unavailable response, never a fabricated number.

## 7. Ticket test

Use an unrelated question.

Expected:
- localized fallback
- localized Yes/No ticket confirmation
- ticket creation after Yes

## 8. Provider test

Set:

```env
ADMIN_TOKEN=your-secret
```

Save the same token in Provider → Settings.

Then verify:
- Tickets
- Claim
- Reply
- Resolve
- Customers
