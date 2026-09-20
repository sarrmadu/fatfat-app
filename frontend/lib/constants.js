// Comptes de démo — doivent correspondre à ceux créés par `npm run seed` côté backend.
// Groupés par ENTREPRISE, pas par ville : plusieurs entreprises concurrentes peuvent
// partager la même ville (ex: Teranga Shop et Dakar Express Delivery sont toutes deux
// à Dakar) sans jamais voir les données l'une de l'autre.
export const SEED_PASSWORD = "demo1234";

export const DEMO_ACCOUNTS = [
  { nom: "Fatima Sy",         telephone: "770000001", role: "gestionnaire", entreprise: "Teranga Shop",          ville: "Dakar" },
  { nom: "Moussa Diop",       telephone: "770000002", role: "livreur",       entreprise: "Teranga Shop",          ville: "Dakar" },
  { nom: "Aïssatou Ndiaye",   telephone: "770000003", role: "livreur",       entreprise: "Teranga Shop",          ville: "Dakar" },

  { nom: "Babacar Gueye",     telephone: "770000010", role: "gestionnaire", entreprise: "Dakar Express Delivery", ville: "Dakar" },
  { nom: "Modou Fall",        telephone: "770000011", role: "livreur",       entreprise: "Dakar Express Delivery", ville: "Dakar" },

  { nom: "Astou Mbaye",       telephone: "770000020", role: "gestionnaire", entreprise: "Sunu Colis",             ville: "Dakar" },
  { nom: "Ibrahima Sarr",     telephone: "770000021", role: "livreur",       entreprise: "Sunu Colis",             ville: "Dakar" },

  { nom: "Ibrahima Ka",       telephone: "770000004", role: "gestionnaire", entreprise: "Thiès Rapide",           ville: "Thiès" },
  { nom: "Cheikh Faye",       telephone: "770000005", role: "livreur",       entreprise: "Thiès Rapide",           ville: "Thiès" },

  { nom: "Ndeye Coumba Diaw", telephone: "770000030", role: "gestionnaire", entreprise: "Rail Express Thiès",     ville: "Thiès" },
  { nom: "Ousmane Ba",        telephone: "770000031", role: "livreur",       entreprise: "Rail Express Thiès",     ville: "Thiès" },

  { nom: "Aminata Diouf",     telephone: "770000006", role: "gestionnaire", entreprise: "Saly Logistique",        ville: "Mbour" },
  { nom: "Fatou Sarr",        telephone: "770000007", role: "livreur",       entreprise: "Saly Logistique",        ville: "Mbour" },
];
