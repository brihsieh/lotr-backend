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
    "User situation: " + situation.trim(),
    "",
    "Select the 2 quotes that best resonate with the user situation based on emotional and thematic resonance. Keep each reason to one sentence only.",
    "Your entire response must be ONLY a raw JSON array. No markdown. No code fences. No explanation. No preamble. No postamble.",
    'Exact required format: [{"uuid":"1a2b3c4d-0001","reason":"One or two sentences."},{"uuid":"1a2b3c4d-0002","reason":"One or two sentences."}]'
  ].join("\n");

  // ── Call the Anthropic API ────────────────────────────────────────────────
  // ANTHROPIC_API_KEY is set as an environment variable in Vercel's dashboard.
  // It is never sent to the browser.
  try {
    // Gemini API endpoint — model is gemini-3.1-flash-lite-preview which is free tier eligible
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const anthropicResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 }
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: `Gemini API error: ${anthropicResponse.status}` });
    }

    const data = await anthropicResponse.json();

    // Gemini returns: candidates[0].content.parts[0].text
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any accidental markdown code fences before parsing
    console.log('Gemini rawText:', rawText);
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(cleaned);

    return res.status(200).json({ recommendations });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
