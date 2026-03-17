const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'analistas';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function getBaseHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.');
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function getTableUrl(query = '') {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
  return `${cleanUrl}/rest/v1/${SUPABASE_TABLE}${query}`;
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function requirePost(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { sucesso: false, mensagem: 'Metodo nao permitido.' });
    return false;
  }

  return true;
}

function requireAdminToken(req, res) {
  if (!ADMIN_TOKEN) {
    return true;
  }

  const token = req.headers['x-admin-token'];

  if (!token || token !== ADMIN_TOKEN) {
    sendJson(res, 401, { sucesso: false, mensagem: 'Token admin invalido ou nao informado.' });
    return false;
  }

  return true;
}

async function safeReadBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (!req.body || typeof req.body !== 'string') {
    return {};
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

async function supabaseFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getBaseHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { response, data: json };
}

module.exports = {
  SUPABASE_TABLE,
  getTableUrl,
  sendJson,
  requirePost,
  requireAdminToken,
  safeReadBody,
  supabaseFetch
};
