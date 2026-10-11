// Autorise l'appli Android (Capacitor, origine https://localhost) à appeler les fonctions /api.
// Le site lui-même est sur la même origine et n'en a pas besoin.
const ORIGINES = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

export function avecCors(handler) {
  return async (req, res) => {
    const origine = req.headers?.origin;
    if (origine && ORIGINES.includes(origine)) {
      res.setHeader('Access-Control-Allow-Origin', origine);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    return handler(req, res);
  };
}
