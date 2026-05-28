/**
 * pages/Students.jsx
 * Correction : filtre spécialités par filière (code_dep peut être objet ou string)
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { etudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

// ── Utilitaire : extrait la valeur string d'un FK (objet ou string) ──────────
const fkVal = (v, key) => {
  if (!v) return '';
  if (typeof v === 'object') return v[key] ?? '';
  return v;
};

// ── Formulaire ───────────────────────────────────────────────────────────────
function Form({ item, onClose, onSave, labels }) {
  const { t, toast } = useApp();
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);
  const [loadingForm,  setLoadingForm]  = useState(true);

  const [f, setF] = useState({
    mle_etudiant: item?.mle_etudiant || '',
    nom:          item?.nom          || '',
    prenom:       item?.prenom       || '',
    sexe:         item?.sexe         || '',
    numero_cni:   item?.numero_cni   || '',
    date_naiss:   item?.date_naiss?.slice(0, 10) || '',
    lieu:         item?.lieu         || '',
    region_or:    item?.region_or    || '',
    // code_dep peut arriver comme objet {code_dep, lib_dep} ou string
    code_dep:     fkVal(item?.code_dep, 'code_dep') || '',
    code_sp:      fkVal(item?.code_sp,  'code_sp')  || '',
    nom_pere:     item?.nom_pere     || '',
    nom_mere:     item?.nom_mere     || '',
    tel:          item?.tel          || '',
    email:        item?.email        || '',
    domicile:     item?.domicile     || '',
    nom_tuteur:   item?.nom_tuteur   || '',
    adresse:      item?.adresse      || '',
  });

  // Charge les listes au montage
  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
    ]).then(([depRes, spRes]) => {
      setDepartements(depRes.data.results ?? depRes.data);
      setSpecialites(spRes.data.results  ?? spRes.data);
    }).catch(() => {
      toast.error(t.errors.loading);
    }).finally(() => {
      setLoadingForm(false);
    });
  }, []);

  // Filtre les spécialités quand la filière change
  useEffect(() => {
    if (!f.code_dep) {
      setFilteredSp(specialites);
      return;
    }
    // code_dep dans la spécialité peut être un objet ou une string
    const filtered = specialites.filter(s => {
      const spDep = fkVal(s.code_dep, 'code_dep');
      return spDep === f.code_dep;
    });
    setFilteredSp(filtered);
    // Si la spécialité sélectionnée n'appartient plus à la filière, reset
    if (f.code_sp) {
      const stillValid = filtered.some(s => s.code_sp === f.code_sp);
      if (!stillValid) {
        setF(prev => ({ ...prev, code_sp: '' }));
      }
    }
  }, [f.code_dep, specialites]);

  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  if (loadingForm) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="sms-spinner" style={{ width: 32, height: 32 }}></div>
    </div>
  );

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      {/* Filière + Spécialité */}
      <div className="sms-form-row">
        <SearchableSelect
          label={labels?.departementLabel || t.fields.departement} name="code_dep" value={f.code_dep} onChange={ch}
          options={departements.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
        />
        <SearchableSelect
          label={labels?.specialiteLabel || t.fields.specialite} name="code_sp" value={f.code_sp} onChange={ch}
          options={filteredSp.map(s => ({ value: s.code_sp, label: s.lib_sp }))}
          disabled={!f.code_dep}
        />
      </div>

      {/* Infos principales */}
      <div className="sms-form-row">
        <FormField label={t.fields.matricule} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required placeholder="ETU001" />
        <FormField label={t.fields.nom}       name="nom"          value={f.nom}          onChange={ch} required />
        <FormField label={t.fields.prenom}    name="prenom"       value={f.prenom}       onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.genre} name="sexe" type="select" value={f.sexe} onChange={ch}
          options={[{ value:'M', label:t.fields.masculin }, { value:'F', label:t.fields.feminin }]} />
        <FormField label={t.fields.numeroCni} name="numero_cni" value={f.numero_cni} onChange={ch} placeholder="Ex: 123456789" />
        <FormField label={t.fields.dateNaiss} name="date_naiss" type="date" value={f.date_naiss} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.lieu}   name="lieu"      value={f.lieu}      onChange={ch} />
        <FormField label={t.fields.region} name="region_or" value={f.region_or} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.tel}      name="tel"      type="tel"   value={f.tel}      onChange={ch} />
        <FormField label={t.fields.email}    name="email"    type="email" value={f.email}    onChange={ch} />
        <FormField label={t.fields.domicile} name="domicile"              value={f.domicile} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.pere}   name="nom_pere"   value={f.nom_pere}   onChange={ch} />
        <FormField label={t.fields.mere}   name="nom_mere"   value={f.nom_mere}   onChange={ch} />
        <FormField label={t.fields.tuteur} name="nom_tuteur" value={f.nom_tuteur} onChange={ch} required />
      </div>
      <FormField label={t.fields.adresse} name="adresse" type="textarea" value={f.adresse} onChange={ch} />

      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Students() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [depFilter,    setDepFilter]    = useState('');
  const [departements, setDepartements] = useState([]);

  const { data, loading, error, reload } = useApi(
    () => etudiantService.list({ page_size: 100, ...(depFilter ? { code_dep: depFilter } : {}) }),
    [depFilter]
  );

  const { mutate: create } = useMutation(useCallback(d => etudiantService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => etudiantService.update(d.mle_etudiant, d), []));
  const { mutate: remove } = useMutation(useCallback(d => etudiantService.delete(d.mle_etudiant), []));

  useEffect(() => {
    api.get('/api/departements/?page_size=100')
      .then(r => setDepartements(r.data.results ?? r.data))
      .catch(() => {});
  }, []);

  const COLS = [
    { accessor: 'mle_etudiant', label: t.fields.matricule },
    { accessor: 'nom',          label: t.fields.nom,      bold: true },
    { accessor: 'prenom',       label: t.fields.prenom },
    { key: 'sexe', label: t.fields.genre, searchValue: r => r.sexe === 'M' ? t.fields.masculin : r.sexe === 'F' ? t.fields.feminin : '', render: r => r.sexe
        ? <span className={`sms-badge ${r.sexe === 'M' ? 'badge-info' : 'badge-warning'}`}>{r.sexe === 'M' ? t.fields.masculin : t.fields.feminin}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { accessor: 'numero_cni',   label: t.fields.numeroCni, render: r => r.numero_cni || <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'date',  label: t.fields.dateNaiss, render: r => r.date_naiss?.slice(0, 10) || '—' },
    { accessor: 'tel',          label: t.fields.tel },
    { key: 'dep',   label: labels.departementLabel, searchValue: r => r.lib_dep || '', render: r => r.lib_dep
        ? <span className="sms-badge badge-info" style={{ fontSize: 10 }}>{r.lib_dep}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { key: 'sp',    label: labels.specialiteLabel, render: r => r.lib_sp || '—' },
    { accessor: 'lieu',        label: t.fields.lieu,        render: r => r.lieu      || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor: 'region_or',   label: t.fields.region,      render: r => r.region_or || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor: 'nationalite', label: t.fields.nationalite, render: r => r.nationalite || <span style={{ color:'var(--text-muted)' }}>—</span> },
  ];

  const handleBulkDelete = async (ids) => {
    await api.post('/api/etudiants/bulk-delete/', { ids });
    reload();
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={labels.studentsPageTitle}
      subtitle={labels.studentsPageSubtitle}
      sortBy="nom"
      icon="fas fa-user-graduate"
      columns={COLS}
      data={data || []}
      addLabel={t.common.add}
      exportCsvUrl="/api/etudiants/export-csv/"
      onBulkDelete={handleBulkDelete}
      filters={
        <div className="flex gap-2 items-center">
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {t.common.filter} {labels.departementLabel} :
          </label>
          <select
            className="sms-input"
            style={{ height: 34, minWidth: 180, fontSize: 12 }}
            value={depFilter}
            onChange={e => setDepFilter(e.target.value)}
          >
            <option value="">{labels.allDepsLabel}</option>
            {departements.map(d => (
              <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>
            ))}
          </select>
          {depFilter && (
            <button className="sms-btn-icon" onClick={() => setDepFilter('')} title="Effacer le filtre">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      }
      onAdd={async d => { try { await create(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      renderForm={p => <Form {...p} labels={labels} />}
    />
  );
}
