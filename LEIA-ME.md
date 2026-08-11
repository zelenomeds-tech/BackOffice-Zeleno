# Backoffice Zeleno — hub de acesso

Tela de login única. A pessoa entra com o email de trabalho e vê **apenas** os
painéis a que tem direito.

## Estrutura

```
index.html          tela de login + menu (o menu só aparece depois de logar)
vercel.json         cabeçalhos de segurança
package.json
gerar-senha.mjs     gera o hash de uma senha nova
api/
  _lib.js           usuários, painéis, sessão e código de SSO
  login.js          POST  /api/login
  sessao.js         GET   /api/sessao
  logout.js         POST  /api/logout
  ir.js             GET   /api/ir?p=<painel>
```

> A pasta `api/` **precisa** ir junto no deploy. Sem ela o login não existe e a
> tela fica pedindo senha para sempre.

## 1. Variável de ambiente (obrigatória)

Na Vercel → Settings → Environment Variables:

| Nome | Valor |
|---|---|
| `SSO_SECRET` | uma frase longa e aleatória (mínimo 32 caracteres) |

Para gerar uma:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Opcional: `HORAS_SESSAO` (padrão 12) — de quanto em quanto tempo a pessoa
precisa logar de novo.

> **Salvar não basta.** Depois de criar a variável, vá em Deployments e clique
> em Redeploy. Só assim ela entra em vigor.

## 2. Senhas

Padrão: **Nome + 2026 + @** — ex.: `Carlos2026@`, `Luana2026@`.

As senhas ficam guardadas embaralhadas (scrypt) em `api/_lib.js`. Não dá para
ler a senha a partir do hash.

Para trocar a senha de alguém:

```
node gerar-senha.mjs "NovaSenha2026@"
```

Cole o resultado no campo `hash` da pessoa em `api/_lib.js`.

## 3. Mudar quem vê o quê

Em `api/_lib.js`, cada pessoa tem uma lista `paineis`. Os nomes válidos são:
`descontos`, `vendedores`, `design`, `ti`, `cs`.

Para tirar um acesso, apague o nome da lista. Para dar, acrescente.

## 4. Entrar direto no painel (SSO)

Cada painel em `PAINEIS` tem um campo `sso`:

- `sso: false` — o hub abre o endereço normal e a pessoa loga lá também.
- `sso: true` — o hub gera um código assinado válido por 60 segundos e abre
  `{url}/sso?t=CODIGO`. O painel confere a assinatura com o **mesmo**
  `SSO_SECRET` e já cria a sessão dele.

Hoje todos estão em `false`. Só mude para `true` **depois** que o painel de
destino tiver recebido o trecho que entende `/sso` — senão vira página de erro.
