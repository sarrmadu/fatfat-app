const request = require("supertest");
const app = require("../src/server");
const pool = require("../src/config/db");

let tokenTerangaGest, tokenTerangaLiv, tokenDakarExpressGest, tokenThiesGest;
let commandeIdTeranga;
let tourneeId;
let moussaDiopId; // récupéré dynamiquement — ne jamais coder un id en dur, l'ordre du seed peut changer

afterAll(async () => {
  await pool.end();
});

async function login(telephone) {
  const res = await request(app).post("/api/auth/login").send({ telephone, mot_de_passe: "demo1234" });
  expect(res.status).toBe(200);
  return res.body.token;
}

beforeAll(async () => {
  tokenTerangaGest = await login("770000001");      // Fatima Sy, gestionnaire Teranga Shop (Dakar)
  tokenTerangaLiv = await login("770000002");        // Moussa Diop, livreur Teranga Shop (Dakar)
  tokenDakarExpressGest = await login("770000010");  // Babacar Gueye, gestionnaire Dakar Express Delivery (Dakar AUSSI)
  tokenThiesGest = await login("770000004");         // Ibrahima Ka, gestionnaire Thiès Rapide (Thiès)

  const livreurs = await request(app).get("/api/utilisateurs/livreurs").set("Authorization", `Bearer ${tokenTerangaGest}`);
  moussaDiopId = livreurs.body.find((l) => l.nom === "Moussa Diop").id;
});

describe("Authentification", () => {
  test("refuse un mauvais mot de passe", async () => {
    const res = await request(app).post("/api/auth/login").send({ telephone: "770000001", mot_de_passe: "faux" });
    expect(res.status).toBe(401);
  });

  test("renvoie l'entreprise ET la ville de l'utilisateur, pas juste la ville", async () => {
    const res = await request(app).post("/api/auth/login").send({ telephone: "770000001", mot_de_passe: "demo1234" });
    expect(res.status).toBe(200);
    expect(res.body.utilisateur.entreprise_nom).toBe("Teranga Shop");
    expect(res.body.utilisateur.ville_nom).toBe("Dakar");
  });

  test("rejette une route protégée sans token", async () => {
    const res = await request(app).get("/api/entreprises/moi");
    expect(res.status).toBe(401);
  });
});

describe("Mon entreprise", () => {
  test("renvoie le hub et la ville de SA PROPRE entreprise", async () => {
    const res = await request(app).get("/api/entreprises/moi").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    expect(res.body.nom).toBe("Teranga Shop");
    expect(res.body.ville_nom).toBe("Dakar");
    expect(res.body.hub_lat).toBeTruthy();
  });

  test("deux entreprises de la même ville ont des hubs différents", async () => {
    const resTeranga = await request(app).get("/api/entreprises/moi").set("Authorization", `Bearer ${tokenTerangaGest}`);
    const resDakarExpress = await request(app).get("/api/entreprises/moi").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(resTeranga.body.ville_nom).toBe(resDakarExpress.body.ville_nom); // même ville
    expect(resTeranga.body.nom).not.toBe(resDakarExpress.body.nom);        // entreprises différentes
    expect(resTeranga.body.hub_nom).not.toBe(resDakarExpress.body.hub_nom); // hubs différents
  });
});

