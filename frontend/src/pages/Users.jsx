import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { utilisateurService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const R_STYLE = {
  SUPER_ADMIN:'badge-purple', ADMIN:'badge-danger', SCOLARITE:'badge-info', ENSEIGNANT:'badge-success',
  ETUDIANT:'badge-secondary', COMPTABLE:'badge-warning', DIRECTION:'badge-primary',
  CENSEUR:'badge-info', SURVEILLANT_GENERAL:'badge-warning', APEE:'badge-purple',
};

const TYPE_ETAB_OPTS_USER = [
  { value: '',           label: '— Tous types (SUPER_ADMIN) —' },
  { value: 'PRIMAIRE',   label: 'Primaire' },
  { value: 'SECONDAIRE', label: 'Secondaire' },
  { value: 'SUPERIEUR',  label: 'Supérieur' },
];

function Form({ item, onClose, onSave, defaultTypeEtab }) {
  const { t, lang } = useApp();
  const [f, setF] = useState({
    login:    item?.login    || '',
    passwd:   '',
    role:     item?.role     || '',
    nom_user: item?.nom_user || '',
    type_etab: item?.type_etab !== undefined ? item.type_etab : (defaultTypeEtab || ''),
  });
  const ch = e => setF({ ...f, [e.target.name]: e.target.value });
  const isSuperAdmin = f.role === 'SUPER_ADMIN';
  // Le libellé "Étudiant"/"Élève" doit refléter le type_etab CHOISI dans ce formulaire
  // (le compte créé peut appartenir à un établissement différent de celui actuellement
  // connecté, seul un SUPER_ADMIN pouvant d'ailleurs faire ce choix librement).
  const formLabels = etabLabels(f.type_etab || defaultTypeEtab, 'FRANCOPHONE', lang);
  const ROLES = [
    { value:'SUPER_ADMIN', label: 'Super Administrateur' },
    { value:'ADMIN',       label: t.roles.admin },
    { value:'SCOLARITE',   label: t.roles.scolarite },
    { value:'ENSEIGNANT',  label: t.roles.enseignant },
    { value:'ETUDIANT',    label: formLabels.studentLabel },
    { value:'COMPTABLE',   label: t.roles.comptable },
    { value:'DIRECTION',   label: 'Direction' },
    { value:'CENSEUR',             label: t.roles.censeur },
    { value:'SURVEILLANT_GENERAL', label: t.roles.surveillantGeneral },
    { value:'APEE',                label: t.roles.apee },
  ];
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, type_etab: isSuperAdmin ? null : (f.type_etab || null) }); }}>
      <FormField label={t.fields.nomComplet} name="nom_user" value={f.nom_user} onChange={ch} required placeholder="Ex : Jean Dupont" />
      <div className="sms-form-row">
        <FormField label={t.fields.identifiant} name="login"  value={f.login}  onChange={ch} required placeholder="Ex : j.dupont" disabled={!!item} />
        <FormField label={item ? t.fields.mdpOpt : t.fields.mdp} name="passwd" type="password" value={f.passwd} onChange={ch} required={!item} placeholder="••••••••" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.role} name="role" type="select" value={f.role} onChange={ch} options={ROLES} required />
        {!isSuperAdmin && (
          <FormField label={t.nav.typeEtab} name="type_etab" type="select"
            value={f.type_etab} onChange={ch}
            options={TYPE_ETAB_OPTS_USER.filter(o => o.value !== '')}
            required={!isSuperAdmin} />
        )}
        {isSuperAdmin && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'flex-end', paddingBottom: 8 }}>
            <i className="fas fa-shield-alt" style={{ marginRight: 5, color: '#c4b5fd' }}></i>
            {t.pages.users.allTypesAccess}
          </div>
        )}
      </div>
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { t, toast, lang } = useApp();
  const { typeEtab } = useEtablissement();
  const { data, loading, error, reload } = useApi(() => utilisateurService.list());
  const { mutate: create } = useMutation(useCallback((d) => utilisateurService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => utilisateurService.update(d.login, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => utilisateurService.delete(d.login), []));

  // Le rôle ETUDIANT se traduit par le libellé du TYPE D'ÉTABLISSEMENT DE CE COMPTE (pas
  // celui de l'établissement actuellement connecté) — un SUPER_ADMIN peut lister des
  // comptes de plusieurs établissements de types différents dans le même tableau.
  const ROLE_LABELS = {
    SUPER_ADMIN: 'Super Administrateur', ADMIN: t.roles.admin, SCOLARITE: t.roles.scolarite,
    ENSEIGNANT: t.roles.enseignant, COMPTABLE: t.roles.comptable, DIRECTION: 'Direction',
    CENSEUR: t.roles.censeur, SURVEILLANT_GENERAL: t.roles.surveillantGeneral, APEE: t.roles.apee,
  };
  const roleLabel = r => r.role === 'ETUDIANT'
    ? etabLabels(r.type_etab || typeEtab, 'FRANCOPHONE', lang).studentLabel
    : (ROLE_LABELS[r.role] || r.role || '—');

  const COLS = [
    { key:'av', label:'', render: r => (
      <div className="sms-avatar" style={{ width:28, height:28, fontSize:10 }}>
        {(r.nom_user||r.login).slice(0,2).toUpperCase()}
      </div>
    )},
    { accessor:'login',    label: t.fields.identifiant, bold:true },
    { accessor:'nom_user', label: t.fields.nomComplet },
    { key:'role', label: t.fields.role, searchValue: r => r.role || '', render: r => (
      <span className={`sms-badge ${R_STYLE[r.role]||'badge-secondary'}`}>{roleLabel(r)}</span>
    )},
    { key:'type', label: "Type étab.", render: r => r.lib_type_etab
        ? <span style={{ fontSize:10, color:'#7dd3fc' }}>{r.lib_type_etab}</span>
        : <span style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic' }}>Tous</span>
    },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={t.pages.users.title} subtitle={t.pages.users.subtitle}
      icon="fas fa-users-cog" columns={COLS} data={data || []} addLabel={t.common.add}
      onAdd={async (d) => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
      onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
      onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
      renderForm={p => <Form {...p} defaultTypeEtab={typeEtab} />}
    />
  );
}
