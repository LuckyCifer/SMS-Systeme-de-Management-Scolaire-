import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { utilisateurService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const R_STYLE = { ADMIN:'badge-danger', SCOLARITE:'badge-info', ENSEIGNANT:'badge-success', ETUDIANT:'badge-secondary', COMPTABLE:'badge-warning' };

function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const ROLES = [
    { value:'ADMIN',      label: t.roles.admin },
    { value:'SCOLARITE',  label: t.roles.scolarite },
    { value:'ENSEIGNANT', label: t.roles.enseignant },
    { value:'ETUDIANT',   label: t.roles.etudiant },
    { value:'COMPTABLE',  label: t.roles.comptable },
  ];
  const [f, setF] = useState({
    login: item?.login||'', passwd: '', role: item?.role||'', nom_user: item?.nom_user||'',
  });
  const ch = e => setF({ ...f, [e.target.name]: e.target.value });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <FormField label={t.fields.nomComplet}  name="nom_user" value={f.nom_user} onChange={ch} required />
      <div className="sms-form-row">
        <FormField label={t.fields.identifiant} name="login"  value={f.login}  onChange={ch} required placeholder="ex : jdupont" />
        <FormField label={item ? t.fields.mdpOpt : t.fields.mdp} name="passwd" type="password" value={f.passwd} onChange={ch} required={!item} />
      </div>
      <FormField label={t.fields.role} name="role" type="select" value={f.role} onChange={ch} options={ROLES} required />
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { t, toast } = useApp();
  const { data, loading, error, reload } = useApi(() => utilisateurService.list());
  const { mutate: create } = useMutation(useCallback((d) => utilisateurService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => utilisateurService.update(d.login, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => utilisateurService.delete(d.login), []));

  const COLS = [
    { key:'av', label:'', render: r => (
      <div className="sms-avatar" style={{ width:28, height:28, fontSize:10 }}>
        {(r.nom_user||r.login).slice(0,2).toUpperCase()}
      </div>
    )},
    { accessor:'login',    label: t.fields.identifiant, bold:true },
    { accessor:'nom_user', label: t.fields.nomComplet },
    { key:'role', label: t.fields.role, searchValue: r => r.role || '', render: r => (
      <span className={`sms-badge ${R_STYLE[r.role]||'badge-secondary'}`}>{r.role||'—'}</span>
    )},
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
      renderForm={p => <Form {...p} />}
    />
  );
}
