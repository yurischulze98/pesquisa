const {
  sendJson,
  requireGet,
  getSessionUser,
  isAdminRole
} = require('./_supabase');

module.exports = async function handler(req, res) {
  if (!requireGet(req, res)) return;

  const usuario = getSessionUser(req);

  if (!usuario) {
    return sendJson(res, 200, {
      sucesso: true,
      autenticado: false
    });
  }

  return sendJson(res, 200, {
    sucesso: true,
    autenticado: true,
    admin: isAdminRole(usuario.role),
    usuario: {
      id: usuario.sub,
      usuario: usuario.usuario,
      nome: usuario.nome || '',
      role: usuario.role || 'admin'
    }
  });
};
