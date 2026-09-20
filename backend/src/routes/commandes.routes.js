const express = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { lister, creer, modifier, supprimer, changerStatut } = require("../controllers/commandesController");

const router = express.Router();

router.get("/", requireAuth("gestionnaire"), lister);

router.post(
  "/",
  requireAuth("gestionnaire"),
  [
    body("nom_client").trim().notEmpty().withMessage("nom_client requis."),
    body("lat").isFloat({ min: -90, max: 90 }).withMessage("lat invalide."),
    body("lng").isFloat({ min: -180, max: 180 }).withMessage("lng invalide."),
    body("telephone_client").optional({ nullable: true }).isString(),
    body("repere").optional({ nullable: true }).isString(),
  ],
  validate,
  creer
);

router.put(
  "/:id",
  requireAuth("gestionnaire"),
  [
    body("lat").optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body("lng").optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  ],
  validate,
  modifier
);

router.delete("/:id", requireAuth("gestionnaire"), supprimer);

router.patch(
  "/:id/statut",
  requireAuth("livreur"),
  [body("statut").isIn(["attente", "encours", "livre", "echec"]).withMessage("Statut invalide.")],
  validate,
  changerStatut
);

module.exports = router;
