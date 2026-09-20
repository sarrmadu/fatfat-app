const express = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  listerLivreurs,
  creerLivreur,
  activerDesactiverLivreur,
  reinitialiserMotDePasse,
  modifierTelephoneLivreur,
} = require("../controllers/utilisateursController");

const router = express.Router();

router.get("/livreurs", requireAuth("gestionnaire"), listerLivreurs);

router.post(
  "/livreurs",
  requireAuth("gestionnaire"),
  [
    body("nom").trim().isLength({ min: 2 }).withMessage("Nom requis (2 caractères min)."),
    body("telephone").trim().isLength({ min: 8 }).withMessage("Numéro de téléphone invalide."),
    body("mot_de_passe").isLength({ min: 6 }).withMessage("Mot de passe : 6 caractères minimum."),
  ],
  validate,
  creerLivreur
);

router.patch(
  "/livreurs/:id/statut",
  requireAuth("gestionnaire"),
  [body("actif").isBoolean().withMessage("actif doit être true ou false.")],
  validate,
  activerDesactiverLivreur
);

router.patch(
  "/livreurs/:id/reinitialiser-mot-de-passe",
  requireAuth("gestionnaire"),
  [body("nouveau_mot_de_passe").isLength({ min: 6 }).withMessage("Mot de passe : 6 caractères minimum.")],
  validate,
  reinitialiserMotDePasse
);

router.patch(
  "/livreurs/:id/telephone",
  requireAuth("gestionnaire"),
  [body("nouveau_telephone").trim().isLength({ min: 8 }).withMessage("Numéro de téléphone invalide.")],
  validate,
  modifierTelephoneLivreur
);

module.exports = router;
