/**
 * pages/Grades.jsx
 * Moyennes, rangs et bulletins d'une classe sur une période (ou l'année complète).
 *
 * Aucun calcul de moyenne ici : tout vient de /api/evaluations/moyennes/ (api/notes.py),
 * qui applique les règles de chaque niveau — coefficients au primaire/secondaire, crédits
 * au supérieur, séquences, appréciations A/ECA/NA du primaire, rangs ex-aequo. Les deux
 * vues (par élève, relevé par classe) et les bulletins affichent donc les mêmes chiffres.
 */
import { useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { useTr } from '../hooks/useTr';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { useApi } from '../hooks/useApi';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { evaluationService, classeService, periodeService, clotureNotesService } from '../services/endpoints';
import { getUser } from '../utils/Auth';

// Clôturer / rouvrir une période : censeur et administration (miroir du backend).
const ROLES_GESTION_NOTES = ['SUPER_ADMIN', 'ADMIN', 'SCOLARITE', 'CENSEUR'];
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateBulletin } from '../services/pdfService';
import SearchableSelect from '../components/SearchableSelect';
import { APPRECIATION_BADGE, periodeOptions, parsePeriodeChoice, rangLabel } from '../utils/notes';

const moyColor = v => {
  if (v === null || v === undefined) return 'var(--text-muted)';
  if (v >= 16) return 'var(--green)';
  if (v >= 12) return 'var(--info)';
  if (v >= 10) return 'var(--warning)';
  return 'var(--danger)';
};

const MENTION_KEY   = { 'Très Bien': 'tresBien', 'Bien': 'bien', 'Assez Bien': 'assezBien', 'Passable': 'passable' };
const MENTION_BADGE = { tresBien: 'badge-success', bien: 'badge-info', assezBien: 'badge-warning', passable: 'badge-secondary' };

const AppreciationBadge = ({ value }) => value
  ? <span className={`sms-badge ${APPRECIATION_BADGE[value]}`}>{value}</span>
  : null;

