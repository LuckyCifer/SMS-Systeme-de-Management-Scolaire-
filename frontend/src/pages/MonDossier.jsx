/**
 * pages/MonDossier.jsx — Portail étudiant (Mon dossier)
 * Convention : le login utilisateur == mle_etudiant pour le rôle ETUDIANT.
 * Un fallback permet de saisir manuellement le matricule.
 */
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { LoadingState } from '../components/ApiState';
import { getUser } from '../utils/Auth';
import { generateBulletin } from '../services/pdfService';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const moyColor = v => {
  if (v >= 16) return '#2e7d32';
  if (v >= 12) return '#1a3c5e';
  if (v >= 10) return '#e65100';
  return '#c62828';
};

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
        background: active ? 'var(--primary)' : 'var(--bg-darkest)',
        color: active ? '#fff' : 'var(--text-muted)',
        transition: 'all .2s',
      }}
    >
      <i className={icon}></i> {label}
    </button>
  );
}

export default function MonDossier() {
  const { t, toast, anneeActive, lang } = useApp();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const user = getUser();

  const [query,       setQuery]       = useState(user?.login || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const [loadingSugg, setLoadingSugg] = useState(false);

  const [etudiant,   setEtudiant]   = useState(null);
  const [inscription, setInscription] = useState(null);
  const [evals,      setEvals]      = useState([]);
  const [paiements,  setPaiements]  = useState([]);
  const [absStats,   setAbsStats]   = useState(null);
  const [planning,   setPlanning]   = useState([]);
  const [etab,       setEtab]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [notFound,   setNotFound]   = useState(false);
  const [tab,        setTab]        = useState('notes');
  const [generating, setGenerating] = useState(false);

  // Chargement automatique si rôle ETUDIANT
  useEffect(() => {
    if (user?.role === 'ETUDIANT' && user?.login) loadDossier(user.login);
  }, []);

  useEffect(() => {
    api.get('/api/etablissements/current/').then(r => setEtab(r.data)).catch(() => {});
  }, []);

  // Autocomplétion : déclenche une recherche dès 2 caractères
  useEffect(() => {
    if (loaded) return;                          // dossier déjà chargé, pas de suggestion
    if (query.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    const timer = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await api.get(`/api/etudiants/?search=${encodeURIComponent(query)}&page_size=10`);
        const list = res.data.results ?? res.data;
        setSuggestions(list);
        setShowSugg(list.length > 0);
      } catch {} finally { setLoadingSugg(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, loaded]);

  const loadDossier = async (mle) => {
    if (!mle) return;
    setShowSugg(false);
    setLoading(true);
    setNotFound(false);
    try {
      const etuRes = await api.get(`/api/etudiants/${mle}/`).catch(() => null);
      if (!etuRes || etuRes.status === 404) {
        setNotFound(true);
        setLoaded(false);
        return;
      }
      const etu = etuRes.data;
      setEtudiant(etu);

      // Charger inscription récente pour obtenir la classe
      const inscRes = await api.get(`/api/inscriptions/?mle_etudiant=${mle}&page_size=5`)
        .catch(() => null);
      const inscList = inscRes?.data?.results ?? inscRes?.data ?? [];
      const lastInsc = inscList[inscList.length - 1] || null;
      setInscription(lastInsc);

      const [evRes, payRes, absRes, planRes] = await Promise.all([
        api.get(`/api/evaluations/?mle_etudiant=${mle}&page_size=500`),
        api.get(`/api/etudiants/${mle}/paiements/`),
        api.get(`/api/etudiants/${mle}/absences-stats/`),
        lastInsc?.code_classe
          ? api.get(`/api/planning/?code_cours__code_classe=${lastInsc.code_classe}${anneeActive?.code_annee ? `&code_cours__code_annee=${anneeActive.code_annee}` : ''}&page_size=200`)
          : Promise.resolve({ data: { results: [] } }),
      ]);
      setEvals(evRes.data.results ?? evRes.data);
      setPaiements(payRes.data.results ?? payRes.data);
      setAbsStats(absRes.data);
      setPlanning(planRes.data.results ?? planRes.data ?? []);
      setLoaded(true);
    } catch { toast.error(t.errors.loading); }
    finally  { setLoading(false); }
  };

  const handleSuggestionClick = (etu) => {
    setQuery(`${etu.nom} ${etu.prenom || ''} — ${etu.mle_etudiant}`);
    setSuggestions([]);
    setShowSugg(false);
    loadDossier(etu.mle_etudiant);
  };

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Si ça ressemble à un matricule (pas d'espace ou contient un tiret), charger directement
    const looksLikeMle = !trimmed.includes(' ') || /^[\w\d-]+$/.test(trimmed);
    if (looksLikeMle) { loadDossier(trimmed); return; }
    // Sinon charger le premier résultat de la suggestion
    if (suggestions.length > 0) { handleSuggestionClick(suggestions[0]); return; }
    loadDossier(trimmed);
  };

  // Grouper les évals par matière
  const byMatiere = {};
  evals.forEach(e => {
    const mat = e.lib_matiere || e.code_matiere?.lib_matiere || e.code_matiere || '?';
    if (!byMatiere[mat]) byMatiere[mat] = [];
    byMatiere[mat].push(parseFloat(e.note));
  });
  const matieres = Object.entries(byMatiere).map(([mat, notes]) => ({
    mat,
    moy: (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2),
    nb:  notes.length,
  })).sort((a, b) => parseFloat(b.moy) - parseFloat(a.moy));

  const moyGen = matieres.length
    ? (matieres.reduce((s, m) => s + parseFloat(m.moy), 0) / matieres.length).toFixed(2)
    : null;

  // Paiements totaux
  const totalPaye  = paiements.reduce((s, p) => s + Number(p.mt_paiement || 0), 0);
  const totalDu    = paiements.length ? Number(paiements[0]?.mt_total || 0) : 0;
  const reste      = Math.max(totalDu - totalPaye, 0);

  const handleGenerate = async () => {
    if (!etudiant || matieres.length === 0) return;
    setGenerating(true);
    try {
      const { blob, filename } = await generateBulletin(etudiant, evals, '', etab);
      showPreview(blob, filename);
    } catch { toast.error(t.errors.saving); }
    finally  { setGenerating(false); }
  };

  return (
    <div className="sms-content">
      <div className="sms-page-header">
        <div>
          <h1 className="sms-page-title">
            <i className="fas fa-id-badge" style={{ marginRight: 10, color: '#1a3c5e' }}></i>
            {lang === 'en' ? `My ${labels.studentLabel} Record` : `Mon dossier ${labels.studentLabel.toLowerCase()}`}
          </h1>
          <p className="sms-page-subtitle">{t.pages.monDossier.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {loaded && (
            <button
              className="sms-btn sms-btn-outline"
              onClick={() => { setLoaded(false); setEtudiant(null); setInscription(null); setEvals([]); setPaiements([]); setAbsStats(null); setPlanning([]); setNotFound(false); setQuery(''); setSuggestions([]); setTab('notes'); }}
            >
              <i className="fas fa-arrow-left"></i> {t.common.back || 'Retour'}
            </button>
          )}
          {loaded && matieres.length > 0 && (
            <button className="sms-btn sms-btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating
                ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                : <><i className="fas fa-file-pdf"></i> {t.common.bulletin}</>}
            </button>
          )}
        </div>
      </div>

      {/* Zone de recherche */}
      {!loaded && (
        <div className="sms-card" style={{ padding: '18px', marginBottom: 16, overflow: 'visible' }}>
          <div style={{ position: 'relative' }}>
            <label className="sms-label" style={{ marginBottom: 6, display: 'block' }}>
              Rechercher par matricule, nom ou prénom
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="sms-input"
                  placeholder="Ex : 2023-INF-00012  ou  Kamga  ou  Marie-Claire"
                  value={query}
                  autoComplete="off"
                  onChange={e => { setQuery(e.target.value); setNotFound(false); setLoaded(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 180)}
                />
                {loadingSugg && (
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <div className="sms-spinner" style={{ width: 14, height: 14 }} />
                  </div>
                )}

                {/* Dropdown suggestions */}
                {showSugg && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                    marginTop: 4, maxHeight: 280, overflowY: 'auto',
                  }}>
                    {suggestions.map(s => (
                      <div
                        key={s.mle_etudiant}
                        onMouseDown={() => handleSuggestionClick(s)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {/* Avatar initiales */}
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: '#1a3c5e', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                        }}>
                          {(s.nom || 'E').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.nom?.toUpperCase()} {s.prenom || ''}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            <span style={{ fontFamily: 'monospace' }}>{s.mle_etudiant}</span>
                            {s.lib_sp  && <> &nbsp;·&nbsp; {s.lib_sp}</>}
                            {s.lib_dep && !s.lib_sp && <> &nbsp;·&nbsp; {s.lib_dep}</>}
                          </div>
                        </div>
                        <i className="fas fa-chevron-right" style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="sms-btn sms-btn-primary"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading
                  ? <div className="sms-spinner" style={{ width: 14, height: 14 }} />
                  : <><i className="fas fa-search"></i> {t.pages.monDossier.loadBtn}</>}
              </button>
            </div>

            {notFound && (
              <p style={{ color: '#c62828', fontSize: 12, margin: '8px 0 0' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>
                {t.pages.monDossier.notFound}
              </p>
            )}
          </div>
        </div>
      )}

      {loading && <LoadingState />}

      {loaded && etudiant && (
        <>
          {/* Carte identité étudiant */}
          <div className="sms-card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', background: '#1a3c5e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0,
              }}>
                {(etudiant.nom || 'E').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {etudiant.nom?.toUpperCase()} {etudiant.prenom || ''}
                </div>
                {/* Matricule */}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span><i className="fas fa-id-card" style={{ marginRight: 4 }}></i>{etudiant.mle_etudiant}</span>
                  {/* Classe depuis la dernière inscription */}
                  {(inscription?.lib_classe || inscription?.code_classe) && (
                    <span>
                      <i className="fas fa-door-open" style={{ marginRight: 4 }}></i>
                      {inscription.lib_classe || inscription.code_classe}
                    </span>
                  )}
                  {/* Spécialité */}
                  {etudiant.lib_sp && (
                    <span>
                      <i className="fas fa-graduation-cap" style={{ marginRight: 4 }}></i>
                      {etudiant.lib_sp}
                    </span>
                  )}
                  {/* Filière (si pas de spécialité) */}
                  {!etudiant.lib_sp && etudiant.lib_dep && (
                    <span>
                      <i className="fas fa-university" style={{ marginRight: 4 }}></i>
                      {etudiant.lib_dep}
                    </span>
                  )}
                </div>
                {/* Niveau académique */}
                {etudiant.lib_niveau && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: '#1a3c5e22', color: '#1a3c5e', fontWeight: 600,
                    }}>
                      {etudiant.lib_niveau}
                    </span>
                  </div>
                )}
              </div>
              {moyGen && (
                <div style={{
                  textAlign: 'center', padding: '8px 18px', background: 'var(--bg-darkest)', borderRadius: 10,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {t.common.average}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: moyColor(parseFloat(moyGen)) }}>
                    {moyGen}/20
                  </div>
                </div>
              )}
              {absStats && (
                <div style={{
                  textAlign: 'center', padding: '8px 18px', background: '#fce4ec', borderRadius: 10,
                }}>
                  <div style={{ fontSize: 10, color: '#c62828', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {t.pages.monDossier.myAbsences}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#c62828' }}>
                    {absStats.total_heures}<span style={{ fontSize: 12 }}>{t.pages.monDossier.absHours}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Onglets */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <TabBtn active={tab === 'notes'}    onClick={() => setTab('notes')}    icon="fas fa-star"        label={t.pages.monDossier.myGrades} />
            <TabBtn active={tab === 'payments'} onClick={() => setTab('payments')} icon="fas fa-credit-card" label={t.pages.monDossier.myPayments} />
            <TabBtn active={tab === 'absences'} onClick={() => setTab('absences')} icon="fas fa-user-times"  label={t.pages.monDossier.myAbsences} />
            <TabBtn active={tab === 'planning'} onClick={() => setTab('planning')} icon="fas fa-calendar-alt" label={t.pages.monDossier.myPlanning || 'Mon planning'} />
          </div>

          {/* Contenu onglet Notes */}
          {tab === 'notes' && (
            matieres.length === 0 ? (
              <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fas fa-file-alt" style={{ fontSize: 36, marginBottom: 12, opacity: .4 }}></i>
                <p style={{ margin: 0 }}>{t.pages.monDossier.noGrades}</p>
              </div>
            ) : (
              <div className="sms-card">
                <div className="sms-table-wrap">
                  <table className="sms-table">
                    <thead>
                      <tr>
                        <th>{t.fields.matiere}</th>
                        <th style={{ textAlign: 'center' }}>{t.common.nbEval}</th>
                        <th style={{ textAlign: 'center' }}>{t.common.moyenne}</th>
                        <th style={{ textAlign: 'center' }}>{t.fields.statut}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matieres.map(m => {
                        const moy = parseFloat(m.moy);
                        const ok  = moy >= 10;
                        return (
                          <tr key={m.mat}>
                            <td style={{ fontWeight: 600 }}>{m.mat}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="sms-badge badge-secondary">{m.nb}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <strong style={{ color: moyColor(moy), fontSize: 15 }}>{m.moy}/20</strong>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`sms-badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                                {ok ? t.status.admis : t.status.ajourné}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Contenu onglet Paiements */}
          {tab === 'payments' && (
            <>
              {totalDu > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 14 }}>
                  {[
                    { label: t.pages.monDossier.totalPaid, value: totalPaye.toLocaleString('fr-FR') + ' FCFA', color: '#2e7d32' },
                    { label: t.pages.monDossier.remaining, value: reste.toLocaleString('fr-FR') + ' FCFA',     color: reste > 0 ? '#c62828' : '#2e7d32' },
                  ].map(card => (
                    <div key={card.label} className="sms-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{card.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {paiements.length === 0 ? (
                <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>{t.pages.monDossier.noPayments}</p>
                </div>
              ) : (
                <div className="sms-card">
                  <div className="sms-table-wrap">
                    <table className="sms-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>{t.fields.date}</th>
                          <th>{t.fields.typePaiement}</th>
                          <th style={{ textAlign: 'right' }}>{t.common.colAmount}</th>
                          <th style={{ textAlign: 'center' }}>{t.fields.statut}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paiements.map(p => (
                          <tr key={p.code_paiement}>
                            <td>{p.date_paiement?.slice(0, 10) || '—'}</td>
                            <td>{p.type_paiement || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {Number(p.mt_paiement || 0).toLocaleString('fr-FR')} FCFA
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`sms-badge ${p.statut === 'PAYE' ? 'badge-success' : p.statut === 'PARTIEL' ? 'badge-warning' : 'badge-danger'}`}>
                                {p.statut}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Contenu onglet Absences */}
          {tab === 'absences' && (
            absStats ? (
              <div className="sms-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: '#fce4ec', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#c62828' }}>{absStats.nb_absences}</div>
                    <div style={{ fontSize: 11, color: '#c62828' }}>{t.pages.absences.totalAbs}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: '#fff3e0', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#e65100' }}>{absStats.total_heures}h</div>
                    <div style={{ fontSize: 11, color: '#e65100' }}>{t.pages.absences.totalHeures}</div>
                  </div>
                </div>
                {(absStats.par_matiere || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {t.pages.absences.bySubject}
                    </div>
                    {absStats.par_matiere.map(m => {
                      const maxH = Math.max(...absStats.par_matiere.map(x => x.heures));
                      const pct  = maxH > 0 ? (m.heures / maxH) * 100 : 0;
                      return (
                        <div key={m.matiere} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span>{m.matiere}</span>
                            <strong style={{ color: '#c62828' }}>{m.heures}h</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-darkest)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#c62828', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0 }}>{t.pages.monDossier.noAbsences}</p>
              </div>
            )
          )}

          {/* Contenu onglet Planning */}
          {tab === 'planning' && (() => {
            const hebdo    = planning.filter(p => p.type_planning === 'HEBDO');
            const intensif = planning.filter(p => p.type_planning === 'INTENSIF');
            const JOURS    = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const JOUR_TO_CODE = { Lundi:'LUN', Mardi:'MAR', Mercredi:'MER', Jeudi:'JEU', Vendredi:'VEN', Samedi:'SAM' };
            const jourLabel = j => t.common.jours[JOUR_TO_CODE[j]] || j;
            const byJour   = {};
            hebdo.forEach(p => {
              const j = p.lib_jour || p.code_jour || '?';
              if (!byJour[j]) byJour[j] = [];
              byJour[j].push(p);
            });
            // Trier les séances de chaque jour par heure de début
            Object.values(byJour).forEach(arr => arr.sort((a, b) => (a.h_debut || '') < (b.h_debut || '') ? -1 : 1));
            const joursPresents = JOURS.filter(j => byJour[j]);

            if (planning.length === 0) return (
              <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar-times" style={{ fontSize: 36, marginBottom: 12, opacity: .4 }}></i>
                <p style={{ margin: 0 }}>{t.pages.monDossier.noSchedule}</p>
              </div>
            );

            return (
              <>
                {/* Emploi du temps hebdomadaire */}
                {joursPresents.length > 0 && (
                  <div className="sms-card" style={{ marginBottom: 14 }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                      <i className="fas fa-calendar-week" style={{ marginRight: 7 }}></i>{t.pages.monDossier.weeklySchedule}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-darkest)' }}>
                            {joursPresents.map(j => (
                              <th key={j} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#1a3c5e', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, borderBottom: '2px solid #1a3c5e' }}>
                                {jourLabel(j)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ verticalAlign: 'top' }}>
                            {joursPresents.map(j => (
                              <td key={j} style={{ padding: '10px 12px', borderRight: '1px solid var(--border)', minWidth: 160 }}>
                                {byJour[j].map((s, i) => (
                                  <div key={i} style={{
                                    marginBottom: 8, padding: '8px 10px', borderRadius: 6,
                                    background: '#e8f0fb', borderLeft: '3px solid #1a3c5e',
                                  }}>
                                    <div style={{ fontWeight: 700, color: '#1a3c5e', marginBottom: 2 }}>
                                      {s.lib_matiere || s.code_matiere || '—'}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                      <i className="fas fa-clock" style={{ marginRight: 4 }}></i>
                                      {s.h_debut?.slice(0,5) || '—'} – {s.h_fin?.slice(0,5) || '—'}
                                    </div>
                                    {s.lib_salle && (
                                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                        <i className="fas fa-door-open" style={{ marginRight: 4 }}></i>{s.lib_salle}
                                      </div>
                                    )}
                                    {s.nom_ens && (
                                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                        <i className="fas fa-chalkboard-teacher" style={{ marginRight: 4 }}></i>{s.nom_ens}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Cours intensifs */}
                {intensif.length > 0 && (
                  <div className="sms-card">
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                      <i className="fas fa-bolt" style={{ marginRight: 7, color: '#e65100' }}></i>{t.pages.monDossier.intensiveCourses}
                    </div>
                    <div className="sms-table-wrap">
                      <table className="sms-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Matière</th>
                            <th>Période</th>
                            <th>Horaire</th>
                            <th>Salle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {intensif.map((s, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{s.lib_matiere || s.code_matiere || '—'}</td>
                              <td>{s.date_debut || '—'} → {s.date_fin || '—'}</td>
                              <td>{s.h_debut?.slice(0,5) || '—'} – {s.h_fin?.slice(0,5) || '—'}</td>
                              <td>{s.lib_salle || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