describe("Commandes — cloisonnement par entreprise (pas par ville)", () => {
  test("Teranga Shop liste ses commandes", async () => {
    const res = await request(app).get("/api/commandes").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c) => c.nom_client !== "Atelier Médina")).toBe(true); // c'est une commande de Dakar Express Delivery
    commandeIdTeranga = res.body[0].id;
  });

  test("Dakar Express Delivery liste SES commandes à elle, différentes de Teranga (même ville pourtant)", async () => {
    const res = await request(app).get("/api/commandes").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.find((c) => c.id === commandeIdTeranga)).toBeUndefined();
  });

  test("Dakar Express Delivery NE PEUT PAS modifier une commande de Teranga Shop (même ville)", async () => {
    const res = await request(app)
      .put(`/api/commandes/${commandeIdTeranga}`)
      .set("Authorization", `Bearer ${tokenDakarExpressGest}`)
      .send({ nom_client: "PIRATE" });
    expect(res.status).toBe(404);
  });

  test("Dakar Express Delivery NE PEUT PAS supprimer une commande de Teranga Shop (même ville)", async () => {
    const res = await request(app).delete(`/api/commandes/${commandeIdTeranga}`).set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(res.status).toBe(404);
  });

  test("Thiès Rapide (autre ville) ne voit pas non plus les commandes de Teranga Shop", async () => {
    const res = await request(app).get("/api/commandes").set("Authorization", `Bearer ${tokenThiesGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((c) => c.id === commandeIdTeranga)).toBeUndefined();
  });

  test("crée une commande avec repère textuel pour Teranga Shop", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ nom_client: "Test Client", telephone_client: "770000099", repere: "Portail rouge", lat: 14.70, lng: -17.45 });
    expect(res.status).toBe(201);
    expect(res.body.repere).toBe("Portail rouge");
  });
});

describe("Assignation de tournée — cloisonnement strict par entreprise", () => {
  test("Dakar Express Delivery NE PEUT PAS assigner une tournée à un livreur de Teranga Shop (même ville)", async () => {
    const res = await request(app)
      .post("/api/tournees")
      .set("Authorization", `Bearer ${tokenDakarExpressGest}`)
      .send({ livreur_id: moussaDiopId, commande_ids: [commandeIdTeranga], distance_km: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/introuvable dans votre entreprise/);
  });

  let commandeIds;

  test("Teranga Shop prévisualise une tournée optimisée depuis SON hub", async () => {
    const list = await request(app).get("/api/commandes").set("Authorization", `Bearer ${tokenTerangaGest}`);
    commandeIds = list.body.map((c) => c.id);

    const res = await request(app)
      .post("/api/tournees/optimiser")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ commande_ids: commandeIds });

    expect(res.status).toBe(200);
    expect(res.body.distance_km).toBeGreaterThan(0);
    expect(res.body.etapes.length).toBe(commandeIds.length);
  });

  test("Teranga Shop assigne la tournée à SON livreur", async () => {
    const res = await request(app)
      .post("/api/tournees")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ livreur_id: moussaDiopId, commande_ids: commandeIds, distance_km: 12.5 });

    expect(res.status).toBe(201);
    tourneeId = res.body.id;
  });

  test("le livreur de Teranga Shop voit bien sa tournée", async () => {
    const res = await request(app).get("/api/tournees/mine").set("Authorization", `Bearer ${tokenTerangaLiv}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(tourneeId);
  });

  test("le livreur change le statut d'une étape", async () => {
    const premiereEtape = commandeIds[0];
    const res = await request(app)
      .patch(`/api/commandes/${premiereEtape}/statut`)
      .set("Authorization", `Bearer ${tokenTerangaLiv}`)
      .send({ statut: "livre" });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe("livre");
  });

  test("réoptimise depuis une nouvelle position, en gardant l'étape livrée en tête", async () => {
    const res = await request(app)
      .post(`/api/tournees/${tourneeId}/reoptimiser`)
      .set("Authorization", `Bearer ${tokenTerangaLiv}`)
      .send({ lat: 14.705, lng: -17.47 });

    expect(res.status).toBe(200);
    expect(res.body.etapes[0].statut).toBe("livre");
  });
});

describe("Gestion des comptes livreurs — cloisonnée par entreprise", () => {
  let nouveauLivreurId;

  test("Teranga Shop crée un nouveau livreur", async () => {
    const res = await request(app)
      .post("/api/utilisateurs/livreurs")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ nom: "Nouveau Livreur Test", telephone: "770009999", mot_de_passe: "motdepasse123", capacite_max: 15 });

    expect(res.status).toBe(201);
    nouveauLivreurId = res.body.id;
  });

  test("Dakar Express Delivery ne voit PAS ce livreur dans sa propre liste (même ville pourtant)", async () => {
    const res = await request(app).get("/api/utilisateurs/livreurs").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((l) => l.id === nouveauLivreurId)).toBeUndefined();
  });

  test("Teranga Shop voit bien son nouveau livreur", async () => {
    const res = await request(app).get("/api/utilisateurs/livreurs").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((l) => l.id === nouveauLivreurId)).toBeTruthy();
  });

  test("Dakar Express Delivery NE PEUT PAS désactiver un livreur de Teranga Shop", async () => {
    const res = await request(app)
      .patch(`/api/utilisateurs/livreurs/${nouveauLivreurId}/statut`)
      .set("Authorization", `Bearer ${tokenDakarExpressGest}`)
      .send({ actif: false });
    expect(res.status).toBe(404);
  });

  test("respecte la capacité maximale du livreur lors de l'assignation", async () => {
    const capaRes = await request(app)
      .post("/api/utilisateurs/livreurs")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ nom: "Livreur Petite Capacité", telephone: "770008888", mot_de_passe: "motdepasse123", capacite_max: 1 });
    const livreurId = capaRes.body.id;

    const list = await request(app).get("/api/commandes").set("Authorization", `Bearer ${tokenTerangaGest}`);
    const ids = list.body.map((c) => c.id);

    const res = await request(app)
      .post("/api/tournees")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ livreur_id: livreurId, commande_ids: ids, distance_km: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/capacité maximale/);
  });
});

