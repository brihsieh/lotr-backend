/*
 * api/recommend.js — Vercel Serverless Function
 *
 * This function acts as a secure proxy between the GitHub Pages frontend
 * and the Anthropic API. The API key lives here as an environment variable,
 * so it is never exposed in the browser.
 *
 * Endpoint: POST /api/recommend
 * Body:     { situation: string }
 * Returns:  { recommendations: [{uuid, reason}, {uuid, reason}] }
 */

export default async function handler(req, res) {

  // ── CORS headers ─────────────────────────────────────────────────────────
  // Allow requests from your GitHub Pages frontend.
  // Replace the origin below with your actual GitHub Pages URL once deployed.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request sent by the browser before POST
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate input ────────────────────────────────────────────────────────
  const { situation, quotes } = req.body;

  if (!situation || typeof situation !== 'string' || situation.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid situation' });
  }

  if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid quotes array' });
  }

  // ── Build the prompt ──────────────────────────────────────────────────────
  // We send the quote dataset from the frontend rather than hardcoding it
  // here — this makes it easy to update quotes without redeploying the backend.
  const slimQuotes = quotes.map(q => ({
    uuid: q.uuid,
    text: q.text,
    character: q.character,
    theme: q.theme
  }));

  const prompt = [
    "You are a literary recommendation engine for J.R.R. Tolkien's Lord of the Rings trilogy.",
    "Available quotes (JSON): " + JSON.stringify(slimQuotes),
    "Task: Select the 2 quotes that best resonate with the user's situation based on emotional and thematic resonance.",
    'Return ONLY a valid JSON array, no markdown, no preamble:',
    '[{"uuid": "<uuid>", "reason": "<1-2 sentences why this fits>"}, {"uuid": "<uuid>", "reason": "<1-2 sentences why this fits>"}]',
    "",
    "User situation: " + situation.trim()
  ].join("\n");

  // ── Call the Anthropic API ────────────────────────────────────────────────
  // ANTHROPIC_API_KEY is set as an environment variable in Vercel's dashboard.
  // It is never sent to the browser.
  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: `Anthropic API error: ${anthropicResponse.status}` });
    }

    const data = await anthropicResponse.json();

    // Extract the text content from the response
    const rawText = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Strip any accidental markdown code fences before parsing
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(cleaned);

    return res.status(200).json({ recommendations });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
