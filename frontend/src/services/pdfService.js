/**
 * services/pdfService.js
 * Service d'export PDF utilisant html2pdf.js (chargé depuis CDN).
 * Génère : bulletins de notes, reçus de paiement, listes de classe.
 *
 * Installation requise :
 * npm install html2pdf.js
 */

// ── Chargeur dynamique de html2pdf ────────────────────────────────────────────
const loadHtml2Pdf = () => {
  return new Promise((resolve) => {
    if (window.html2pdf) { resolve(window.html2pdf); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve(window.html2pdf);
    document.head.appendChild(script);
  });
};

// ── Options par défaut ────────────────────────────────────────────────────────
const DEFAULT_OPTIONS = {
  margin:       [10, 10, 10, 10],
  image:        { type: 'jpeg', quality: 0.98 },
  html2canvas:  { scale: 2, useCORS: true },
  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
};

// ── Export générique d'un élément HTML ────────────────────────────────────────
export const exportToPDF = async (element, filename = 'export.pdf', options = {}) => {
  const html2pdf = await loadHtml2Pdf();
  await html2pdf()
    .set({ ...DEFAULT_OPTIONS, ...options, filename })
    .from(element)
    .save();
};

// ── Bulletin de notes ─────────────────────────────────────────────────────────
export const generateBulletin = async (etudiant, evaluations, periode) => {
  const html2pdf = await loadHtml2Pdf();

  const matieres = {};
  evaluations.forEach(e => {
    const lib = e.lib_matiere || e.code_matiere?.lib_matiere || 'Matière';
    if (!matieres[lib]) matieres[lib] = [];
    matieres[lib].push(parseFloat(e.note));
  });

  const moyenneGenerale = evaluations.length > 0
    ? (evaluations.reduce((s, e) => s + parseFloat(e.note), 0) / evaluations.length).toFixed(2)
    : '—';

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 800px; margin: 0 auto;">
      <!-- En-tête -->
      <div style="text-align: center; border-bottom: 3px solid #2e7d32; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="font-size: 22px; color: #2e7d32; margin: 0 0 4px;">SYSTÈME DE MANAGEMENT SCOLAIRE</h1>
        <h2 style="font-size: 16px; margin: 0; color: #444;">BULLETIN DE NOTES</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #666;">${periode || 'Année académique 2025/2026'}</p>
      </div>

      <!-- Infos étudiant -->
      <div style="display: flex; justify-content: space-between; background: #f5f5f5; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 12px; color: #666;">Étudiant</div>
          <div style="font-size: 15px; font-weight: bold;">${etudiant?.nom || ''} ${etudiant?.prenom || ''}</div>
          <div style="font-size: 12px; color: #666;">Matricule : ${etudiant?.mle_etudiant || '—'}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #666;">Classe</div>
          <div style="font-size: 14px; font-weight: bold;">${etudiant?.classe || '—'}</div>
          <div style="font-size: 12px; color: #666;">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>

      <!-- Tableau des notes -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
          <tr style="background: #2e7d32; color: white;">
            <th style="padding: 10px 12px; text-align: left; border-radius: 4px 0 0 0;">Matière</th>
            <th style="padding: 10px 12px; text-align: center;">Nb éval.</th>
            <th style="padding: 10px 12px; text-align: center;">Moy. matière</th>
            <th style="padding: 10px 12px; text-align: center; border-radius: 0 4px 0 0;">Appréciation</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(matieres).map(([mat, notes], i) => {
            const moy = (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2);
            const appre = moy >= 16 ? 'Très Bien' : moy >= 14 ? 'Bien' : moy >= 12 ? 'Assez Bien' : moy >= 10 ? 'Passable' : 'Insuffisant';
            const color = moy >= 10 ? '#1b5e20' : '#b71c1c';
            return `
              <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 1px solid #eee;">
                <td style="padding: 9px 12px; font-weight: 500;">${mat}</td>
                <td style="padding: 9px 12px; text-align: center; color: #666;">${notes.length}</td>
                <td style="padding: 9px 12px; text-align: center; font-weight: bold; color: ${color};">${moy}/20</td>
                <td style="padding: 9px 12px; text-align: center; color: ${color};">${appre}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Moyenne générale -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="background: #2e7d32; color: white; padding: 12px 24px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; opacity: .85; text-transform: uppercase; letter-spacing: 1px;">Moyenne Générale</div>
          <div style="font-size: 26px; font-weight: bold; margin-top: 2px;">${moyenneGenerale}/20</div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 12px; color: #666; margin-bottom: 40px;">Le Directeur des Études</p>
          <div style="border-top: 1px solid #999; padding-top: 4px; font-size: 11px; color: #888;">Signature et cachet</div>
        </div>
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 12px; color: #666; margin-bottom: 40px;">L'Étudiant(e)</p>
          <div style="border-top: 1px solid #999; padding-top: 4px; font-size: 11px; color: #888;">Signature</div>
        </div>
      </div>

      <!-- Pied de page -->
      <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #aaa;">
        Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — SMS v2.0
      </div>
    </div>
  `;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);

  await html2pdf()
    .set({ ...DEFAULT_OPTIONS, filename: `bulletin_${etudiant?.mle_etudiant || 'etudiant'}.pdf` })
    .from(el)
    .save();

  document.body.removeChild(el);
};

// ── Reçu de paiement ──────────────────────────────────────────────────────────
export const generateRecu = async (paiement, user) => {
  const html2pdf = await loadHtml2Pdf();

  const nomComplet   = `${paiement?.nom_etudiant || ''} ${paiement?.prenom_etudiant || ''}`.trim() || '—';
  const matricule    = typeof paiement?.mle_etudiant === 'object'
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

  const typePaiement  = paiement?.type_paiement || 'SCOLARITE';
  const showTotaux    = ['SCOLARITE', 'INSCRIPTION'].includes(typePaiement); // pas de total ref pour BTS/soutenance
  const motif         = TYPE_MOTIFS[typePaiement] || typePaiement;
  const labelTotal    = TYPE_TOTAL_LABEL[typePaiement] || 'Total';
  const labelReste    = typePaiement === 'INSCRIPTION' ? 'Reste à payer (inscription)' : 'Reste à payer (scolarité totale)';

  const mtPaye      = Number(paiement?.mt_paiement || 0);
  const mtTotal     = showTotaux ? Number(paiement?.mt_total   || 0) : 0;
  const totalPaye   = showTotaux ? Number(paiement?.total_paye || 0) : 0;
  const resteAPayer = mtTotal > 0 ? Math.max(mtTotal - totalPaye, 0) : 0;

  // Date du paiement parsée en heure locale (évite le décalage UTC minuit)
  const rawDate  = paiement?.date_paiement?.slice(0, 10);
  const dateStr  = rawDate
    ? new Date(rawDate + 'T00:00:00').toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  // Heure d'émission = moment où le reçu est généré
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

      <!-- En-tête -->
      <div style="text-align:center;border-bottom:3px solid #2e7d32;padding-bottom:14px;margin-bottom:22px;">
        <h1 style="font-size:19px;color:#2e7d32;margin:0 0 3px;letter-spacing:1px;">
          SYSTÈME DE MANAGEMENT SCOLAIRE
        </h1>
        <h2 style="font-size:15px;margin:0;color:#333;">REÇU DE PAIEMENT</h2>
      </div>

      <!-- N° reçu + date + heure d'émission -->
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
          <span style="font-size:12px;font-weight:600;color:${resteAPayer > 0 ? '#c62828' : '#2e7d32'};">
            ${labelReste}
          </span>
          <span style="font-size:14px;font-weight:bold;color:${resteAPayer > 0 ? '#c62828' : '#2e7d32'};">
            ${resteAPayer.toLocaleString('fr-FR')} FCFA
          </span>
        </div>` : ''}
      </div>

      <!-- Signature unique — établissant le reçu -->
      <div style="margin-top:36px;text-align:center;max-width:260px;">
        <div style="font-size:12px;color:#444;margin-bottom:4px;">Établi par</div>
        <div style="font-size:13px;font-weight:bold;margin-bottom:56px;">${etabliPar}</div>
        <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#888;">
          Signature et cachet
        </div>
      </div>

      <!-- Pied de page -->
      <div style="text-align:center;margin-top:22px;padding-top:12px;
                  border-top:1px solid #eee;font-size:10px;color:#aaa;">
        Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${heureStr} — SMS v2.0
      </div>
    </div>
  `;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);

  await html2pdf()
    .set({ ...DEFAULT_OPTIONS, filename: `recu_paiement_${paiement?.code_paiement || 'xxx'}.pdf` })
    .from(el)
    .save();

  document.body.removeChild(el);
};

// ── Liste de classe ───────────────────────────────────────────────────────────
export const generateListeClasse = async (classe, etudiants) => {
  const html2pdf = await loadHtml2Pdf();

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
      <div style="text-align: center; border-bottom: 3px solid #2e7d32; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="font-size: 20px; color: #2e7d32; margin: 0 0 4px;">SYSTÈME DE MANAGEMENT SCOLAIRE</h1>
        <h2 style="font-size: 15px; margin: 0;">LISTE DE CLASSE — ${classe?.lib_classe || classe?.code_classe || ''}</h2>
        <p style="font-size: 12px; color: #666; margin: 4px 0 0;">Année académique 2025/2026 • ${etudiants.length} étudiant(s)</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #2e7d32; color: white;">
            <th style="padding: 8px 10px; text-align: center; width: 40px;">N°</th>
            <th style="padding: 8px 10px; text-align: left;">Matricule</th>
            <th style="padding: 8px 10px; text-align: left;">Nom et Prénom</th>
            <th style="padding: 8px 10px; text-align: left;">Date naissance</th>
            <th style="padding: 8px 10px; text-align: left;">Téléphone</th>
          </tr>
        </thead>
        <tbody>
          ${etudiants.map((e, i) => `
            <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 1px solid #eee;">
              <td style="padding: 7px 10px; text-align: center; color: #666;">${i + 1}</td>
              <td style="padding: 7px 10px; font-weight: 500;">${e.mle_etudiant || '—'}</td>
              <td style="padding: 7px 10px;">${e.nom || ''} ${e.prenom || ''}</td>
              <td style="padding: 7px 10px; color: #666;">${e.date_naiss?.slice(0, 10) || '—'}</td>
              <td style="padding: 7px 10px; color: #666;">${e.tel || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #aaa;">
        Imprimé le ${new Date().toLocaleDateString('fr-FR')} — SMS v2.0
      </div>
    </div>
  `;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);

  await html2pdf()
    .set({ ...DEFAULT_OPTIONS, filename: `liste_${classe?.code_classe || 'classe'}.pdf` })
    .from(el)
    .save();

  document.body.removeChild(el);
};
