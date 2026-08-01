// api/results.js
// Returns all satisfaction-survey submissions as JSON for the mentor dashboard.
// Requires a PIN (sent as a header) so the data endpoint isn't wide open to
// anyone who finds the URL — this is a light deterrent, not bank-grade auth.

const { JWT } = require('google-auth-library');

const SHEET_RANGE = 'submissions!A2:L'; // skip header row
const DASH_PIN = process.env.DASH_PIN || '1817';

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return client;
}

function rowsToObjects(rows) {
  const cols = ['id', 'ts', 'year', 'uni', 'wk', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
  return (rows || [])
    .filter((r) => r && r[0]) // skip blank rows
    .map((r) => {
      const obj = {};
      cols.forEach((c, i) => { obj[c] = r[i] !== undefined ? r[i] : ''; });
      obj.wk = Number(obj.wk) || 1;
      ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach((q) => { obj[q] = Number(obj[q]) || 0; });
      return obj;
    });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dash-Pin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const pin = req.headers['x-dash-pin'] || (req.query && req.query.pin);
  if (pin !== DASH_PIN) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    res.status(500).json({ ok: false, error: 'server not configured (missing GOOGLE_SHEET_ID)' });
    return;
  }

  try {
    const auth = await getAuthClient();
    const token = await auth.authorize();

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_RANGE)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Sheets read failed:', resp.status, text);
      res.status(502).json({ ok: false, error: 'failed to read sheet' });
      return;
    }

    const data = await resp.json();
    const submissions = rowsToObjects(data.values);

    res.status(200).json({ ok: true, submissions });
  } catch (e) {
    console.error('results error:', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
};
