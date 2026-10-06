import { useCallback, useState, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { enseignantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useFormValidation } from '../hooks/useFormValidation';
import { PH } from '../utils/placeholders';
import PhotoProfil from '../components/PhotoProfil';
import { AvatarCircle } from '../utils/avatar';

const S_STYLE = { PERMANENT:'badge-success', VACATAIRE:'badge-warning', CONTRACTUEL:'badge-info' };
const GRADE_LABELS = {
  PROFESSEUR:   'Professeur Titulaire',
  MAITRE_CONF:  'Maître de Conférences',
  CHARGE_COURS: 'Chargé de Cours',
  ASSISTANT:    'Assistant',
  VACATAIRE:    'Vacataire',
};

const fkVal = (v, key) => {
  if (!v) return '';
  const raw = typeof v === 'object' ? (v[key] ?? '') : v;
  return raw.toString().trim();
};

function Form({ item, onClose, onSave }) {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [departements,  setDepartements]  = useState([]);
  const [comptes,       setComptes]       = useState([]);
  const [loadingForm,   setLoadingForm]   = useState(true);
  const [photoFile,     setPhotoFile]     = useState(null);

  const STATUTS = [
    { value:'PERMANENT',   label: t.status.permanent },
    { value:'VACATAIRE',   label: t.status.vacataire },
    { value:'CONTRACTUEL', label: t.status.contractuel },
  ];

  const GRADES = Object.entries(GRADE_LABELS).map(([value, label]) => ({ value, label }));

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
    grade:       item?.grade       || '',
    utilisateur: fkVal(item?.utilisateur, 'login') || '',
  });

  const { errors, validateAll, onBlur: vBlur, onChange: vChange } = useFormValidation({
    mle_ens:   { required: true },
    nom_ens:   { required: true, minLen: 2 },
    email_ens: { email: true },
    tel_ens:   { tel: true },
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/utilisateurs/?page_size=200'),
    ]).then(([depRes, userRes]) => {
      setDepartements(depRes.data.results ?? depRes.data);
      const users = userRes.data.results ?? userRes.data;
      setComptes(users.filter(u => u.role === 'ENSEIGNANT'));
    }).catch(() => toast.error(t.errors.loading))
      .finally(() => setLoadingForm(false));
  }, []);

  const ch = e => {
    const { name, value } = e.target;
    setF(prev => ({ ...prev, [name]: value }));
    vChange(name, value);
  };
  const bl = e => vBlur(e.target.name, e.target.value);

  const handleDeletePhoto = async () => {
    if (!item?.mle_ens) { setPhotoFile(null); return; }
    try {
      await api.delete(`/api/enseignants/${item.mle_ens}/photo/`);
      toast.success('Photo supprimée.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loadingForm) return (
    <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
      <div className="sms-spinner" style={{ width:32, height:32 }}></div>
    </div>
  );

  return (
    <form onSubmit={e => { e.preventDefault(); if (!validateAll(f)) return; onSave({ ...f, code_dep: f.code_dep || null, utilisateur: f.utilisateur || null, _photoFile: photoFile }); }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
        <PhotoProfil
          photoUrl={item?.photo_url || null}
          onChange={setPhotoFile}
          onDelete={handleDeletePhoto}
          label="Photo de l'enseignant"
        />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.matricule} name="mle_ens"    value={f.mle_ens}    onChange={ch} onBlur={bl} required placeholder={PH.matriculeEns} error={errors.mle_ens} />
        <FormField label={t.fields.nom}       name="nom_ens"    value={f.nom_ens}    onChange={ch} onBlur={bl} required placeholder={PH.nomEns} error={errors.nom_ens} />
        <FormField label={t.fields.prenom}    name="prenom_ens" value={f.prenom_ens} onChange={ch} placeholder={PH.prenomEns} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.genre} name="sexe" type="select" value={f.sexe} onChange={ch}
          options={[{ value:'M', label:t.fields.masculin }, { value:'F', label:t.fields.feminin }]} />
        <FormField label={t.fields.numeroCni} name="numero_cni" value={f.numero_cni} onChange={ch} placeholder={PH.numeroCni} />
        <FormField label={t.fields.statut} name="statut" type="select" value={f.statut} onChange={ch} options={STATUTS} />
      </div>
      {typeEtab === 'SUPERIEUR' && (
        <div className="sms-form-row">
          <FormField label="Grade académique" name="grade" type="select" value={f.grade} onChange={ch} options={GRADES} />
        </div>
      )}
      <div className="sms-form-row">
        <SearchableSelect
          label={labels.departementLabel} name="code_dep" value={f.code_dep} onChange={ch}
          options={departements.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
        />
        <FormField label="Compte de connexion" name="utilisateur" type="select"
          value={f.utilisateur} onChange={ch}
          options={comptes.map(c => ({ value: c.login, label: c.nom_user ? `${c.login} — ${c.nom_user}` : c.login }))}
          help="Compte utilisateur (rôle Enseignant) associé — nécessaire pour que cet enseignant ne voie que ses propres matières/classes." />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.tel}   name="tel_ens"   type="tel"   value={f.tel_ens}   onChange={ch} onBlur={bl} placeholder={PH.tel} error={errors.tel_ens} />
        <FormField label={t.fields.email} name="email_ens" type="email" value={f.email_ens} onChange={ch} onBlur={bl} placeholder={PH.emailEns} error={errors.email_ens} />
      </div>
      <FormField label={t.fields.adresse} name="adresse_ens" type="textarea" value={f.adresse_ens} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

const buildPayload = (data) => {
  const { _photoFile, ...fields } = data;
  if (!_photoFile) return fields;
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });
  fd.append('photo', _photoFile);
  return fd;
};

