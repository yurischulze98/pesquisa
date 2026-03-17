const {
  getTableUrl,
  sendJson,
  requirePost,
  requireAdminToken,
  safeReadBody,
  supabaseFetch
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireAdminToken(req, res)) return;

  try {
    const body = await safeReadBody(req);
    const nome = String(body.nome || '').trim();
    const torre = String(body.torre || '').trim();
    const funcao = String(body.funcao || '').trim();

    if (!nome || !torre || !funcao) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Preencha nome, torre e funcao.' });
    }

    const url = getTableUrl('');
    const { response, data } = await supabaseFetch(url, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify([{ nome, torre, funcao }])
    });

    if (!response.ok) {
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao salvar o analista.',
        erro: data
      });
    }

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: 'Analista salvo com sucesso.',
      analista: Array.isArray(data) ? data[0] : data
    });
  } catch (error) {
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao salvar analista.'
    });
  }
};
