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

// ── Bulletin de notes ─────────────────────────────────────────────────────────
export const generateBulletin = async (etudiant, evaluations, periode, etab, options = {}) => {
  const { classMoyenne = null, rang = null, totalEleves = null, creditsMap = {} } = options;

  // Établissement (paramètre ou localStorage)
  const etabData   = etab || getEtabFromStorage();
  const logoBase64 = etabData?.logo ? await fetchPhotoBase64(etabData.logo) : null;

  // Photo de profil étudiant
  const photoBase64 = etudiant?.photo_url ? await fetchPhotoBase64(etudiant.photo_url) : null;
  const photoHtml   = photoBase64
    ? `<img src="${photoBase64}" alt="Photo"
           style="width:99px;height:127px;object-fit:cover;display:block;border:1px solid #111;" />`
    : `<div style="width:99px;height:127px;display:flex;align-items:center;
                   justify-content:center;border:1px solid #999;
                   background:#f9f9f9;font-size:10px;color:#aaa;">Photo</div>`;

  const classeLib = etudiant?.lib_classe
    || etudiant?.classe
    || evaluations[0]?.lib_classe
    || (typeof evaluations[0]?.code_classe === 'object' ? evaluations[0]?.code_classe?.lib_classe : null)
    || '—';

  const nomComplet = [(etudiant?.nom || '').toUpperCase(), etudiant?.prenom || '']
    .filter(Boolean).join(' ');

  const today    = new Date().toLocaleDateString('fr-FR');
  const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const showCredits = Object.keys(creditsMap).length > 0;
  const typeEtabBulletin = etabData?.type_etab || 'SUPERIEUR';
  const chefSignatureBulletin = typeEtabBulletin === 'SUPERIEUR'
    ? `${getChefEtabLabel(typeEtabBulletin, 'signature')} des Études`
    : getChefEtabLabel(typeEtabBulletin, 'signature');

  // Primaire réformé : évaluation par compétences (A/ECA/NA) — pas de notation chiffrée,
  // donc ni moyenne, ni rang, ni mention numérique dans ce bulletin (voir doc de référence
  // système éducatif camerounais). Détecté depuis l'établissement, pas depuis les données,
  // pour rester cohérent même si un étudiant primaire n'a encore aucune évaluation saisie.
  const isPrimaire = typeEtabBulletin === 'PRIMAIRE';
  const APPRECIATION_LABEL = { A: 'Acquis', ECA: "En cours d'acquisition", NA: 'Non acquis' };
  const APPRECIATION_COLOR = { A: '#1b5e20', ECA: '#e65100', NA: '#b71c1c' };

  // Regroupement par matière — conserve les évaluations (note ou appréciation) dans l'ordre.
  const matieres = {};
  evaluations.forEach(e => {
    const lib = e.lib_matiere || e.code_matiere?.lib_matiere || 'Matière';
    if (!matieres[lib]) matieres[lib] = [];
    matieres[lib].push(e);
  });

  const moyenneGenerale = (!isPrimaire && evaluations.length > 0)
    ? (evaluations.reduce((s, e) => s + parseFloat(e.note), 0) / evaluations.length).toFixed(2)
    : '—';

  // Répartition A/ECA/NA (primaire) — l'appréciation la plus récente sert de bilan par
  // matière, mais le résumé global porte sur toutes les évaluations de la période.
  const repartition = { A: 0, ECA: 0, NA: 0 };
  if (isPrimaire) {
    evaluations.forEach(e => { if (e.appreciation) repartition[e.appreciation]++; });
  }

  const lignesMatieres = Object.entries(matieres).map(([mat, evals], i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
    if (isPrimaire) {
      // Appréciation la plus récente (par date d'évaluation) pour cette matière.
      const derniere = [...evals].sort((a, b) => (a.date_eval || '').localeCompare(b.date_eval || ''))
        .at(-1);
      const appre = derniere?.appreciation || null;
      const color = appre ? APPRECIATION_COLOR[appre] : '#999';
      return `
        <tr style="background:${bg};border-bottom:1px solid #eee;">
          <td style="padding:5px 9px;font-size:11px;">${mat}</td>
          <td style="padding:5px 9px;text-align:center;color:#777;font-size:11px;">${evals.length}</td>
          <td style="padding:5px 9px;text-align:center;font-weight:700;color:${color};font-size:12px;">${appre || '—'}</td>
          <td style="padding:5px 9px;text-align:center;color:${color};font-size:11px;">${appre ? APPRECIATION_LABEL[appre] : '—'}</td>
        </tr>`;
    }
    const notes   = evals.map(e => parseFloat(e.note));
    const moy     = (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2);
    const appre   = moy >= 16 ? 'Très Bien' : moy >= 14 ? 'Bien' : moy >= 12 ? 'Assez Bien' : moy >= 10 ? 'Passable' : 'Insuffisant';
    const color   = moy >= 10 ? '#1b5e20' : '#b71c1c';
    const credits = creditsMap[mat] != null ? creditsMap[mat] : '—';
    return `
      <tr style="background:${bg};border-bottom:1px solid #eee;">
        <td style="padding:5px 9px;font-size:11px;">${mat}</td>
        <td style="padding:5px 9px;text-align:center;color:#777;font-size:11px;">${notes.length}</td>
        ${showCredits ? `<td style="padding:5px 9px;text-align:center;color:#555;font-size:11px;">${credits}</td>` : ''}
        <td style="padding:5px 9px;text-align:center;font-weight:700;color:${color};font-size:12px;">${moy}/20</td>
        <td style="padding:5px 9px;text-align:center;color:${color};font-size:11px;">${appre}</td>
      </tr>`;
  }).join('');

  // Rang / moyenne de classe : sans objet en évaluation par compétences (pas de notation
  // chiffrée à classer) — ignorés même si transmis par appel précédent.
  const rangHtml = (!isPrimaire && rang !== null && totalEleves !== null)
    ? `<div style="background:#1a3c5e;color:#fff;padding:8px 16px;border-radius:6px;
                   text-align:center;min-width:110px;">
         <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Rang</div>
         <div style="font-size:20px;font-weight:700;margin-top:1px;">${rang}<sup style="font-size:11px;vertical-align:super;opacity:.8;">e</sup><span style="font-size:13px;opacity:.7;">/${totalEleves}</span></div>
       </div>` : '';

  const classMoyHtml = (!isPrimaire && classMoyenne !== null)
    ? `<div style="background:#e8f5e9;border:1px solid #a5d6a7;padding:8px 16px;
                   border-radius:6px;text-align:center;min-width:130px;">
         <div style="font-size:10px;color:#2e7d32;text-transform:uppercase;letter-spacing:1px;">Moy. classe</div>
         <div style="font-size:18px;font-weight:700;color:#2e7d32;margin-top:1px;">${classMoyenne}/20</div>
       </div>` : '';

  // Bilan global (primaire) : répartition A/ECA/NA à la place du bloc "Ma moyenne".
  const bilanCompetencesHtml = isPrimaire
    ? `<div style="background:#1a3c5e;color:#fff;padding:8px 18px;border-radius:6px;
                   text-align:center;min-width:200px;display:flex;gap:14px;align-items:center;">
         ${['A', 'ECA', 'NA'].map(a => `
           <div>
             <div style="font-size:9px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">${a}</div>
             <div style="font-size:18px;font-weight:700;margin-top:1px;">${repartition[a]}</div>
           </div>`).join('')}
       </div>` : '';

  const periodeLabel = periode || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

  const html = `
    <div style="font-family:Arial,sans-serif;padding:12px 16px;color:#111;
                max-width:700px;margin:0 auto;box-sizing:border-box;">

      ${buildEtabHeader(etabData, logoBase64, `${isPrimaire ? "BULLETIN D'ÉVALUATION" : 'BULLETIN DE NOTES'} — ${periodeLabel}`, '#2e7d32')}

      <!-- Infos étudiant -->
      <div style="display:flex;align-items:flex-start;gap:12px;
                  background:#f5f5f5;padding:8px 12px;border-radius:6px;
                  margin-bottom:10px;border-left:4px solid #2e7d32;">
        <div style="flex:1;">
          <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Élève</div>
          <div style="font-size:14px;font-weight:700;">${nomComplet}</div>
          <div style="font-size:11px;color:#666;">Matricule : ${etudiant?.mle_etudiant || '—'}</div>
          ${!isPrimaire ? `<div style="font-size:11px;color:#2e7d32;font-weight:600;margin-top:3px;">
            Moyenne : ${moyenneGenerale}/20
          </div>` : ''}
        </div>
        <div style="text-align:right;flex:1;">
          <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Classe</div>
          <div style="font-size:13px;font-weight:700;">${classeLib}</div>
          <div style="font-size:11px;color:#666;">Date : ${today}</div>
          ${(!isPrimaire && rang !== null) ? `<div style="font-size:11px;color:#1a3c5e;font-weight:600;margin-top:3px;">Rang : ${rang}<sup>e</sup>${totalEleves ? '/' + totalEleves : ''}</div>` : ''}
        </div>
        <div style="flex-shrink:0;">${photoHtml}</div>
      </div>

      <!-- Tableau des évaluations -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:#2e7d32;color:#fff;">
            <th style="padding:7px 9px;text-align:left;font-size:11px;">Matière</th>
            <th style="padding:7px 9px;text-align:center;font-size:11px;">Nb éval.</th>
            ${(showCredits && !isPrimaire) ? '<th style="padding:7px 9px;text-align:center;font-size:11px;">Crédits</th>' : ''}
            <th style="padding:7px 9px;text-align:center;font-size:11px;">${isPrimaire ? 'Compétence' : 'Moy. matière'}</th>
            <th style="padding:7px 9px;text-align:center;font-size:11px;">Appréciation</th>
          </tr>
        </thead>
        <tbody>${lignesMatieres}</tbody>
      </table>

      <!-- Statistiques -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:12px;align-items:stretch;">
        ${classMoyHtml}
        ${rangHtml}
        ${isPrimaire ? bilanCompetencesHtml : `
        <div style="background:#2e7d32;color:#fff;padding:8px 18px;
                    border-radius:6px;text-align:center;min-width:130px;">
          <div style="font-size:10px;opacity:.85;text-transform:uppercase;letter-spacing:1px;">Ma moyenne</div>
          <div style="font-size:22px;font-weight:700;margin-top:2px;">${moyenneGenerale}/20</div>
        </div>`}
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
  const result = await exportSinglePage(el, `bulletin_${etudiant?.mle_etudiant || 'etudiant'}.pdf`, { scale: 1.5 });
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

// ── Certificat de scolarité ───────────────────────────────────────────────────
export const generateCertificatScolarite = async (etudiant, inscription, etablissement, user) => {
  const etabData   = etablissement || getEtabFromStorage();
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
