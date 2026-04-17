# BatasMo Chatbot Backend (Gemini 2.5)

Full backend server for BatasMo AI chatbot using Google's Gemini 2.5 Flash model.

## Setup Instructions

### 1. Install Dependencies

```bash
cd batasmo-chatbot-backend
npm install
```

### 2. Configure Environment

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Then edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=AIzaSy...your_key_here...
PORT=4000
ALLOWED_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**Where to get the API key?**
1. Go to https://aistudio.google.com/
2. Click "Create API key"
3. Select or create a project
4. Copy your API key
5. Paste in `.env`

### 3. Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Expected output:
```
╔═════════════════════════════════════════════════════════╗
║  BatasMo Chatbot Backend (Gemini 2.5)                  ║
║  Listening on: http://localhost:4000                   ║
║  API Endpoint: POST /chatbot/message                   ║
║  Health Check: GET /health                             ║
╚═════════════════════════════════════════════════════════╝
```

### 4. Connect Frontend

In your React project, set:

```env
REACT_APP_CHATBOT_API_URL=http://localhost:4000
```

Then restart the React app:
```bash
npm start
```

Now the floating chatbot will use Gemini 2.5 instead of local intent matching.

## API Endpoints

### `POST /chatbot/message`

Sends a user message and returns AI response.

**Request:**
```json
{
  "message": "How do I book a consultation?",
  "conversation": [
    {
      "from": "user",
      "text": "Hi there"
    },
    {
      "from": "ai",
      "text": "Hello! How can I help?"
    }
  ],
  "user": {
    "id": "user-uuid",
    "role": "Client",
    "full_name": "John Doe"
  },
  "disclaimer": "This chatbot provides general information only and is not legal advice."
}
```

**Response:**
```json
{
  "intent": "booking",
  "reply": "You can book a consultation with our attorneys. Click the button below to browse available slots and book your preferred time.",
  "actions": [
    {
      "label": "Open booking",
      "page": "book-appointment"
    }
  ]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-10T11:19:00.000Z",
  "model": "gemini-2.5-flash"
}
```

## Supported Intents

- `greeting` - Initial greeting and help
- `booking` - Consultation booking
- `availability` - Available slots
- `notarial` - Notarial services
- `payment` - Payment and transaction info
- `fallback` - General/unrecognized questions

## Available Page Actions

When Gemini generates action buttons, use these page values:

| Label | Page |
|-------|------|
| Book consultation | `book-appointment` |
| Notarial request | `notarial-request` |
| Transaction history | `transaction-history` |
| My appointments | `my-appointments` |
| Profile | `profile` |

## Model Info

- **Model:** `gemini-2.5-flash`
- **Max tokens:** 500 per response
- **Temperature:** 0.7 (balanced creativity + accuracy)
- **Language:** English + Filipino support

## Rate Limiting (Optional Hardening)

For production, add rate limiting:

```bash
npm install express-rate-limit
```

Then in `server.js`:

```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})

app.use('/chatbot/message', limiter)
```

## Deployment

### Render.com (Recommended)

1. Create account at https://render.com/
2. Create new Web Service
3. Connect GitHub repo (push this folder to GitHub)
4. Set environment variables in Render dashboard:
   - `GEMINI_API_KEY`
   - `ALLOWED_ORIGIN` (your React app URL)
5. Deploy

Then update React `.env`:
```env
REACT_APP_CHATBOT_API_URL=https://your-render-url.onrender.com
```

### Railway.app

Similar process to Render. Supports auto-deploy from GitHub.

### Fly.io

```bash
npm install -g flyctl
flyctl launch
flyctl deploy
```

## Troubleshooting

**Issue:** `GEMINI_API_KEY not set`
- Solution: Add the API key to `.env` or environment variables

**Issue:** CORS error from React
- Solution: Check `ALLOWED_ORIGIN` in `.env` matches your React domain

**Issue:** "Failed to create project"
- Solution: Might be rate-limited; wait a few minutes or use Cloud Console directly

**Issue:** Slow responses
- Solution: Normal for first request (cold start); subsequent requests are faster

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` file to GitHub
- Never share your API key publicly
- Use `.env.example` as template in your repo
- For production, use secure environment variable management (Render, Railway, etc.)

## Support

For issues, check:
1. API key is valid (test at https://aistudio.google.com/)
2. Server is running (`GET /health` returns ok)
3. React `.env` has correct backend URL
4. CORS is enabled (check browser console for errors)
