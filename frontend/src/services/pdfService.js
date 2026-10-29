/**
 * services/pdfService.js
 * Service d'export PDF utilisant html2pdf.js — dépendance npm embarquée dans le build
 * (pas de script chargé depuis un CDN à l'exécution) : l'export PDF fonctionne donc
 * même sans accès Internet, tant que l'application elle-même a été chargée une fois.
 * Génère : bulletins de notes, reçus de paiement, certificats, listes de classe.
 */
import html2pdf from 'html2pdf.js';

// ── Conversion image URL → base64 ─────────────────────────────────────────────
const fetchPhotoBase64 = async (url) => {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror   = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

// ── Lecture de l'établissement depuis le localStorage ─────────────────────────
const getEtabFromStorage = () => {
  try {
    const raw = localStorage.getItem('sms_etab');
    return raw ? JSON.parse(raw)?.data : null;
  } catch { return null; }
};

// ── En-tête commun à tous les PDFs ───────────────────────────────────────────
// Affiche : logo (si disponible) | Nom + coordonnées | Titre du document
const buildEtabHeader = (etab, logoBase64, docTitle, accentColor = '#1a3c5e') => {
  const nom      = etab?.lib_etab  || 'Système de Management Scolaire';
  const sigle    = etab?.sigle     || '';
  const adresse  = etab?.adresse   || '';
  const ville    = etab?.ville     || '';
  const tel      = etab?.tel_etab  || '';
  const email    = etab?.email     || '';

  const coordonnees = [adresse, ville, tel, email].filter(Boolean).join('  •  ');

  return `
    <div style="text-align:center;border-bottom:3px solid ${accentColor};
                padding-bottom:12px;margin-bottom:16px;">
      ${logoBase64 ? `<div style="margin-bottom:8px;">
        <img src="${logoBase64}" alt="Logo"
             style="height:72px;max-width:140px;object-fit:contain;" />
      </div>` : ''}
      ${sigle ? `<div style="font-size:10px;color:${accentColor};letter-spacing:2px;
                             font-weight:700;text-transform:uppercase;margin-bottom:2px;">${sigle}</div>` : ''}
      <div style="font-size:16px;font-weight:800;color:${accentColor};
                  text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">${nom}</div>
      ${etab?.devise ? `<div style="font-size:10px;font-style:italic;color:${accentColor};margin-bottom:3px;">${etab.devise}</div>` : ''}
      ${coordonnees ? `<div style="font-size:10px;color:#666;margin-bottom:6px;">${coordonnees}</div>` : ''}
      <div style="font-size:13px;font-weight:700;color:#333;
                  letter-spacing:2px;text-transform:uppercase;">${docTitle}</div>
    </div>`;
};

// ── Titre du chef d'établissement selon le type ───────────────────────────────
// forme='fonction' → utilisé dans le corps du texte  ("Je soussigné(e), X, Proviseur(e) de…")
// forme='signature' → utilisé dans le bloc signature ("Le Proviseur / Le Principal")
const getChefEtabLabel = (typeEtab, forme = 'signature') => {
  if (forme === 'fonction') {
    switch (typeEtab) {
      case 'SECONDAIRE': return 'Proviseur(e)';
      case 'PRIMAIRE':   return 'Directeur(trice)';
      default:           return 'DAAC';
    }
  }
  switch (typeEtab) {
    case 'SECONDAIRE': return 'Le Proviseur';
    case 'PRIMAIRE':   return 'Le Directeur';
    default:           return 'Le DAAC';
  }
};

// ── Options par défaut html2pdf ───────────────────────────────────────────────
const DEFAULT_OPTIONS = {
  margin:       [10, 10, 10, 10],
  image:        { type: 'jpeg', quality: 0.98 },
  html2canvas:  { scale: 2, useCORS: true },
  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
};

// ── Export générique d'un élément HTML ────────────────────────────────────────
export const exportToPDF = async (element, filename = 'export.pdf', options = {}) => {
  await html2pdf()
    .set({ ...DEFAULT_OPTIONS, ...options, filename })
    .from(element)
    .save();
};

// ── Export « page unique » ────────────────────────────────────────────────────
// Dimensionne la page PDF exactement sur la hauteur réelle du contenu rendu, au lieu
// d'une page A4 fixe : un document légèrement plus haut que 297mm ne se retrouve donc
// jamais coupé avec un reliquat sur une 2e page quasi vide. S'appuie sur l'API Worker
// documentée de html2pdf.js pour ajuster le format après le rendu du canevas, sans le
// regénérer (un seul rendu html2canvas, pas de perte de performance).
//
// Retourne { blob, filename } au lieu de déclencher un téléchargement directement : les
// pages appelantes affichent d'abord un aperçu (voir context/PdfPreviewContext) et
// l'utilisateur choisit ensuite de télécharger — plutôt qu'un export immédiat et silencieux.
const exportSinglePage = async (el, filename, { scale = 2, widthMm = 210 } = {}) => {
  const worker = html2pdf().set({
    margin:      0,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale, useCORS: true, scrollY: 0 },
    pagebreak:   { mode: ['avoid-all'] },
  }).from(el);

  await worker.toCanvas();
  const canvas   = await worker.get('canvas');
  const heightMm = (canvas.height * widthMm) / canvas.width;

  await worker.set({
    filename,
    jsPDF: { unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' },
  });
  await worker.toPdf();
  const blob = await worker.outputPdf('blob');
  return { blob, filename };
};

// ── Bulletin du secondaire (format officiel des lycées et collèges camerounais) ──
// En-tête bilingue République du Cameroun / Republic of Cameroon, identité de l'élève avec
// photo, matières regroupées (littéraires, scientifiques, techniques, autres) avec les
// notes des sous-périodes (séquences d'un trimestre, ou trimestres de l'année), moyenne,
// coefficient, total, rang et appréciation, puis discipline, travail, profil de la classe
// et décision. Tous les chiffres viennent de /api/evaluations/moyennes/ (api/notes.py) ;
// seules les sommes des sous-totaux de groupe sont faites ici.
// Délégation régionale : [français (avec son article), anglais].
const REGIONS_FR_EN = {
  ADAMAOUA: ["DE L'ADAMAOUA", 'ADAMAWA'], CENTRE: ['DU CENTRE', 'CENTRE'], EST: ["DE L'EST", 'EAST'],
  EXTREME_NORD: ["DE L'EXTRÊME-NORD", 'FAR NORTH'], LITTORAL: ['DU LITTORAL', 'LITTORAL'], NORD: ['DU NORD', 'NORTH'],
  NORD_OUEST: ['DU NORD-OUEST', 'NORTH WEST'], OUEST: ["DE L'OUEST", 'WEST'], SUD: ['DU SUD', 'SOUTH'],
  SUD_OUEST: ['DU SUD-OUEST', 'SOUTH WEST'],
};
// Groupe de matières d'après le module de la matière.
const GROUPES_MATIERES = [
  { fr: '1er groupe : matières littéraires',  en: 'Group 1: Arts subjects',     modules: ['LIT', 'GEN', 'LITTECRIT', 'LITTORAL'] },
  { fr: '2e groupe : matières scientifiques', en: 'Group 2: Science subjects',  modules: ['SCI', 'MATHS', 'ARITHM', 'ALGO', 'MATINFO'] },
  { fr: 'Matières techniques et professionnelles', en: 'Technical subjects', modules: ['TEC', 'ELECTRICT', 'INDUSTRI'] },
  { fr: '3e groupe : autres matières',        en: 'Group 3: Other subjects',   modules: null },   // le reste
];

const generateBulletinSecondaire = async (etudiant, resultat, etabData, ctx) => {
  const { default: api } = await import('./api');
  const liste = r => r.data?.results ?? r.data ?? [];
  const mle = etudiant?.mle_etudiant || resultat?.mle_etudiant;

  // ── Données ──
  const [periodes, classe, matieresRef, cours, absences] = await Promise.all([
    api.get('/api/periodes/', { params: { page_size: 500 } }).then(liste).catch(() => []),
    api.get(`/api/classes/${ctx.code_classe}/`).then(r => r.data).catch(() => ({})),
    api.get('/api/matieres/', { params: { page_size: 2000 } }).then(liste).catch(() => []),
    api.get('/api/cours/', { params: { code_classe: ctx.code_classe, page_size: 500 } }).then(liste).catch(() => []),
    api.get('/api/absences/', { params: { mle_etudiant: mle, page_size: 5000 } }).then(liste).catch(() => []),
  ]);
  const periode = ctx.code_periode ? periodes.find(p => String(p.code_periode) === String(ctx.code_periode)) : null;
  const codeAnnee = ctx.code_annee || periode?.code_annee || '';
  const parDate = (a, b) => String(a.date_debut || '').localeCompare(String(b.date_debut || ''));
  // Sous-périodes affichées en colonnes : séquences d'un trimestre, ou trimestres de l'année.
  let colonnes = [];
  if (periode) colonnes = periodes.filter(p => String(p.periode_parent) === String(periode.code_periode)).sort(parDate);
  else if (codeAnnee) colonnes = periodes.filter(p => p.code_annee === codeAnnee && !p.periode_parent && p.type_etab === 'SECONDAIRE').sort(parDate);
  const notesColonnes = await Promise.all(colonnes.map(c =>
    api.get('/api/evaluations/moyennes/', { params: { code_classe: ctx.code_classe, code_periode: c.code_periode, mle_etudiant: mle } })
      .then(r => Object.fromEntries((r.data?.[0]?.matieres || []).map(m => [m.code_matiere, m.moyenne])))
      .catch(() => ({}))));
  const decision = ctx.code_annee
    ? await api.get('/api/decisions/', { params: { mle_etudiant: mle, code_annee: ctx.code_annee } }).then(r => liste(r)[0]).catch(() => null)
    : null;

  // ── Langue : celle de la classe (anglophone = bulletin en anglais) ──
  const anglo = classe?.systeme === 'ANGLOPHONE' || (!classe?.systeme && etabData?.systeme === 'ANGLOPHONE');
  const L = (fr, en) => (anglo ? en : fr);
  const fmt = v => (v === null || v === undefined || v === '') ? '' : Number(v).toFixed(2);
  const rangTxt = (r, ex) => r ? `${r}${anglo ? ({ 1: 'st', 2: 'nd', 3: 'rd' }[r % 10] && ![11, 12, 13].includes(r % 100) ? { 1: 'st', 2: 'nd', 3: 'rd' }[r % 10] : 'th') : (r === 1 ? 'er' : 'e')}${ex ? (anglo ? ' =' : ' ex') : ''}` : '';
  const dateFr = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : '';

  // ── En-tête ──
  const logo  = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;
  const photo = etudiant?.photo_url ? await fetchPhotoBase64(etudiant.photo_url) : null;
  const [regFr, regEn] = REGIONS_FR_EN[etabData?.region] || ['', ''];
  const colEntete = (lignes) => `<div style="flex:1;text-align:center;font-size:8.5px;line-height:1.35;">${lignes.join('<br/>')}</div>`;
  const entete = `
    <div style="display:flex;align-items:center;gap:8px;">
      ${colEntete(['<b>RÉPUBLIQUE DU CAMEROUN</b>', '<i>Paix – Travail – Patrie</i>', '*******',
                   '<b>MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES</b>', regFr ? `DÉLÉGATION RÉGIONALE ${regFr}` : '',
                   `<b style="font-size:9.5px;">${(etabData?.lib_etab || '').toUpperCase()}</b>`])}
      <div style="width:84px;text-align:center;">
        ${logo ? `<img src="${logo}" style="height:70px;max-width:84px;object-fit:contain;"/>` : ''}
        ${etabData?.devise ? `<div style="font-size:7px;font-style:italic;color:#1F3864;margin-top:2px;">${etabData.devise}</div>` : ''}
      </div>
      ${colEntete(['<b>REPUBLIC OF CAMEROON</b>', '<i>Peace – Work – Fatherland</i>', '*******',
                   '<b>MINISTRY OF SECONDARY EDUCATION</b>', regEn ? `REGIONAL DELEGATION FOR THE ${regEn}` : '',
                   `<b style="font-size:9.5px;">${(etabData?.lib_etab || '').toUpperCase()}</b>`])}
    </div>`;

  const titre = ctx.code_annee
    ? L('BULLETIN SCOLAIRE ANNUEL', 'ANNUAL REPORT CARD')
    : periode?.periode_parent
      ? `${L('BULLETIN DE NOTES', 'REPORT CARD')} — ${(periode?.lib_periode || '').toUpperCase()}`
      : `${L('BULLETIN DE NOTES DU', 'REPORT CARD —')} ${(periode?.lib_periode || '').replace(/ SEC$/, '').toUpperCase()}`;

  // ── Identité ──
  const cellule = (lib, val) => `<td style="padding:3px 6px;border:1px solid #444;font-size:9px;">
      <span style="color:#444;">${lib} :</span> <b>${val || ''}</b></td>`;
  const fille = etudiant?.sexe === 'F';
  const identite = `
    <div style="display:flex;gap:8px;margin-top:6px;">
      <div style="width:72px;height:88px;border:1px solid #444;flex-shrink:0;display:flex;align-items:center;justify-content:center;
                  font-size:8px;color:#999;overflow:hidden;">${photo ? `<img src="${photo}" style="width:72px;height:88px;object-fit:cover;"/>` : 'Photo'}</div>
      <table style="flex:1;border-collapse:collapse;">
        <tr>${cellule(L('Nom et prénoms', 'Name'), `${(etudiant?.nom || '').toUpperCase()} ${etudiant?.prenom || ''}`)}
            ${cellule(L('Classe', 'Class'), classe?.lib_classe || etudiant?.lib_classe)}</tr>
        <tr>${cellule(L(fille ? 'Née le' : 'Né le', 'Born on'), `${dateFr(etudiant?.date_naiss)} ${etudiant?.lieu ? L('à', 'at') + ' ' + etudiant.lieu : ''}`)}
            ${cellule(L('Effectif', 'Class size'), resultat?.effectif)}</tr>
        <tr>${cellule(L('Matricule', 'Registration N°'), mle)}
            ${cellule(L('Sexe', 'Sex'), etudiant?.sexe === 'F' ? L('Féminin', 'Female') : etudiant?.sexe === 'M' ? L('Masculin', 'Male') : '')}</tr>
        <tr>${cellule(L('Parent / Tuteur', 'Parent / Guardian'), etudiant?.nom_tuteur || etudiant?.nom_pere)}
            ${cellule(L('Professeur principal', 'Class master'), '')}</tr>
      </table>
    </div>`;

  // ── Tableau des matières ──
  const moduleDe = Object.fromEntries(matieresRef.map(m => [m.code_matiere, m.code_module?.code_module || m.code_module]));
  const ensDe = Object.fromEntries(cours.filter(c => !codeAnnee || c.code_annee === codeAnnee)
    .map(c => [c.code_matiere?.code_matiere || c.code_matiere, c.nom_ens]));
  const groupeDe = code => GROUPES_MATIERES.findIndex(g => !g.modules || g.modules.includes(moduleDe[code]));
  const matieres = (resultat?.matieres || []).filter(m => m.poids !== null || m.moyenne !== null);
  const th = 'padding:3px 4px;border:1px solid #444;font-size:8.5px;background:#D6E4F0;';
  const td = 'padding:2px 4px;border:1px solid #444;font-size:9px;text-align:center;';
  const colsTitres = colonnes.map(c => `<th style="${th}">${(c.lib_periode || '').replace('Séquence ', 'Séq. ').replace('Trimestre ', 'Trim. ').replace(/ SEC$/, '')}</th>`).join('');
  let lignes = '';
  let totalCoef = 0, totalPoints = 0;
  GROUPES_MATIERES.forEach((g, gi) => {
    const duGroupe = matieres.filter(m => groupeDe(m.code_matiere) === gi);
    if (!duGroupe.length) return;
    let coefG = 0, pointsG = 0;
    duGroupe.forEach(m => {
      const coef = m.poids ?? '';
      const total = m.moyenne !== null && m.poids ? m.moyenne * m.poids : null;
      if (total !== null) { coefG += m.poids; pointsG += total; }
      lignes += `<tr>
        <td style="${td}text-align:left;"><b>${m.lib_matiere}</b>${ensDe[m.code_matiere] ? `<div style="font-size:7.5px;color:#555;">${ensDe[m.code_matiere]}</div>` : ''}</td>
        ${colonnes.map((c, ci) => `<td style="${td}">${fmt(notesColonnes[ci][m.code_matiere])}</td>`).join('')}
        <td style="${td}font-weight:700;color:${m.moyenne !== null && m.moyenne < 10 ? '#b71c1c' : '#111'};">${m.dispense ? 'ABS. J' : fmt(m.moyenne)}</td>
        <td style="${td}">${coef}</td>
        <td style="${td}">${fmt(total)}</td>
        <td style="${td}">${rangTxt(m.rang)}</td>
        <td style="${td}">${fmt(m.moyenne_classe_matiere)}</td>
        <td style="${td}text-align:left;font-size:8px;">${m.appreciation_bulletin ? L(m.appreciation_bulletin, m.appreciation_bulletin) : ''}</td>
      </tr>`;
    });
    totalCoef += coefG; totalPoints += pointsG;
    lignes += `<tr style="background:#eef3f8;font-weight:700;">
      <td style="${td}text-align:left;font-size:8.5px;">${L(g.fr, g.en)}</td>
      ${colonnes.map(() => `<td style="${td}"></td>`).join('')}
      <td style="${td}">${coefG ? fmt(pointsG / coefG) : ''}</td><td style="${td}">${coefG || ''}</td>
      <td style="${td}">${fmt(pointsG)}</td><td style="${td}" colspan="3"></td></tr>`;
  });
  const tableau = `
    <table style="width:100%;border-collapse:collapse;margin-top:6px;">
      <thead><tr>
        <th style="${th}text-align:left;">${L('Matières / Enseignants', 'Subjects / Teachers')}</th>${colsTitres}
        <th style="${th}">${L('Moy. /20', 'Avg /20')}</th><th style="${th}">Coef.</th><th style="${th}">${L('Total', 'Total')}</th>
        <th style="${th}">${L('Rang', 'Rank')}</th><th style="${th}">${L('Moy. cl.', 'Cl. avg')}</th><th style="${th}">${L('Appréciation', 'Remark')}</th>
      </tr></thead>
      <tbody>${lignes}
        <tr style="background:#1F3864;color:#fff;font-weight:700;">
          <td style="${td}text-align:left;color:#fff;">${L('TOTAL GÉNÉRAL', 'GRAND TOTAL')}</td>
          ${colonnes.map(() => `<td style="${td}"></td>`).join('')}
          <td style="${td}color:#fff;">${fmt(resultat?.moyenne_generale)}</td><td style="${td}color:#fff;">${resultat?.total_poids ?? totalCoef}</td>
          <td style="${td}color:#fff;">${fmt(resultat?.total_points ?? totalPoints)}</td>
          <td style="${td}color:#fff;">${rangTxt(resultat?.rang, resultat?.ex_aequo)}${resultat?.effectif ? '/' + resultat.effectif : ''}</td>
          <td style="${td}color:#fff;">${fmt(resultat?.moyenne_classe)}</td><td style="${td}color:#fff;">${resultat?.appreciation_travail || ''}</td>
        </tr>
      </tbody>
    </table>`;

  // ── Discipline (absences de la période) ──
  // Bornes : la période choisie, ou pour l'année du début du 1er trimestre à la fin du dernier.
  const debut = String(periode?.date_debut || colonnes[0]?.date_debut || '').slice(0, 10);
  const fin   = String(periode?.date_fin || colonnes[colonnes.length - 1]?.date_fin || '').slice(0, 10);
  const absPeriode = absences.filter(a => {
    const d = String(a.date_seance || '');
    return (!debut || d >= debut) && (!fin || d <= fin);
  });
  const heures = l => l.reduce((s, a) => s + Number(a.nb_heures || 0), 0);
  const absentes = absPeriode.filter(a => !a.present);
  const hJ  = heures(absentes.filter(a => a.justifiee));
  const hNJ = heures(absentes.filter(a => !a.justifiee));
  const retards = absPeriode.filter(a => a.present && Number(a.retard_minutes) > 0).length;
  const case_ = coche => `<span style="display:inline-block;width:9px;height:9px;border:1px solid #333;margin-right:4px;vertical-align:middle;text-align:center;line-height:8px;font-size:8px;">${coche ? '✔' : ''}</span>`;
  const bloc = (titreBloc, contenu, largeur) => `
    <div style="width:${largeur};border:1px solid #444;">
      <div style="background:#1F3864;color:#fff;font-size:8.5px;font-weight:700;padding:3px 6px;text-transform:uppercase;">${titreBloc}</div>
      <div style="padding:5px 6px;font-size:8.5px;line-height:1.7;">${contenu}</div>
    </div>`;
  const moy = resultat?.moyenne_generale;
  const discipline = bloc(L('Discipline', 'Conduct'), `
    ${L('Absences justifiées', 'Excused absences')} : <b>${hJ ? Math.round(hJ) + ' h' : '0'}</b><br/>
    ${L('Absences non justifiées', 'Unexcused absences')} : <b>${hNJ ? Math.round(hNJ) + ' h' : '0'}</b><br/>
    ${L('Retards', 'Late arrivals')} : <b>${retards}</b><br/>
    ${case_(false)}${L('Avertissement conduite', 'Conduct warning')}<br/>
    ${case_(false)}${L('Blâme conduite', 'Conduct reprimand')}<br/>
    ${case_(false)}${L('Exclusion temporaire', 'Suspension')}`, '31%');
  const travail = bloc(L("Travail de l'élève", "Student's work"), `
    ${L('Moyenne', 'Average')} : <b>${fmt(moy) || '—'}</b> / 20 &nbsp; ${L('Rang', 'Rank')} : <b>${rangTxt(resultat?.rang, resultat?.ex_aequo)}${resultat?.effectif ? ' / ' + resultat.effectif : ''}</b><br/>
    ${L('Appréciation', 'Remark')} : <b>${resultat?.appreciation_travail || '—'}</b><br/>
    ${case_(moy >= 12)}${L("Tableau d'honneur", 'Roll of honour')}<br/>
    ${case_(moy >= 14)}${L('Encouragements', 'Encouragement')}<br/>
    ${case_(moy >= 16)}${L('Félicitations', 'Congratulations')}<br/>
    ${case_(moy !== null && moy !== undefined && moy < 8)}${L('Avertissement travail', 'Work warning')}`, '33%');
  const profil = bloc(L('Profil de la classe', 'Class profile'), `
    ${L('Moyenne de la classe', 'Class average')} : <b>${fmt(resultat?.moyenne_classe)}</b><br/>
    ${L('Plus forte moyenne', 'Highest average')} : <b>${fmt(resultat?.moyenne_max)}</b><br/>
    ${L('Plus faible moyenne', 'Lowest average')} : <b>${fmt(resultat?.moyenne_min)}</b><br/>
    ${L('Taux de réussite', 'Pass rate')} : <b>${resultat?.taux_reussite ?? ''}${resultat?.taux_reussite !== null && resultat?.taux_reussite !== undefined ? ' %' : ''}</b><br/>
    ${L('Effectif classé', 'Students ranked')} : <b>${resultat?.effectif ?? ''}</b>`, '33%');

  const res = decision?.resultat;
  const decisionBloc = ctx.code_annee ? `
    <div style="margin-top:6px;border:1px solid #444;padding:5px 8px;font-size:9px;">
      <b>${L('DÉCISION DU CONSEIL DE CLASSE', 'CLASS COUNCIL DECISION')} :</b> &nbsp;
      ${case_(res === 'ADMIS')}${L('Admis(e) en classe supérieure', 'Promoted')} &nbsp;
      ${case_(res === 'REDOUBLE')}${L('Redouble', 'Repeats')} &nbsp;
      ${case_(res === 'EXCLU')}${L('Exclu(e)', 'Dismissed')}
      ${decision?.observations ? `<div style="margin-top:3px;"><i>${decision.observations}</i></div>` : ''}
    </div>` : '';
  const signatures = `
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:9px;">
      <div style="width:30%;text-align:center;">${L('Visa du parent', "Parent's signature")}<div style="height:48px;"></div></div>
      <div style="width:30%;text-align:center;">${L('Le Professeur principal', 'The Class master')}<div style="height:48px;"></div></div>
      <div style="width:34%;text-align:center;">${etabData?.ville || ''}, ${L('le', 'on')} ${new Date().toLocaleDateString('fr-FR')}<br/>
        <b>${L('Le Proviseur / Le Principal', 'The Principal')}</b><div style="height:42px;"></div>
        <div style="font-size:8.5px;">${etabData?.directeur || ''}</div></div>
    </div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;background:#fff;width:760px;padding:16px 18px;">
      ${entete}
      <div style="text-align:center;margin:6px 0 2px;">
        <div style="font-size:14px;font-weight:800;letter-spacing:1px;color:#1F3864;">${titre}</div>
        <div style="font-size:10px;">${L('Année scolaire', 'School year')} : <b>${codeAnnee}</b></div>
      </div>
      ${identite}
      ${tableau}
      <div style="display:flex;justify-content:space-between;gap:6px;margin-top:6px;">${discipline}${travail}${profil}</div>
      ${decisionBloc}
      ${signatures}
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `bulletin_${mle || 'eleve'}.pdf`, { scale: 1.6 });
  document.body.removeChild(el);
  return result;
};

