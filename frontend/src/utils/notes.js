/**
 * utils/notes.js — Aides d'affichage des notes, partagées par les pages Notes, Bulletins,
 * Fiches de notes et Mon dossier. Les calculs (moyennes, rangs) restent côté backend
 * (api/notes.py) ; seule l'appréciation d'une note en cours de saisie est déduite ici.
 */
import { getLang } from '../services/lang';

// Texte selon la langue courante (lue à chaque appel : ces aides sont appelées au rendu).
const tr = (fr, en) => (getLang() === 'en' ? en : fr);

export const APPRECIATION_BADGE = { A: 'badge-success', ECA: 'badge-warning', NA: 'badge-danger' };

// Séries (miroir de NIVEAUX_AVEC_SERIE dans backend api/notes.py) : troisième langue en
// 4ème/3ème, série au second cycle ; aucune en 6ème/5ème ni au primaire.
const SERIES_LANGUES = ['ALLEMAND', 'ESPAGNOL', 'LATIN', 'CHINOIS'];
const SERIES_FR = ['A', 'C', 'D', 'E', 'TI'];
const SERIES_EN = ['ARTS', 'SCIENCE'];
// Enseignement technique : spécialité du CAP (1ère à 4ème année), série du bac technique.
const SERIES_TECH_CAP = ['ELEC', 'ELN', 'MACO', 'IS', 'FC', 'MEB'];
const SERIES_TECH_BAC = ['F2', 'F3', 'F4', 'F5', 'IS', 'IB', 'MEB'];
export const SERIES_PAR_NIVEAU = {
  '4EME_FR': SERIES_LANGUES, '3EME_FR': SERIES_LANGUES,
  '2NDE_FR': SERIES_FR, '1ERE_FR': SERIES_FR, 'TLE_FR': SERIES_FR,
  'LS_EN': SERIES_EN, 'US_EN': SERIES_EN,
  '1AN_TECH': SERIES_TECH_CAP, '2AN_TECH': SERIES_TECH_CAP, '3AN_TECH': SERIES_TECH_CAP, '4AN_TECH': SERIES_TECH_CAP,
  '2NDE_TECH': SERIES_TECH_BAC, '1ERE_TECH': SERIES_TECH_BAC, 'TLE_TECH': SERIES_TECH_BAC,
};
const LIBELLES_SERIE = {
  ALLEMAND: ['Allemand', 'German'], ESPAGNOL: ['Espagnol', 'Spanish'], LATIN: ['Latin', 'Latin'],
  CHINOIS: ['Chinois', 'Chinese'], A: ['Série A', 'Series A'], C: ['Série C', 'Series C'],
  D: ['Série D', 'Series D'], E: ['Série E', 'Series E'], TI: ['Série TI', 'Series TI'],
  ARTS: ['Arts', 'Arts'], SCIENCE: ['Science', 'Science'],
  ELEC: ['Électricité', 'Electricity'], ELN: ['Électronique', 'Electronics'], MACO: ['Maçonnerie', 'Masonry'],
  FC: ['Froid et climatisation', 'Refrigeration & air conditioning'], IS: ['Installation sanitaire', 'Plumbing'],
  MEB: ['Menuiserie-ébénisterie', 'Joinery & cabinet-making'], F2: ['F2 — Électronique', 'F2 — Electronics'],
  F3: ['F3 — Électrotechnique', 'F3 — Electrical engineering'], F4: ['F4 — Génie civil', 'F4 — Civil engineering'],
  F5: ['F5 — Froid et climatisation', 'F5 — Refrigeration & air conditioning'], IB: ['Industrie du bois', 'Wood industry'],
};
// LIB_SERIE[code] donne le libellé dans la langue courante (accesseurs évalués à la lecture).
export const LIB_SERIE = Object.defineProperties({}, Object.fromEntries(
  Object.entries(LIBELLES_SERIE).map(([code, [fr, en]]) => [code, { get: () => tr(fr, en), enumerable: true }])
));

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
  if (getLang() === 'en') {
    const n = r.rang, fin = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${fin}${r.ex_aequo ? ' (tied)' : ''}`;
  }
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
    options.push({ value: `annee:${code}`, label: `${tr('Année complète', 'Full year')} ${code}` });
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
