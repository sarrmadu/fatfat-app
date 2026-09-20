const express = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { previsualiser, assigner, maTournee, reoptimiser, historique, suiviDuJour } = require("../controllers/tourneesController");

const router = express.Router();

router.post(
  "/optimiser",
  requireAuth("gestionnaire"),
  [body("commande_ids").isArray({ min: 2 }).withMessage("Fournissez au moins 2 commande_ids.")],
  validate,
  previsualiser
);

router.post(
  "/",
  requireAuth("gestionnaire"),
  [
    body("livreur_id").isInt().withMessage("livreur_id requis."),
    body("commande_ids").isArray({ min: 1 }).withMessage("commande_ids requis."),
  ],
  validate,
  assigner
);

router.get("/mine", requireAuth("livreur"), maTournee);
router.get("/historique", requireAuth("gestionnaire"), historique);
router.get("/suivi", requireAuth("gestionnaire"), suiviDuJour);

router.post(
  "/:id/reoptimiser",
  requireAuth("livreur"),
  [
    body("lat").isFloat({ min: -90, max: 90 }).withMessage("lat invalide."),
    body("lng").isFloat({ min: -180, max: 180 }).withMessage("lng invalide."),
  ],
  validate,
  reoptimiser
);

module.exports = router;