// ── Bulletin de notes ─────────────────────────────────────────────────────────
// `resultat` : ligne de l'élève renvoyée par /api/evaluations/moyennes/ (api/notes.py) —
// moyennes par matière, poids (coefficient ou crédits), moyenne générale, rang, effectif,
// moyenne de classe, appréciations du primaire. Aucun calcul de moyenne ici : le bulletin
// affiche exactement les mêmes chiffres que les relevés et les délibérations.
//
// `contexte` ({ code_classe, code_periode | code_annee }) : au secondaire, il permet le
// bulletin au format officiel (voir generateBulletinSecondaire) ; sans lui, bulletin simple.
export const generateBulletin = async (etudiant, resultat, periode, etab, contexte = null) => {
  // Établissement (paramètre ou localStorage)
  const etabData   = etab || getEtabFromStorage();
  if (etabData?.type_etab === 'SECONDAIRE' && contexte?.code_classe) {
    return generateBulletinSecondaire(etudiant, resultat, etabData, contexte);
  }
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;

  // Photo de profil étudiant
  const photoBase64 = etudiant?.photo_url ? await fetchPhotoBase64(etudiant.photo_url) : null;
  const photoHtml   = photoBase64
    ? `<img src="${photoBase64}" alt="Photo"
           style="width:99px;height:127px;object-fit:cover;display:block;border:1px solid #111;" />`
    : `<div style="width:99px;height:127px;display:flex;align-items:center;
                   justify-content:center;border:1px solid #999;
                   background:#f9f9f9;font-size:10px;color:#aaa;">Photo</div>`;

  const classeLib  = etudiant?.lib_classe || etudiant?.classe || '—';
  const nomComplet = [(etudiant?.nom || '').toUpperCase(), etudiant?.prenom || '']
    .filter(Boolean).join(' ') || resultat?.nom_etudiant || '—';

  const today    = new Date().toLocaleDateString('fr-FR');
  const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const typeEtabBulletin = etabData?.type_etab || 'SUPERIEUR';
  const chefSignatureBulletin = typeEtabBulletin === 'SUPERIEUR'
    ? `${getChefEtabLabel(typeEtabBulletin, 'signature')} des Études`
    : getChefEtabLabel(typeEtabBulletin, 'signature');

  // Primaire : chaque moyenne /20 est accompagnée de son appréciation A/ECA/NA.
  // Pré-bac : coefficients et points (moyenne × coef) ; supérieur : crédits LMD.
  const isPrimaire = typeEtabBulletin === 'PRIMAIRE';
  const isPreBac   = typeEtabBulletin !== 'SUPERIEUR';
  const poidsLabel = isPreBac ? 'Coef.' : 'Crédits';
  const APPRECIATION_LABEL = { A: 'Acquis', ECA: "En cours d'acquisition", NA: 'Non acquis' };
  const APPRECIATION_COLOR = { A: '#1b5e20', ECA: '#e65100', NA: '#b71c1c' };
  const fmt = v => (v === null || v === undefined) ? '—' : Number(v).toFixed(2);
  const mentionMatiere = moy => moy >= 16 ? 'Très Bien' : moy >= 14 ? 'Bien' : moy >= 12 ? 'Assez Bien' : moy >= 10 ? 'Passable' : 'Insuffisant';

  const matieres = resultat?.matieres || [];
  const moyenneGenerale = resultat?.moyenne_generale ?? null;
  const rang        = resultat?.rang ?? null;
  const totalEleves = resultat?.effectif ?? null;
  const classMoyenne = resultat?.moyenne_classe ?? null;
  const rangTexte = rang !== null
    ? `${rang}<sup>${rang === 1 ? 'er' : 'e'}</sup>${resultat?.ex_aequo ? ' ex æquo' : ''}${totalEleves ? ' / ' + totalEleves : ''}`
    : null;

  const appreciationHtml = (appre, taille = 11) => appre
    ? `<span style="font-weight:700;color:${APPRECIATION_COLOR[appre]};font-size:${taille}px;">${appre}</span>
       <span style="color:${APPRECIATION_COLOR[appre]};font-size:${taille - 1}px;"> — ${APPRECIATION_LABEL[appre]}</span>`
    : '—';

  const lignesMatieres = matieres.map((m, i) => {
    const bg    = i % 2 === 0 ? '#fff' : '#f9f9f9';
    const moy   = m.moyenne;
    const color = moy === null ? '#999' : moy >= 10 ? '#1b5e20' : '#b71c1c';
    const points = (isPreBac && moy !== null && m.poids) ? (moy * m.poids).toFixed(2) : '—';
    return `
      <tr style="background:${bg};border-bottom:1px solid #eee;">
        <td style="padding:5px 9px;font-size:11px;">${m.lib_matiere}</td>
        <td style="padding:5px 9px;text-align:center;color:#777;font-size:11px;">${m.nb_evals ?? '—'}</td>
        <td style="padding:5px 9px;text-align:center;color:#555;font-size:11px;">${m.poids ?? '—'}</td>
        <td style="padding:5px 9px;text-align:center;font-weight:700;color:${color};font-size:12px;">${moy !== null ? fmt(moy) + '/20' : (m.dispense ? 'Abs. justifiée' : '—')}</td>
        ${isPreBac ? `<td style="padding:5px 9px;text-align:center;color:#555;font-size:11px;">${points}</td>` : ''}
        <td style="padding:5px 9px;text-align:center;font-size:11px;color:${color};">
          ${isPrimaire ? appreciationHtml(m.appreciation) : (moy !== null ? mentionMatiere(moy) : '—')}
        </td>
      </tr>`;
  }).join('');

  // Ligne des totaux (pré-bac) : Σ coefficients et Σ points, comme sur les bulletins officiels.
  const totauxHtml = (isPreBac && resultat?.total_poids) ? `
      <tr style="background:#e8f5e9;font-weight:700;border-top:2px solid #2e7d32;">
        <td style="padding:6px 9px;font-size:11px;" colspan="2">TOTAUX</td>
        <td style="padding:6px 9px;text-align:center;font-size:11px;">${resultat.total_poids}</td>
        <td style="padding:6px 9px;text-align:center;font-size:11px;"></td>
        <td style="padding:6px 9px;text-align:center;font-size:11px;">${fmt(resultat.total_points)}</td>
        <td style="padding:6px 9px;"></td>
      </tr>` : '';

  const rangHtml = rangTexte ? `
    <div style="background:#1a3c5e;color:#fff;padding:8px 16px;border-radius:6px;
                text-align:center;min-width:110px;">
      <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Rang</div>
      <div style="font-size:18px;font-weight:700;margin-top:1px;">${rangTexte}</div>
    </div>` : '';

  const classMoyHtml = classMoyenne !== null ? `
    <div style="background:#e8f5e9;border:1px solid #a5d6a7;padding:8px 16px;
                border-radius:6px;text-align:center;min-width:130px;">
      <div style="font-size:10px;color:#2e7d32;text-transform:uppercase;letter-spacing:1px;">Moy. classe</div>
      <div style="font-size:18px;font-weight:700;color:#2e7d32;margin-top:1px;">${fmt(classMoyenne)}/20</div>
    </div>` : '';

  const appreciationGeneraleHtml = (isPrimaire && resultat?.appreciation_generale) ? `
    <div style="background:#fff;border:2px solid ${APPRECIATION_COLOR[resultat.appreciation_generale]};
                padding:8px 16px;border-radius:6px;text-align:center;min-width:150px;">
      <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Appréciation</div>
      <div style="margin-top:3px;">${appreciationHtml(resultat.appreciation_generale, 14)}</div>
    </div>` : '';

  const periodeLabel = periode || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

  const html = `
    <div style="font-family:Arial,sans-serif;padding:12px 16px;color:#111;
                max-width:700px;margin:0 auto;box-sizing:border-box;">

      ${buildEtabHeader(etabData, logoBase64, `BULLETIN DE NOTES — ${periodeLabel}`, '#2e7d32')}

      <!-- Infos élève -->
      <div style="display:flex;align-items:flex-start;gap:12px;
                  background:#f5f5f5;padding:8px 12px;border-radius:6px;
                  margin-bottom:10px;border-left:4px solid #2e7d32;">
        <div style="flex:1;">
          <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Élève</div>
          <div style="font-size:14px;font-weight:700;">${nomComplet}</div>
          <div style="font-size:11px;color:#666;">Matricule : ${etudiant?.mle_etudiant || resultat?.mle_etudiant || '—'}</div>
          <div style="font-size:11px;color:#2e7d32;font-weight:600;margin-top:3px;">
            Moyenne : ${fmt(moyenneGenerale)}/20${isPrimaire && resultat?.appreciation_generale ? ` (${resultat.appreciation_generale})` : ''}
          </div>
        </div>
        <div style="text-align:right;flex:1;">
          <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Classe</div>
          <div style="font-size:13px;font-weight:700;">${classeLib}</div>
          <div style="font-size:11px;color:#666;">Date : ${today}</div>
          ${rangTexte ? `<div style="font-size:11px;color:#1a3c5e;font-weight:600;margin-top:3px;">Rang : ${rangTexte}</div>` : ''}
        </div>
        <div style="flex-shrink:0;">${photoHtml}</div>
      </div>

      <!-- Tableau des matières -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:#2e7d32;color:#fff;">
            <th style="padding:7px 9px;text-align:left;font-size:11px;">Matière</th>
            <th style="padding:7px 9px;text-align:center;font-size:11px;">Nb éval.</th>
            <th style="padding:7px 9px;text-align:center;font-size:11px;">${poidsLabel}</th>
            <th style="padding:7px 9px;text-align:center;font-size:11px;">Moyenne</th>
            ${isPreBac ? '<th style="padding:7px 9px;text-align:center;font-size:11px;">Points</th>' : ''}
            <th style="padding:7px 9px;text-align:center;font-size:11px;">Appréciation</th>
          </tr>
        </thead>
        <tbody>${lignesMatieres}${totauxHtml}</tbody>
      </table>

      <!-- Statistiques -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:12px;align-items:stretch;">
        ${classMoyHtml}
        ${rangHtml}
        ${appreciationGeneraleHtml}
        <div style="background:#2e7d32;color:#fff;padding:8px 18px;
                    border-radius:6px;text-align:center;min-width:130px;">
          <div style="font-size:10px;opacity:.85;text-transform:uppercase;letter-spacing:1px;">Ma moyenne</div>
          <div style="font-size:22px;font-weight:700;margin-top:2px;">${fmt(moyenneGenerale)}/20</div>
        </div>
      </div>

      <!-- Signature -->
      <div style="padding-top:10px;border-top:1px solid #ddd;margin-top:2px;text-align:center;">
        <p style="font-size:11px;color:#666;margin:0 0 24px;">${chefSignatureBulletin}</p>
        <div style="border-top:1px solid #aaa;padding-top:3px;font-size:10px;color:#aaa;
                    max-width:220px;margin:0 auto;">Signature et cachet</div>
      </div>

      <!-- Pied de page -->
      <div style="text-align:center;margin-top:10px;font-size:9px;color:#bbb;">
        Généré le ${today} à ${heureStr} — SMS v2.0
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `bulletin_${etudiant?.mle_etudiant || resultat?.mle_etudiant || 'eleve'}.pdf`, { scale: 1.5 });
  document.body.removeChild(el);
  return result;
};

// ── Reçu de paiement ──────────────────────────────────────────────────────────
export const generateRecu = async (paiement, user, etab) => {
  // Établissement (paramètre ou localStorage)
  const etabData   = etab || getEtabFromStorage();
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;

  const nomComplet = `${paiement?.nom_etudiant || ''} ${paiement?.prenom_etudiant || ''}`.trim() || '—';
  const matricule  = typeof paiement?.mle_etudiant === 'object'
    ? paiement.mle_etudiant?.mle_etudiant
    : paiement?.mle_etudiant || '—';

  const TYPE_MOTIFS = {
    SCOLARITE:          `Frais de scolarité${paiement?.lib_tranche ? ' — ' + paiement.lib_tranche : ''}`,
    INSCRIPTION:        "Frais d'inscription",
    EXAMEN_BTS:         "Frais d'examen BTS",
    SOUTENANCE_BTS:     'Frais de soutenance BTS',
    SOUTENANCE_LICENCE: 'Frais de soutenance Licence',
    SOUTENANCE_MASTER:  'Frais de soutenance Master',
  };
  const TYPE_TOTAL_LABEL = {
    SCOLARITE:   'Scolarité totale',
    INSCRIPTION: "Frais d'inscription (total)",
  };

  const typePaiement = paiement?.type_paiement || 'SCOLARITE';
  const showTotaux   = ['SCOLARITE', 'INSCRIPTION'].includes(typePaiement);
  const motif        = TYPE_MOTIFS[typePaiement] || typePaiement;
  const labelTotal   = TYPE_TOTAL_LABEL[typePaiement] || 'Total';
  const labelReste   = typePaiement === 'INSCRIPTION' ? 'Reste à payer (inscription)' : 'Reste à payer (scolarité totale)';

  const mtPaye      = Number(paiement?.mt_paiement || 0);
  const mtTotal     = showTotaux ? Number(paiement?.mt_total   || 0) : 0;
  const totalPaye   = showTotaux ? Number(paiement?.total_paye || 0) : 0;
  const resteAPayer = mtTotal > 0 ? Math.max(mtTotal - totalPaye, 0) : 0;

  const rawDate  = paiement?.date_paiement?.slice(0, 10);
  const dateStr  = rawDate
    ? new Date(rawDate + 'T00:00:00').toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const etabliPar = user?.nom_user || user?.login || '—';
  const numRecu   = `PAY-${String(paiement?.code_paiement || '0').padStart(4, '0')}`;

  const row = (label, value, bold = false) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                padding:9px 0;border-bottom:1px solid #f0f0f0;">
      <span style="color:#666;font-size:12px;min-width:140px;">${label}</span>
      <span style="font-size:13px;${bold ? 'font-weight:bold;' : ''}text-align:right;">${value}</span>
    </div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;padding:30px;color:#111;max-width:620px;margin:0 auto;">

      ${buildEtabHeader(etabData, logoBase64, 'REÇU DE PAIEMENT', '#2e7d32')}

      <!-- N° reçu + date -->
      <div style="display:flex;justify-content:space-between;margin-bottom:18px;font-size:12px;color:#555;">
        <div><strong>N° Reçu :</strong> ${numRecu}</div>
        <div><strong>Date :</strong> ${dateStr} &nbsp;|&nbsp; <strong>Heure d'émission :</strong> ${heureStr}</div>
      </div>

      <!-- Bloc étudiant -->
      <div style="background:#f0f7f0;border-left:4px solid #2e7d32;border-radius:4px;
                  padding:12px 16px;margin-bottom:18px;">
        <div style="font-size:11px;color:#2e7d32;font-weight:700;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:8px;">Informations étudiant</div>
        ${row('Matricule', matricule, true)}
        ${row('Nom complet', nomComplet, true)}
        ${row('Niveau / Classe', paiement?.lib_classe || '—')}
        ${row('Filière', paiement?.lib_dep || '—')}
        ${row('Spécialité', paiement?.lib_sp || '—')}
      </div>

      <!-- Bloc paiement -->
      <div style="background:#f9f9f9;border:1px solid #ddd;border-radius:8px;
                  padding:16px 18px;margin-bottom:18px;">
        <div style="font-size:11px;color:#555;font-weight:700;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:8px;">Détails du paiement</div>
        ${row('Motif', motif)}
        ${row('Année scolaire', paiement?.lib_annee || paiement?.code_annee || '—')}
        ${paiement?.obs_paiement ? row('Observations', paiement.obs_paiement) : ''}
        ${mtTotal > 0 ? row(labelTotal, `${mtTotal.toLocaleString('fr-FR')} FCFA`) : ''}
        ${mtTotal > 0 ? row('Total déjà payé', `${totalPaye.toLocaleString('fr-FR')} FCFA`) : ''}
        <div style="display:flex;justify-content:space-between;align-items:baseline;
                    padding:11px 0 0;margin-top:6px;border-top:2px solid #2e7d32;">
          <span style="font-size:14px;font-weight:bold;color:#2e7d32;">MONTANT PAYÉ</span>
          <span style="font-size:20px;font-weight:bold;color:#2e7d32;">
            ${mtPaye.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        ${mtTotal > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:baseline;
                    padding:6px 0 0;margin-top:4px;">
          <span style="font-size:12px;font-weight:600;
                       color:${resteAPayer > 0 ? '#c62828' : '#2e7d32'};">${labelReste}</span>
          <span style="font-size:14px;font-weight:bold;
                       color:${resteAPayer > 0 ? '#c62828' : '#2e7d32'};">
            ${resteAPayer.toLocaleString('fr-FR')} FCFA
          </span>
        </div>` : ''}
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:36px;gap:20px;">
        <div style="text-align:center;flex:1;border:1px solid #e0e0e0;border-radius:6px;padding:14px;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Encaissé par</div>
          <div style="font-size:13px;font-weight:bold;margin-bottom:44px;">${etabliPar}</div>
          <div style="border-top:1px solid #bbb;padding-top:4px;font-size:10px;color:#aaa;">Signature et cachet</div>
        </div>
        <div style="text-align:center;flex:1;border:1px solid #e0e0e0;border-radius:6px;padding:14px;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Paiement effectué par</div>
          <div style="font-size:13px;font-weight:bold;margin-bottom:44px;">${nomComplet}</div>
          <div style="border-top:1px solid #bbb;padding-top:4px;font-size:10px;color:#aaa;">Signature du payeur</div>
        </div>
      </div>

      <!-- Pied de page -->
      <div style="text-align:center;margin-top:22px;padding-top:12px;
                  border-top:1px solid #eee;font-size:10px;color:#aaa;">
        Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${heureStr} — SMS v2.0
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `recu_paiement_${paiement?.code_paiement || 'xxx'}.pdf`);
  document.body.removeChild(el);
  return result;
};