export default function Teachers() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [depFilter,    setDepFilter]    = useState('');
  const [sexeFilter,   setSexeFilter]   = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [departements, setDepartements] = useState([]);

  useEffect(() => {
    api.get('/api/departements/?page_size=100')
      .then(r => setDepartements(r.data.results ?? r.data))
      .catch(() => {});
  }, []);

  const { data, loading, error, reload } = useApi(
    () => enseignantService.list({
      page_size: 200,
      ...(depFilter    ? { code_dep: depFilter    } : {}),
      ...(sexeFilter   ? { sexe:     sexeFilter   } : {}),
      ...(statutFilter ? { statut:   statutFilter } : {}),
    }),
    [depFilter, sexeFilter, statutFilter]
  );
  const handleAdd    = async (d) => { await enseignantService.create(buildPayload(d)); };
  const handleEdit   = async (d) => {
    const payload = buildPayload(d);
    if (payload instanceof FormData) {
      await enseignantService.patch(d.mle_ens, payload);
    } else {
      await enseignantService.update(d.mle_ens, payload);
    }
  };
  const handleRemove = async (d) => { await enseignantService.delete(d.mle_ens); };

  const COLS = [
    { key:'avatar', label:'', render: r => <AvatarCircle nom={r.nom_ens} prenom={r.prenom_ens} photoUrl={r.photo_url} size={36} /> },
    { accessor:'mle_ens',    label: t.fields.matricule },
    { accessor:'nom_ens',    label: t.fields.nom,    bold:true },
    { accessor:'prenom_ens', label: t.fields.prenom },
    { key:'sexe', label:t.fields.genre, searchValue: r => r.sexe === 'M' ? t.fields.masculin : r.sexe === 'F' ? t.fields.feminin : '', render: r => r.sexe
        ? <span className={`sms-badge ${r.sexe === 'M' ? 'badge-info' : 'badge-warning'}`} style={{ gap: 5 }}>
            <i className={`fas fa-${r.sexe === 'M' ? 'mars' : 'venus'}`} style={{ fontSize: 10 }}></i>
            {r.sexe}
          </span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
    { accessor:'numero_cni', label:t.fields.numeroCni, render: r => r.numero_cni || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor:'tel_ens',    label: t.fields.tel },
    { accessor:'email_ens',  label: t.fields.email },
    { key:'statut', label: t.fields.statut, searchValue: r => r.statut || '', render: r => (
      <span className={`sms-badge ${S_STYLE[r.statut]||'badge-secondary'}`}>{r.statut}</span>
    )},
    ...(typeEtab === 'SUPERIEUR' ? [{
      key: 'grade', label: 'Grade', searchValue: r => GRADE_LABELS[r.grade] || '',
      render: r => r.grade
        ? <span className="sms-badge badge-primary" style={{ fontSize: 10 }}>{GRADE_LABELS[r.grade] || r.grade}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    }] : []),
    { key:'dep', label: labels.departementLabel, searchValue: r => r.lib_dep || '', render: r => r.lib_dep
        ? <span className="sms-badge badge-info" style={{ fontSize:10 }}>{r.lib_dep}</span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
    { key:'compte', label: 'Compte lié', render: r => r.utilisateur
        ? <span className="sms-badge badge-success" style={{ fontSize:10 }}>
            <i className="fas fa-link" style={{ marginRight:4 }}></i>
            {typeof r.utilisateur === 'object' ? r.utilisateur.login : r.utilisateur}
          </span>
        : <span className="sms-badge badge-secondary" style={{ fontSize:10 }}>Non lié</span>
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
      exportCsvUrl={`/api/enseignants/export-xlsx/${[depFilter && `code_dep=${depFilter}`, sexeFilter && `sexe=${sexeFilter}`, statutFilter && `statut=${statutFilter}`].filter(Boolean).join('&') ? '?' + [depFilter && `code_dep=${depFilter}`, sexeFilter && `sexe=${sexeFilter}`, statutFilter && `statut=${statutFilter}`].filter(Boolean).join('&') : ''}`}
      filters={
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
            value={depFilter} onChange={e => setDepFilter(e.target.value)}>
            <option value="">{t.common.allDepts}</option>
            {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
          </select>
          <select className="sms-input" style={{ height: 34, minWidth: 140, fontSize: 12 }}
            value={sexeFilter} onChange={e => setSexeFilter(e.target.value)}>
            <option value="">{t.common.allGenres}</option>
            <option value="M">{t.fields.masculin}</option>
            <option value="F">{t.fields.feminin}</option>
          </select>
          <select className="sms-input" style={{ height: 34, minWidth: 150, fontSize: 12 }}
            value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
            <option value="">{t.common.allStatuts}</option>
            <option value="PERMANENT">{t.status.permanent}</option>
            <option value="CONTRACTUEL">{t.status.contractuel}</option>
            <option value="VACATAIRE">{t.status.vacataire}</option>
          </select>
          {(depFilter || sexeFilter || statutFilter) && (
            <button className="sms-btn-icon" onClick={() => { setDepFilter(''); setSexeFilter(''); setStatutFilter(''); }} title={t.common.reset}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      }
      onAdd={async (d) => {
        try { await handleAdd(d); toast.success(t.toast.added); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onEdit={async (d) => {
        try { await handleEdit(d); toast.success(t.toast.updated); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onDelete={async (d) => {
        try { await handleRemove(d); toast.success(t.toast.deleted); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      renderForm={p => <Form {...p} />}
    />
  );
}
