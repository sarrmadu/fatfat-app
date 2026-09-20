const express = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  listerVilles,
  listerEntreprises,
  creerEntreprise,
  activerDesactiverEntreprise,
} = require("../controllers/adminController");

const router = express.Router();

router.get("/villes", requireAuth("admin"), listerVilles);
router.get("/entreprises", requireAuth("admin"), listerEntreprises);

router.post(
  "/entreprises",
  requireAuth("admin"),
  [
    body("nom").trim().notEmpty().withMessage("Le nom de l'entreprise est requis."),
    body("ville_id").isInt().withMessage("ville_id requis."),
    body("hub_nom").trim().notEmpty().withMessage("hub_nom requis."),
    body("hub_lat").isFloat({ min: -90, max: 90 }).withMessage("hub_lat invalide."),
    body("hub_lng").isFloat({ min: -180, max: 180 }).withMessage("hub_lng invalide."),
    body("gestionnaire.nom").trim().notEmpty().withMessage("gestionnaire.nom requis."),
    body("gestionnaire.telephone").trim().isLength({ min: 8 }).withMessage("gestionnaire.telephone invalide."),
    body("gestionnaire.mot_de_passe").isLength({ min: 6 }).withMessage("gestionnaire.mot_de_passe : 6 caractères minimum."),
  ],
  validate,
  creerEntreprise
);

router.patch(
  "/entreprises/:id/statut",
  requireAuth("admin"),
  [body("actif").isBoolean().withMessage("actif doit être true ou false.")],
  validate,
  activerDesactiverEntreprise
);

module.exports = router;
