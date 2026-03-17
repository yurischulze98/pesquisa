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
    const id = Number(body.id);
    const nome = String(body.nome || '').trim();
    const torre = String(body.torre || '').trim();
    const funcao = String(body.funcao || '').trim();

    if (!Number.isFinite(id) || id <= 0) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'ID invalido.' });
    }

    if (!nome || !torre || !funcao) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Preencha nome, torre e funcao.' });
    }

    const url = getTableUrl(`?id=eq.${id}`);
    const { response, data } = await supabaseFetch(url, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ nome, torre, funcao })
    });

    if (!response.ok) {
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao editar o analista.',
        erro: data
      });
    }

    const atualizado = Array.isArray(data) ? data[0] : null;

    if (!atualizado) {
      return sendJson(res, 404, { sucesso: false, mensagem: 'Analista nao encontrado.' });
    }

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: 'Analista atualizado com sucesso.',
      analista: atualizado
    });
  } catch (error) {
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao editar analista.'
    });
  }
};
