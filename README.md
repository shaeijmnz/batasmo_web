# BatasMo Web

BatasMo web app with integrated client chatbot.

## Prerequisites

- Node.js 18+
- npm 9+

## Environment Setup

1. Frontend env:
   - Copy `.env.example` to `.env`
   - Ensure this value exists:
     - `REACT_APP_CHATBOT_API_URL=http://localhost:4000`

2. Backend env:
   - Copy `backend/.env.example` to `backend/.env`
   - Required values:
     - `PORT=4000`
     - `ALLOWED_ORIGIN=http://localhost:3000`
     - `CHATBOT_PROVIDER_MODE=free` or `auto`
   - For Gemini mode, set:
     - `GEMINI_API_KEY=your_real_key`

## Install

From project root:

```bash
npm install
```

From backend folder:

```bash
cd backend
npm install
```

## Run (Recommended)

From project root:

```bash
npm run start:all
```

This starts:
- Frontend: `http://localhost:3000`
- Chatbot backend: `http://localhost:4000`

## Alternative Run Commands

From project root:

```bash
npm run start:frontend
npm run start:backend
```

## Chatbot Health Check

Open:

- `http://localhost:4000/health`

Expected response includes:
- `status: "ok"`
- `providerMode`

## Database Migration (Optional for chatbot logs)

Run SQL file:

- `database/20260410_chatbot_logs.sql`

## Notes for GitHub Push

- `.env` and `backend/.env` are ignored by git
- Commit `.env.example` and `backend/.env.example` only
