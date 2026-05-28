/**
 * pages/Examens.jsx — Planning des examens et convocations
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { examenService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const [matieres, setMat]     = useState([]);
  const [classes,  setClasses] = useState([]);
  const [annees,   setAnnees]  = useState([]);
  const [periodes, setPer]     = useState([]);
  const [loading,  setLoad]    = useState(true);

  const [f, setF] = useState({
    lib_examen:   item?.lib_examen  || '',
    code_matiere: item?.code_matiere || '',
    code_classe:  item?.code_classe  || '',
    code_annee:   item?.code_annee   || '',
    code_periode: item?.code_periode || '',
    code_salle:   item?.code_salle   || '',
    date_examen:  item?.date_examen?.slice(0, 16) || '',
    duree_minutes:item?.duree_minutes || 60,
    type_examen:  item?.type_examen  || 'ECRIT',
    surveillant:  item?.surveillant  || '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/matieres/?page_size=200'),
      api.get('/api/classes/?page_size=100'),
      api.get('/api/annees/?page_size=20'),
      api.get('/api/periodes/?page_size=50'),
    ]).then(([m, c, a, p]) => {
      setMat(m.data.results ?? m.data);
      setClasses(c.data.results ?? c.data);
      setAnnees(a.data.results ?? a.data);
      setPer(p.data.results ?? p.data);
    }).finally(() => setLoad(false));
  }, []);

  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="sms-spinner" style={{ width: 32, height: 32, margin: 'auto' }}></div></div>;

  const TYPES_EXAMEN = [
    { value: 'ECRIT', label: t.types.ecrit },
    { value: 'ORAL',  label: t.types.oral },
    { value: 'TP',    label: t.types.tp },
    { value: 'MIXTE', label: t.types.mixte },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <FormField label={`${t.fields.libExamen} *`} name="lib_examen" value={f.lib_examen} onChange={ch} required placeholder="Ex: Examen de mi-semestre S1" />
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.matiere} *</label>
          <select className="sms-input" name="code_matiere" value={f.code_matiere} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {matieres.map(m => <option key={m.code_matiere} value={m.code_matiere}>{m.lib_matiere}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.classe} *</label>
          <select className="sms-input" name="code_classe" value={f.code_classe} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {classes.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
          </select>
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
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.periode}</label>
          <select className="sms-input" name="code_periode" value={f.code_periode} onChange={ch}>
            <option value="">{t.common.select}</option>
            {periodes.map(p => <option key={p.code_periode} value={p.code_periode}>{p.lib_periode}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        <FormField label={`${t.fields.date} *`} name="date_examen" type="datetime-local" value={f.date_examen} onChange={ch} required />
        <FormField label={t.fields.duree}        name="duree_minutes" type="number" value={f.duree_minutes} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.typeExamen}</label>
          <select className="sms-input" name="type_examen" value={f.type_examen} onChange={ch}>
            {TYPES_EXAMEN.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <FormField label={t.fields.salle}       name="code_salle"  value={f.code_salle}  onChange={ch} />
        <FormField label={t.fields.surveillant} name="surveillant" value={f.surveillant} onChange={ch} placeholder={t.fields.mleEns} />
      </div>
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Examens() {
  const { t, toast } = useApp();
  const [generating, setGenerating] = useState(null);

  const { data, loading, error, reload } = useApi(() => examenService.list({ page_size: 100 }));
  const { mutate: create } = useMutation(useCallback(d => examenService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => examenService.update(d.code_examen, d), []));
  const { mutate: remove } = useMutation(useCallback(d => examenService.delete(d.code_examen), []));

  const handleGenererConvocations = async (examen) => {
    setGenerating(examen.code_examen);
    try {
      const res = await examenService.genererConvocations(examen.code_examen);
      toast.success(`${res.data.generated} ${t.common.convocSent} "${examen.lib_examen}".`);
      reload();
    } catch { toast.error(t.toast.error); }
    finally  { setGenerating(null); }
  };

  const COLS = [
    { accessor: 'lib_examen',   label: t.fields.libExamen, bold: true },
    { key: 'mat',     label: t.fields.matiere,   render: r => r.lib_matiere || r.code_matiere },
    { key: 'classe',  label: t.fields.classe,    render: r => r.lib_classe  || r.code_classe },
    { key: 'date',    label: t.fields.date,      render: r => r.date_examen?.slice(0, 16).replace('T', ' ') || '—' },
    { key: 'duree',   label: t.fields.duree,     render: r => `${r.duree_minutes} min` },
    { accessor: 'type_examen', label: t.fields.typeExamen },
    { accessor: 'code_salle',  label: t.fields.salle },
    { key: 'conv',    label: t.common.convoc, render: r => (
      r.convocation_envoyee
        ? <span className="sms-badge badge-success"><i className="fas fa-check"></i> {t.common.convocSent}</span>
        : <span className="sms-badge badge-secondary">{t.common.convocNotSent}</span>
    )},
    { key: 'actions', label: '', render: r => (
      !r.convocation_envoyee && (
        <button className="sms-btn sms-btn-outline sms-btn-sm"
          onClick={e => { e.stopPropagation(); handleGenererConvocations(r); }}
          disabled={generating === r.code_examen}>
          {generating === r.code_examen
            ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
            : <><i className="fas fa-envelope"></i> {t.common.convoquer}</>}
        </button>
      )
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={t.pages.examens.title}
      subtitle={t.pages.examens.subtitle}
      icon="fas fa-pen-alt"
      columns={COLS}
      data={data || []}
      addLabel={t.pages.examens.addLabel}
      onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
      onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
      onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
      renderForm={p => <Form {...p} />}
    />
  );
}
