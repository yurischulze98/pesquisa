const {
  getTableUrl,
  sendJson,
  requirePost,
  requireAdminAccess,
  safeReadBody,
  supabaseFetch
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireAdminAccess(req, res)) return;

  try {
    const body = await safeReadBody(req);
    const nome = String(body.nome || '').trim();
    const torre = String(body.torre || '').trim();
    const funcao = String(body.funcao || '').trim();
    const clientesModo = String(body.clientes_modo || 'Todos').trim() === 'Especificos' ? 'Especificos' : 'Todos';
    const clientes = clientesModo === 'Especificos' ? String(body.clientes || '').trim() : null;
    const horarioTipo = String(body.horario_tipo || 'Comercial').trim() || 'Comercial';
    const horarioOutro = horarioTipo === 'Outro' ? String(body.horario_outro || '').trim() : null;

    if (!nome || !torre || !funcao) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Preencha nome, torre e funcao.' });
    }

    if (clientesModo === 'Especificos' && !clientes) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Informe os clientes especificos ou selecione Todos.' });
    }

    if (horarioTipo === 'Outro' && !horarioOutro) {
      return sendJson(res, 400, { sucesso: false, mensagem: 'Informe o detalhe do horario quando selecionar Outro.' });
    }

    const payload = [{
      nome,
      torre,
      funcao,
      clientes_modo: clientesModo,
      clientes,
      horario_tipo: horarioTipo,
      horario_outro: horarioOutro
    }];

    const url = getTableUrl('');
    const { response, data } = await supabaseFetch(url, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
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
