// api/submit.js
// Receives a satisfaction-survey submission from a student and appends
// it as a new row to the "submissions" tab of the configured Google Sheet.

const { JWT } = require('google-auth-library');

const SHEET_RANGE = 'submissions!A:M'; // id, ts, year, uni, wk, q1..q7, comment
const REQUIRED_Q = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];

function loadServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT env var');
  return JSON.parse(raw);
}

async function getAuthClient() {
  const creds = loadServiceAccount();
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return client;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'invalid body';
  if (!body.uni || typeof body.uni !== 'string' || !body.uni.trim()) return 'missing uni';
  if (![1, 2].includes(Number(body.wk))) return 'invalid wk';
  for (const q of REQUIRED_Q) {
    const v = Number(body[q]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return `invalid ${q}`;
  }
  return null;
}

function sanitize(str) {
  // Strip characters that could be interpreted as a formula by spreadsheet
  // software if the sheet is ever opened/exported (formula injection guard).
  return String(str).replace(/^[=+\-@]/, "'$&").slice(0, 200);
}

function sanitizeComment(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/^[=+\-@]/, "'$&").slice(0, 1000);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    res.status(500).json({ ok: false, error: 'server not configured (missing GOOGLE_SHEET_ID)' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  const err = validatePayload(body);
  if (err) {
    res.status(400).json({ ok: false, error: err });
    return;
  }

  const now = new Date();
  const id = 's' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 7);
  const row = [
    id,
    now.toISOString(),
    String(now.getFullYear()),
    sanitize(body.uni.trim()),
    Number(body.wk),
    ...REQUIRED_Q.map((q) => Number(body[q])),
    sanitizeComment(body.comment),
  ];

  try {
    const auth = await getAuthClient();
    const token = await auth.authorize();

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Sheets append failed:', resp.status, text);
      res.status(502).json({ ok: false, error: 'failed to write to sheet' });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error('submit error:', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
};
