/**
 * pages/Decisions.jsx — Délibérations et décisions jury
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { decisionService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const RESULTAT_COLORS = {
  ADMIS: 'badge-success', 'AJOURNÉ': 'badge-warning',
  'REDOUBLÉ': 'badge-danger', EXCLU: 'badge-secondary',
};

function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const [etudiants, setEts]     = useState([]);
  const [classes,   setClasses] = useState([]);
  const [annees,    setAnnees]  = useState([]);
  const [loading,   setLoad]    = useState(true);

  const [f, setF] = useState({
    mle_etudiant:      item?.mle_etudiant || '',
    code_annee:        item?.code_annee   || '',
    code_classe:       item?.code_classe  || '',
    moyenne_annuelle:  item?.moyenne_annuelle  || '',
    total_credits:     item?.total_credits     || 0,
    credits_valides:   item?.credits_valides   || 0,
    resultat:          item?.resultat          || 'ADMIS',
    mention:           item?.mention           || '',
    rang:              item?.rang              || '',
    effectif:          item?.effectif          || '',
    date_deliberation: item?.date_deliberation?.slice(0, 10) || '',
    president_jury:    item?.president_jury    || '',
    observations:      item?.observations      || '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/etudiants/?page_size=200'),
      api.get('/api/classes/?page_size=100'),
      api.get('/api/annees/?page_size=20'),
    ]).then(([e, c, a]) => {
      setEts(e.data.results ?? e.data);
      setClasses(c.data.results ?? c.data);
      setAnnees(a.data.results ?? a.data);
    }).finally(() => setLoad(false));
  }, []);

  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="sms-spinner" style={{ width: 32, height: 32, margin: 'auto' }}></div></div>;

  const RESULTATS = [
    { value: 'ADMIS',     label: t.status.admis },
    { value: 'AJOURNÉ',   label: t.status.ajourné },
    { value: 'REDOUBLÉ',  label: t.status.redoublé },
    { value: 'EXCLU',     label: t.status.exclu },
  ];
  const MENTIONS = [
    { value: 'Très Bien',   label: t.mentions.tresBien },
    { value: 'Bien',        label: t.mentions.bien },
    { value: 'Assez Bien',  label: t.mentions.assezBien },
    { value: 'Passable',    label: t.mentions.passable },
    { value: 'Insuffisant', label: t.mentions.insuffisant },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.nomEtud} *</label>
          <select className="sms-input" name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {etudiants.map(e => <option key={e.mle_etudiant} value={e.mle_etudiant}>{e.nom} {e.prenom || ''} ({e.mle_etudiant})</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.classe} *</label>
          <select className="sms-input" name="code_classe" value={f.code_classe} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {classes.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.annee} *</label>
          <select className="sms-input" name="code_annee" value={f.code_annee} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.moyenne}      name="moyenne_annuelle" type="number" value={f.moyenne_annuelle} onChange={ch} placeholder="14.50" />
        <FormField label={t.fields.creditsTotal} name="total_credits"   type="number" value={f.total_credits}    onChange={ch} />
        <FormField label={t.fields.creditsVal}   name="credits_valides" type="number" value={f.credits_valides}  onChange={ch} />
      </div>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.resultat} *</label>
          <select className="sms-input" name="resultat" value={f.resultat} onChange={ch} required>
            {RESULTATS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.mention}</label>
          <select className="sms-input" name="mention" value={f.mention} onChange={ch}>
            <option value="">{t.common.noMention}</option>
            {MENTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.rang}      name="rang"              type="number" value={f.rang}              onChange={ch} />
        <FormField label={t.fields.effectif}  name="effectif"          type="number" value={f.effectif}          onChange={ch} />
        <FormField label={t.fields.dateDelib} name="date_deliberation" type="date"   value={f.date_deliberation} onChange={ch} />
      </div>
      <FormField label={t.fields.president} name="president_jury" value={f.president_jury}  onChange={ch} />
      <FormField label={t.fields.obs}       name="observations"   type="textarea" value={f.observations} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Decisions() {
  const { t, toast } = useApp();
  const [classeFilter, setClasseFilter] = useState('');
  const [anneeFilter,  setAnneeFilter]  = useState('');
  const [classes, setClasses] = useState([]);
  const [annees,  setAnnees]  = useState([]);

  const { data, loading, error, reload } = useApi(
    () => decisionService.list({ page_size: 200, ...(classeFilter ? { code_classe: classeFilter } : {}), ...(anneeFilter ? { code_annee: anneeFilter } : {}) }),
    [classeFilter, anneeFilter]
  );
  const { mutate: create } = useMutation(useCallback(d => decisionService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => decisionService.update(d.code_decision, d), []));
  const { mutate: remove } = useMutation(useCallback(d => decisionService.delete(d.code_decision), []));

  useEffect(() => {
    api.get('/api/classes/?page_size=100').then(r => setClasses(r.data.results ?? r.data)).catch(() => {});
    api.get('/api/annees/?page_size=20').then(r => setAnnees(r.data.results ?? r.data)).catch(() => {});
  }, []);

  const nb = (res) => (data || []).filter(d => d.resultat === res).length;

  const COLS = [
    { key: 'mle',     label: t.fields.matricule, render: r => r.mle_etudiant || '—' },
    { key: 'etud',    label: t.fields.nomEtud, searchValue: r => r.nom_etudiant || r.mle_etudiant, render: r => <strong>{r.nom_etudiant || r.mle_etudiant}</strong> },
    { key: 'classe',  label: t.fields.classe,  render: r => r.lib_classe || r.code_classe },
    { key: 'annee',   label: t.fields.annee,   render: r => r.lib_annee || r.code_annee || '—' },
    { key: 'session', label: t.fields.session, searchValue: r => r.session || '', render: r => r.session
        ? <span className="sms-badge badge-info">{r.session}</span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
    { accessor: 'moyenne_annuelle', label: t.common.moyenne, render: r => (
      <strong style={{ color: r.moyenne_annuelle >= 10 ? 'var(--green)' : '#c62828', fontSize: 13 }}>
        {r.moyenne_annuelle ? `${r.moyenne_annuelle}/20` : '—'}
      </strong>
    )},
    { key: 'credits', label: t.fields.credits, render: r => `${r.credits_valides}/${r.total_credits}` },
    { key: 'mention', label: t.fields.mention, searchValue: r => r.mention || '', render: r => r.mention ? <span className="sms-badge badge-info">{r.mention}</span> : '—' },
    { key: 'resultat', label: t.fields.resultat, searchValue: r => r.resultat || '', render: r => {
      const color = RESULTAT_COLORS[r.resultat] || 'badge-secondary';
      return <span className={`sms-badge ${color}`}>{r.resultat}</span>;
    }},
    { key: 'rang', label: t.fields.rang, render: r => r.rang ? `${r.rang}/${r.effectif}` : '—' },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 16 }}>
        {[
          { label: t.status.admis,    count: nb('ADMIS'),    color: 'c-green',  icon: 'fas fa-check-circle' },
          { label: t.status.ajourné,  count: nb('AJOURNÉ'),  color: 'c-orange', icon: 'fas fa-clock' },
          { label: t.status.redoublé, count: nb('REDOUBLÉ'), color: 'c-red',    icon: 'fas fa-redo' },
          { label: t.common.total,    count: (data || []).length, color: 'c-blue', icon: 'fas fa-users' },
        ].map(s => (
          <div className={`stat-card ${s.color}`} key={s.label}>
            <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
            <div><div className="stat-value">{s.count}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <CrudTable
        title={t.pages.decisions.title}
        subtitle={t.pages.decisions.subtitle}
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        icon="fas fa-gavel"
        columns={COLS}
        data={data || []}
        addLabel={t.pages.decisions.addLabel}
        exportCsvUrl="/api/decisions/export-csv/"
        filters={
          <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
            <select className="sms-input" style={{ height: 34, minWidth: 160, fontSize: 12 }}
              value={classeFilter} onChange={e => setClasseFilter(e.target.value)}>
              <option value="">{t.common.allClasses}</option>
              {classes.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
            </select>
            <select className="sms-input" style={{ height: 34, minWidth: 140, fontSize: 12 }}
              value={anneeFilter} onChange={e => setAnneeFilter(e.target.value)}>
              <option value="">{t.common.allYears}</option>
              {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
            </select>
          </div>
        }
        onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
        onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />
    </div>
  );
}
