import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import {
  coursService, matiereService, classeService,
  enseignantService, anneeService,
} from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

// ── Formulaire ────────────────────────────────────────────────────────────────
function CoursForm({ item, onClose, onSave }) {
  const { t } = useApp();
  const [f, setF] = useState({
    code_matiere:  item?.code_matiere  || '',
    code_classe:   item?.code_classe   || '',
    mle_ens:       item?.mle_ens       || '',
    semestre:      item?.semestre      || 'S1',
    code_annee:    item?.code_annee    || '',
    quota_horaire: item?.quota_horaire ?? 20,
    credits:       item?.credits       ?? 0,
    groupes:       item?.groupes       || '',
  });
  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const { data: matieres }    = useApi(() => matiereService.list({ page_size: 200 }));
  const { data: classes }     = useApi(() => classeService.list({ page_size: 100 }));
  const { data: enseignants } = useApi(() => enseignantService.list({ page_size: 200 }));
  const { data: annees }      = useApi(() => anneeService.list({ page_size: 20 }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      onSave({ ...f, mle_ens: f.mle_ens || null });
    }}>
      <div className="sms-form-row">
        <FormField
          label={t.fields.matiere} name="code_matiere" type="searchable"
          value={f.code_matiere} onChange={ch} required
          options={(matieres || []).map(m => ({
            value: m.code_matiere,
            label: `${m.code_matiere} — ${m.lib_matiere}`,
          }))}
        />
        <FormField
          label={t.fields.classe} name="code_classe" type="searchable"
          value={f.code_classe} onChange={ch} required
          options={(classes || []).map(c => ({
            value: c.code_classe,
            label: c.lib_classe || c.code_classe,
          }))}
        />
      </div>

      <div className="sms-form-row">
        <FormField
          label={t.fields.enseignant} name="mle_ens" type="searchable"
          value={f.mle_ens} onChange={ch}
          options={(enseignants || []).map(e => ({
            value: e.mle_ens,
            label: `${e.nom_ens} ${e.prenom_ens || ''}`.trim(),
          }))}
        />
        <FormField
          label={t.fields.semestre} name="semestre" type="select"
          value={f.semestre} onChange={ch} required
          options={[
            { value: 'S1', label: t.pages.planning.sem1 },
            { value: 'S2', label: t.pages.planning.sem2 },
          ]}
        />
      </div>

      <div className="sms-form-row">
        <FormField
          label={t.fields.annee} name="code_annee" type="searchable"
          value={f.code_annee} onChange={ch} required
          options={(annees || []).map(a => ({
            value: a.code_annee,
            label: a.lib_annee || a.code_annee,
          }))}
        />
        <FormField
          label={t.fields.quota} name="quota_horaire" type="number"
          value={f.quota_horaire} onChange={ch} required
        />
        <FormField
          label={t.fields.credits} name="credits" type="number"
          value={f.credits} onChange={ch}
        />
      </div>

      <FormField
        label={t.fields.groupes}
        name="groupes"
        value={f.groupes}
        onChange={ch}
        placeholder="Ex : GI1, GL1, IA1 — cours en Amphi A"
      />

      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Cours() {
  const { t, toast } = useApp();
  const { data, loading, error, reload } = useApi(
    useCallback(() => coursService.list({ page_size: 200 }), [])
  );
  const { mutate: create } = useMutation(useCallback(d => coursService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => coursService.update(d.id, d), []));
  const { mutate: remove } = useMutation(useCallback(d => coursService.delete(d.id), []));

  const COLS = [
    { key: 'mat', label: t.common.colCode,         render: r => r.code_matiere?.code_matiere || r.code_matiere },
    { key: 'lib', label: t.fields.matiere,          bold: true, render: r => r.lib_matiere || '—' },
    { key: 'cls', label: t.fields.classe,           render: r => r.lib_classe || r.code_classe },
    { key: 'ens', label: t.fields.enseignant,       render: r => r.nom_ens || '—' },
    { key: 'sem', label: t.fields.semestre, searchValue: r => r.semestre, render: r => (
      <span className="sms-badge badge-info">{r.semestre || '—'}</span>
    )},
    { key: 'ann', label: t.common.colYear,          render: r => r.lib_annee || r.code_annee || '—' },
    { key: 'qh',  label: t.pages.courses.quotaCol,  render: r => r.quota_horaire ?? '—' },
    { key: 'cr',  label: t.fields.credits,          render: r => r.credits ?? '—' },
    { key: 'grp', label: t.pages.courses.groupesCol, searchValue: r => r.groupes || '', render: r => r.groupes
        ? <span style={{ fontSize:11, color:'var(--warning)', fontStyle:'italic' }}>
            <i className="fas fa-users" style={{ marginRight:4 }}></i>{r.groupes}
          </span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={t.pages.courses.title}
      subtitle={t.pages.courses.subtitle}
      sortBy={r => r.lib_matiere || ''}
      icon="fas fa-book-open"
      columns={COLS}
      data={data || []}
      addLabel={t.pages.courses.addLabel}
      onAdd={async d => {
        try { await create(d); toast.success(t.toast.added); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onEdit={async d => {
        try { await update(d); toast.success(t.toast.updated); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      onDelete={async d => {
        try { await remove(d); toast.success(t.toast.deleted); reload(); }
        catch (e) { toast.error(e.message); }
      }}
      renderForm={p => <CoursForm {...p} />}
    />
  );
}