describe("Changement de mot de passe", () => {
  test("refuse si l'ancien mot de passe est incorrect", async () => {
    const res = await request(app)
      .patch("/api/auth/mot-de-passe")
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ ancien_mot_de_passe: "mauvais", nouveau_mot_de_passe: "nouveauMDP123" });
    expect(res.status).toBe(401);
  });

  test("accepte un changement valide", async () => {
    const res = await request(app)
      .patch("/api/auth/mot-de-passe")
      .set("Authorization", `Bearer ${tokenThiesGest}`)
      .send({ ancien_mot_de_passe: "demo1234", nouveau_mot_de_passe: "nouveauMDP123" });
    expect(res.status).toBe(200);

    const relogin = await request(app).post("/api/auth/login").send({ telephone: "770000004", mot_de_passe: "nouveauMDP123" });
    expect(relogin.status).toBe(200);
  });
});

describe("Modification du numéro d'un livreur — par son gestionnaire", () => {
  test("le gestionnaire modifie le numéro de Moussa Diop (cas d'un livreur qui a perdu son téléphone)", async () => {
    const res = await request(app)
      .patch(`/api/utilisateurs/livreurs/${moussaDiopId}/telephone`)
      .set("Authorization", `Bearer ${tokenTerangaGest}`)
      .send({ nouveau_telephone: "770005678" });
    expect(res.status).toBe(200);
    expect(res.body.telephone).toBe("770005678");

    const relogin = await request(app).post("/api/auth/login").send({ telephone: "770005678", mot_de_passe: "demo1234" });
    expect(relogin.status).toBe(200);
  });

  test("Dakar Express Delivery NE PEUT PAS modifier le numéro d'un livreur de Teranga Shop", async () => {
    const res = await request(app)
      .patch(`/api/utilisateurs/livreurs/${moussaDiopId}/telephone`)
      .set("Authorization", `Bearer ${tokenDakarExpressGest}`)
      .send({ nouveau_telephone: "770009991" });
    expect(res.status).toBe(404);
  });
});

describe("Historique et statistiques — cloisonnés par entreprise", () => {
  test("l'historique de Teranga Shop inclut sa tournée, pas celle des autres", async () => {
    const res = await request(app).get("/api/tournees/historique").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((t) => t.id === tourneeId)).toBeTruthy();
  });

  test("l'historique de Dakar Express Delivery NE contient PAS la tournée de Teranga Shop", async () => {
    const res = await request(app).get("/api/tournees/historique").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((t) => t.id === tourneeId)).toBeUndefined();
  });

  test("les statistiques du jour de Teranga Shop sont cohérentes", async () => {
    const res = await request(app).get("/api/stats").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    expect(res.body.total_commandes).toBeGreaterThan(0);
    expect(res.body.par_statut.livre).toBeGreaterThanOrEqual(1);
  });

  test("les statistiques de Dakar Express Delivery ne comptent PAS les commandes de Teranga Shop", async () => {
    const resTeranga = await request(app).get("/api/stats").set("Authorization", `Bearer ${tokenTerangaGest}`);
    const resDakarExpress = await request(app).get("/api/stats").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(resTeranga.body.par_statut.livre).not.toBe(resDakarExpress.body.par_statut.livre);
  });
});