// ── Certificat de scolarité du primaire ──────────────────────────────────────
// Modèle des écoles primaires camerounaises (« School attendance certificate / Certificat de
// scolarité ») : la directrice ou le directeur atteste que l'élève, né(e) le … à …, fils/fille
// de … et de …, est inscrit(e) en classe de … pour l'année scolaire …. La langue suit le
// système de l'école : bilingue = anglais avec le français en italique dessous, comme sur les
// certificats papier ; francophone ou anglophone = une seule langue.
const generateCertificatPrimaire = async (etudiant, inscription, etabData, user) => {
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;
  const systeme = etabData?.systeme || 'FRANCOPHONE';
  const fille   = etudiant?.sexe === 'F';
  const fmtDate = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : '……………');
  const vide    = '……………………………………';

  // Libellé d'une rubrique selon la langue de l'école.
  const rubrique = (en, fr) => {
    if (systeme === 'ANGLOPHONE') return `<div style="font-size:12px;color:#333;">${en}</div>`;
    if (systeme === 'FRANCOPHONE') return `<div style="font-size:12px;color:#333;">${fr}</div>`;
    return `<div style="font-size:12px;color:#333;">${en}</div>
            <div style="font-size:11px;color:#555;font-style:italic;">${fr}</div>`;
  };
  const ligne = (en, fr, valeur, grand = false) => `
    <div style="display:flex;align-items:flex-end;gap:16px;margin:0 0 16px;">
      <div style="width:190px;flex-shrink:0;">${rubrique(en, fr)}</div>
      <div style="flex:1;border-bottom:1px dotted #999;padding-bottom:2px;font-family:'Times New Roman',serif;
                  font-size:${grand ? 17 : 15}px;${grand ? 'font-weight:700;letter-spacing:.5px;' : ''}color:#0b2a55;">
        ${valeur || vide}
      </div>
    </div>`;

  const nomComplet = `${etudiant?.nom || ''} ${etudiant?.prenom || ''}`.trim().toUpperCase();
  const directeur  = etabData?.directeur || '';
  const etabNom    = etabData?.lib_etab || '';
  const ville      = etabData?.ville || '';
  const classe     = inscription?.lib_classe || inscription?.code_classe || '';
  const annee      = (inscription?.code_annee || inscription?.lib_annee || '').toString().replace('-', '/');
  const aujourdhui = new Date().toLocaleDateString('fr-FR');
  const coordonnees = [etabData?.adresse, ville, etabData?.telephone || etabData?.tel, etabData?.email]
    .filter(Boolean).join('  •  ');

  const titre = systeme === 'ANGLOPHONE' ? ['SCHOOL ATTENDANCE CERTIFICATE', '']
    : systeme === 'FRANCOPHONE' ? ['CERTIFICAT DE SCOLARITÉ', '']
    : ['SCHOOL ATTENDANCE CERTIFICATE', 'CERTIFICAT DE SCOLARITÉ'];
  const phrase = (en, fr) => systeme === 'ANGLOPHONE' ? `<div>${en}</div>`
    : systeme === 'FRANCOPHONE' ? `<div>${fr}</div>`
    : `<div>${en}</div><div style="font-style:italic;color:#444;">${fr}</div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;padding:34px 44px;color:#111;background:#fff;width:700px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:18px;border-bottom:3px solid #1F3864;padding-bottom:12px;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:78px;max-width:110px;object-fit:contain;" />` : ''}
        <div style="flex:1;text-align:center;">
          <div style="font-size:19px;font-weight:800;color:#1F3864;text-transform:uppercase;letter-spacing:.5px;">${etabNom}</div>
          ${etabData?.sigle ? `<div style="font-size:12px;font-weight:700;color:#2E74B5;">(${etabData.sigle})</div>` : ''}
          ${coordonnees ? `<div style="font-size:10px;color:#555;margin-top:3px;">${coordonnees}</div>` : ''}
        </div>
      </div>
      ${etabData?.devise ? `<div style="background:#1F3864;color:#fff;text-align:center;font-size:11px;font-weight:700;
                                        letter-spacing:1px;text-transform:uppercase;padding:4px 8px;">${etabData.devise}</div>` : ''}

      <div style="text-align:center;margin:26px 0 30px;">
        <div style="font-size:15px;font-weight:700;text-decoration:underline;letter-spacing:1px;">${titre[0]}</div>
        ${titre[1] ? `<div style="font-size:15px;font-style:italic;font-family:'Times New Roman',serif;margin-top:4px;">${titre[1]}</div>` : ''}
      </div>

      ${ligne('I, the undersigned', 'Je soussigné(e)', directeur)}
      ${ligne('Head teacher of', 'Directeur (Directrice) de', etabNom)}
      ${ligne('Certify that', 'Atteste que', nomComplet, true)}
      ${ligne(`Born on`, fille ? 'Née le' : 'Né le',
              `${fmtDate(etudiant?.date_naiss)} &nbsp;<span style="font-family:Arial;font-size:12px;color:#333;">${
                systeme === 'FRANCOPHONE' ? 'à' : systeme === 'ANGLOPHONE' ? 'at' : 'at / à'}</span>&nbsp; ${etudiant?.lieu || '……………'}`)}
      ${ligne('Admission N°', 'N° de matricule', etudiant?.mle_etudiant)}
      ${ligne(fille ? 'Daughter of' : 'Son of', fille ? 'Fille de' : 'Fils de', etudiant?.nom_pere)}
      ${ligne('And of', 'Et de', etudiant?.nom_mere)}
      ${ligne('Is (was) a pupil in class', `Est (a été) régulièrement inscrit${fille ? 'e' : ''} en classe de`, classe)}
      ${ligne('For the academic year', "Pour l'année scolaire", annee)}

      <div style="font-size:12px;line-height:1.6;margin:22px 0 26px;">
        ${phrase('This attendance certificate is issued to serve where ever need be.',
                 'En foi de quoi nous lui délivrons le présent certificat de scolarité pour servir et valoir ce que de droit.')}
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <div style="text-align:center;width:300px;">
          <div style="font-size:13px;margin-bottom:6px;">
            ${systeme === 'ANGLOPHONE' ? `${ville}, the ${aujourdhui}` : systeme === 'FRANCOPHONE' ? `Fait à ${ville}, le ${aujourdhui}`
              : `${ville}, the / le ${aujourdhui}`}
          </div>
          <div style="font-size:12px;font-weight:700;">
            ${systeme === 'ANGLOPHONE' ? 'The Head Teacher' : systeme === 'FRANCOPHONE' ? 'Le Directeur / La Directrice'
              : 'The Head Teacher / Le Directeur (La Directrice)'}
          </div>
          <div style="height:90px;"></div>
          <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#666;">
            ${directeur ? `${directeur} — ` : ''}${systeme === 'ANGLOPHONE' ? 'Signature and stamp' : 'Signature et cachet'}
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:26px;padding-top:8px;border-top:1px solid #eee;font-size:9px;color:#aaa;">
        CERT-${etudiant?.mle_etudiant || ''}-${new Date().getFullYear()} — ${user?.nom_user || user?.login || ''} — SMS
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `certificat_scolarite_${etudiant?.mle_etudiant || 'eleve'}.pdf`);
  document.body.removeChild(el);
  return result;
};

