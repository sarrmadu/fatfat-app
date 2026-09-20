const express = require("express");
const { body } = require("express-validator");
const { login, changerMotDePasse } = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimiter");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post(
  "/login",
  loginLimiter,
  [
    body("telephone").trim().notEmpty().withMessage("Téléphone requis."),
    body("mot_de_passe").notEmpty().withMessage("Mot de passe requis."),
  ],
  validate,
  login
);

router.patch(
  "/mot-de-passe",
  requireAuth(),
  [
    body("ancien_mot_de_passe").notEmpty().withMessage("Ancien mot de passe requis."),
    body("nouveau_mot_de_passe").isLength({ min: 6 }).withMessage("Le nouveau mot de passe doit faire au moins 6 caractères."),
  ],
  validate,
  changerMotDePasse
);

module.exports = router;