describe("Suivi en direct des tournées du jour (visibilité gestionnaire)", () => {
  test("le gestionnaire voit la tournée de son livreur, avec un statut 'en_cours' ou 'terminee'", async () => {
    const res = await request(app).get("/api/tournees/suivi").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(200);
    const suivi = res.body.find((t) => t.id === tourneeId);
    expect(suivi).toBeTruthy();
    expect(["en_cours", "terminee"]).toContain(suivi.statut);
    expect(suivi.livreur_nom).toBe("Moussa Diop");
  });

  test("passe à 'terminee' dès que toutes les étapes sont livrées ou en échec", async () => {
    // Marque toutes les étapes restantes comme livrées.
    const mine = await request(app).get("/api/tournees/mine").set("Authorization", `Bearer ${tokenTerangaLiv}`);
    for (const etape of mine.body.etapes) {
      if (etape.statut !== "livre") {
        await request(app)
          .patch(`/api/commandes/${etape.id}/statut`)
          .set("Authorization", `Bearer ${tokenTerangaLiv}`)
          .send({ statut: "livre" });
      }
    }

    const res = await request(app).get("/api/tournees/suivi").set("Authorization", `Bearer ${tokenTerangaGest}`);
    const suivi = res.body.find((t) => t.id === tourneeId);
    expect(suivi.statut).toBe("terminee");
    expect(suivi.nb_livrees).toBe(suivi.nb_arrets);
  });

  test("Dakar Express Delivery ne voit pas la tournée de Teranga Shop dans son suivi", async () => {
    const res = await request(app).get("/api/tournees/suivi").set("Authorization", `Bearer ${tokenDakarExpressGest}`);
    expect(res.status).toBe(200);
    expect(res.body.find((t) => t.id === tourneeId)).toBeUndefined();
  });
});

describe("Panneau admin — gestion des entreprises clientes", () => {
  let tokenAdmin;
  let nouvelleEntrepriseId;

  test("l'admin se connecte (compte sans entreprise)", async () => {
    const res = await request(app).post("/api/auth/login").send({ telephone: "770000000", mot_de_passe: "demo1234" });
    expect(res.status).toBe(200);
    expect(res.body.utilisateur.role).toBe("admin");
    expect(res.body.utilisateur.entreprise_id).toBeNull();
    tokenAdmin = res.body.token;
  });

  test("un gestionnaire NE PEUT PAS accéder aux routes admin", async () => {
    const res = await request(app).get("/api/admin/entreprises").set("Authorization", `Bearer ${tokenTerangaGest}`);
    expect(res.status).toBe(403);
  });

  test("l'admin liste les villes disponibles", async () => {
    const res = await request(app).get("/api/admin/villes").set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.find((v) => v.nom === "Dakar")).toBeTruthy();
  });

  test("l'admin liste toutes les entreprises, tous clients confondus", async () => {
    const res = await request(app).get("/api/admin/entreprises").set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
    expect(res.body.find((e) => e.nom === "Teranga Shop")).toBeTruthy();
  });

  test("l'admin crée une nouvelle entreprise avec son premier gestionnaire", async () => {
    const villes = await request(app).get("/api/admin/villes").set("Authorization", `Bearer ${tokenAdmin}`);
    const dakarId = villes.body.find((v) => v.nom === "Dakar").id;

    const res = await request(app)
      .post("/api/admin/entreprises")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({
        nom: "Nouveau Client Test",
        ville_id: dakarId,
        hub_nom: "Hub Test",
        hub_lat: 14.70,
        hub_lng: -17.44,
        gestionnaire: { nom: "Gérant Test", telephone: "770007777", mot_de_passe: "motdepasse123" },
      });

    expect(res.status).toBe(201);
    expect(res.body.entreprise.nom).toBe("Nouveau Client Test");
    nouvelleEntrepriseId = res.body.entreprise.id;
  });

  test("le nouveau gestionnaire peut se connecter et ne voit AUCUNE commande des autres entreprises", async () => {
    const login = await request(app).post("/api/auth/login").send({ telephone: "770007777", mot_de_passe: "motdepasse123" });
    expect(login.status).toBe(200);

    const commandes = await request(app).get("/api/commandes").set("Authorization", `Bearer ${login.body.token}`);
    expect(commandes.status).toBe(200);
    expect(commandes.body.length).toBe(0); // toute nouvelle entreprise démarre avec un bordereau vide
  });

  test("désactive l'entreprise nouvellement créée", async () => {
    const res = await request(app)
      .patch(`/api/admin/entreprises/${nouvelleEntrepriseId}/statut`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ actif: false });
    expect(res.status).toBe(200);
    expect(res.body.actif).toBe(false);
  });

  test("le gestionnaire d'une entreprise désactivée ne peut plus se connecter", async () => {
    const res = await request(app).post("/api/auth/login").send({ telephone: "770007777", mot_de_passe: "motdepasse123" });
    expect(res.status).toBe(401);
  });
});
