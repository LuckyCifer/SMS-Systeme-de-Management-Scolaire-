/**
 * utils/notes.js — Aides d'affichage des notes, partagées par les pages Notes, Bulletins,
 * Fiches de notes et Mon dossier. Les calculs (moyennes, rangs) restent côté backend
 * (api/notes.py) ; seule l'appréciation d'une note en cours de saisie est déduite ici.
 */

export const APPRECIATION_BADGE = { A: 'badge-success', ECA: 'badge-warning', NA: 'badge-danger' };

// Séries (miroir de NIVEAUX_AVEC_SERIE dans backend api/notes.py) : troisième langue en
// 4ème/3ème, série au second cycle ; aucune en 6ème/5ème ni au primaire.
const SERIES_LANGUES = ['ALLEMAND', 'ESPAGNOL', 'LATIN', 'CHINOIS'];
const SERIES_FR = ['A', 'C', 'D', 'E', 'TI'];
const SERIES_EN = ['ARTS', 'SCIENCE'];
export const SERIES_PAR_NIVEAU = {
  '4EME_FR': SERIES_LANGUES, '3EME_FR': SERIES_LANGUES,
  '2NDE_FR': SERIES_FR, '1ERE_FR': SERIES_FR, 'TLE_FR': SERIES_FR,
  'LS_EN': SERIES_EN, 'US_EN': SERIES_EN,
};
export const LIB_SERIE = {
  ALLEMAND: 'Allemand', ESPAGNOL: 'Espagnol', LATIN: 'Latin', CHINOIS: 'Chinois',
  A: 'Série A', C: 'Série C', D: 'Série D', E: 'Série E', TI: 'Série TI', ARTS: 'Arts', SCIENCE: 'Science',
};

// Primaire : 00-09/20 → NA, 10-14/20 → ECA, 15-20/20 → A (même règle que api/notes.py).
export const appreciationDepuisNote = note => {
  if (note === null || note === undefined || note === '' || isNaN(Number(note))) return null;
  const n = Number(note);
  if (n < 10) return 'NA';
  if (n < 15) return 'ECA';
  return 'A';
};

// « 2e ex æquo » quand plusieurs élèves partagent la même moyenne.
export const rangLabel = r => {
  if (r?.rang === null || r?.rang === undefined) return '—';
  return `${r.rang}${r.rang === 1 ? 'er' : 'e'}${r.ex_aequo ? ' ex æquo' : ''}`;
};

/**
 * Options du sélecteur de période : « Année complète » pour chaque année, puis les
 * périodes de premier niveau (trimestres, semestres), chacune suivie de ses séquences.
 * Valeurs : "annee:<code_annee>" ou le code de la période (voir parsePeriodeChoice).
 */
export const periodeOptions = (periodes = []) => {
  const byDate = (a, b) => (a.date_debut || '').localeCompare(b.date_debut || '')
    || String(a.lib_periode).localeCompare(String(b.lib_periode));
  const annees = [...new Set(periodes.filter(p => p.code_annee).map(p => p.code_annee))].sort().reverse();
  const options = [];
  annees.forEach(code => {
    options.push({ value: `annee:${code}`, label: `Année complète ${code}` });
    periodes.filter(p => p.code_annee === code && !p.periode_parent).sort(byDate).forEach(racine => {
      // L'année figure dans chaque libellé : les mêmes trimestres et séquences existent
      // chaque année, et le sélecteur (avec recherche) ne montre pas le regroupement.
      options.push({ value: String(racine.code_periode), label: `${racine.lib_periode} — ${code}` });
      periodes.filter(p => p.periode_parent === racine.code_periode).sort(byDate).forEach(seq => {
        options.push({ value: String(seq.code_periode), label: `↳ ${seq.lib_periode} (${racine.lib_periode} — ${code})` });
      });
    });
  });
  // Périodes sans année (anciennes saisies) : proposées telles quelles.
  periodes.filter(p => !p.code_annee).sort(byDate).forEach(p => {
    options.push({ value: String(p.code_periode), label: p.lib_periode });
  });
  return options;
};

// "annee:2025-2026" → { code_annee }, "12" → { code_periode }, "" → null.
export const parsePeriodeChoice = value => {
  if (!value) return null;
  const v = String(value);
  return v.startsWith('annee:') ? { code_annee: v.slice(6) } : { code_periode: v };
};
