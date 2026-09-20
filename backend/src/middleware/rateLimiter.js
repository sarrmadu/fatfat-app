const rateLimit = require("express-rate-limit");

// En environnement de test, la suite Jest enchaîne légitimement plus de connexions
// en quelques secondes qu'un vrai attaquant n'en ferait — la limite doit rester
// active en production, mais désactivée pendant `npm test` pour ne pas fausser
// les résultats des tests eux-mêmes avec de faux 429.
const enTest = process.env.NODE_ENV === "test";
const passthrough = (req, res, next) => next();

/**
 * Limite les tentatives de connexion : 10 essais / 15 min par IP.
 * Protège contre le bruteforce de mot de passe sur /api/auth/login.
 */
const loginLimiter = enTest
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
    });

/**
 * Limite générale sur le reste de l'API : évite qu'un client (bug ou abus)
 * ne sature le serveur. Volontairement plus large que le login.
 */
const apiLimiter = enTest
  ? passthrough
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de requêtes. Ralentissez un peu." },
    });

module.exports = { loginLimiter, apiLimiter };