// ── Certificat de scolarité ───────────────────────────────────────────────────
export const generateCertificatScolarite = async (etudiant, inscription, etablissement, user) => {
  const etabData   = etablissement || getEtabFromStorage();
  if (etabData?.type_etab === 'PRIMAIRE') return generateCertificatPrimaire(etudiant, inscription, etabData, user);
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;

  const nom       = `${etudiant?.nom || ''} ${etudiant?.prenom || ''}`.trim();
  const matricule = etudiant?.mle_etudiant || '—';
  const classe    = inscription?.lib_classe || inscription?.code_classe || '—';
  const annee     = inscription?.lib_annee  || inscription?.code_annee  || '—';
  const dateNaiss = etudiant?.date_naiss
    ? new Date(etudiant.date_naiss + 'T00:00:00').toLocaleDateString('fr-FR')
    : '—';
  const lieuNaiss  = etudiant?.lieu || '—';
  const numCert    = `CERT-${matricule}-${new Date().getFullYear()}`;
  const dateEmis   = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const etabNom    = etabData?.lib_etab || 'L\'établissement';
  const etabVille  = etabData?.ville    || '';
  const directeur  = etabData?.directeur || '________________';
  const emetteur   = user?.nom_user || user?.login || '—';
  const typeEtabCert   = etabData?.type_etab || 'SUPERIEUR';
  const chefFonction   = getChefEtabLabel(typeEtabCert, 'fonction');
  const chefSignature  = getChefEtabLabel(typeEtabCert, 'signature');

  const certCoordonnees = [etabData?.adresse, etabData?.ville, etabData?.telephone || etabData?.tel_etab, etabData?.email]
    .filter(Boolean).join('  •  ');

  const html = `
    <div style="font-family:Arial,sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto;">

      <!-- En-tête centré avec logo au-dessus du texte -->
      <div style="text-align:center;border-bottom:3px solid #1a3c5e;padding-bottom:14px;margin-bottom:16px;">
        ${logoBase64 ? `<div style="margin-bottom:10px;"><img src="${logoBase64}" alt="Logo"
          style="height:80px;max-width:160px;object-fit:contain;" /></div>` : ''}
        ${etabData?.sigle ? `<div style="font-size:10px;color:#1a3c5e;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:2px;">${etabData.sigle}</div>` : ''}
        <div style="font-size:16px;font-weight:800;color:#1a3c5e;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">${etabNom}</div>
        ${etabData?.devise ? `<div style="font-size:10px;font-style:italic;color:#1a3c5e;margin-bottom:3px;">${etabData.devise}</div>` : ''}
        ${certCoordonnees ? `<div style="font-size:10px;color:#666;margin-bottom:6px;">${certCoordonnees}</div>` : ''}
        <div style="font-size:13px;font-weight:700;color:#333;letter-spacing:2px;text-transform:uppercase;">CERTIFICAT DE SCOLARITÉ</div>
      </div>

      <!-- Numéro + date -->
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:28px;">
        <span><strong>N° :</strong> ${numCert}</span>
        <span><strong>Délivré le :</strong> ${dateEmis}</span>
      </div>

      <!-- Corps -->
      <p style="font-size:14px;line-height:1.9;color:#222;text-align:justify;">
        Je soussigné(e), <strong>${directeur}</strong>, ${chefFonction} de
        <strong>${etabNom}</strong>${etabVille ? ` à <strong>${etabVille}</strong>` : ''}, certifie que l'étudiant(e) :
      </p>

      <!-- Bloc étudiant -->
      <div style="background:#f4f8fc;border-left:5px solid #1a3c5e;border-radius:4px;
                  padding:18px 24px;margin:20px 0;font-size:14px;line-height:2;">
        <div><strong>Nom et Prénom :</strong> &nbsp; ${nom.toUpperCase()}</div>
        <div><strong>Matricule :</strong> &nbsp; ${matricule}</div>
        <div><strong>Date de naissance :</strong> &nbsp; ${dateNaiss} à ${lieuNaiss}</div>
        <div><strong>Classe :</strong> &nbsp; ${classe}</div>
        <div><strong>Année académique :</strong> &nbsp; ${annee}</div>
      </div>

      <p style="font-size:14px;line-height:1.9;color:#222;text-align:justify;margin-bottom:30px;">
        est régulièrement inscrit(e) dans notre établissement pour l'année académique
        <strong>${annee}</strong>, et suit les cours à plein temps.
      </p>

      <p style="font-size:14px;color:#222;font-style:italic;text-align:justify;margin-bottom:40px;">
        En foi de quoi le présent document est établi pour servir et valoir ce que de droit.
      </p>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:50px;">
        <div style="text-align:center;width:45%;">
          <p style="font-size:12px;color:#444;margin-bottom:4px;">L'étudiant(e)</p>
          <div style="height:60px;"></div>
          <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#aaa;">Signature</div>
        </div>
        <div style="text-align:center;width:45%;">
          <p style="font-size:12px;color:#444;margin-bottom:4px;">${chefSignature}</p>
          <div style="height:60px;"></div>
          <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#aaa;">
            ${directeur} — Signature et cachet
          </div>
        </div>
      </div>

      <!-- Pied de page -->
      <div style="text-align:center;margin-top:30px;padding-top:12px;
                  border-top:1px solid #eee;font-size:10px;color:#bbb;">
        Document généré le ${dateEmis} par ${emetteur} — SMS v2.0
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `certificat_scolarite_${matricule}.pdf`);
  document.body.removeChild(el);
  return result;
};

// ── Liste de classe ───────────────────────────────────────────────────────────
export const generateListeClasse = async (classe, etudiants, etab) => {
  const etabData   = etab || getEtabFromStorage();
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;

  const classeLib = classe?.lib_classe || classe?.code_classe || '';
  const today     = new Date().toLocaleDateString('fr-FR');
  const heureStr  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family:Arial,sans-serif;padding:20px;color:#111;">

      ${buildEtabHeader(etabData, logoBase64, `LISTE DE CLASSE — ${classeLib}`, '#2e7d32')}

      <p style="font-size:12px;color:#666;margin:0 0 16px;text-align:center;">
        ${etudiants.length} étudiant(s) inscrit(s)
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#2e7d32;color:#fff;">
            <th style="padding:8px 10px;text-align:center;width:40px;">N°</th>
            <th style="padding:8px 10px;text-align:left;">Matricule</th>
            <th style="padding:8px 10px;text-align:left;">Nom et Prénom</th>
            <th style="padding:8px 10px;text-align:left;">Date naissance</th>
            <th style="padding:8px 10px;text-align:left;">Téléphone</th>
          </tr>
        </thead>
        <tbody>
          ${etudiants.map((e, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'};border-bottom:1px solid #eee;">
              <td style="padding:7px 10px;text-align:center;color:#666;">${i + 1}</td>
              <td style="padding:7px 10px;font-weight:500;">${e.mle_etudiant || '—'}</td>
              <td style="padding:7px 10px;">${e.nom || ''} ${e.prenom || ''}</td>
              <td style="padding:7px 10px;color:#666;">${e.date_naiss?.slice(0, 10) || '—'}</td>
              <td style="padding:7px 10px;color:#666;">${e.tel || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="text-align:center;margin-top:20px;font-size:10px;color:#aaa;">
        Imprimé le ${today} à ${heureStr} — SMS v2.0
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = await exportSinglePage(el, `liste_${classe?.code_classe || 'classe'}.pdf`);
  document.body.removeChild(el);
  return result;
};
