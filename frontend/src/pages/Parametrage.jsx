/**
 * pages/Parametrage.jsx
 * Paramétrage général — référentiels du système en 5 onglets.
 *
 * Règle React respectée : chaque formulaire est un composant nommé propre,
 * jamais une fonction inline avec useState (violation des Rules of Hooks).
 */
import { useState, useCallback } from 'react';
import { FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import {
  anneeService, periodeService,
  cycleService, niveauService, departementService, specialiteService,
  batimentService, salleService,
  typeEvalService, jourService,
  pensionService, trancheService, fraisService,
} from '../services/endpoints';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────
function FormFooter({ onClose, saving }) {
  const { t } = useApp();
  return (
    <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
      <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>
        {t.common.cancel}
      </button>
      <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm" disabled={saving}>
        {saving
          ? <><div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }} />{t.common.loading}</>
          : <><i className="fas fa-save" /> {t.common.save}</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant RefSection — mini-CRUD réutilisable
// Reçoit FormComponent (composant React) + formProps (données supplémentaires)
// ─────────────────────────────────────────────────────────────────────────────
function RefSection({ title, icon, color = 'var(--green)', items = [], loading = false,
  columns, FormComponent, formProps = {}, onAdd, onEdit, onDelete }) {
  const { t, toast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem,  setDelItem]  = useState(null);
  const [saving,   setSaving]   = useState(false);

  const openAdd  = ()   => { setEditItem(null); setShowForm(true); };
  const openEdit = row  => { setEditItem(row);  setShowForm(true); };
  const close    = ()   => { setShowForm(false); setEditItem(null); };

  const handleSave = async data => {
    setSaving(true);
    try {
      if (editItem) { await onEdit({ ...editItem, ...data }); toast.success(t.pages.parametrage.updated); }
      else          { await onAdd(data);  toast.success(t.pages.parametrage.added); }
      close();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async item => {
    try { await onDelete(item); toast.success(t.pages.parametrage.deleted); setDelItem(null); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="sms-card" style={{ marginBottom: 16, overflow: 'hidden' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: '1px solid var(--border)', background: `${color}08` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={icon} style={{ color, fontSize: 12 }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)',
            borderRadius: 10, padding: '1px 8px' }}>{items.length}</span>
        </div>
        <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={openAdd} style={{ fontSize: 11 }}>
          <i className="fas fa-plus" /> {t.common.add}
        </button>
      </div>

      {/* Table */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="sms-spinner" style={{ margin: 'auto' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            <i className={icon} style={{ fontSize: 20, display: 'block', marginBottom: 6, opacity: .3 }} />
            {t.pages.parametrage.noRecord}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)' }}>
                {columns.map(c => (
                  <th key={c.label} style={{ padding: '7px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  {columns.map(c => (
                    <td key={c.label} style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="sms-btn-icon" onClick={() => openEdit(row)} title={t.common.edit}>
                        <i className="fas fa-edit" />
                      </button>
                      <button className="sms-btn-icon danger" onClick={() => setDelItem(row)} title={t.common.delete}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="sms-modal" style={{ maxWidth: 480 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className={icon} style={{ marginRight: 8, color }} />
                {editItem ? t.pages.parametrage.modify : t.pages.parametrage.new} — {title}
              </div>
              <button className="sms-btn-icon" onClick={close}><i className="fas fa-times" /></button>
            </div>
            <div className="sms-modal-body">
              <FormComponent
                item={editItem}
                onClose={close}
                onSave={handleSave}
                saving={saving}
                {...formProps}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {delItem && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setDelItem(null)}>
          <div className="sms-modal" style={{ maxWidth: 380 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color: 'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
                {t.common.confirm}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                {t.pages.parametrage.confirmDeleteMsg}
              </p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelItem(null)}>{t.common.cancel}</button>
              <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={() => handleDelete(delItem)}>
                <i className="fas fa-trash" /> {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaires — un composant nommé par entité (Rules of Hooks respectées)
// ─────────────────────────────────────────────────────────────────────────────
function AnneeForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const STATUTS_ANNEE = [
    { value: 'EN COURS',  label: t.pages.parametrage.statuts.enCours   },
    { value: 'PLANIFIEE', label: t.pages.parametrage.statuts.planifiee  },
    { value: 'CLOTUREE',  label: t.pages.parametrage.statuts.cloturee   },
  ];
  const [f, setF] = useState({
    code_annee: item?.code_annee || '',
    lib_annee:  item?.lib_annee  || '',
    date_deb:   item?.date_deb?.slice(0, 10) || '',
    date_fin:   item?.date_fin?.slice(0, 10) || '',
    statut:     item?.statut || 'EN COURS',
    obs_annee:  item?.obs_annee  || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_annee" value={f.code_annee} onChange={ch}
            required maxLength={10} placeholder="Ex : 2025-2026"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={t.fields.libelle} name="lib_annee" value={f.lib_annee} onChange={ch} placeholder="Ex : Année 2025-2026" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.dateDebut} name="date_deb" type="date" value={f.date_deb} onChange={ch} />
        <FormField label={t.fields.dateFin}   name="date_fin" type="date" value={f.date_fin} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.statut} name="statut" type="select" value={f.statut} onChange={ch} options={STATUTS_ANNEE} />
        <FormField label={t.fields.obs}    name="obs_annee" value={f.obs_annee} onChange={ch} />
      </div>
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function PeriodeForm({ item, onClose, onSave, saving, annees }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({
    code_periode: item?.code_periode || '',
    lib_periode:  item?.lib_periode  || '',
    date_debut:   item?.date_debut?.slice(0, 10) || '',
    date_fin:     item?.date_fin?.slice(0, 10)   || '',
    code_annee:   item?.code_annee  || '',
    obs_periode:  item?.obs_periode || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, code_annee: f.code_annee || null }); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_periode" value={f.code_periode} onChange={ch}
            required maxLength={10} placeholder="Ex : S1"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_periode" value={f.lib_periode} onChange={ch} required placeholder="Ex : Semestre 1" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.dateDebut} name="date_debut" type="date" value={f.date_debut} onChange={ch} />
        <FormField label={t.fields.dateFin}   name="date_fin"   type="date" value={f.date_fin}   onChange={ch} />
      </div>
      <FormField label={t.fields.annee} name="code_annee" type="select" value={f.code_annee} onChange={ch}
        options={(annees || []).map(a => ({ value: a.code_annee, label: a.lib_annee || a.code_annee }))} />
      <FormField label={t.fields.obs} name="obs_periode" value={f.obs_periode} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function CycleForm({ item, onClose, onSave, saving, pensions }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({
    code_cycle:   item?.code_cycle   || '',
    lib_cycle:    item?.lib_cycle    || '',
    code_pension: item?.code_pension || '',
    obs_cycle:    item?.obs_cycle    || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, code_pension: f.code_pension || null }); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_cycle" value={f.code_cycle} onChange={ch}
            required maxLength={10} placeholder="Ex : LIC"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_cycle" value={f.lib_cycle} onChange={ch} required placeholder="Ex : Licence" />
      </div>
      <FormField label={t.pages.parametrage.regime} name="code_pension" type="searchable" value={f.code_pension} onChange={ch}
        options={(pensions || []).map(p => ({ value: p.code_pension, label: p.lib_pension || `Pension ${p.code_pension}` }))} />
      <FormField label={t.fields.obs} name="obs_cycle" value={f.obs_cycle} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function NiveauForm({ item, onClose, onSave, saving, cycles, pensions, annees }) {
  const { t } = useApp();
  const [f, setF] = useState({
    lib_niveau:   item?.lib_niveau   || '',
    code_cycle:   item?.code_cycle   || '',
    code_pension: item?.code_pension || '',
    code_annee:   item?.code_annee   || '',
    obs_niveau:   item?.obs_niveau   || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({
      ...f,
      code_cycle:   f.code_cycle   || null,
      code_pension: f.code_pension || null,
      code_annee:   f.code_annee   || null,
    }); }}>
      <FormField label={`${t.fields.libelle} *`} name="lib_niveau" value={f.lib_niveau} onChange={ch} required placeholder="Ex : Licence 1" />
      <div className="sms-form-row">
        <FormField label={t.pages.parametrage.cols.cycle} name="code_cycle" type="select" value={f.code_cycle} onChange={ch}
          options={(cycles || []).map(c => ({ value: c.code_cycle, label: c.lib_cycle }))} />
        <FormField label={t.pages.parametrage.regime} name="code_pension" type="select" value={f.code_pension} onChange={ch}
          options={(pensions || []).map(p => ({ value: p.code_pension, label: p.lib_pension || `Pension ${p.code_pension}` }))} />
      </div>
      <FormField label={t.fields.annee} name="code_annee" type="select" value={f.code_annee} onChange={ch}
        options={(annees || []).map(a => ({ value: a.code_annee, label: a.lib_annee || a.code_annee }))} />
      <FormField label={t.fields.obs} name="obs_niveau" value={f.obs_niveau} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function DepartementForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({ code_dep: item?.code_dep || '', lib_dep: item?.lib_dep || '', obs_dep: item?.obs_dep || '' });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_dep" value={f.code_dep} onChange={ch}
            required maxLength={10} placeholder="Ex : INFO"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_dep" value={f.lib_dep} onChange={ch} required placeholder="Ex : Département Informatique" />
      </div>
      <FormField label={t.fields.obs} name="obs_dep" value={f.obs_dep} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function SpecialiteForm({ item, onClose, onSave, saving, departements }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({
    code_sp:  item?.code_sp  || '',
    lib_sp:   item?.lib_sp   || '',
    code_dep: item?.code_dep || '',
    obs_sp:   item?.obs_sp   || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_sp" value={f.code_sp} onChange={ch}
            required maxLength={10} placeholder="Ex : GI"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_sp" value={f.lib_sp} onChange={ch} required placeholder="Ex : Génie Informatique" />
      </div>
      <FormField label={`${t.fields.departement2} *`} name="code_dep" type="searchable" value={f.code_dep} onChange={ch} required
        options={(departements || []).map(d => ({ value: d.code_dep, label: `${d.code_dep} — ${d.lib_dep}` }))} />
      <FormField label={t.fields.obs} name="obs_sp" value={f.obs_sp} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function BatimentForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({ code_bat: item?.code_bat || '', lib_bat: item?.lib_bat || '', obs_bat: item?.obs_bat || '' });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_bat" value={f.code_bat} onChange={ch}
            required maxLength={5} placeholder="Ex : A"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={t.fields.libelle} name="lib_bat" value={f.lib_bat} onChange={ch} placeholder="Ex : Bloc A" />
      </div>
      <FormField label={t.fields.obs} name="obs_bat" value={f.obs_bat} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function SalleForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({ code_salle: item?.code_salle || '', lib_salle: item?.lib_salle || '', obs_salle: item?.obs_salle || '' });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_salle" value={f.code_salle} onChange={ch}
            required maxLength={5} placeholder="Ex : S01"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={t.fields.libelle} name="lib_salle" value={f.lib_salle} onChange={ch} placeholder="Ex : Salle 01" />
      </div>
      <FormField label={t.fields.obs} name="obs_salle" value={f.obs_salle} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function TypeEvalForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const [f, setF] = useState({ lib_type_eval: item?.lib_type_eval || '', obs_type_eval: item?.obs_type_eval || '' });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <FormField label={`${t.fields.libelle} *`} name="lib_type_eval" value={f.lib_type_eval} onChange={ch} required placeholder="Ex : Contrôle continu" />
      <FormField label={t.fields.obs} name="obs_type_eval" value={f.obs_type_eval} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function JourForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({ code_jour: item?.code_jour || '', lib_jour: item?.lib_jour || '', obs_jour: item?.obs_jour || '' });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_jour" value={f.code_jour} onChange={ch}
            required maxLength={10} placeholder="Ex : LUN"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_jour" value={f.lib_jour} onChange={ch} required placeholder="Ex : Lundi" />
      </div>
      <FormField label={t.fields.obs} name="obs_jour" value={f.obs_jour} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function PensionForm({ item, onClose, onSave, saving }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({
    code_pension:   item?.code_pension   || '',
    lib_pension:    item?.lib_pension    || '',
    mt_pension:     item?.mt_pension     || 0,
    mt_inscription: item?.mt_inscription || 0,
    nb_tranche:     item?.nb_tranche     || '',
    obs_pension:    item?.obs_pension    || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, nb_tranche: f.nb_tranche || null }); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_pension" value={f.code_pension} onChange={ch}
            required type="number" min={1} placeholder="Ex : 1"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={t.fields.libelle} name="lib_pension" value={f.lib_pension} onChange={ch} placeholder="Ex : Licence — Informatique" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.pages.parametrage.scolariteField}   name="mt_pension"     type="number" value={f.mt_pension}     onChange={ch} required />
        <FormField label={t.pages.parametrage.inscriptionField} name="mt_inscription" type="number" value={f.mt_inscription} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.pages.parametrage.nbTranches} name="nb_tranche" type="number" value={f.nb_tranche} onChange={ch} placeholder="Ex : 3" />
        <FormField label={t.fields.obs}                   name="obs_pension" value={f.obs_pension} onChange={ch} />
      </div>
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function TrancheForm({ item, onClose, onSave, saving, pensions }) {
  const { t } = useApp();
  const [f, setF] = useState({
    lib_tranche:  item?.lib_tranche  || '',
    code_pension: item?.code_pension || '',
    mt_tranche:   item?.mt_tranche   || 0,
    obs_tranche:  item?.obs_tranche  || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={`${t.fields.libelle} *`}  name="lib_tranche" value={f.lib_tranche} onChange={ch} required placeholder="Ex : Tranche 1" />
        <FormField label={`${t.fields.montant} *`}  name="mt_tranche"  type="number" value={f.mt_tranche} onChange={ch} required />
      </div>
      <FormField label={`${t.pages.parametrage.regime} *`} name="code_pension" type="select" value={f.code_pension} onChange={ch} required
        options={(pensions || []).map(p => ({ value: p.code_pension, label: p.lib_pension || `Pension ${p.code_pension}` }))} />
      <FormField label={t.fields.obs} name="obs_tranche" value={f.obs_tranche} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

function FraisForm({ item, onClose, onSave, saving, annees }) {
  const { t } = useApp();
  const isEdit = Boolean(item);
  const [f, setF] = useState({
    code_frais: item?.code_frais || '',
    lib_frais:  item?.lib_frais  || '',
    type_frais: item?.type_frais || '',
    mt_frais:   item?.mt_frais   || 0,
    code_annee: item?.code_annee || '',
    obs_frais:  item?.obs_frais  || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, code_annee: f.code_annee || null }); }}>
      <div className="sms-form-row">
        <div>
          <label className="sms-label">Code <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="sms-input" name="code_frais" value={f.code_frais} onChange={ch}
            required type="number" min={1} placeholder="Ex : 1"
            disabled={isEdit} style={isEdit ? { opacity: .6, cursor: 'not-allowed' } : {}} />
        </div>
        <FormField label={`${t.fields.libelle} *`} name="lib_frais" value={f.lib_frais} onChange={ch} required placeholder="Ex : Frais d'examen" />
      </div>
      <div className="sms-form-row">
        <FormField label={`${t.fields.type} *`}  name="type_frais" value={f.type_frais} onChange={ch} required placeholder="Ex : EXAMEN" />
        <FormField label={t.fields.montant}       name="mt_frais"   type="number" value={f.mt_frais} onChange={ch} />
      </div>
      <FormField label={t.fields.annee} name="code_annee" type="select" value={f.code_annee} onChange={ch}
        options={(annees || []).map(a => ({ value: a.code_annee, label: a.lib_annee || a.code_annee }))} />
      <FormField label={t.fields.obs} name="obs_frais" value={f.obs_frais} onChange={ch} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglets
// ─────────────────────────────────────────────────────────────────────────────
const S = { 'EN COURS': 'badge-success', PLANIFIEE: 'badge-info', CLOTUREE: 'badge-secondary' };
const fmt = n => Number(n || 0).toLocaleString('fr-FR');

function CalendrierTab() {
  const { t } = useApp();
  const { data: annees,   reload: reA } = useApi(useCallback(() => anneeService.list({ page_size: 100 }), []));
  const { data: periodes, reload: reP } = useApi(useCallback(() => periodeService.list({ page_size: 200 }), []));
  const { mutate: cA } = useMutation(useCallback(d => anneeService.create(d), []));
  const { mutate: uA } = useMutation(useCallback(d => anneeService.update(d.code_annee, d), []));
  const { mutate: dA } = useMutation(useCallback(d => anneeService.delete(d.code_annee), []));
  const { mutate: cP } = useMutation(useCallback(d => periodeService.create(d), []));
  const { mutate: uP } = useMutation(useCallback(d => periodeService.update(d.code_periode, d), []));
  const { mutate: dP } = useMutation(useCallback(d => periodeService.delete(d.code_periode), []));

  return (
    <div>
      <RefSection title={t.pages.parametrage.sections.annees} icon="fas fa-calendar-alt" color="#4caf50"
        items={annees || []} FormComponent={AnneeForm}
        columns={[
          { label: t.common.colCode,   render: r => <strong style={{ color: '#4caf50' }}>{r.code_annee}</strong> },
          { label: t.common.colLabel,  render: r => r.lib_annee || '—' },
          { label: t.common.colStart,  render: r => r.date_deb?.slice(0, 10) || '—' },
          { label: t.common.colEnd,    render: r => r.date_fin?.slice(0, 10) || '—' },
          { label: t.common.colStatus, render: r => r.statut
              ? <span className={`sms-badge ${S[r.statut] || 'badge-secondary'}`} style={{ fontSize: 10 }}>{r.statut}</span>
              : '—' },
        ]}
        onAdd={async d => { await cA(d); reA(); }}
        onEdit={async d => { await uA(d); reA(); }}
        onDelete={async d => { await dA(d); reA(); }}
      />
      <RefSection title={t.pages.parametrage.sections.periodes} icon="fas fa-clock" color="#42a5f5"
        items={periodes || []} FormComponent={PeriodeForm} formProps={{ annees: annees || [] }}
        columns={[
          { label: t.common.colLabel, render: r => <strong>{r.lib_periode}</strong> },
          { label: t.common.colStart, render: r => r.date_debut?.slice(0, 10) || '—' },
          { label: t.common.colEnd,   render: r => r.date_fin?.slice(0, 10)   || '—' },
          { label: t.common.colYear,  render: r => r.lib_annee || r.code_annee || '—' },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_periode || '—'}</span> },
        ]}
        onAdd={async d => { await cP(d); reP(); }}
        onEdit={async d => { await uP(d); reP(); }}
        onDelete={async d => { await dP(d); reP(); }}
      />
    </div>
  );
}

function StructureTab() {
  const { t } = useApp();
  const { data: cycles,  reload: reC }  = useApi(useCallback(() => cycleService.list({ page_size: 100 }), []));
  const { data: niveaux, reload: reN }  = useApi(useCallback(() => niveauService.list({ page_size: 100 }), []));
  const { data: deps,    reload: reD }  = useApi(useCallback(() => departementService.list({ page_size: 100 }), []));
  const { data: specs,   reload: reSp } = useApi(useCallback(() => specialiteService.list({ page_size: 200 }), []));
  const { data: annees }                = useApi(useCallback(() => anneeService.list({ page_size: 50 }), []));
  const { data: pensions }              = useApi(useCallback(() => pensionService.list({ page_size: 50 }), []));
  const { mutate: cC } = useMutation(useCallback(d => cycleService.create(d), []));
  const { mutate: uC } = useMutation(useCallback(d => cycleService.update(d.code_cycle, d), []));
  const { mutate: dC } = useMutation(useCallback(d => cycleService.delete(d.code_cycle), []));
  const { mutate: cN } = useMutation(useCallback(d => niveauService.create(d), []));
  const { mutate: uN } = useMutation(useCallback(d => niveauService.update(d.code_niveau, d), []));
  const { mutate: dN } = useMutation(useCallback(d => niveauService.delete(d.code_niveau), []));
  const { mutate: cD } = useMutation(useCallback(d => departementService.create(d), []));
  const { mutate: uD } = useMutation(useCallback(d => departementService.update(d.code_dep, d), []));
  const { mutate: dD } = useMutation(useCallback(d => departementService.delete(d.code_dep), []));
  const { mutate: cSp } = useMutation(useCallback(d => specialiteService.create(d), []));
  const { mutate: uSp } = useMutation(useCallback(d => specialiteService.update(d.code_sp, d), []));
  const { mutate: dSp } = useMutation(useCallback(d => specialiteService.delete(d.code_sp), []));

  return (
    <div>
      <RefSection title={t.pages.parametrage.sections.cycles} icon="fas fa-redo-alt" color="#ab47bc"
        items={cycles || []} FormComponent={CycleForm} formProps={{ pensions: pensions || [] }}
        columns={[
          { label: t.common.colCode,                    render: r => <strong style={{ color: '#ab47bc' }}>{r.code_cycle}</strong> },
          { label: t.common.colLabel,                   render: r => r.lib_cycle },
          { label: t.pages.parametrage.cols.pension,    render: r => r.lib_pension || r.code_pension || '—' },
          { label: t.common.colObs,                     render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_cycle || '—'}</span> },
        ]}
        onAdd={async d => { await cC(d); reC(); }}
        onEdit={async d => { await uC(d); reC(); }}
        onDelete={async d => { await dC(d); reC(); }}
      />
      <RefSection title={t.pages.parametrage.sections.niveaux} icon="fas fa-layer-group" color="#ffa726"
        items={niveaux || []} FormComponent={NiveauForm}
        formProps={{ cycles: cycles || [], pensions: pensions || [], annees: annees || [] }}
        columns={[
          { label: t.common.colLabel,                   render: r => <strong>{r.lib_niveau}</strong> },
          { label: t.pages.parametrage.cols.cycle,      render: r => r.lib_cycle   || r.code_cycle   || '—' },
          { label: t.pages.parametrage.cols.pension,    render: r => r.lib_pension || r.code_pension || '—' },
          { label: t.common.colYear,                    render: r => r.code_annee  || '—' },
        ]}
        onAdd={async d => { await cN(d); reN(); }}
        onEdit={async d => { await uN(d); reN(); }}
        onDelete={async d => { await dN(d); reN(); }}
      />
      <RefSection title={t.pages.parametrage.sections.departements} icon="fas fa-sitemap" color="#26c6da"
        items={deps || []} FormComponent={DepartementForm}
        columns={[
          { label: t.common.colCode,  render: r => <strong style={{ color: '#26c6da' }}>{r.code_dep}</strong> },
          { label: t.common.colLabel, render: r => r.lib_dep },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_dep || '—'}</span> },
        ]}
        onAdd={async d => { await cD(d); reD(); }}
        onEdit={async d => { await uD(d); reD(); }}
        onDelete={async d => { await dD(d); reD(); }}
      />
      <RefSection title={t.pages.parametrage.sections.specialites} icon="fas fa-graduation-cap" color="#66bb6a"
        items={specs || []} FormComponent={SpecialiteForm} formProps={{ departements: deps || [] }}
        columns={[
          { label: t.common.colCode,  render: r => <strong style={{ color: '#66bb6a' }}>{r.code_sp}</strong> },
          { label: t.common.colLabel, render: r => r.lib_sp },
          { label: t.common.colDept,  render: r => r.lib_dep || r.code_dep || '—' },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_sp || '—'}</span> },
        ]}
        onAdd={async d => { await cSp(d); reSp(); }}
        onEdit={async d => { await uSp(d); reSp(); }}
        onDelete={async d => { await dSp(d); reSp(); }}
      />
    </div>
  );
}

function InfraTab() {
  const { t } = useApp();
  const { data: batiments, reload: reB } = useApi(useCallback(() => batimentService.list({ page_size: 100 }), []));
  const { data: salles,    reload: reS } = useApi(useCallback(() => salleService.list({ page_size: 200 }), []));
  const { mutate: cB } = useMutation(useCallback(d => batimentService.create(d), []));
  const { mutate: uB } = useMutation(useCallback(d => batimentService.update(d.code_bat, d), []));
  const { mutate: dB } = useMutation(useCallback(d => batimentService.delete(d.code_bat), []));
  const { mutate: cS } = useMutation(useCallback(d => salleService.create(d), []));
  const { mutate: uS } = useMutation(useCallback(d => salleService.update(d.code_salle, d), []));
  const { mutate: dS } = useMutation(useCallback(d => salleService.delete(d.code_salle), []));

  return (
    <div>
      <RefSection title={t.pages.parametrage.sections.batiments} icon="fas fa-building" color="#5c6bc0"
        items={batiments || []} FormComponent={BatimentForm}
        columns={[
          { label: t.common.colCode,  render: r => <strong style={{ color: '#5c6bc0' }}>{r.code_bat}</strong> },
          { label: t.common.colLabel, render: r => r.lib_bat || '—' },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_bat || '—'}</span> },
        ]}
        onAdd={async d => { await cB(d); reB(); }}
        onEdit={async d => { await uB(d); reB(); }}
        onDelete={async d => { await dB(d); reB(); }}
      />
      <RefSection title={t.pages.parametrage.sections.salles} icon="fas fa-door-open" color="#26a69a"
        items={salles || []} FormComponent={SalleForm}
        columns={[
          { label: t.common.colCode,  render: r => <strong style={{ color: '#26a69a' }}>{r.code_salle}</strong> },
          { label: t.common.colLabel, render: r => r.lib_salle || '—' },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_salle || '—'}</span> },
        ]}
        onAdd={async d => { await cS(d); reS(); }}
        onEdit={async d => { await uS(d); reS(); }}
        onDelete={async d => { await dS(d); reS(); }}
      />
    </div>
  );
}

function EvalTab() {
  const { t } = useApp();
  const { data: typeEvals, reload: reTE } = useApi(useCallback(() => typeEvalService.list({ page_size: 100 }), []));
  const { data: jours,     reload: reJ }  = useApi(useCallback(() => jourService.list({ page_size: 20 }), []));
  const { mutate: cTE } = useMutation(useCallback(d => typeEvalService.create(d), []));
  const { mutate: uTE } = useMutation(useCallback(d => typeEvalService.update(d.code_type_eval, d), []));
  const { mutate: dTE } = useMutation(useCallback(d => typeEvalService.delete(d.code_type_eval), []));
  const { mutate: cJ }  = useMutation(useCallback(d => jourService.create(d), []));
  const { mutate: uJ }  = useMutation(useCallback(d => jourService.update(d.code_jour, d), []));
  const { mutate: dJ }  = useMutation(useCallback(d => jourService.delete(d.code_jour), []));

  return (
    <div>
      <RefSection title={t.pages.parametrage.sections.typeEvals} icon="fas fa-clipboard-list" color="#ef5350"
        items={typeEvals || []} FormComponent={TypeEvalForm}
        columns={[
          { label: t.common.colLabel, render: r => <strong>{r.lib_type_eval}</strong> },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_type_eval || '—'}</span> },
        ]}
        onAdd={async d => { await cTE(d); reTE(); }}
        onEdit={async d => { await uTE(d); reTE(); }}
        onDelete={async d => { await dTE(d); reTE(); }}
      />
      <RefSection title={t.pages.parametrage.sections.jours} icon="fas fa-calendar-day" color="#ffa726"
        items={jours || []} FormComponent={JourForm}
        columns={[
          { label: t.common.colCode,  render: r => <strong style={{ color: '#ffa726' }}>{r.code_jour}</strong> },
          { label: t.common.colLabel, render: r => t.common.jours[r.code_jour] || r.lib_jour },
          { label: t.common.colObs,   render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_jour || '—'}</span> },
        ]}
        onAdd={async d => { await cJ(d); reJ(); }}
        onEdit={async d => { await uJ(d); reJ(); }}
        onDelete={async d => { await dJ(d); reJ(); }}
      />
    </div>
  );
}

function FinancierTab() {
  const { t } = useApp();
  const { data: pensions, reload: rePen } = useApi(useCallback(() => pensionService.list({ page_size: 100 }), []));
  const { data: tranches, reload: reTr }  = useApi(useCallback(() => trancheService.list({ page_size: 200 }), []));
  const { data: frais,    reload: reFr }  = useApi(useCallback(() => fraisService.list({ page_size: 200 }), []));
  const { data: annees }                  = useApi(useCallback(() => anneeService.list({ page_size: 50 }), []));
  const { mutate: cPen } = useMutation(useCallback(d => pensionService.create(d), []));
  const { mutate: uPen } = useMutation(useCallback(d => pensionService.update(d.code_pension, d), []));
  const { mutate: dPen } = useMutation(useCallback(d => pensionService.delete(d.code_pension), []));
  const { mutate: cTr }  = useMutation(useCallback(d => trancheService.create(d), []));
  const { mutate: uTr }  = useMutation(useCallback(d => trancheService.update(d.code_tranche, d), []));
  const { mutate: dTr }  = useMutation(useCallback(d => trancheService.delete(d.code_tranche), []));
  const { mutate: cFr }  = useMutation(useCallback(d => fraisService.create(d), []));
  const { mutate: uFr }  = useMutation(useCallback(d => fraisService.update(d.code_frais, d), []));
  const { mutate: dFr }  = useMutation(useCallback(d => fraisService.delete(d.code_frais), []));

  return (
    <div>
      <RefSection title={t.pages.parametrage.sections.pensions} icon="fas fa-hand-holding-usd" color="#4caf50"
        items={pensions || []} FormComponent={PensionForm}
        columns={[
          { label: t.common.colLabel,                       render: r => <strong>{r.lib_pension || `Pension ${r.code_pension}`}</strong> },
          { label: t.pages.parametrage.cols.scolarite,      render: r => <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(r.mt_pension)} FCFA</span> },
          { label: t.pages.parametrage.cols.inscription,    render: r => <span style={{ color: '#ffa726', fontWeight: 700 }}>{fmt(r.mt_inscription)} FCFA</span> },
          { label: t.pages.parametrage.cols.tranches,       render: r => r.nb_tranche ?? '—' },
        ]}
        onAdd={async d => { await cPen(d); rePen(); }}
        onEdit={async d => { await uPen(d); rePen(); }}
        onDelete={async d => { await dPen(d); rePen(); }}
      />
      <RefSection title={t.pages.parametrage.sections.tranches} icon="fas fa-coins" color="#ffa726"
        items={tranches || []} FormComponent={TrancheForm} formProps={{ pensions: pensions || [] }}
        columns={[
          { label: t.common.colLabel,                    render: r => <strong>{r.lib_tranche}</strong> },
          { label: t.pages.parametrage.cols.pension,     render: r => r.lib_pension || r.code_pension || '—' },
          { label: t.common.colAmount,                   render: r => <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(r.mt_tranche)} FCFA</span> },
          { label: t.common.colObs,                      render: r => <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.obs_tranche || '—'}</span> },
        ]}
        onAdd={async d => { await cTr(d); reTr(); }}
        onEdit={async d => { await uTr(d); reTr(); }}
        onDelete={async d => { await dTr(d); reTr(); }}
      />
      <RefSection title={t.pages.parametrage.sections.frais} icon="fas fa-file-invoice-dollar" color="#ef5350"
        items={frais || []} FormComponent={FraisForm} formProps={{ annees: annees || [] }}
        columns={[
          { label: t.common.colLabel,  render: r => <strong>{r.lib_frais}</strong> },
          { label: t.common.colType,   render: r => <span className="sms-badge badge-info" style={{ fontSize: 10 }}>{r.type_frais}</span> },
          { label: t.common.colAmount, render: r => <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(r.mt_frais)} FCFA</span> },
          { label: t.common.colYear,   render: r => r.lib_annee || r.code_annee || '—' },
        ]}
        onAdd={async d => { await cFr(d); reFr(); }}
        onEdit={async d => { await uFr(d); reFr(); }}
        onDelete={async d => { await dFr(d); reFr(); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  calendrier: 'fas fa-calendar-alt',
  structure:  'fas fa-sitemap',
  infra:      'fas fa-building',
  evaluation: 'fas fa-clipboard-check',
  financier:  'fas fa-coins',
};
const TAB_COLORS = {
  calendrier: '#4caf50',
  structure:  '#ab47bc',
  infra:      '#5c6bc0',
  evaluation: '#ef5350',
  financier:  '#ffa726',
};

export default function Parametrage() {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState('calendrier');

  const TABS = [
    { key: 'calendrier', label: t.pages.parametrage.tabs.calendrier, icon: TAB_ICONS.calendrier, color: TAB_COLORS.calendrier },
    { key: 'structure',  label: t.pages.parametrage.tabs.structure,  icon: TAB_ICONS.structure,  color: TAB_COLORS.structure  },
    { key: 'infra',      label: t.pages.parametrage.tabs.infra,      icon: TAB_ICONS.infra,      color: TAB_COLORS.infra      },
    { key: 'evaluation', label: t.pages.parametrage.tabs.evaluation, icon: TAB_ICONS.evaluation, color: TAB_COLORS.evaluation },
    { key: 'financier',  label: t.pages.parametrage.tabs.financier,  icon: TAB_ICONS.financier,  color: TAB_COLORS.financier  },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-cogs text-green" style={{ marginRight: 10, fontSize: 22 }} />
            {t.pages.parametrage.title}
          </h1>
          <p className="page-subtitle">{t.pages.parametrage.subtitle}</p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap',
        background: 'var(--bg-card)', borderRadius: 12, padding: 6, border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, minWidth: 120, padding: '10px 14px',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'var(--transition)',
            background: activeTab === tab.key ? tab.color : 'transparent',
            color:      activeTab === tab.key ? '#fff' : 'var(--text-muted)',
            boxShadow:  activeTab === tab.key ? `0 2px 8px ${tab.color}40` : 'none',
          }}>
            <i className={tab.icon} style={{ fontSize: 13 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'calendrier' && <CalendrierTab />}
      {activeTab === 'structure'  && <StructureTab />}
      {activeTab === 'infra'      && <InfraTab />}
      {activeTab === 'evaluation' && <EvalTab />}
      {activeTab === 'financier'  && <FinancierTab />}
    </div>
  );
}
