// Crée (ou met à jour) un compte administrateur avec mot de passe.
// Usage : npm run creer-admin -- email@exemple.fr
// Le mot de passe est saisi dans le terminal (non affiché) et n'est jamais enregistré ailleurs que dans Supabase.

import readline from 'node:readline';
import { auth, rest, supabaseConfigure } from './supabase-admin.mjs';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!supabaseConfigure) throw new Error('Supabase non configuré : renseignez SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local.');
if (!email.includes('@')) throw new Error('Usage : npm run creer-admin -- email@exemple.fr');

function saisirMotDePasse() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = () => {}; // masque la saisie
  process.stdout.write('Mot de passe (8 caractères minimum) : ');
  return new Promise((resolve) => rl.question('', (r) => { rl.close(); process.stdout.write('\n'); resolve(r); }));
}

const motDePasse = await saisirMotDePasse();
if (motDePasse.length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');

const { users } = await auth('admin/users?per_page=1000');
const existant = users.find((u) => (u.email || '').toLowerCase() === email);
if (existant) {
  await auth(`admin/users/${existant.id}`, { method: 'PUT', body: { password: motDePasse, email_confirm: true } });
  console.log(`Mot de passe mis à jour pour ${email}.`);
} else {
  await auth('admin/users', { method: 'POST', body: { email, password: motDePasse, email_confirm: true } });
  console.log(`Compte créé pour ${email}.`);
}
await rest('admins?on_conflict=email', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { email } });
console.log(`${email} est administrateur.`);
