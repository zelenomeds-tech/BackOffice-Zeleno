// ---------------------------------------------------------------------------
// MÓDULO: DESIGN — banners + produtos em destaque da home (era o repo `backdesign`)
//
// ⚠️ UNIFICAÇÃO (10/08): este arquivo é o server.js ORIGINAL do backdesign,
// recortado em módulo. Blocos copiados VERBATIM (sem reindentar, pra diff limpo).
//
// O QUE MUDOU em relação ao original — e SÓ isto:
//   1. `const app = express()` e o `app.listen()` saíram (vão no server.js raiz).
//   2. O catch-all `app.use((req,res)=>res.sendFile(INDEX))` virou `app.get('/design')`.
//      OBRIGATÓRIO: catch-all engoliria as rotas do módulo de descontos.
//   3. 🐛 CORREÇÃO: o parser de JSON deste endpoint passou a aceitar `text/plain`.
//      O index.html manda `Content-Type: text/plain;charset=utf-8` (herança da
//      época do Apps Script, que exigia isso pra fugir de preflight CORS), mas
//      `express.json()` só parseia `application/json` — então `req.body` chegava
//      VAZIO e TODA ação respondia "Ação desconhecida: ". Testado e confirmado.
//      A correção é aditiva: `application/json` continua funcionando igual.
//
// A lógica de banners/destaques/upload não foi tocada.
// ---------------------------------------------------------------------------

const express = require('express');
const path = require('path');

// Página do painel (antes: index.html na raiz deste repo).
const INDEX = path.join(__dirname, '..', 'public', 'design.html');

// ===== VERBATIM: server.js original do backdesign, linhas 16-17 =====
const LOJA_SYNC_URL = String(process.env.LOJA_SYNC_URL || '').trim().replace(/\/$/, '');
const LOJA_SYNC_SECRET = String(process.env.LOJA_SYNC_SECRET || '').trim();

// ===== VERBATIM: server.js original do backdesign, linhas 21-51 (ponte com a LOJA) =====
// ---- ponte server-to-server com a LOJA (segredo no header, NUNCA no browser) ---------------------
async function lojaJson(method, sufixo, corpo) {
  const resp = await fetch(`${LOJA_SYNC_URL}${sufixo}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-sync-secret': LOJA_SYNC_SECRET },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    throw new Error((data && data.message) || `Loja respondeu HTTP ${resp.status}`);
  }
  return data;
}

// Sobe a imagem base64 pro Storage público da loja e devolve a URL.
async function subirImagem(imagemBase64, mimeType) {
  const d = await lojaJson('POST', '/api/admin/home/upload-imagem', { imagemBase64, mimeType });
  return d.url;
}

// Resolve o imagem_url do salvar: imagem nova -> sobe; edição sem imagem nova -> mantém a atual.
async function resolverImagemUrl(item, tipo) {
  if (item.imagemBase64) return await subirImagem(item.imagemBase64, item.mimeType);
  if (item.id) {
    const d = await lojaJson('GET', '/api/admin/home/conteudo');
    const lista = tipo === 'banner' ? (d.banners || []) : (d.destaques || []);
    const atual = lista.find((x) => String(x.id) === String(item.id));
    if (atual && atual.imagem_url) return atual.imagem_url;
  }
  throw new Error('Escolha uma imagem.');
}

// 🐛 Ver item 3 do cabeçalho: aceita application/json E text/plain (o que o painel manda).
// Limite de 20mb mantido do original — imagem de banner vira base64 (~1-3MB).
const parserGs = express.json({ limit: '20mb', type: ['application/json', 'text/plain'] });

function montar(app) {
// ===== VERBATIM: server.js original do backdesign, linhas 53-55 (comentários) =====
// ---- proxy de ações (mesmo shape que o index.html já mandava pro Apps Script) ---------------------
// ⚠️ SEGURANÇA: o `adminSecret` que o browser manda é IGNORADO. Quem autentica com a loja é o
// LOJA_SYNC_SECRET server-side. A UI já é gateada pelo login PBKDF2 do próprio index.html.
app.post('/api/gs', parserGs, async (req, res) => {   // ⚠️ acrescentado 'parserGs' — resto igual
// ===== VERBATIM: server.js original do backdesign, linhas 57-100 (handler) =====
  try {
    if (!LOJA_SYNC_URL || !LOJA_SYNC_SECRET) {
      return res.json({ success: false, message: 'Configure LOJA_SYNC_URL e LOJA_SYNC_SECRET na Vercel.' });
    }
    const b = req.body || {};
    const action = String(b.action || '');

    if (action === 'getBanners') {
      const d = await lojaJson('GET', '/api/admin/home/conteudo');
      return res.json({ success: true, banners: d.banners || [] });
    }
    if (action === 'getProdutosDestaque') {
      const d = await lojaJson('GET', '/api/admin/home/conteudo');
      return res.json({ success: true, produtos: d.destaques || [] });
    }
    if (action === 'salvarBanner') {
      const imagem_url = await resolverImagemUrl(b, 'banner');
      await lojaJson('POST', '/api/admin/banners/salvar', {
        id: b.id || '', publico: b.publico, idioma: b.idioma, dispositivo: b.dispositivo,
        imagem_url, alt: b.alt, ordem: b.ordem, ativo: b.ativo
      });
      return res.json({ success: true });
    }
    if (action === 'salvarProdutoDestaque') {
      const imagem_url = await resolverImagemUrl(b, 'destaque');
      await lojaJson('POST', '/api/admin/destaques/salvar', {
        id: b.id || '', titulo: b.titulo, texto: b.texto,
        imagem_url, ordem: b.ordem, ativo: b.ativo
      });
      return res.json({ success: true });
    }
    if (action === 'excluirBanner') {
      await lojaJson('POST', '/api/admin/banners/excluir', { id: b.id });
      return res.json({ success: true });
    }
    if (action === 'excluirProdutoDestaque') {
      await lojaJson('POST', '/api/admin/destaques/excluir', { id: b.id });
      return res.json({ success: true });
    }
    return res.json({ success: false, message: 'Ação desconhecida: ' + action });
  } catch (e) {
    return res.json({ success: false, message: String((e && e.message) || e) });
  }
});

  // ---- painel de design ------------------------------------------------------
  // ⚠️ era catch-all (`app.use`) servindo o INDEX em QUALQUER url. Virou rota fixa
  // porque agora divide o servidor com o painel de descontos.
  app.get('/design', (req, res) => res.sendFile(INDEX));
}

module.exports = { montar };