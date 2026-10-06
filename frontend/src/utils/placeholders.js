/**
 * Placeholders centralisés pour tous les formulaires du projet.
 * Format camerounais : +237 6XX XXX XXX
 */

export const PH = {
  // Identités
  nom:        'Ex : DUPONT',
  prenom:     'Ex : Jean-Baptiste',
  nomEns:     'Ex : MBALLA',
  prenomEns:  'Ex : Emmanuel',
  nomComplet: 'Ex : Jean Dupont',

  // Contact
  tel:        'Ex : +237 6XX XXX XXX',
  email:      'Ex : jean.dupont@gmail.com',
  emailEns:   'Ex : m.mballa@example.com',

  // Matricules / codes
  matriculeEtu: 'ETU001',
  matriculeEns: 'Ex : ENS001',
  login:        'Ex : j.dupont',
  numeroCni:    'Ex : 123456789',
  numeroCarte:  'CARTE-2026-001',

  // Géographie
  lieu:      'Ex : Yaoundé',
  region:    'Ex : Centre',
  domicile:  'Ex : Bastos, Yaoundé',

  // Années / périodes
  annee:    '2025-2026',

  // Salles / lieux d'examen
  salle:    'Ex : Amphi A, Salle 203',

  // Libellés libres
  libExamen:   'Ex : Examen de mi-semestre S1',
  libelleRegime: 'Ex : Scolarité Terminale C...',
  libelleTrancheAcompte: 'Ex : Tranche 1, Acompte...',
  libelleClasse: 'Ex : Génie Informatique — Licence 1',
  codeClasse:    'Ex : GI1-L1',

  // Montants (FCFA)
  montant:        'Ex : 75 000',
  montantTotal:   'Ex : 150 000',
  montantPaye:    'Ex : 75 000',
  scolariteAnn:   'Ex : 850 000',
  inscriptionFrais: 'Ex : 50 000',
  montantTranche: 'Ex : 283 000',

  // Numérique
  effMax:        'Ex : 30',
  quotaHoraire:  'Ex : 30',
  credits:       'Ex : 3',
  nbTranches:    'Ex : 3',
  codeTrancheId: 'Ex : T1',

  // Documents
  numeroFacture: 'Ex : FACT-2026-001',
  batiment:      'Ex : Bât. A',

  // Mots de passe
  password: '••••••••',

  // Dates (browser date picker — les help texts affichent le format)
  // Pas de placeholder texte sur les inputs type="date" / "datetime-local"
  // → utiliser les help texts "Format : JJ/MM/AAAA" définis dans chaque page.
};

/**
 * Help texts pour les dates.
 * Utilisés comme prop `help` sur FormField.
 */
export const DATE_HELP = {
  date:     'Format : JJ/MM/AAAA',
  datetime: 'Format : JJ/MM/AAAA HH:MM',
};
