/**
 * pages/Grades.jsx
 * Relevé de notes avec export PDF du bulletin.
 */
import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { useApi } from '../hooks/useApi';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { evaluationService, etudiantService, classeService, periodeService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateBulletin } from '../services/pdfService';
import { CanDo } from '../components/RoleGuard';
import SearchableSelect from '../components/SearchableSelect';

const moyColor = v => {
  if (v >= 16) return 'var(--green)';
  if (v >= 12) return 'var(--info)';
  if (v >= 10) return 'var(--warning)';
  return 'var(--danger)';
};

const getMention = (moy, t) => {
  if (moy >= 16) return { key:'tresBien',  badge:'badge-success' };
  if (moy >= 14) return { key:'bien',      badge:'badge-info' };
  if (moy >= 12) return { key:'assezBien', badge:'badge-warning' };
  return           { key:'passable',  badge:'badge-secondary' };
};

// Évaluation par compétences (primaire réformé) : A/ECA/NA au lieu d'une moyenne /20.
const APPRECIATION_BADGE = { A: 'badge-success', ECA: 'badge-warning', NA: 'badge-danger' };
const dominantAppreciation = counts => {
  const order = ['A', 'ECA', 'NA'];
  return order.reduce((best, a) => (counts[a] > (counts[best] || 0) ? a : best), null);
};