// ── Vue relevé par classe ─────────────────────────────────────────────────────
function ReleveParClasse({ resultats, isPrimaire, poidsLabel }) {
  const tr = useTr();
  // Colonnes : matières notées dans la classe, avec leur poids (coefficient / crédits).
  const subjects = useMemo(() => {
    const map = new Map();
    resultats.forEach(r => r.matieres.forEach(m => {
      if (!map.has(m.code_matiere)) map.set(m.code_matiere, { code: m.code_matiere, lib: m.lib_matiere, poids: m.poids, defaut: m.poids_defaut });
    }));
    return [...map.values()].sort((a, b) => a.lib.localeCompare(b.lib));
  }, [resultats]);

  const cellule = (r, code) => r.matieres.find(m => m.code_matiere === code) || null;

  const colMeans = subjects.map(s => {
    const vals = resultats.map(r => cellule(r, s.code)?.moyenne).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  const moyClasse = resultats[0]?.moyenne_classe ?? null;

  const th = { padding: '8px 8px', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' };

  return (
    <div className="sms-card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 12 }}>{tr('Rang', 'Rank')}</th>
            <th style={{ ...th, textAlign: 'left' }}>Élève</th>
            {subjects.map(s => (
              <th key={s.code} style={{ ...th, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.lib}>
                {s.lib.length > 10 ? s.lib.slice(0, 10) + '…' : s.lib}
                {s.poids != null && (
                  <div style={{ fontWeight: 400, textTransform: 'none', color: s.defaut ? 'var(--warning)' : undefined }}
                    title={s.defaut ? tr('Non renseigné : compté pour 1', 'Not set: counted as 1') : undefined}>
                    {poidsLabel} {s.poids}{s.defaut ? ' *' : ''}
                  </div>
                )}
              </th>
            ))}
            <th style={{ ...th, color: 'var(--green)', fontWeight: 700, fontSize: 11 }}>MOY.</th>
          </tr>
        </thead>
        <tbody>
          {resultats.map((r, i) => (
            <tr key={r.mle_etudiant} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--bg-hover)' : '' }}>
              <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {rangLabel(r)}
              </td>
              <td style={{ padding: '7px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.nom_etudiant}</td>
              {subjects.map(s => {
                const c = cellule(r, s.code);
                return (
                  <td key={s.code} style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {c?.moyenne != null ? (
                      <span style={{ color: c.moyenne >= 10 ? 'var(--green)' : '#ef5350', fontWeight: 600 }}>
                        {c.moyenne.toFixed(2)}
                      </span>
                    ) : c?.dispense
                      ? <span style={{ color: 'var(--text-muted)', fontSize: 10 }} title={tr('Absence justifiée : matière neutralisée', 'Excused absence: subject not counted')}>{tr('ABS. J', 'EXC.')}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    {isPrimaire && c?.appreciation && <> <AppreciationBadge value={c.appreciation} /></>}
                  </td>
                );
              })}
              <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                <span style={{ color: moyColor(r.moyenne_generale) }}>
                  {r.moyenne_generale != null ? r.moyenne_generale.toFixed(2) : '—'}
                </span>
                {isPrimaire && <> <AppreciationBadge value={r.appreciation_generale} /></>}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid var(--green)', background: 'rgba(76,175,80,.05)' }}>
            <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--green)', textTransform: 'uppercase' }}>
              {tr('Moy. classe', 'Class avg.')}
            </td>
            {colMeans.map((m, ci) => (
              <td key={ci} style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: moyColor(m) }}>
                {m !== null ? m.toFixed(2) : '—'}
              </td>
            ))}
            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: moyColor(moyClasse) }}>
              {moyClasse !== null ? moyClasse.toFixed(2) : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Grades() {
  const { t, toast, lang } = useApp();
  const tr = useTr();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const poidsLabel = labels.isSuperieur ? tr('Crédits', 'Credits') : tr('Coef.', 'Coef.');

  const [mode,      setMode]      = useState('etudiant'); // 'etudiant' | 'classe'
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(null);
  const [classeId,  setClasseId]  = useState('');
  const [periodeChoice, setPeriodeChoice] = useState('');

  const { data: classes }  = useApi(useCallback(() => classeService.list({ page_size: 300 }), []));
  const { data: periodes } = useApi(useCallback(() => periodeService.list({ page_size: 200 }), []));
  const { data: etab }     = useApi(useCallback(() => api.get('/api/etablissements/current/').catch(() => ({ data: null })), []));

  const choix = parsePeriodeChoice(periodeChoice);
  const { data: moyennesData, loading, error, reload } = useApi(
    useCallback(() => (classeId && choix)
      ? evaluationService.moyennes({ code_classe: classeId, ...choix })
      : Promise.resolve({ data: [] }),
    [classeId, periodeChoice]), [classeId, periodeChoice]
  );
  const resultats = moyennesData || [];

  // Clôture : uniquement pour une période précise (pas l'année complète).
  const codePeriode = choix?.code_periode;
  const peutCloturer = ROLES_GESTION_NOTES.includes(getUser()?.role);
  const { data: clotures, reload: reloadClotures } = useApi(
    useCallback(() => (classeId && codePeriode)
      ? clotureNotesService.list({ code_classe: classeId, code_periode: codePeriode })
      : Promise.resolve({ data: [] }), [classeId, codePeriode]), [classeId, codePeriode]);
  const cloture = (clotures || [])[0] || null;
  const basculerCloture = async () => {
    const question = cloture
      ? tr('Rouvrir cette période ? Les notes de la classe redeviendront modifiables.',
           "Reopen this period? The class's grades will be editable again.")
      : tr('Clôturer cette période pour la classe (conseil de classe tenu) ? Plus aucune note ne pourra être modifiée sans réouverture.',
           'Close this period for the class (class council held)? No grade can be changed until it is reopened.');
    if (!window.confirm(question)) return;
    try {
      if (cloture) await clotureNotesService.delete(cloture.id);
      else await clotureNotesService.create({ code_classe: classeId, code_periode: codePeriode });
      toast.success(cloture ? tr('Période rouverte.', 'Period reopened.') : tr('Période clôturée.', 'Period closed.'));
      reloadClotures();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || t.errors.saving);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resultats.filter(r => !q ||
      (r.nom_etudiant || '').toLowerCase().includes(q) ||
      (r.mle_etudiant || '').toLowerCase().includes(q));
  }, [resultats, search]);

  const classe       = (classes || []).find(c => c.code_classe === classeId);
  // Matières sans coefficient (ou sans crédits) : comptées pour 1, à signaler.
  const sansPoids = [...new Set(resultats.flatMap(r => r.matieres.filter(m => m.poids_defaut).map(m => m.lib_matiere)))];
  const periodeLabel = periodeOptions(periodes || []).find(o => o.value === periodeChoice)?.label || '';

  const handleExportBulletin = async (r) => {
    setExporting(r.mle_etudiant);
    try {
      let etud = {};
      try { etud = (await api.get(`/api/etudiants/${r.mle_etudiant}/`)).data; } catch {}
      const { blob, filename } = await generateBulletin(
        { ...etud, mle_etudiant: r.mle_etudiant, lib_classe: classe?.lib_classe || '' },
        r, periodeLabel, etab,
        // Secondaire : bulletin au format officiel (classe et période nécessaires).
        { code_classe: classeId, ...(choix || {}) },
      );
      showPreview(blob, filename);
      toast.success(t.toast.exported);
    } catch {
      toast.error(t.toast.error);
    } finally {
      setExporting(null);
    }
  };

  // Statistiques : mentions (secondaire/supérieur) ou appréciations générales (primaire).
  const statCards = isPrimaire
    ? [
        { key: 'A',   color: 'c-green',  icon: 'fas fa-check-circle',    label: t.appreciations.A },
        { key: 'ECA', color: 'c-orange', icon: 'fas fa-hourglass-half',  label: t.appreciations.ECA },
        { key: 'NA',  color: 'c-red',    icon: 'fas fa-times-circle',    label: t.appreciations.NA },
      ].map(s => ({ ...s, count: resultats.filter(r => r.appreciation_generale === s.key).length }))
    : [
        { key: 'tresBien',  color: 'c-green',  icon: 'fas fa-trophy' },
        { key: 'bien',      color: 'c-blue',   icon: 'fas fa-medal' },
        { key: 'assezBien', color: 'c-orange', icon: 'fas fa-award' },
        { key: 'passable',  color: 'c-red',    icon: 'fas fa-graduation-cap' },
      ].map(s => ({ ...s, label: t.mentions[s.key], count: resultats.filter(r => MENTION_KEY[r.mention] === s.key).length }));

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
          <div style={{ display: 'flex', background: 'var(--bg-darkest)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 3 }}>
            {[
              { key: 'etudiant', label: lang === 'en' ? `By ${labels.studentLabel}` : `Par ${labels.studentLabel.toLowerCase()}`, icon: 'fas fa-user' },
              { key: 'classe',   label: lang === 'en' ? 'Class sheet' : 'Relevé de classe', icon: 'fas fa-chalkboard' },
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

      {/* Sélecteurs classe + période (communs aux deux vues) */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <SearchableSelect
            name="classeId" value={classeId}
            onChange={e => setClasseId(e.target.value)}
            options={(classes || []).map(c => ({ value: c.code_classe, label: c.lib_classe }))}
            placeholder={tr('— Sélectionner une classe —', '— Select a class —')}
          />
        </div>
        <div style={{ minWidth: 260 }}>
          <SearchableSelect
            name="periodeChoice" value={periodeChoice}
            onChange={e => setPeriodeChoice(e.target.value)}
            options={periodeOptions(periodes || [])}
            placeholder={tr('— Période ou année complète —', '— Period or full year —')}
          />
        </div>
        {classeId && codePeriode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
            {cloture
              ? <span className="sms-badge badge-secondary" title={tr(`Clôturée par ${cloture.cloturee_par} le ${cloture.cloturee_le?.slice(0, 10)}`, `Closed by ${cloture.cloturee_par} on ${cloture.cloturee_le?.slice(0, 10)}`)}>
                  <i className="fas fa-lock"></i> {tr('Période clôturée', 'Period closed')}
                </span>
              : <span className="sms-badge badge-success"><i className="fas fa-lock-open"></i> {tr('Période ouverte', 'Period open')}</span>}
            {peutCloturer && (
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={basculerCloture}>
                <i className={cloture ? 'fas fa-unlock' : 'fas fa-lock'}></i> {cloture ? tr('Rouvrir', 'Reopen') : tr('Clôturer la période', 'Close the period')}
              </button>
            )}
          </div>
        )}
        {resultats.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8 }}>
            {resultats[0].effectif} {labels.studentLabel.toLowerCase()}(s) {tr('classé(s)', 'ranked')}
            {resultats[0].moyenne_classe != null && (
              <> · {tr('Moyenne de classe', 'Class average')} : <strong style={{ color: moyColor(resultats[0].moyenne_classe) }}>
                {resultats[0].moyenne_classe.toFixed(2)}/20
              </strong></>
            )}
          </span>
        )}
      </div>

      {sansPoids.length > 0 && (
        <div className="sms-card" style={{ padding: '10px 16px', marginBottom: 12, borderLeft: '4px solid var(--warning)', fontSize: 12 }}>
          <i className="fas fa-exclamation-triangle" style={{ color: 'var(--warning)', marginRight: 6 }}></i>
          {labels.isSuperieur
            ? <>{tr('Crédits non renseignés (comptés pour 1)', 'Credits not set (counted as 1)')} : <strong>{sansPoids.join(', ')}</strong> — {tr('à saisir dans la page Cours.', 'to be entered on the Courses page.')}</>
            : <>{tr('Coefficient absent de la grille (compté pour 1)', 'Coefficient missing from the grid (counted as 1)')} : <strong>{sansPoids.join(', ')}</strong> — {tr('à saisir dans la page Coefficients', 'to be entered on the Coefficients page')}{classe && !classe.serie && classe.niveau_scolaire ? tr(', et vérifier la série de la classe', ", and check the class's series") : ''}.</>}
        </div>
      )}

      {!classeId || !choix ? (
        <div className="sms-card" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <i className="fas fa-chalkboard" style={{ fontSize: 36, display: 'block', marginBottom: 12, opacity: .2 }} />
          {tr("Sélectionnez une classe et une période (ou l'année complète) pour afficher les moyennes", 'Select a class and a period (or the full year) to display the averages')}
        </div>
      ) : loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : resultats.length === 0 ? (
        <div className="sms-card" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          {tr('Aucune note enregistrée pour cette classe sur cette période', 'No grade recorded for this class over this period')}
        </div>
      ) : mode === 'classe' ? (
        <ReleveParClasse resultats={resultats} isPrimaire={isPrimaire} poidsLabel={poidsLabel} />
      ) : (<>
        <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))' }}>
          {statCards.map(s => (
            <div className={`stat-card ${s.color}`} key={s.key}>
              <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
              <div>
                <div className="stat-value">{s.count}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sms-card" style={{ display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 300px)', overflow:'hidden' }}>
          <div className="sms-card-header" style={{ flexShrink:0 }}>
            <div className="sms-card-title"><i className="fas fa-table"></i> {t.common.list} ({filtered.length})</div>
            <div className="sms-search">
              <i className="fas fa-search"></i>
              <input type="text" placeholder={t.common.search} value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="sms-table-wrap" style={{ flex:1, overflowY:'auto', overflowX:'auto', maxHeight:'none' }}>
            <table className="sms-table">
              <thead>
                <tr>
                  <th>{tr('Rang', 'Rank')}</th>
                  <th>{t.fields.matricule}</th>
                  <th>{labels.studentLabel}</th>
                  <th>{t.common.nbEval}</th>
                  <th>{t.common.moyenne}</th>
                  <th>{isPrimaire ? t.fields.appreciation : t.fields.mention}</th>
                  <th>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>
                    {t.common.noResult}
                  </td></tr>
                ) : filtered.map(r => {
                  const mentionKey = MENTION_KEY[r.mention];
                  return (
                    <tr key={r.mle_etudiant}>
                      <td style={{ fontWeight: 700 }}>{rangLabel(r)}</td>
                      <td>{r.mle_etudiant}</td>
                      <td><strong>{r.nom_etudiant}</strong></td>
                      <td style={{ color:'var(--text-muted)' }}>{r.matieres.reduce((s, m) => s + (m.nb_evals || 0), 0)}</td>
                      <td>
                        <strong style={{ color: moyColor(r.moyenne_generale), fontSize:14, fontFamily:'var(--font-display)' }}>
                          {r.moyenne_generale != null ? `${r.moyenne_generale.toFixed(2)}/20` : '—'}
                        </strong>
                      </td>
                      <td>
                        {isPrimaire
                          ? (r.appreciation_generale
                              ? <><AppreciationBadge value={r.appreciation_generale} /> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.appreciations[r.appreciation_generale]}</span></>
                              : '—')
                          : (mentionKey
                              ? <span className={`sms-badge ${MENTION_BADGE[mentionKey]}`}>{t.mentions[mentionKey]}</span>
                              : <span className="sms-badge badge-danger">{lang === 'en' ? 'Insufficient' : 'Insuffisant'}</span>)}
                      </td>
                      <td>
                        <button
                          className="sms-btn sms-btn-outline sms-btn-sm"
                          onClick={() => handleExportBulletin(r)}
                          disabled={exporting === r.mle_etudiant}
                          title={tr('Exporter le bulletin PDF', 'Export the PDF report card')}
                        >
                          {exporting === r.mle_etudiant
                            ? <><div className="sms-spinner" style={{ width:12, height:12 }}></div> Export…</>
                            : <><i className="fas fa-file-pdf"></i> {t.common.bulletin}</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
