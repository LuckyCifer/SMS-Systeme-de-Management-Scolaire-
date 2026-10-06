/**
 * pages/RapportStat.jsx — Rapports statistiques :
 *  - Réussite  : taux de réussite, effectifs, répartition H/F
 *  - Assiduité : taux d'absence par classe/spécialité/filière/pôle et par période
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { rapportStatService, rapportAssiduiteService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import SearchableSelect from '../components/SearchableSelect';
import EmptyState from '../components/EmptyState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

function StatBar({ label, value, max, color = 'var(--green)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div className="sms-progress" style={{ height: 8 }}>
        <div className="sms-progress-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Un seul périmètre d'agrégation à la fois, du plus précis au plus large :
// classe > spécialité > filière (département) > pôle (faculté). Partagé par les deux
// formulaires (réussite et assiduité).
const SCOPE_FIELDS = ['code_classe', 'code_sp', 'code_dep', 'code_faculte'];

function scopeChangeHandler(setF) {
  return e => setF(p => {
    const next = { ...p, [e.target.name]: e.target.value };
    if (SCOPE_FIELDS.includes(e.target.name) && e.target.value) {
      SCOPE_FIELDS.filter(k => k !== e.target.name).forEach(k => { next[k] = ''; });
    }
    return next;
  });
}

function ScopeFields({ f, ch, labels, lang, classes, specs, deps, facultes }) {
  return (
    <>
      <div className="sms-form-row">
        <SearchableSelect
          label={`${labels.classeLabel} (optionnel)`}
          name="code_classe"
          value={f.code_classe}
          onChange={ch}
          options={classes.map(c => ({ value: c.code_classe, label: c.lib_classe }))}
          placeholder="Toutes les classes"
        />
        <SearchableSelect
          label={`${labels.specialiteLabel} (optionnel)`}
          name="code_sp"
          value={f.code_sp}
          onChange={ch}
          options={specs.map(s => ({ value: s.code_sp, label: s.lib_sp }))}
          placeholder={lang === 'en' ? `All ${labels.specialiteLabel.toLowerCase()}s` : `Toutes les ${labels.specialiteLabel.toLowerCase()}s`}
        />
      </div>
      <div className="sms-form-row">
        <SearchableSelect
          label={`${labels.departementLabel} (optionnel)`}
          name="code_dep"
          value={f.code_dep}
          onChange={ch}
          options={deps.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
          placeholder={lang === 'en' ? `All ${labels.departementLabel.toLowerCase()}s` : `Tous les ${labels.departementLabel.toLowerCase()}s`}
        />
        <SearchableSelect
          label={`${labels.faculteLabel} (optionnel)`}
          name="code_faculte"
          value={f.code_faculte}
          onChange={ch}
          options={facultes.map(fa => ({ value: fa.code_faculte, label: fa.lib_faculte }))}
          placeholder={lang === 'en' ? 'All faculties / poles' : 'Tous les pôles / facultés'}
        />
      </div>
      {(f.code_classe || f.code_sp || f.code_dep || f.code_faculte) && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, marginTop: -4 }}>
          <i className="fas fa-info-circle" style={{ marginRight: 4 }}></i>
          {f.code_classe
            ? 'Rapport par classe sélectionnée.'
            : f.code_sp
            ? `Rapport agrégé par ${labels.specialiteLabel.toLowerCase()}.`
            : f.code_dep
            ? `Rapport agrégé par ${labels.departementLabel.toLowerCase()}.`
            : `Rapport agrégé par ${labels.faculteLabel.toLowerCase()}.`}
        </div>
      )}
    </>
  );
}

// Périmètre d'agrégation d'un rapport (réussite ou assiduité), du plus précis au plus
// large — un seul est renseigné par rapport.
const scopeLabel = r =>
  r.lib_classe  ? r.lib_classe
  : r.lib_sp    ? r.lib_sp
  : r.lib_dep   ? r.lib_dep
  : r.lib_faculte ? r.lib_faculte
  : null;

// ── Formulaire génération automatique — Réussite ─────────────────────────────────
function Form({ onClose, onGenerate }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [classes,   setClasses]   = useState([]);
  const [specs,     setSpecs]     = useState([]);
  const [deps,      setDeps]      = useState([]);
  const [facultes,  setFacultes]  = useState([]);
  const [annees,    setAnnees]    = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [generating,  setGenerating]  = useState(false);

  const [f, setF] = useState({ code_annee: '', code_classe: '', code_sp: '', code_dep: '', code_faculte: '' });
  const ch = scopeChangeHandler(setF);

  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=200'),
      api.get('/api/specialites/?page_size=200'),
      api.get('/api/departements/?page_size=100'),
      api.get('/api/facultes/?page_size=100'),
      api.get('/api/annees/?page_size=20'),
    ]).then(([c, sp, d, fac, a]) => {
      setClasses(c.data.results ?? c.data);
      setSpecs(sp.data.results ?? sp.data);
      setDeps(d.data.results ?? d.data);
      setFacultes(fac.data.results ?? fac.data);
      setAnnees(a.data.results ?? a.data);
    }).finally(() => setLoadingData(false));
  }, []);

  const submit = async e => {
    e.preventDefault();
    setGenerating(true);
    try {
      await onGenerate({
        ...f,
        code_classe:  f.code_classe  || null,
        code_sp:      f.code_sp      || null,
        code_dep:     f.code_dep     || null,
        code_faculte: f.code_faculte || null,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loadingData) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div className="sms-spinner" style={{ width:32, height:32, margin:'auto' }}></div>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <div style={{ background:'var(--green-dark)18', border:'1px solid var(--green)44',
        borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
        <i className="fas fa-magic" style={{ color:'var(--green)', marginTop:2, flexShrink:0 }}></i>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
          Le rapport est <strong>calculé automatiquement</strong> à partir des inscriptions,
          décisions de jury et évaluations existantes. Choisissez une année et,
          optionnellement, <em>un seul</em> périmètre d'agrégation ci-dessous.
        </div>
      </div>

      <div className="sms-form-group">
        <label className="sms-label">{t.fields.annee} *</label>
        <select className="sms-input" name="code_annee" value={f.code_annee} onChange={ch} required>
          <option value="">{t.common.select}</option>
          {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
        </select>
      </div>

      <ScopeFields f={f} ch={ch} labels={labels} lang={lang} classes={classes} specs={specs} deps={deps} facultes={facultes} />

      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose} disabled={generating}>
          {t.common.cancel}
        </button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm" disabled={generating || !f.code_annee}>
          {generating
            ? <><div className="sms-spinner" style={{ width:12, height:12, display:'inline-block', marginRight:6 }}></div> Génération…</>
            : <><i className="fas fa-magic"></i> Générer le rapport</>
          }
        </button>
      </div>
    </form>
  );
}

// ── Formulaire génération automatique — Assiduité ────────────────────────────────
function FormAssiduite({ onClose, onGenerate }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [classes,   setClasses]   = useState([]);
  const [specs,     setSpecs]     = useState([]);
  const [deps,      setDeps]      = useState([]);
  const [facultes,  setFacultes]  = useState([]);
  const [periodes,  setPeriodes]  = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [generating,  setGenerating]  = useState(false);

  const [f, setF] = useState({ code_periode: '', code_classe: '', code_sp: '', code_dep: '', code_faculte: '' });
  const ch = scopeChangeHandler(setF);

  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=200'),
      api.get('/api/specialites/?page_size=200'),
      api.get('/api/departements/?page_size=100'),
      api.get('/api/facultes/?page_size=100'),
      api.get('/api/periodes/?page_size=100'),
    ]).then(([c, sp, d, fac, per]) => {
      setClasses(c.data.results ?? c.data);
      setSpecs(sp.data.results ?? sp.data);
      setDeps(d.data.results ?? d.data);
      setFacultes(fac.data.results ?? fac.data);
      setPeriodes(per.data.results ?? per.data);
    }).finally(() => setLoadingData(false));
  }, []);

  const submit = async e => {
    e.preventDefault();
    setGenerating(true);
    try {
      await onGenerate({
        ...f,
        code_classe:  f.code_classe  || null,
        code_sp:      f.code_sp      || null,
        code_dep:     f.code_dep     || null,
        code_faculte: f.code_faculte || null,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loadingData) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div className="sms-spinner" style={{ width:32, height:32, margin:'auto' }}></div>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <div style={{ background:'var(--green-dark)18', border:'1px solid var(--green)44',
        borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
        <i className="fas fa-user-clock" style={{ color:'var(--green)', marginTop:2, flexShrink:0 }}></i>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
          Le taux d'absence est <strong>calculé automatiquement</strong> à partir des présences
          déjà saisies (séances). Choisissez une période ({labels.semestreLabel.toLowerCase()})
          et, optionnellement, <em>un seul</em> périmètre d'agrégation ci-dessous.
        </div>
      </div>

      <div className="sms-form-group">
        <label className="sms-label">{labels.semestreLabel} *</label>
        <select className="sms-input" name="code_periode" value={f.code_periode} onChange={ch} required>
          <option value="">{t.common.select}</option>
          {periodes.map(p => (
            <option key={p.code_periode} value={p.code_periode}>
              {p.lib_periode} — {p.lib_annee || p.code_annee}
            </option>
          ))}
        </select>
      </div>

      <ScopeFields f={f} ch={ch} labels={labels} lang={lang} classes={classes} specs={specs} deps={deps} facultes={facultes} />

      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose} disabled={generating}>
          {t.common.cancel}
        </button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm" disabled={generating || !f.code_periode}>
          {generating
            ? <><div className="sms-spinner" style={{ width:12, height:12, display:'inline-block', marginRight:6 }}></div> Génération…</>
            : <><i className="fas fa-user-clock"></i> Générer le rapport</>
          }
        </button>
      </div>
    </form>
  );
}

export default function RapportStat() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [tab, setTab] = useState('reussite'); // 'reussite' | 'assiduite'
  const [selected,          setSelected]          = useState(null);
  const [selectedAssiduite, setSelectedAssiduite] = useState(null);

  const { data,     loading,  error,  reload  } = useApi(() => rapportStatService.list({ page_size: 200 }));
  const { data: dataA, loading: loadingA, error: errorA, reload: reloadA } =
    useApi(() => rapportAssiduiteService.list({ page_size: 200 }));

  const { mutate: remove }     = useMutation(useCallback(d => rapportStatService.delete(d.code_rapport_stat), []));
  const { mutate: removeA }    = useMutation(useCallback(d => rapportAssiduiteService.delete(d.code_rapport_assiduite), []));

  const isReussite = tab === 'reussite';

  if (isReussite  && loading)  return <LoadingState />;
  if (!isReussite && loadingA) return <LoadingState />;
  if (isReussite  && error)    return <ErrorState message={error}  onRetry={reload} />;
  if (!isReussite && errorA)   return <ErrorState message={errorA} onRetry={reloadA} />;

  const list  = data  || [];
  const listA = dataA || [];
  const sel  = selected          ? list.find(r  => r.code_rapport_stat      === selected)          : list[0];
  const selA = selectedAssiduite ? listA.find(r => r.code_rapport_assiduite === selectedAssiduite) : listA[0];

  const handleExportCsv = () => {
    const token    = localStorage.getItem('sms_access');
    const url      = isReussite ? '/api/rapports-stat/export-csv/' : '/api/rapports-assiduite/export-csv/';
    const filename = isReussite ? 'rapport_statistique.csv'        : 'rapport_assiduite.csv';
    fetch(`http://localhost:8000${url}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        toast.success(t.toast.exported);
      })
      .catch(() => toast.error(t.toast.error));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className={`fas ${isReussite ? 'fa-chart-bar' : 'fa-user-clock'} text-green`} style={{ marginRight: 10, fontSize: 22 }}></i>
            {isReussite ? t.pages.rapportStat.title : (lang === 'en' ? 'Attendance report' : "Rapport d'assiduité")}
          </h1>
          <p className="page-subtitle">
            {isReussite
              ? (lang === 'en'
                  ? `Pass rate by class, ${labels.specialiteLabel.toLowerCase()}, ${labels.departementLabel.toLowerCase()} or ${labels.faculteLabel.toLowerCase()}, gender breakdown`
                  : `Taux de réussite par classe, ${labels.specialiteLabel.toLowerCase()}, ${labels.departementLabel.toLowerCase()} ou ${labels.faculteLabel.toLowerCase()}, répartition H/F`)
              : (lang === 'en'
                  ? `Absence rate by class, ${labels.specialiteLabel.toLowerCase()}, ${labels.departementLabel.toLowerCase()} or ${labels.faculteLabel.toLowerCase()}, per ${labels.semestreLabel.toLowerCase()}`
                  : `Taux d'absence par classe, ${labels.specialiteLabel.toLowerCase()}, ${labels.departementLabel.toLowerCase()} ou ${labels.faculteLabel.toLowerCase()}, par ${labels.semestreLabel.toLowerCase()}`)
            }
          </p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-darkest)', borderRadius: 8, padding: 3 }}>
            <button
              className={`sms-btn sms-btn-sm ${isReussite ? 'sms-btn-primary' : 'sms-btn-outline'}`}
              style={!isReussite ? { border: 'none' } : undefined}
              onClick={() => setTab('reussite')}>
              <i className="fas fa-chart-bar"></i> Réussite
            </button>
            <button
              className={`sms-btn sms-btn-sm ${!isReussite ? 'sms-btn-primary' : 'sms-btn-outline'}`}
              style={isReussite ? { border: 'none' } : undefined}
              onClick={() => setTab('assiduite')}>
              <i className="fas fa-user-clock"></i> Assiduité
            </button>
          </div>
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={handleExportCsv}>
            <i className="fas fa-download"></i> {t.common.exportCsv}
          </button>
        </div>
      </div>

      {isReussite ? (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          <div className="sms-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
            <div className="sms-card-header" style={{ flexShrink: 0 }}>
              <div className="sms-card-title"><i className="fas fa-list"></i> {t.common.reports} ({list.length})</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {list.map(r => (
                <div key={r.code_rapport_stat}
                  onClick={() => setSelected(r.code_rapport_stat)}
                  style={{ padding: '10px 16px', cursor: 'pointer', borderLeft: `3px solid ${r.code_rapport_stat === (sel?.code_rapport_stat) ? 'var(--green)' : 'transparent'}`,
                    background: r.code_rapport_stat === (sel?.code_rapport_stat) ? 'var(--bg-darkest)' : 'transparent', transition: 'all .2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.code_annee} {scopeLabel(r) ? `— ${scopeLabel(r)}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.nb_inscrits} {t.fields.nbInscrits.toLowerCase()} · {t.fields.txReussite} : {r.taux_reussite}%
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <EmptyState
                  icon="fas fa-chart-bar"
                  title={t.common.noReports || 'Aucun rapport'}
                  subtitle="Cliquez sur « Nouveau rapport » pour en générer un."
                  compact
                />
              )}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 12px rgba(0,0,0,.08)' }}>
              <button className="sms-btn sms-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const modal = document.getElementById('new-rapport-modal');
                  if (modal) modal.style.display = 'flex';
                }}>
                <i className="fas fa-plus"></i> {t.common.newReport}
              </button>
            </div>
          </div>

          {sel ? (
            <div>
              <div className="sms-card" style={{ marginBottom: 16 }}>
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-chart-bar"></i> {sel.code_annee}
                    {scopeLabel(sel) && ` — ${scopeLabel(sel)}`}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {sel.genere_le ? new Date(sel.genere_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </span>
                </div>
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
                  {[
                    { label: t.fields.nbInscrits,  value: sel.nb_inscrits,  color: 'var(--green)',   icon: 'fas fa-users' },
                    { label: t.fields.nbAdmis,      value: sel.nb_admis,     color: 'var(--green)',   icon: 'fas fa-check-circle' },
                    { label: t.fields.nbAjournes,   value: sel.nb_ajournes,  color: '#e65100',        icon: 'fas fa-clock' },
                    { label: t.fields.txReussite,   value: `${sel.taux_reussite}%`, color: sel.taux_reussite >= 50 ? 'var(--green)' : '#c62828', icon: 'fas fa-percent' },
                    { label: t.fields.moyenneGen,   value: sel.moyenne_generale ? `${sel.moyenne_generale}/20` : '—', color: 'var(--info)', icon: 'fas fa-chart-line' },
                    { label: t.fields.txFeminisa,   value: `${sel.taux_feminisation}%`, color: '#ab47bc', icon: 'fas fa-venus-mars' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-darkest)', borderRadius: 8, padding: '12px 14px', borderTop: `2px solid ${s.color}` }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sms-card">
                <div className="sms-card-header"><div className="sms-card-title">{t.common.details}</div></div>
                <div style={{ padding: '16px 20px' }}>
                  <StatBar label={t.fields.nbHommes}   value={sel.nb_hommes}   max={sel.nb_inscrits} color="#42a5f5" />
                  <StatBar label={t.fields.nbFemmes}   value={sel.nb_femmes}   max={sel.nb_inscrits} color="#ab47bc" />
                  <StatBar label={t.fields.nbAdmis}    value={sel.nb_admis}    max={sel.nb_inscrits} color="var(--green)" />
                  <StatBar label={t.fields.nbAjournes} value={sel.nb_ajournes} max={sel.nb_inscrits} color="#e65100" />
                  {sel.nb_redoubles > 0 && <StatBar label={t.fields.redoublants} value={sel.nb_redoubles} max={sel.nb_inscrits} color="#c62828" />}
                </div>
                <div style={{ padding: '0 20px 16px', display: 'flex', gap: 12 }}>
                  <button className="sms-btn sms-btn-danger sms-btn-sm"
                    onClick={async () => { try { await remove(sel); toast.success(t.toast.deleted); reload(); setSelected(null); } catch(e){ toast.error(e.message); } }}>
                    <i className="fas fa-trash"></i> {t.common.delete}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="sms-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fas fa-chart-bar" style={{ fontSize: 40, marginBottom: 12 }}></i>
                <p>{t.common.selectOrCreate}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          <div className="sms-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
            <div className="sms-card-header" style={{ flexShrink: 0 }}>
              <div className="sms-card-title"><i className="fas fa-list"></i> {t.common.reports} ({listA.length})</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {listA.map(r => (
                <div key={r.code_rapport_assiduite}
                  onClick={() => setSelectedAssiduite(r.code_rapport_assiduite)}
                  style={{ padding: '10px 16px', cursor: 'pointer', borderLeft: `3px solid ${r.code_rapport_assiduite === (selA?.code_rapport_assiduite) ? 'var(--green)' : 'transparent'}`,
                    background: r.code_rapport_assiduite === (selA?.code_rapport_assiduite) ? 'var(--bg-darkest)' : 'transparent', transition: 'all .2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.lib_periode || r.code_periode} {scopeLabel(r) ? `— ${scopeLabel(r)}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.nb_etudiants} étudiants · Taux d'absence : {r.taux_absence}%
                  </div>
                </div>
              ))}
              {listA.length === 0 && (
                <EmptyState
                  icon="fas fa-user-clock"
                  title={t.common.noReports || 'Aucun rapport'}
                  subtitle="Cliquez sur « Nouveau rapport » pour en générer un."
                  compact
                />
              )}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 12px rgba(0,0,0,.08)' }}>
              <button className="sms-btn sms-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const modal = document.getElementById('new-rapport-assiduite-modal');
                  if (modal) modal.style.display = 'flex';
                }}>
                <i className="fas fa-plus"></i> {t.common.newReport}
              </button>
            </div>
          </div>

          {selA ? (
            <div>
              <div className="sms-card" style={{ marginBottom: 16 }}>
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-user-clock"></i> {selA.lib_periode || selA.code_periode}
                    {scopeLabel(selA) && ` — ${scopeLabel(selA)}`}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selA.genere_le ? new Date(selA.genere_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </span>
                </div>
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
                  {[
                    { label: 'Étudiants',              value: selA.nb_etudiants, color: 'var(--info)', icon: 'fas fa-users' },
                    { label: 'Séances',                value: selA.nb_seances,   color: 'var(--info)', icon: 'fas fa-calendar' },
                    { label: "Taux d'absence",         value: `${selA.taux_absence}%`, color: selA.taux_absence <= 10 ? 'var(--green)' : '#c62828', icon: 'fas fa-user-times' },
                    { label: 'Taux de présence',       value: `${selA.taux_presence}%`, color: 'var(--green)', icon: 'fas fa-user-check' },
                    { label: 'Absences injustifiées',  value: selA.nb_absences_injustifiees, color: '#e65100', icon: 'fas fa-exclamation-triangle' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-darkest)', borderRadius: 8, padding: '12px 14px', borderTop: `2px solid ${s.color}` }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sms-card">
                <div className="sms-card-header"><div className="sms-card-title">{t.common.details}</div></div>
                <div style={{ padding: '16px 20px' }}>
                  <StatBar label="Absences"              value={selA.nb_absences}              max={selA.nb_controles} color="#e65100" />
                  <StatBar label="Absences injustifiées" value={selA.nb_absences_injustifiees} max={selA.nb_controles} color="#c62828" />
                </div>
                <div style={{ padding: '0 20px 16px', display: 'flex', gap: 12 }}>
                  <button className="sms-btn sms-btn-danger sms-btn-sm"
                    onClick={async () => { try { await removeA(selA); toast.success(t.toast.deleted); reloadA(); setSelectedAssiduite(null); } catch(e){ toast.error(e.message); } }}>
                    <i className="fas fa-trash"></i> {t.common.delete}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="sms-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fas fa-user-clock" style={{ fontSize: 40, marginBottom: 12 }}></i>
                <p>{t.common.selectOrCreate}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div id="new-rapport-modal" style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
        <div className="sms-modal" style={{ maxWidth: 700 }}>
          <div className="sms-modal-header">
            <div className="sms-modal-title"><i className="fas fa-chart-bar" style={{ marginRight: 8 }}></i> {t.common.newReportStat}</div>
            <button className="sms-btn-icon" onClick={() => { document.getElementById('new-rapport-modal').style.display = 'none'; }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="sms-modal-body">
            <Form
              onClose={() => { document.getElementById('new-rapport-modal').style.display = 'none'; }}
              onGenerate={async d => {
                try {
                  await rapportStatService.generate(d);
                  toast.success('Rapport généré avec succès !');
                  reload();
                  document.getElementById('new-rapport-modal').style.display = 'none';
                } catch (e) { toast.error(e.message); }
              }}
            />
          </div>
        </div>
      </div>

      <div id="new-rapport-assiduite-modal" style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
        <div className="sms-modal" style={{ maxWidth: 700 }}>
          <div className="sms-modal-header">
            <div className="sms-modal-title"><i className="fas fa-user-clock" style={{ marginRight: 8 }}></i> Nouveau rapport d'assiduité</div>
            <button className="sms-btn-icon" onClick={() => { document.getElementById('new-rapport-assiduite-modal').style.display = 'none'; }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="sms-modal-body">
            <FormAssiduite
              onClose={() => { document.getElementById('new-rapport-assiduite-modal').style.display = 'none'; }}
              onGenerate={async d => {
                try {
                  await rapportAssiduiteService.generate(d);
                  toast.success('Rapport généré avec succès !');
                  reloadA();
                  document.getElementById('new-rapport-assiduite-modal').style.display = 'none';
                } catch (e) { toast.error(e.message); }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
