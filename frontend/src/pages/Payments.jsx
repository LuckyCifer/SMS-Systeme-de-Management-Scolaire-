/**
 * pages/Payments.jsx
 * Paiements (scolarité + inscription) avec export reçu PDF.
 */
import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import AutocompleteField from '../components/AutocompleteField';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { paiementService, etudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateRecu } from '../services/pdfService';

const S_STYLE = { PAYE:'badge-success', PARTIEL:'badge-warning', IMPAYE:'badge-danger' };
const T_STYLE = {
  SCOLARITE:          'badge-info',
  INSCRIPTION:        'badge-warning',
  EXAMEN_BTS:         'badge-secondary',
  SOUTENANCE_BTS:     'badge-secondary',
  SOUTENANCE_LICENCE: 'badge-secondary',
  SOUTENANCE_MASTER:  'badge-secondary',
};
// T_LABEL is computed inside Payments to support i18n
const NEEDS_TRANCHE = ['SCOLARITE'];

function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const STATUTS = [
    { value:'PAYE',    label: t.status.paye },
    { value:'PARTIEL', label: t.status.partiel },
    { value:'IMPAYE',  label: t.status.impaye },
  ];
  const TYPES = [
    { value:'SCOLARITE',          label: t.pages.payments.types.scolarite },
    { value:'INSCRIPTION',        label: t.pages.payments.types.inscription },
    { value:'EXAMEN_BTS',         label: t.pages.payments.types.examenBTS },
    { value:'SOUTENANCE_BTS',     label: t.pages.payments.types.soutenanceBTS },
    { value:'SOUTENANCE_LICENCE', label: t.pages.payments.types.soutenanceLic },
    { value:'SOUTENANCE_MASTER',  label: t.pages.payments.types.soutenanceMas },
  ];
  const [f, setF] = useState({
    type_paiement: item?.type_paiement  || 'SCOLARITE',
    mle_etudiant:  item?.mle_etudiant?.mle_etudiant || item?.mle_etudiant || '',
    code_tranche:  item?.code_tranche?.code_tranche || item?.code_tranche || '',
    code_annee:    item?.code_annee?.code_annee     || item?.code_annee   || '2025-2026',
    date_paiement: item?.date_paiement?.slice(0,10) || new Date().toISOString().slice(0,10),
    mt_paiement:   item?.mt_paiement || 0,
    obs_paiement:  item?.obs_paiement || '',
    statut:        item?.statut || 'PAYE',
  });
  const ch = e => setF(p => {
    const next = { ...p, [e.target.name]: e.target.value };
    if (e.target.name === 'type_paiement' && !NEEDS_TRANCHE.includes(e.target.value)) {
      next.code_tranche = '';
    }
    return next;
  });

  const submit = e => {
    e.preventDefault();
    const d = { ...f };
    if (!NEEDS_TRANCHE.includes(d.type_paiement) || d.code_tranche === '') d.code_tranche = null;
    onSave(d);
  };

  return (
    <form onSubmit={submit}>
      <div className="sms-form-row">
        <FormField label={t.fields.typePaiement} name="type_paiement" type="select"
          value={f.type_paiement} onChange={ch} options={TYPES} />
        <AutocompleteField
          label={t.fields.mleEtud} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required
          service={etudiantService}
          labelFn={e => `${e.nom} ${e.prenom || ''} — ${e.mle_etudiant}`}
          valueFn={e => e.mle_etudiant}
          initialLabel={item ? `${item.nom_etudiant || ''} ${item.prenom_etudiant || ''} — ${item.mle_etudiant?.mle_etudiant || item.mle_etudiant}`.trim() : ''}
          placeholder="Rechercher par nom ou matricule…"
        />
        <FormField label={t.fields.annee} name="code_annee"
          value={f.code_annee} onChange={ch} required />
      </div>
      <div className="sms-form-row">
        {NEEDS_TRANCHE.includes(f.type_paiement) && (
          <FormField label={`${t.fields.codeTrancheLabel} *`} name="code_tranche"
            value={f.code_tranche} onChange={ch} required
            placeholder="Code de la tranche" />
        )}
        <FormField label={t.fields.montant} name="mt_paiement" type="number"
          value={f.mt_paiement} onChange={ch} required />
        <FormField label={t.fields.date}    name="date_paiement" type="date"
          value={f.date_paiement} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.statut} name="statut" type="select"
          value={f.statut} onChange={ch} options={STATUTS} />
        <FormField label={t.fields.obs}    name="obs_paiement"
          value={f.obs_paiement} onChange={ch} />
      </div>
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

