const { validationResult } = require("express-validator");

/**
 * À placer après une chaîne de règles express-validator (ex: body('nom_client').notEmpty()).
 * Renvoie 400 avec le détail des champs invalides plutôt que de laisser une erreur SQL
 * remonter brute jusqu'au client.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Champs invalides.",
      details: errors.array().map((e) => ({ champ: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
