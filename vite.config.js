import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En local, `npm run dev` sert aussi les fonctions de /api (comme sur Vercel),
// avec la clé lue dans .env.local.
function apiLocale() {
  return {
    name: 'api-locale',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const nom = req.url.split('?')[0].replace('/api/', '');
        try {
          const mod = await server.ssrLoadModule(`/api/${nom}.js`);
          let corps = '';
          for await (const morceau of req) corps += morceau;
          req.body = corps ? JSON.parse(corps) : {};
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(data));
          };
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ erreur: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_MODEL_SECOURS', 'GEMINI_DELAI_SEANCE_MS', 'GEMINI_DELAI_FICHE_MS']) {
    if (env[k]) process.env[k] = env[k];
  }
  return { plugins: [react(), apiLocale()] };
});
