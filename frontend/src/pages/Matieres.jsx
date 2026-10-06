/**
 * pages/Matieres.jsx
 * Gestion des matières + gestion inline des modules via modal dédié.
 */
import { useState, useCallback, useMemo } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { matiereService, moduleService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

// ── Modal gestion des modules ─────────────────────────────────────────────────
function ModuleModal({ modules, onClose, onCreate, onUpdate, onDelete, reloadModules }) {
  const { t, toast } = useApp();
  const EMPTY = { code_module: '', lib_module: '', obs_module: '' };
  const [form, setForm]           = useState(null);   // null | { mode, data }
  const [delConfirm, setDelConfirm] = useState(null); // module à confirmer
  const [saving, setSaving]       = useState(false);

  const chForm = e => setForm(f => ({ ...f, data: { ...f.data, [e.target.name]: e.target.value } }));

  const openAdd  = ()  => setForm({ mode: 'add',  data: { ...EMPTY } });
  const openEdit = mod => setForm({ mode: 'edit', data: {
    code_module: mod.code_module,
    lib_module:  mod.lib_module,
    obs_module:  mod.obs_module || '',
  }});
  const cancelForm = () => setForm(null);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.mode === 'add') {
        await onCreate(form.data);
        toast.success(t.pages.matieres.moduleAdded);
      } else {
        await onUpdate(form.data.code_module, form.data);
        toast.success(t.pages.matieres.moduleUpdated);
      }
      await reloadModules();
      setForm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async mod => {
    try {
      await onDelete(mod.code_module);
      toast.success(t.pages.matieres.moduleDeleted);
      await reloadModules();
      setDelConfirm(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête */}
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-layer-group" style={{ marginRight: 8, color: 'var(--green)' }}></i>
            {t.pages.matieres.moduleMgmt}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!form && (
              <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={openAdd}>
                <i className="fas fa-plus"></i> {t.pages.matieres.newModule}
              </button>
            )}
            <button className="sms-btn-icon" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="sms-modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Formulaire ajout / édition ── */}
          {form && (
            <form onSubmit={handleSubmit}>
              <div style={{
                background: form.mode === 'add' ? 'var(--green-glow)' : '#42a5f510',
                border: `1px solid ${form.mode === 'add' ? 'var(--green-dark)' : '#42a5f540'}`,
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.mode === 'add' ? 'var(--green)' : '#42a5f5', marginBottom: 12 }}>
                  <i className={`fas ${form.mode === 'add' ? 'fa-plus-circle' : 'fa-edit'}`} style={{ marginRight: 6 }}></i>
                  {form.mode === 'add' ? t.pages.matieres.newModule : `${t.pages.parametrage.modify} — ${form.data.code_module}`}
                </div>

                <div className="sms-form-row" style={{ marginBottom: 10 }}>
                  {/* Code */}
                  <div>
                    <label className="sms-label">
                      Code <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      className="sms-input"
                      name="code_module"
                      value={form.data.code_module}
                      onChange={chForm}
                      required maxLength={10}
                      placeholder="Ex : MATH"
                      disabled={form.mode === 'edit'}
                      style={form.mode === 'edit' ? { opacity: .55, cursor: 'not-allowed' } : {}}
                    />
                    {form.mode === 'edit' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                        {t.pages.matieres.notEditable}
                      </span>
                    )}
                  </div>
                  {/* Libellé */}
                  <div>
                    <label className="sms-label">
                      {t.fields.libelle} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      className="sms-input"
                      name="lib_module"
                      value={form.data.lib_module}
                      onChange={chForm}
                      required maxLength={25}
                      placeholder="Ex : Mathématiques"
                    />
                  </div>
                </div>

                {/* Observations */}
                <div style={{ marginBottom: 12 }}>
                  <label className="sms-label">{t.fields.obs}</label>
                  <input
                    className="sms-input"
                    name="obs_module"
                    value={form.data.obs_module}
                    onChange={chForm}
                    maxLength={45}
                    placeholder={t.common.obsPlaceholder}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={cancelForm}>
                    {t.common.cancel}
                  </button>
                  <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm" disabled={saving}>
                    {saving
                      ? <><div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }}></div>{t.common.loading}</>
                      : <><i className="fas fa-save"></i> {t.common.save}</>
                    }
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── Liste des modules ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {modules?.length ?? 0} module{(modules?.length ?? 0) > 1 ? 's' : ''}
            </div>

            {(!modules || modules.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <i className="fas fa-layer-group" style={{ fontSize: 28, marginBottom: 8, display: 'block', opacity: .4 }}></i>
                {t.pages.matieres.noModules}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modules.map(mod => (
                  <div key={mod.code_module}>
                    {/* Ligne module */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8,
                      border: `1px solid ${delConfirm?.code_module === mod.code_module ? 'var(--danger)' : 'var(--border)'}`,
                      background: delConfirm?.code_module === mod.code_module
                        ? '#ef535008'
                        : form?.data?.code_module === mod.code_module && form?.mode === 'edit'
                          ? '#42a5f508'
                          : 'var(--bg-hover)',
                      transition: 'var(--transition)',
                    }}>
                      {/* Badge code */}
                      <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
                        color: 'var(--green)', background: 'var(--green-glow)',
                        borderRadius: 5, padding: '2px 7px', minWidth: 70, textAlign: 'center',
                        flexShrink: 0,
                      }}>
                        {mod.code_module}
                      </span>

                      {/* Libellé + obs */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mod.lib_module}
                        </div>
                        {mod.obs_module && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {mod.obs_module}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {delConfirm?.code_module !== mod.code_module && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            className="sms-btn-icon"
                            onClick={() => { setDelConfirm(null); openEdit(mod); }}
                            title="Modifier"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="sms-btn-icon danger"
                            onClick={() => { cancelForm(); setDelConfirm(mod); }}
                            title="Supprimer"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Confirmation suppression inline */}
                    {delConfirm?.code_module === mod.code_module && (
                      <div style={{
                        margin: '4px 0 2px', padding: '10px 14px',
                        borderRadius: 8, background: '#ef535012',
                        border: '1px dashed var(--danger)',
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      }}>
                        <i className="fas fa-exclamation-triangle" style={{ color: 'var(--danger)', fontSize: 13 }}></i>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                          {t.common.delete} <strong>{mod.lib_module}</strong> ? {t.pages.matieres.deleteModuleMsg}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelConfirm(null)}>
                            {t.common.cancel}
                          </button>
                          <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={() => handleDelete(mod)}>
                            <i className="fas fa-trash"></i> {t.common.delete}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pied */}
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>
            <i className="fas fa-times"></i> {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_ETAB_OPTIONS = [
  { value: '',           label: '— Partagée (tous types) —' },
  { value: 'PRIMAIRE',   label: 'Primaire uniquement' },
  { value: 'SECONDAIRE', label: 'Secondaire uniquement' },
  { value: 'SUPERIEUR',  label: 'Supérieur uniquement' },
];

// ── Formulaire matière ────────────────────────────────────────────────────────
function MatiereForm({ item, onClose, onSave, modules, defaultTypeEtab }) {
  const { t } = useApp();
  const isEdit = Boolean(item);

  const [f, setF] = useState({
    code_matiere: item?.code_matiere || '',
    lib_matiere:  item?.lib_matiere  || '',
    code_module:  item?.code_module?.code_module || item?.code_module || '',
    obs_matiere:  item?.obs_matiere  || '',
    type_etab:    item?.type_etab    || defaultTypeEtab || '',
  });
  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">
            Code matière <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="sms-input"
            name="code_matiere"
            value={f.code_matiere}
            onChange={ch}
            required maxLength={10}
            placeholder="Ex : MATH01"
            disabled={isEdit}
            style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}}
          />
          {isEdit && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
              {t.pages.matieres.notEditable}
            </span>
          )}
        </div>
        <FormField
          label={t.fields.libelle}
          name="lib_matiere"
          value={f.lib_matiere}
          onChange={ch}
          required
          placeholder="Ex : Mathématiques"
        />
      </div>

      <FormField
        label={`${t.pages.matieres.cols.module} *`}
        name="code_module"
        type="searchable"
        value={f.code_module}
        onChange={ch}
        required
        options={(modules || []).map(m => ({
          value: m.code_module,
          label: `${m.code_module} — ${m.lib_module}`,
        }))}
      />

      <div className="sms-form-row">
        <FormField
          label={t.nav.typeEtab}
          name="type_etab"
          type="select"
          value={f.type_etab}
          onChange={ch}
          options={TYPE_ETAB_OPTIONS}
        />
        <div>
          <label className="sms-label">{t.fields.obs}</label>
          <textarea
            className="sms-input"
            name="obs_matiere"
            value={f.obs_matiere}
            onChange={ch}
            maxLength={45}
            placeholder={t.common.obsPlaceholder}
            rows={2}
            style={{ resize: 'vertical', minHeight: 60 }}
          />
        </div>
      </div>

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

// ── Page principale ───────────────────────────────────────────────────────────
const TYPE_COLORS_MAP = { PRIMAIRE:'#4caf50', SECONDAIRE:'#2196f3', SUPERIEUR:'#9c27b0' };
const TYPE_LABELS_MAP = { PRIMAIRE:'Primaire', SECONDAIRE:'Secondaire', SUPERIEUR:'Supérieur' };

export default function Matieres() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [moduleFilter,    setModuleFilter]    = useState('');
  const [search,          setSearch]          = useState('');
  const [showModuleModal, setShowModuleModal] = useState(false);

  // ── Données matières ──────────────────────────────────────────────────────
  const { data: rawData, loading, error, reload } = useApi(
    useCallback(() => matiereService.list({ page_size: 500 }), [])
  );

  // ── Données modules ───────────────────────────────────────────────────────
  const { data: modules, reload: reloadModules } = useApi(
    useCallback(() => moduleService.list({ page_size: 200 }), [])
  );

  // ── Mutations matières ────────────────────────────────────────────────────
  const { mutate: createMatiere } = useMutation(useCallback(d => matiereService.create(d), []));
  const { mutate: updateMatiere } = useMutation(useCallback(d => matiereService.update(d.code_matiere, d), []));
  const { mutate: deleteMatiere } = useMutation(useCallback(d => matiereService.delete(d.code_matiere), []));

  // ── Mutations modules ─────────────────────────────────────────────────────
  const { mutate: createModule } = useMutation(useCallback(d => moduleService.create(d), []));
  const { mutate: updateModule } = useMutation(useCallback((id, d) => moduleService.update(id, d), []));
  const { mutate: deleteModule } = useMutation(useCallback(id => moduleService.delete(id), []));

  const data = rawData || [];

  // ── Filtrage client-side ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data
      .filter(m => !moduleFilter || (m.code_module?.code_module || m.code_module) === moduleFilter)
      .filter(m => !q || m.lib_matiere?.toLowerCase().includes(q) || m.code_matiere?.toLowerCase().includes(q));
  }, [data, moduleFilter, search]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const nbModulesUtilises = useMemo(() =>
    new Set(data.map(m => m.code_module?.code_module || m.code_module)).size,
  [data]);

  const parModule = useMemo(() => {
    const acc = {};
    data.forEach(m => {
      const key = m.lib_module || m.code_module?.lib_module || m.code_module?.code_module || m.code_module || '—';
      acc[key] = (acc[key] || 0) + 1;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

  // ── Colonnes ──────────────────────────────────────────────────────────────
  const COLS = [
    {
      accessor: 'code_matiere',
      label: t.pages.matieres.cols.code,
      render: r => (
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 12, color: 'var(--green)', letterSpacing: .5,
        }}>
          {r.code_matiere}
        </span>
      ),
    },
    { key: 'lib', label: t.pages.matieres.cols.label, bold: true, render: r => r.lib_matiere || '—' },
    {
      key: 'module',
      label: t.pages.matieres.cols.module,
      render: r => {
        const lib  = r.lib_module || r.code_module?.lib_module || '—';
        const code = r.code_module?.code_module || r.code_module || '';
        return (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="sms-badge badge-info" style={{ fontSize: 10 }}>{code}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lib}</span>
          </span>
        );
      },
    },
    {
      key: 'type',
      label: "Type étab.",
      render: r => r.type_etab
        ? <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
            background: `${TYPE_COLORS_MAP[r.type_etab] || '#888'}20`,
            color: TYPE_COLORS_MAP[r.type_etab] || '#888',
            border: `1px solid ${TYPE_COLORS_MAP[r.type_etab] || '#888'}40`,
          }}>{TYPE_LABELS_MAP[r.type_etab]}</span>
        : <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Partagée</span>,
    },
    {
      key: 'obs',
      label: t.pages.matieres.cols.observations,
      render: r => r.obs_matiere
        ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_matiere}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      {/* ── Statistiques ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 20 }}>
        <div className="stat-card c-green">
          <div className="stat-icon c-green"><i className="fas fa-book"></i></div>
          <div><div className="stat-value">{data.length}</div><div className="stat-label">{t.pages.matieres.totalMatieres}</div></div>
        </div>
        <div className="stat-card c-blue">
          <div className="stat-icon c-blue"><i className="fas fa-layer-group"></i></div>
          <div><div className="stat-value">{nbModulesUtilises}</div><div className="stat-label">{t.pages.matieres.modulesCoverts}</div></div>
        </div>
        <div className="stat-card c-orange">
          <div className="stat-icon c-orange"><i className="fas fa-filter"></i></div>
          <div><div className="stat-value">{filtered.length}</div><div className="stat-label">{t.pages.matieres.affichees}</div></div>
        </div>
        {parModule[0] && (
          <div className="stat-card c-purple">
            <div className="stat-icon c-purple">
              <i className="fas fa-star"></i>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stat-value" style={{ fontSize: 15 }}>{parModule[0][1]}</div>
              <div className="stat-label" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parModule[0][0]}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Répartition par module ── */}
      {parModule.length > 0 && (
        <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--green)' }}></i>
            {t.pages.matieres.repartition}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {parModule.map(([mod, count]) => {
              const pct = data.length ? Math.round(count / data.length * 100) : 0;
              return (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 130, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mod}
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: 'var(--green)', height: '100%', borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 50, textAlign: 'right' }}>
                    {count} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tableau CRUD matières ── */}
      <CrudTable
        title={t.pages.matieres.title}
        subtitle={t.pages.matieres.subtitle}
        icon="fas fa-book"
        columns={COLS}
        data={filtered}
        addLabel={t.pages.matieres.addLabel}
        filters={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Recherche */}
            <div style={{ position: 'relative' }}>
              <i className="fas fa-search" style={{
                position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                className="sms-input"
                style={{ height: 36, paddingLeft: 28, minWidth: 180, fontSize: 12 }}
                placeholder={t.pages.matieres.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filtre module */}
            <select
              className="sms-input"
              style={{ height: 36, minWidth: 220, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-darkest)', padding: '0 10px' }}
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
            >
              <option value="">{t.pages.matieres.allModules}</option>
              {(modules || []).map(m => (
                <option key={m.code_module} value={m.code_module}>
                  {m.code_module} — {m.lib_module}
                </option>
              ))}
            </select>

            {/* Réinitialiser */}
            {(moduleFilter || search) && (
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => { setModuleFilter(''); setSearch(''); }}>
                <i className="fas fa-times"></i> {t.common.reset}
              </button>
            )}

            {/* Gérer les modules */}
            <button
              className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setShowModuleModal(true)}
              title="Ajouter, modifier ou supprimer des modules"
              style={{ marginLeft: 'auto', borderColor: 'var(--green-dark)', color: 'var(--green)' }}
            >
              <i className="fas fa-layer-group"></i> {t.pages.matieres.manageModules}
            </button>
          </div>
        }
        onAdd={async d => {
          try { await createMatiere(d); toast.success(t.pages.matieres.matiereAdded); reload(); }
          catch (e) { toast.error(e.message); }
        }}
        onEdit={async d => {
          try { await updateMatiere(d); toast.success(t.pages.matieres.matiereUpdated); reload(); }
          catch (e) { toast.error(e.message); }
        }}
        onDelete={async d => {
          try { await deleteMatiere(d); toast.success(t.pages.matieres.matiereDeleted); reload(); }
          catch (e) { toast.error(e.message); }
        }}
        renderForm={p => <MatiereForm {...p} modules={modules} defaultTypeEtab={typeEtab} />}
      />

      {/* ── Modal modules ── */}
      {showModuleModal && (
        <ModuleModal
          modules={modules}
          onClose={() => { setShowModuleModal(false); reload(); }}
          onCreate={createModule}
          onUpdate={updateModule}
          onDelete={deleteModule}
          reloadModules={reloadModules}
        />
      )}
    </div>
  );
}
