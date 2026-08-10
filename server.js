// ---------------------------------------------------------------------------
// BACKOFFICE ZELENO — servidor único.
//
// ⚠️ UNIFICAÇÃO (10/08): antes eram repositórios/projetos Vercel separados
// (`codigo-descontos` e `backdesign`), cada um com o seu server.js. Agora é UM
// app só: este arquivo cria o Express, aplica os middlewares comuns e chama o
// `montar(app)` de cada módulo. A lógica de cada painel continua no seu módulo.
//
// PRA ADICIONAR UM PAINEL NOVO (os "outros" que faltam):
//   1. crie `modulos/nome.js` exportando `{ montar }`
//   2. coloque o HTML em `public/nome.html`
//   3. acrescente duas linhas: o `require` e o `montar(app)` abaixo
//   4. acrescente o card no menu em `public/index.html`
// Só isso — nenhum outro arquivo precisa mudar.
//
// MAPA DE URLS
//   /                        menu (público — cada painel tem o login dele)
//   /login, /api/login,
//   /api/logout              sessão do painel de DESCONTOS
//   /descontos               painel de descontos      (exige sessão)
//   /api/produtos            \
//   /api/descontos(/:id)      | API do painel de descontos (exige sessão)
//   /api/desconto-global(/:id)|
//   /api/cupom-frete-gratis   /
//   /design                  painel de banners/destaques (login PBKDF2 na página)
//   /api/gs                  API do painel de design
// ---------------------------------------------------------------------------

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Parser JSON comum. Limite de 20mb (era o do backdesign) porque o painel de
// design sobe imagem em base64; para as rotas de descontos um limite MAIOR é
// só permissivo, não muda comportamento nenhum.
app.use(express.json({ limit: '20mb' }));

// ---- módulos ---------------------------------------------------------------
// A ORDEM IMPORTA: quem registra primeiro atende primeiro. Descontos vem antes
// porque é dono das rotas de sessão (/login) que o menu referencia.
require('./modulos/descontos').montar(app);
require('./modulos/design').montar(app);

// ---- menu (raiz) -----------------------------------------------------------
// ⚠️ PÚBLICO de propósito: os dois painéis usam sistemas de login DIFERENTES e
// listas de usuários diferentes (ver README). Uma página que só lista os painéis
// não expõe dado nenhum, e é o único jeito de os dois grupos entrarem sem que a
// gente troque o login de alguém agora. Ao unificar o login (passo 2), esta
// página passa a exigir sessão.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- 404 -------------------------------------------------------------------
// ⚠️ Express 5: catch-all é `app.use(...)` — `app.get('*')` quebra no
// path-to-regexp novo.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Rota não encontrada: ' + req.path });
  }
  return res.status(404).redirect('/');
});

// Local: sobe o servidor. Vercel: invoca o app como função serverless (exportado).
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backoffice Zeleno em http://localhost:${PORT}`));
}

module.exports = app;