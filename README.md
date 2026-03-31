# lotr-backend

Vercel serverless backend for [Lord of the Rings Quote Recommender](https://brihsieh.github.io/lord-of-the-rings).

## Repo structure

```
lotr-backend/
├── api/
│   └── recommend.js   # Serverless function — proxies requests to Gemini API
└── vercel.json        # Vercel configuration
```

## How it works

The frontend at `brihsieh.github.io/lord-of-the-rings` POSTs a situation and quote dataset to `/api/recommend`. This function calls the Google Gemini API using a secret key and returns the 2 best-matching quotes as JSON.

```
POST /api/recommend
Body: { situation: string, quotes: Quote[] }
Returns: { recommendations: [{ uuid, reason }, { uuid, reason }] }
```

## Environment variables

Set in Vercel dashboard under **Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key from [aistudio.google.com](https://aistudio.google.com) |

## Deployment

Vercel auto-deploys on every push to `main`. To manually redeploy, go to **Deployments → Redeploy** in the Vercel dashboard.

## Tech stack

- Vercel serverless functions (Node.js)
- Google Gemini API (`gemini-2.5-flash`)