export default function Payments() {
  const { t, toast, user } = useApp();
  const { data, loading, error, reload } = useApi(() => paiementService.list({ page_size: 500 }));
  const { mutate: create } = useMutation(useCallback((d) => paiementService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => paiementService.update(d.code_paiement, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => paiementService.delete(d.code_paiement), []));
  const [exporting, setExporting] = useState(null);

  const handleExportRecu = async (p) => {
    setExporting(p.code_paiement);
    try {
      await generateRecu(p, user);
      toast.success(t.toast.exported);
    } catch {
      toast.error(t.toast.error);
    } finally {
      setExporting(null);
    }
  };

  const T_LABEL = {
    SCOLARITE:          t.pages.payments.types.scolarite,
    INSCRIPTION:        t.pages.payments.types.inscription,
    EXAMEN_BTS:         t.pages.payments.types.examenBTS,
    SOUTENANCE_BTS:     t.pages.payments.types.soutenanceBTS,
    SOUTENANCE_LICENCE: t.pages.payments.types.soutenanceLic,
    SOUTENANCE_MASTER:  t.pages.payments.types.soutenanceMas,
  };

  const totalPaye       = (data || []).filter(d => d.statut==='PAYE').reduce((s,d) => s + Number(d.mt_paiement||0), 0);
  const nbInscription   = (data || []).filter(d => d.type_paiement==='INSCRIPTION').length;
  const nbScolarite     = (data || []).filter(d => d.type_paiement==='SCOLARITE' || !d.type_paiement).length;

  const COLS = [
    { accessor:'code_paiement', label:'N°' },
    { key:'type', label: t.fields.type, searchValue: r => T_LABEL[r.type_paiement] || r.type_paiement || '', render: r => (
      <span className={`sms-badge ${T_STYLE[r.type_paiement] || 'badge-info'}`} style={{ fontSize:10, whiteSpace:'nowrap' }}>
        {T_LABEL[r.type_paiement] || t.pages.payments.types.scolarite}
      </span>
    )},
    { key:'etud',   label: t.fields.mleEtud,  render: r => r.mle_etudiant?.mle_etudiant || r.mle_etudiant },
    { key:'nom',    label: t.fields.nomEtud,  bold:true, render: r => r.nom_etudiant || r.mle_etudiant?.nom || '—' },
    { key:'motif', label: t.fields.tranche, render: r => {
      if (r.type_paiement === 'SCOLARITE' || !r.type_paiement)
        return <span style={{ fontSize:11 }}>{r.lib_tranche || '—'}</span>;
      return <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{T_LABEL[r.type_paiement] || r.type_paiement}</span>;
    }},
    { key:'mt',     label: t.fields.montant,  render: r => (
      <span style={{ color:'var(--green)', fontWeight:700, fontFamily:'var(--font-display)' }}>
        {Number(r.mt_paiement||0).toLocaleString()} FCFA
      </span>
    )},
    { key:'date',   label: t.fields.date,     render: r => r.date_paiement?.slice(0,10) || '—' },
    { key:'statut', label: t.fields.statut, searchValue: r => r.statut === 'PAYE' ? t.status.paye : r.statut === 'PARTIEL' ? t.status.partiel : t.status.impaye, render: r => (
      <span className={`sms-badge ${S_STYLE[r.statut]||'badge-secondary'}`}>
        {r.statut==='PAYE' ? t.status.paye : r.statut==='PARTIEL' ? t.status.partiel : t.status.impaye}
      </span>
    )},
    { key:'annee',  label: t.fields.annee,   render: r => r.lib_annee || r.code_annee || '—' },
    { key:'pdf', label:'', render: r => (
      <button
        className="sms-btn-icon"
        onClick={e => { e.stopPropagation(); handleExportRecu(r); }}
        disabled={exporting === r.code_paiement}
        title={t.pages.payments.downloadPdf}
        style={{ color:'var(--danger)' }}
      >
        {exporting === r.code_paiement
          ? <div className="sms-spinner" style={{ width:12, height:12 }}></div>
          : <i className="fas fa-file-pdf"></i>
        }
      </button>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', marginBottom:20 }}>
        <div className="stat-card c-green"><div className="stat-icon c-green"><i className="fas fa-check-circle"></i></div>
          <div><div className="stat-value">{(data||[]).filter(d=>d.statut==='PAYE').length}</div><div className="stat-label">{t.fields.payes}</div></div></div>
        <div className="stat-card c-orange"><div className="stat-icon c-orange"><i className="fas fa-clock"></i></div>
          <div><div className="stat-value">{(data||[]).filter(d=>d.statut==='PARTIEL').length}</div><div className="stat-label">{t.fields.partiels}</div></div></div>
        <div className="stat-card c-red"><div className="stat-icon c-red"><i className="fas fa-times-circle"></i></div>
          <div><div className="stat-value">{(data||[]).filter(d=>d.statut==='IMPAYE').length}</div><div className="stat-label">{t.fields.impayes}</div></div></div>
        <div className="stat-card c-blue"><div className="stat-icon c-blue"><i className="fas fa-coins"></i></div>
          <div><div className="stat-value" style={{ fontSize:15 }}>{totalPaye.toLocaleString()}</div><div className="stat-label">{t.fields.encaisse}</div></div></div>
        <div className="stat-card c-purple" style={{ '--c-purple':'#7c3aed' }}><div className="stat-icon" style={{ background:'#7c3aed22', color:'#7c3aed' }}><i className="fas fa-file-signature"></i></div>
          <div><div className="stat-value">{nbInscription}</div><div className="stat-label">{t.nav.inscriptions}</div></div></div>
      </div>
      <CrudTable
        title={t.pages.payments.title} subtitle={t.pages.payments.subtitle}
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        icon="fas fa-credit-card" columns={COLS} data={data || []} addLabel={t.common.add}
        filters={
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)' }}>
            <i className="fas fa-file-pdf" style={{ color:'var(--danger)', fontSize:13 }}></i>
            {t.pages.payments.pdfHint}
          </div>
        }
        onAdd={async (d) => { try { await create(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message); } }}
        onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />
    </div>
  );
}