// ── Vue relevé par classe ─────────────────────────────────────────────────────
// Moyennes calculées côté backend (voir EvaluationViewSet.moyennes), pondérées par type
// d'évaluation (ex : Contrôle continu 30% + Session normale 70%, configuré dans
// Paramétrage). Nécessite une classe ET une période — la pondération n'a de sens que
// pour une période donnée (une même matière peut avoir plusieurs sessions dans l'année).
function ReleveParClasse() {
  const { typeEtab } = useEtablissement();
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const [classeId, setClasseId]   = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const { data: classes }  = useApi(useCallback(() => classeService.list({ page_size: 200 }), []));
  const { data: periodes } = useApi(useCallback(() => periodeService.list({ page_size: 100 }), []));
  const { data: moyennesData, loading } = useApi(
    useCallback(() => (classeId && periodeId)
      ? evaluationService.moyennes({ code_classe: classeId, code_periode: periodeId })
      : Promise.resolve({ data: [] }),
    [classeId, periodeId]), [classeId, periodeId]
  );

  // Construire la matrice : étudiant × matière à partir des moyennes déjà pondérées
  // (voir EvaluationViewSet.moyennes) — ou, en primaire, des appréciations A/ECA/NA
  // (`m.appreciation`, sans objet numérique en évaluation par compétences).
  const etudiantsData = moyennesData || [];
  const subjects = new Set();
  etudiantsData.forEach(e => e.matieres.forEach(m => subjects.add(m.lib_matiere)));
  const subjectList = [...subjects].sort();

  const studentRows = etudiantsData.map(e => {
    const parMatiere = Object.fromEntries(e.matieres.map(m => [m.lib_matiere, m]));
    const rowCells = subjectList.map(s => parMatiere[s] || null);
    const counts = { A: 0, ECA: 0, NA: 0 };
    rowCells.forEach(c => { if (c?.appreciation) counts[c.appreciation]++; });
    return {
      mle: e.mle_etudiant, nom: e.nom_etudiant, rowCells,
      moy: e.moyenne_generale, counts, dominant: dominantAppreciation(counts),
    };
  }).sort((a, b) => isPrimaire ? a.nom.localeCompare(b.nom) : (b.moy || 0) - (a.moy || 0));

  // Moyennes par matière (colonne) — ou répartition A/ECA/NA en primaire.
  const colMeans = subjectList.map((_, ci) => {
    const vals = studentRows.map(r => r.rowCells[ci]?.moyenne).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  const colAppreciations = subjectList.map((_, ci) => {
    const counts = { A: 0, ECA: 0, NA: 0 };
    studentRows.forEach(r => { const a = r.rowCells[ci]?.appreciation; if (a) counts[a]++; });
    return counts;
  });

  // Moyenne générale de la classe — moyenne des moyennes générales (déjà pondérées par
  // crédits, voir EvaluationViewSet.moyennes) de chaque étudiant, pas seulement des
  // moyennes par matière ci-dessus. Sans objet en évaluation par compétences (primaire).
  const classMoyGenerale = (() => {
    const vals = studentRows.map(r => r.moy).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const cellColor = v => v === null ? 'var(--text-muted)' : v >= 10 ? 'var(--green)' : '#ef5350';

  return (
    <div>
      {/* Sélecteurs classe + période */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <SearchableSelect
            name="classeId"
            value={classeId}
            onChange={e => setClasseId(e.target.value)}
            options={(classes || []).map(c => ({ value: c.code_classe, label: c.lib_classe }))}
            placeholder="— Sélectionner une classe —"
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <SearchableSelect
            name="periodeId"
            value={periodeId}
            onChange={e => setPeriodeId(e.target.value)}
            options={(periodes || []).map(p => ({ value: p.code_periode, label: p.lib_periode }))}
            placeholder="— Sélectionner une période —"
          />
        </div>
        {classeId && periodeId && etudiantsData.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8 }}>
            {studentRows.length} élève(s) · {subjectList.length} matière(s)
            {!isPrimaire && classMoyGenerale !== null && (
              <> · Moyenne générale : <strong style={{ color: classMoyGenerale >= 10 ? 'var(--green)' : '#ef5350' }}>
                {classMoyGenerale.toFixed(2)}/20
              </strong></>
            )}
          </span>
        )}
      </div>

      {!classeId || !periodeId ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <i className="fas fa-chalkboard" style={{ fontSize: 36, display: 'block', marginBottom: 12, opacity: .2 }} />
          Sélectionnez une classe et une période pour afficher le relevé de notes
        </div>
      ) : loading ? <LoadingState /> : etudiantsData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          Aucune note enregistrée pour cette classe sur cette période
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {isPrimaire ? 'N°' : 'Rang'}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Élève
                </th>
                {subjectList.map(s => (
                  <th key={s} style={{ padding: '8px 8px', textAlign: 'center',
                    fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
                    maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={s}>
                    {s.length > 10 ? s.slice(0, 10) + '…' : s}
                  </th>
                ))}
                <th style={{ padding: '8px 12px', textAlign: 'center',
                  fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                  {isPrimaire ? 'BILAN' : 'MOY.'}
                </th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((row, i) => (
                <tr key={row.mle}
                  style={{ borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? '' : 'var(--bg-hover)' }}>
                  <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '7px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {row.nom}
                  </td>
                  {row.rowCells.map((c, ci) => (
                    <td key={ci} style={{ padding: '7px 8px', textAlign: 'center' }}>
                      {isPrimaire ? (
                        c?.appreciation
                          ? <span className={`sms-badge ${APPRECIATION_BADGE[c.appreciation]}`}>{c.appreciation}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <span style={{ color: cellColor(c?.moyenne ?? null), fontWeight: c?.moyenne != null ? 600 : 400 }}>
                          {c?.moyenne != null ? c.moyenne.toFixed(2) : '—'}
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                    {isPrimaire ? (
                      row.dominant
                        ? <span className={`sms-badge ${APPRECIATION_BADGE[row.dominant]}`}>{row.dominant}</span>
                        : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                    ) : (
                      <span style={{ color: row.moy !== null ? (row.moy >= 10 ? 'var(--green)' : '#ef5350') : 'var(--text-muted)' }}>
                        {row.moy !== null ? row.moy.toFixed(2) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Ligne synthèse par matière */}
              <tr style={{ borderTop: '2px solid var(--green)', background: 'rgba(76,175,80,.05)' }}>
                <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11,
                  color: 'var(--green)', textTransform: 'uppercase' }}>
                  {isPrimaire ? 'Répartition classe' : 'Moy. classe'}
                </td>
                {isPrimaire ? colAppreciations.map((counts, ci) => (
                  <td key={ci} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                    A:{counts.A} · ECA:{counts.ECA} · NA:{counts.NA}
                  </td>
                )) : colMeans.map((m, ci) => (
                  <td key={ci} style={{ padding: '8px 8px', textAlign: 'center',
                    fontWeight: 700, color: m !== null ? (m >= 10 ? 'var(--green)' : '#ef5350') : 'var(--text-muted)' }}>
                    {m !== null ? m.toFixed(2) : '—'}
                  </td>
                ))}
                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                  {isPrimaire ? null : (
                    <span style={{ color: classMoyGenerale !== null ? (classMoyGenerale >= 10 ? 'var(--green)' : '#ef5350') : 'var(--text-muted)' }}>
                      {classMoyGenerale !== null ? classMoyGenerale.toFixed(2) : '—'}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Grades() {
  const { t, toast, lang } = useApp();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const [mode,      setMode]      = useState('etudiant'); // 'etudiant' | 'classe'
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(null);

  const { data: evaluations, loading: evalLoading, error: evalError, reload } = useApi(
    useCallback(() => evaluationService.list({ page_size: 500 }), [])
  );
  const { data: etudiants, loading: etudLoading } = useApi(
    useCallback(() => etudiantService.list({ page_size: 200 }), [])
  );

  const loading = evalLoading || etudLoading;

  // Calcul mémoïsé des moyennes par étudiant (hooks toujours appelés, jamais conditionnels).
  // Primaire (évaluation par compétences) : regroupe par appréciation A/ECA/NA plutôt que
  // par note — sinon ces étudiants, qui n'ont jamais de note numérique, disparaîtraient
  // purement et simplement de la liste (et ne pourraient plus exporter leur bulletin).
  const moyennesMap = useMemo(() => {
    const map = {};
    (evaluations || []).forEach(e => {
      const mle = e.mle_etudiant?.mle_etudiant || e.mle_etudiant;
      const nom = e.nom_etudiant || e.mle_etudiant?.nom || mle;
      if (isPrimaire) {
        if (!e.appreciation) return;
        if (!map[mle]) map[mle] = { nom, counts: { A: 0, ECA: 0, NA: 0 } };
        map[mle].counts[e.appreciation]++;
      } else {
        if (e.note === null || e.note === undefined) return;
        if (!map[mle]) map[mle] = { nom, notes: [] };
        map[mle].notes.push(parseFloat(e.note));
      }
    });
    return map;
  }, [evaluations, isPrimaire]);

  const rows = useMemo(() => Object.entries(moyennesMap).map(([mle, d]) => {
    const etud = (etudiants || []).find(e => e.mle_etudiant === mle);
    if (isPrimaire) {
      const nbNotes = d.counts.A + d.counts.ECA + d.counts.NA;
      return { mle, nom: d.nom, counts: d.counts, dominant: dominantAppreciation(d.counts), nbNotes, etud };
    }
    const moy = d.notes.length > 0
      ? parseFloat((d.notes.reduce((a, b) => a + b, 0) / d.notes.length).toFixed(2))
      : 0;
    return { mle, nom: d.nom, moy, nbNotes: d.notes.length, etud };
  }), [moyennesMap, etudiants, isPrimaire]);

  const filtered = useMemo(() => rows.filter(r =>
    r.nom.toLowerCase().includes(search.toLowerCase()) ||
    r.mle.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  // Retours conditionnels après tous les hooks
  if (loading)   return <LoadingState />;
  if (evalError) return <ErrorState message={evalError} onRetry={reload} />;

  const handleExportBulletin = async (row) => {
    setExporting(row.mle);
    try {
      const evals = (evaluations || []).filter(e =>
        (e.mle_etudiant?.mle_etudiant || e.mle_etudiant) === row.mle
      );

      // Fiche complète de l'étudiant, recherchée directement plutôt que dans la liste
      // chargée en mémoire (plafonnée à 200 résultats) : sur un grand établissement
      // (ex: 1500+ étudiants), cet étudiant peut très bien ne pas en faire partie, et
      // `row.etud` serait alors introuvable — le prénom disparaissait silencieusement
      // du bulletin dans ce cas.
      let etudFull = row.etud || null;
      if (!etudFull && row.mle) {
        try {
          const api = (await import('../services/api')).default;
          const etudRes = await api.get(`/api/etudiants/${row.mle}/`);
          etudFull = etudRes.data;
        } catch {}
      }

      // Classe depuis l'inscription ou les évaluations
      let classeLib = etudFull?.lib_classe || evals[0]?.lib_classe || '';
      let codeClasse = evals[0]?.code_classe?.code_classe || evals[0]?.code_classe || '';

      if (!classeLib && row.mle) {
        try {
          const api = (await import('../services/api')).default;
          const inscRes = await api.get(`/api/etudiants/${row.mle}/inscriptions/?page_size=1`);
          const inscList = inscRes.data.results ?? inscRes.data ?? [];
          const lastInsc = inscList[inscList.length - 1];
          classeLib  = lastInsc?.lib_classe  || '';
          codeClasse = lastInsc?.code_classe?.code_classe || lastInsc?.code_classe || codeClasse;
        } catch {}
      }

      // Établissement depuis le localStorage
      let etab = null;
      try {
        const raw = localStorage.getItem('sms_etab');
        if (raw) etab = JSON.parse(raw)?.data;
      } catch {}

      // Crédits par matière depuis les cours de la classe
      const creditsMap = {};
      if (codeClasse) {
        try {
          const api = (await import('../services/api')).default;
          const coursRes = await api.get(`/api/cours/?code_classe=${codeClasse}&page_size=200`);
          const coursList = coursRes.data.results ?? coursRes.data ?? [];
          coursList.forEach(c => {
            const lib = c.lib_matiere || c.code_matiere?.lib_matiere;
            if (lib && c.credits != null) creditsMap[lib] = c.credits;
          });
        } catch {}
      }

      // Rang / moyenne de classe : sans objet en évaluation par compétences (primaire).
      // Calculés à partir des évaluations de CETTE classe uniquement, récupérées
      // directement plutôt que dérivées de `rows` — qui mélange tous les étudiants de
      // l'établissement, toutes classes et toutes périodes confondues (plafonné à 500
      // évaluations). Sans ce correctif, le rang et la moyenne affichés sur le bulletin
      // n'avaient aucun rapport avec la classe réelle de l'étudiant (ex : "27e/50" pour
      // une classe qui ne compte en réalité que 10 élèves).
      let rang = null, totalEleves = null, classMoyenne = null;
      if (!isPrimaire && codeClasse) {
        try {
          const api = (await import('../services/api')).default;
          const classEvalsRes = await api.get('/api/evaluations/', {
            params: { code_classe: codeClasse, page_size: 1000 },
          });
          const classEvals = classEvalsRes.data.results ?? classEvalsRes.data ?? [];
          const notesParEtudiant = {};
          classEvals.forEach(e => {
            if (e.note === null || e.note === undefined) return;
            const mle = e.mle_etudiant?.mle_etudiant || e.mle_etudiant;
            (notesParEtudiant[mle] ||= []).push(parseFloat(e.note));
          });
          const classRows = Object.entries(notesParEtudiant).map(([mle, notes]) => ({
            mle, moy: notes.reduce((a, b) => a + b, 0) / notes.length,
          }));
          if (classRows.length > 0) {
            const sortedClassRows = [...classRows].sort((a, b) => b.moy - a.moy);
            const idx = sortedClassRows.findIndex(r => r.mle === row.mle);
            rang        = idx >= 0 ? idx + 1 : null;
            totalEleves = classRows.length;
            classMoyenne = (classRows.reduce((s, r) => s + r.moy, 0) / classRows.length).toFixed(2);
          }
        } catch {}
      }

      const etudObj = {
        ...(etudFull || {}),
        mle_etudiant: row.mle,
        nom:          etudFull?.nom    || row.nom,
        prenom:       etudFull?.prenom || '',
        lib_classe:   classeLib,
      };

      const annee = evals[0]?.lib_annee || evals[0]?.code_annee || 'Année académique';

      const { blob, filename } = await generateBulletin(etudObj, evals, annee, etab, {
        classMoyenne,
        rang,
        totalEleves,
        creditsMap,
      });
      showPreview(blob, filename);
      toast.success(t.toast.exported);
    } catch (err) {
      toast.error(t.toast.error);
    } finally {
      setExporting(null);
    }
  };

  const counts = key => rows.filter(r => getMention(r.moy, t).key === key).length;
  const appreciationCounts = a => rows.filter(r => r.dominant === a).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-star-half-alt text-green" style={{ marginRight:10, fontSize:22 }}></i>
            {t.pages.grades.title}
          </h1>
          <p className="page-subtitle">
            {lang === 'en'
              ? `Averages and report cards of ${labels.studentLabelPlural.toLowerCase()}`
              : `Moyennes et bulletins des ${labels.studentLabelPlural.toLowerCase()}`}
          </p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          {/* Switch de vue */}
          <div style={{ display: 'flex', background: 'var(--bg-darkest)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 3 }}>
            {[
              { key: 'etudiant', label: lang === 'en' ? `By ${labels.studentLabel}` : `Par ${labels.studentLabel.toLowerCase()}`, icon: 'fas fa-user' },
              { key: 'classe',   label: lang === 'en' ? 'By class' : 'Par classe',   icon: 'fas fa-chalkboard' },
            ].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                  background: mode === m.key ? 'var(--green)' : 'transparent',
                  color:      mode === m.key ? '#fff' : 'var(--text-muted)',
                  transition: 'all .2s',
                }}>
                <i className={m.icon} style={{ fontSize: 11 }} />{m.label}
              </button>
            ))}
          </div>
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => window.print()}>
            <i className="fas fa-print"></i> {t.common.print}
          </button>
        </div>
      </div>

      {/* Vue Relevé par classe */}
      {mode === 'classe' && <ReleveParClasse />}
      {mode !== 'classe' && (<>

      {/* Stats mentions (secondaire/supérieur) ou répartition A/ECA/NA (primaire) */}
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))' }}>
        {isPrimaire ? (
          [
            { key:'A',   color:'c-green',  icon:'fas fa-check-circle' },
            { key:'ECA', color:'c-orange', icon:'fas fa-hourglass-half' },
            { key:'NA',  color:'c-red',    icon:'fas fa-times-circle' },
          ].map(s => (
            <div className={`stat-card ${s.color}`} key={s.key}>
              <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
              <div>
                <div className="stat-value">{appreciationCounts(s.key)}</div>
                <div className="stat-label">{t.appreciations[s.key]}</div>
              </div>
            </div>
          ))
        ) : (
          [
            { key:'tresBien',  color:'c-green',  icon:'fas fa-trophy' },
            { key:'bien',      color:'c-blue',   icon:'fas fa-medal' },
            { key:'assezBien', color:'c-orange', icon:'fas fa-award' },
            { key:'passable',  color:'c-red',    icon:'fas fa-graduation-cap' },
          ].map(s => (
            <div className={`stat-card ${s.color}`} key={s.key}>
              <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
              <div>
                <div className="stat-value">{counts(s.key)}</div>
                <div className="stat-label">{t.mentions[s.key]}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sms-card" style={{ display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 220px)', overflow:'hidden' }}>
        <div className="sms-card-header" style={{ flexShrink:0 }}>
          <div className="sms-card-title"><i className="fas fa-table"></i> {t.common.list} ({filtered.length})</div>
          <div className="sms-search">
            <i className="fas fa-search"></i>
            <input type="text" placeholder={t.common.search} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="sms-table-wrap" style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
          <table className="sms-table">
            <thead>
              <tr>
                <th>{t.fields.matricule}</th>
                <th>{labels.studentLabel}</th>
                <th>{t.common.nbEval}</th>
                {isPrimaire ? (
                  <th colSpan={2}>{t.fields.appreciation}</th>
                ) : (<>
                  <th>{t.common.moyenne}</th>
                  <th>{t.fields.mention}</th>
                </>)}
                <th>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>
                  {t.common.noResult}
                </td></tr>
              ) : filtered.map((r, i) => {
                const mention = !isPrimaire ? getMention(r.moy, t) : null;
                return (
                  <tr key={r.mle}>
                    <td>{r.mle}</td>
                    <td><strong>{r.nom}</strong></td>
                    <td style={{ color:'var(--text-muted)' }}>{r.nbNotes}</td>
                    {isPrimaire ? (
                      <td colSpan={2}>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          {r.dominant && (
                            <span className={`sms-badge ${APPRECIATION_BADGE[r.dominant]}`}>{r.dominant}</span>
                          )}
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                            A:{r.counts.A} · ECA:{r.counts.ECA} · NA:{r.counts.NA}
                          </span>
                        </div>
                      </td>
                    ) : (<>
                      <td>
                        <strong style={{ color:moyColor(r.moy), fontSize:14, fontFamily:'var(--font-display)' }}>
                          {r.moy}/20
                        </strong>
                      </td>
                      <td><span className={`sms-badge ${mention.badge}`}>{t.mentions[mention.key]}</span></td>
                    </>)}
                    <td>
                      <button
                        className="sms-btn sms-btn-outline sms-btn-sm"
                        onClick={() => handleExportBulletin(r)}
                        disabled={exporting === r.mle}
                        title="Exporter le bulletin PDF"
                      >
                        {exporting === r.mle
                          ? <><div className="sms-spinner" style={{ width:12, height:12 }}></div> Export…</>
                          : <><i className="fas fa-file-pdf"></i> {t.common.bulletin}</>
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer : compteur simple */}
        <div style={{ flexShrink:0, padding:'6px 16px', borderTop:'1px solid var(--border)',
          background:'var(--bg-card)', zIndex:2, position:'relative' }}>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            {filtered.length} {t.common.elements}
          </span>
        </div>
      </div>
      </>)}
    </div>
  );
}
