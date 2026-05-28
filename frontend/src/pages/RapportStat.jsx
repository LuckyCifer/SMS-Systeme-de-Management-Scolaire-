/**
 * pages/RapportStat.jsx — Rapport statistique (taux de réussite, effectifs, H/F)
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { rapportStatService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import SearchableSelect from '../components/SearchableSelect';

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

// ── Formulaire génération automatique ────────────────────────────────────────
function Form({ onClose, onGenerate }) {
  const { t } = useApp();
  const [classes, setClasses] = useState([]);
  const [deps,    setDeps]    = useState([]);
  const [annees,  setAnnees]  = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [generating,  setGenerating]  = useState(false);

  const [f, setF] = useState({ code_annee: '', code_classe: '', code_dep: '' });
  const ch = e => setF(p => {
    const next = { ...p, [e.target.name]: e.target.value };
    // Classe et département sont mutuellement exclusifs
    if (e.target.name === 'code_classe' && e.target.value) next.code_dep = '';
    if (e.target.name === 'code_dep'    && e.target.value) next.code_classe = '';
    return next;
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=200'),
      api.get('/api/departements/?page_size=100'),
      api.get('/api/annees/?page_size=20'),
    ]).then(([c, d, a]) => {
      setClasses(c.data.results ?? c.data);
      setDeps(d.data.results ?? d.data);
      setAnnees(a.data.results ?? a.data);
    }).finally(() => setLoadingData(false));
  }, []);

  const submit = async e => {
    e.preventDefault();
    setGenerating(true);
    try {
      await onGenerate({ ...f, code_classe: f.code_classe || null, code_dep: f.code_dep || null });
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
      {/* Info box */}
      <div style={{ background:'var(--green-dark)18', border:'1px solid var(--green)44',
        borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
        <i className="fas fa-magic" style={{ color:'var(--green)', marginTop:2, flexShrink:0 }}></i>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
          Le rapport est <strong>calculé automatiquement</strong> à partir des inscriptions,
          décisions de jury et évaluations existantes. Choisissez une année et,
          optionnellement, une classe <em>ou</em> un département.
        </div>
      </div>

      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.annee} *</label>
          <select className="sms-input" name="code_annee" value={f.code_annee} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
          </select>
        </div>
        <SearchableSelect
          label={`${t.fields.classe} (optionnel)`}
          name="code_classe"
          value={f.code_classe}
          onChange={ch}
          options={classes.map(c => ({ value: c.code_classe, label: c.lib_classe }))}
          placeholder="Toutes les classes"
        />
        <SearchableSelect
          label={`${t.fields.departement} (optionnel)`}
          name="code_dep"
          value={f.code_dep}
          onChange={ch}
          options={deps.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
          placeholder="Tous les départements"
        />
      </div>

      {(f.code_classe || f.code_dep) && (
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, marginTop:-4 }}>
          <i className="fas fa-info-circle" style={{ marginRight:4 }}></i>
          {f.code_classe ? 'Rapport par classe sélectionnée.' : 'Rapport agrégé pour tout le département.'}
        </div>
      )}

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

export default function RapportStat() {
  const { t, toast } = useApp();
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useApi(() => rapportStatService.list({ page_size: 200 }));
  const { mutate: remove } = useMutation(useCallback(d => rapportStatService.delete(d.code_rapport_stat), []));

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const list = data || [];
  const sel  = selected ? list.find(r => r.code_rapport_stat === selected) : list[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-chart-bar text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            {t.pages.rapportStat.title}
          </h1>
          <p className="page-subtitle">{t.pages.rapportStat.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button className="sms-btn sms-btn-outline sms-btn-sm"
            onClick={() => window.open('http://localhost:8000/api/rapports-stat/export-csv/', '_blank')}>
            <i className="fas fa-download"></i> {t.common.exportCsv}
          </button>
        </div>
      </div>

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
                  {r.code_annee} {r.code_classe ? `— ${r.code_classe}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.nb_inscrits} {t.fields.nbInscrits.toLowerCase()} · {t.fields.txReussite} : {r.taux_reussite}%
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t.common.noReports}
              </div>
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
                  {sel.code_classe && ` — ${sel.code_classe}`}
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
    </div>
  );
}
