const {
  getTorresUrl,
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

    if (!nome) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Informe o nome da torre.' });
    }

    const validarUrl = getTorresUrl(`?select=id,nome&nome=eq.${encodeURIComponent(nome)}`);
    const { response: validarResponse, data: validarData } = await supabaseFetch(validarUrl, { method: 'GET' });

    if (!validarResponse.ok) {
      return sendJson(res, validarResponse.status, {
        sucesso: false,
        mensagem: validarData?.message || 'Falha ao validar a torre.',
        erro: validarData
      });
    }

    if (Array.isArray(validarData) && validarData.length > 0) {
      return sendJson(res, 200, {
        sucesso: true,
        mensagem: 'Torre ja cadastrada.',
        torre: validarData[0]
      });
    }

    const url = getTorresUrl('');
    const { response, data } = await supabaseFetch(url, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify([{ nome }])
    });

    if (!response.ok) {
      return sendJson(res, response.status, {
        sucesso: false,
        mensagem: data?.message || 'Falha ao salvar a torre.',
        erro: data
      });
    }

    return sendJson(res, 200, {
      sucesso: true,
      mensagem: 'Torre salva com sucesso.',
      torre: Array.isArray(data) ? data[0] : data
    });
  } catch (error) {
    return sendJson(res, 500, {
      sucesso: false,
      mensagem: error.message || 'Erro interno ao salvar torre.'
    });
  }
};
