// GET /api/sessao  ->  quem está logado agora e a quais painéis tem direito
import { lerSessao, json, paineisDe } from './_lib.js';

export default async function handler(req, res) {
  const usuario = lerSessao(req);
  if (!usuario) return json(res, 200, { ok: false });
  return json(res, 200, {
    ok: true,
    nome: usuario.nome,
    email: usuario.email,
    paineis: paineisDe(usuario)
  });
}
