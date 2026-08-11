// Gera o hash de uma senha para colar no campo `hash` de api/_lib.js
//   node gerar-senha.mjs "NovaSenha2026@"
import crypto from 'node:crypto';

const senha = process.argv[2];
if (!senha) {
  console.error('Uso: node gerar-senha.mjs "NovaSenha2026@"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(senha, salt, 64);
console.log('scrypt$' + salt.toString('hex') + '$' + hash.toString('hex'));
