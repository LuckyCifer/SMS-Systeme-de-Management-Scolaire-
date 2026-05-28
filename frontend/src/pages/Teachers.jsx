import { useCallback, useState, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { enseignantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const S_STYLE = { PERMANENT:'badge-success', VACATAIRE:'badge-warning', CONTRACTUEL:'badge-info' };

const fkVal = (v, key) => {
  if (!v) return '';
  if (typeof v === 'object') return v[key] ?? '';
  return v;
};

function Form({ item, onClose, onSave }) {
  const { t, toast } = useApp();
  const [departements,  setDepartements]  = useState([]);
  const [loadingForm,   setLoadingForm]   = useState(true);

  const STATUTS = [
    { value:'PERMANENT',   label: t.status.permanent },
    { value:'VACATAIRE',   label: t.status.vacataire },
    { value:'CONTRACTUEL', label: t.status.contractuel },
  ];

  const [f, setF] = useState({
    mle_ens:     item?.mle_ens     || '',
    nom_ens:     item?.nom_ens     || '',
    prenom_ens:  item?.prenom_ens  || '',
    sexe:        item?.sexe        || '',
    numero_cni:  item?.numero_cni  || '',
    code_dep:    fkVal(item?.code_dep, 'code_dep') || '',
    adresse_ens: item?.adresse_ens || '',
    tel_ens:     item?.tel_ens     || '',
    email_ens:   item?.email_ens   || '',
    statut:      item?.statut      || '',
  });

  useEffect(() => {
    api.get('/api/departements/?page_size=100')
      .then(r => setDepartements(r.data.results ?? r.data))
      .catch(() => toast.error(t.errors.loading))
      .finally(() => setLoadingForm(false));
  }, []);

  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  if (loadingForm) return (
    <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
      <div className="sms-spinner" style={{ width:32, height:32 }}></div>
    </div>
  );

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, code_dep: f.code_dep || null }); }}>
      <div className="sms-form-row">
        <FormField label={t.fields.matricule} name="mle_ens"    value={f.mle_ens}    onChange={ch} required />
        <FormField label={t.fields.nom}       name="nom_ens"    value={f.nom_ens}    onChange={ch} required />
        <FormField label={t.fields.prenom}    name="prenom_ens" value={f.prenom_ens} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.genre} name="sexe" type="select" value={f.sexe} onChange={ch}
          options={[{ value:'M', label:t.fields.masculin }, { value:'F', label:t.fields.feminin }]} />
        <FormField label={t.fields.numeroCni} name="numero_cni" value={f.numero_cni} onChange={ch} placeholder="Ex: 123456789" />
        <FormField label={t.fields.statut} name="statut" type="select" value={f.statut} onChange={ch} options={STATUTS} />
      </div>
      <div className="sms-form-row">
        <SearchableSelect
          label={t.fields.departement} name="code_dep" value={f.code_dep} onChange={ch}
          options={departements.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
        />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.tel}   name="tel_ens"   type="tel"   value={f.tel_ens}   onChange={ch} />
        <FormField label={t.fields.email} name="email_ens" type="email" value={f.email_ens} onChange={ch} />
      </div>
      <FormField label={t.fields.adresse} name="adresse_ens" type="textarea" value={f.adresse_ens} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Teachers() {
  const { t, toast } = useApp();
  const { data, loading, error, reload } = useApi(() => enseignantService.list({ page_size: 200 }));
  const { mutate: create } = useMutation(useCallback((d) => enseignantService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => enseignantService.update(d.mle_ens, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => enseignantService.delete(d.mle_ens), []));

  const COLS = [
    { accessor:'mle_ens',    label: t.fields.matricule },
    { accessor:'nom_ens',    label: t.fields.nom,    bold:true },
    { accessor:'prenom_ens', label: t.fields.prenom },
    { key:'sexe', label:t.fields.genre, searchValue: r => r.sexe === 'M' ? t.fields.masculin : r.sexe === 'F' ? t.fields.feminin : '', render: r => r.sexe
        ? <span className={`sms-badge ${r.sexe === 'M' ? 'badge-info' : 'badge-warning'}`}>{r.sexe === 'M' ? t.fields.masculin : t.fields.feminin}</span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
    { accessor:'numero_cni', label:t.fields.numeroCni, render: r => r.numero_cni || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor:'tel_ens',    label: t.fields.tel },
    { accessor:'email_ens',  label: t.fields.email },
    { key:'statut', label: t.fields.statut, searchValue: r => r.statut || '', render: r => (
      <span className={`sms-badge ${S_STYLE[r.statut]||'badge-secondary'}`}>{r.statut}</span>
    )},
    { key:'dep', label: t.fields.departement2, searchValue: r => r.lib_dep || '', render: r => r.lib_dep
        ? <span className="sms-badge badge-info" style={{ fontSize:10 }}>{r.lib_dep}</span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={t.pages.teachers.title}
      subtitle={t.pages.teachers.subtitle}
      sortBy="nom_ens"
      icon="fas fa-chalkboard-teacher"
      columns={COLS}
      data={data || []}
      addLabel={t.common.add}
      onAdd={async (d) => {
        try { await create(d); toast.success(t.toast.added); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onEdit={async (d) => {
        try { await update(d); toast.success(t.toast.updated); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onDelete={async (d) => {
        try { await remove(d); toast.success(t.toast.deleted); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      renderForm={p => <Form {...p} />}
    />
  );
}
