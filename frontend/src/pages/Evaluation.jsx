import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { evaluationService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const noteColor = n => {
  const v = parseFloat(n);
  if (v >= 16) return 'badge-success';
  if (v >= 12) return 'badge-info';
  if (v >= 10) return 'badge-warning';
  return 'badge-danger';
};

// Évaluation par compétences (primaire réformé) : A/ECA/NA au lieu d'une note /20.
const APPRECIATION_COLOR = { A: 'badge-success', ECA: 'badge-warning', NA: 'badge-danger' };

function Form({ item, onClose, onSave }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [f, setF] = useState({
    mle_etudiant:   item?.mle_etudiant?.mle_etudiant || item?.mle_etudiant || '',
    code_matiere:   item?.code_matiere?.code_matiere || item?.code_matiere || '',
    code_classe:    item?.code_classe?.code_classe   || item?.code_classe  || '',
    code_periode:   item?.code_periode?.code_periode || item?.code_periode || '',
    code_type_eval: item?.code_type_eval?.code_type_eval || item?.code_type_eval || '',
    date_eval: item?.date_eval?.slice(0,10) || new Date().toISOString().slice(0,10),
    note: item?.note || '', obs_eval: item?.obs_eval || '',
  });
  const ch = e => setF({ ...f, [e.target.name]: e.target.value });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={lang === 'en' ? `${labels.studentLabel} ID` : `Matricule ${labels.studentLabel.toLowerCase()}`}
          name="mle_etudiant"   value={f.mle_etudiant}   onChange={ch} required />
        <FormField label={t.fields.codeMatiere} name="code_matiere"   value={f.code_matiere}   onChange={ch} required />
        <FormField label={t.fields.classe}      name="code_classe"    value={f.code_classe}    onChange={ch} required />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.codePeriode}   name="code_periode"   value={f.code_periode}   onChange={ch} required />
        <FormField label={t.fields.type}         name="code_type_eval" value={f.code_type_eval} onChange={ch} required />
        <FormField label={t.fields.date}         name="date_eval"      type="date" value={f.date_eval} onChange={ch} required help="Format : JJ/MM/AAAA" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.note}  name="note"     type="number" value={f.note}     onChange={ch} required placeholder="0–20" />
        <FormField label={t.fields.obs}   name="obs_eval"               value={f.obs_eval} onChange={ch} />
      </div>
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Evaluation() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [depFilter,    setDepFilter]    = useState('');
  const [spFilter,     setSpFilter]     = useState('');
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
    ]).then(([dR, sR]) => {
      setDepartements(dR.data.results ?? dR.data);
      const sps = sR.data.results ?? sR.data;
      setSpecialites(sps);
      setFilteredSp(sps);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!depFilter) {
      setFilteredSp(specialites);
      setSpFilter('');
    } else {
      const f = specialites.filter(s => {
        const d = typeof s.code_dep === 'object' ? s.code_dep?.code_dep : s.code_dep;
        return d === depFilter;
      });
      setFilteredSp(f);
      if (spFilter && !f.some(s => s.code_sp === spFilter)) setSpFilter('');
    }
  }, [depFilter, specialites]);

  const { data, loading, error, reload } = useApi(
    () => evaluationService.list({
      page_size: 500,
      ...(depFilter ? { code_dep: depFilter } : {}),
      ...(spFilter  ? { code_sp:  spFilter  } : {}),
    }),
    [depFilter, spFilter]
  );
  const { mutate: create } = useMutation(useCallback((d) => evaluationService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => evaluationService.update(d.code_eval, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => evaluationService.delete(d.code_eval), []));

  const COLS = [
    { key:'etud',  label: lang === 'en' ? `${labels.studentLabel} ID` : `Matricule ${labels.studentLabel.toLowerCase()}`,
      render: r => r.mle_etudiant?.mle_etudiant || r.mle_etudiant },
    { key:'nom',   label: labels.studentLabel,  bold:true, render: r => r.nom_etudiant || r.mle_etudiant?.nom || '—' },
    { key:'mat',   label: t.fields.matiere,  render: r => r.lib_matiere || r.code_matiere?.lib_matiere || '—' },
    { key:'cls',   label: t.fields.classe,   render: r => r.lib_classe || r.code_classe },
    { key:'type',  label: t.fields.type,     render: r => r.lib_type_eval || r.code_type_eval?.lib_type_eval || '—' },
    { key:'date',  label: t.fields.date,     render: r => r.date_eval?.slice(0,10) || '—' },
    { key:'note',  label: t.fields.note, searchValue: r => r.appreciation || r.note, render: r =>
        r.appreciation
          ? <span className={`sms-badge ${APPRECIATION_COLOR[r.appreciation] || 'badge-secondary'}`}>{r.appreciation}</span>
          : <span className={`sms-badge ${noteColor(r.note)}`}>{r.note}/20</span>
    },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={t.pages.evaluations.title} subtitle={t.pages.evaluations.subtitle}
      sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
      icon="fas fa-clipboard-check" columns={COLS} data={data || []} addLabel={t.common.add}
      exportCsvUrl={`/api/evaluations/export-csv/${[depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`].filter(Boolean).join('&') ? '?' + [depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`].filter(Boolean).join('&') : ''}`}
      filters={
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
            value={depFilter} onChange={e => setDepFilter(e.target.value)}>
            <option value="">{t.common.allDepts}</option>
            {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
          </select>
          <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
            value={spFilter} onChange={e => setSpFilter(e.target.value)} disabled={!depFilter}>
            <option value="">{t.common.allSp}</option>
            {filteredSp.map(s => <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>)}
          </select>
          {(depFilter || spFilter) && (
            <button className="sms-btn-icon" onClick={() => { setDepFilter(''); setSpFilter(''); }} title={t.common.reset}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      }
      onAdd={async (d) => { try { await create(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message); } }}
      onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
      onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
      renderForm={p => <Form {...p} />}
    />
  );
}
