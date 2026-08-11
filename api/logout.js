// POST /api/logout  ->  apaga a sessão
import { apagarSessao, json, erro } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return erro(res, 405, 'Método não permitido.');
  apagarSessao(res);
  return json(res, 200, { ok: true });
}
