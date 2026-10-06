/**
 * pages/Payments.jsx
 * Paiements (scolarité + inscription) avec export reçu PDF.
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import AutocompleteField from '../components/AutocompleteField';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { useApi, useMutation } from '../hooks/useApi';
import { paiementService, etudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateRecu } from '../services/pdfService';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import PaymentsSalaires from './PaymentsSalaires';

const S_STYLE = { PAYE:'badge-success', PARTIEL:'badge-warning', IMPAYE:'badge-danger' };
const T_STYLE = {
  SCOLARITE:          'badge-info',
  INSCRIPTION:        'badge-warning',
  EXAMEN_BTS:         'badge-secondary',
  SOUTENANCE_BTS:     'badge-secondary',
  SOUTENANCE_LICENCE: 'badge-secondary',
  SOUTENANCE_MASTER:  'badge-secondary',
  APEE:               'badge-purple',
  EXAMEN_OFFICIEL:    'badge-secondary',
};
// T_LABEL is computed inside Payments to support i18n
const NEEDS_TRANCHE = ['SCOLARITE'];

function Form({ item, onClose, onSave, showSoutenances, isPreBac, labels }) {
  const { t } = useApp();
  const [formError, setFormError] = useState('');
  const [annees, setAnnees] = useState([]);
  useEffect(() => {
    api.get('/api/annees/?page_size=20').then(r => setAnnees(r.data.results ?? r.data)).catch(() => {});
  }, []);
  const STATUTS = [
    { value:'PAYE',    label: t.status.paye },
    { value:'PARTIEL', label: t.status.partiel },
    { value:'IMPAYE',  label: t.status.impaye },
  ];
  const ALL_TYPES = [
    { value:'SCOLARITE',          label: t.pages.payments.types.scolarite,    sup: false },
    { value:'INSCRIPTION',        label: t.pages.payments.types.inscription,  sup: false },
    { value:'EXAMEN_BTS',         label: t.pages.payments.types.examenBTS,    sup: true  },
    { value:'SOUTENANCE_BTS',     label: t.pages.payments.types.soutenanceBTS,sup: true  },
    { value:'SOUTENANCE_LICENCE', label: t.pages.payments.types.soutenanceLic,sup: true  },
    { value:'SOUTENANCE_MASTER',  label: t.pages.payments.types.soutenanceMas,sup: true  },
    // APEE : contribution parents-enseignants, propre au primaire/secondaire (voir doc
    // de référence système éducatif — coût réel dans le public où la scolarité est
    // nominalement gratuite). Frais d'examen officiel : universel (CEP/BEPC/Bac/BTS…).
    { value:'APEE',            label: t.pages.payments.types.apee,           preBac: true },
    { value:'EXAMEN_OFFICIEL', label: t.pages.payments.types.examenOfficiel },
  ];
  const TYPES = ALL_TYPES.filter(t => (!t.sup || showSoutenances) && (!t.preBac || isPreBac));
  const [f, setF] = useState({
    type_paiement: item?.type_paiement  || 'SCOLARITE',
    mle_etudiant:  item?.mle_etudiant?.mle_etudiant || item?.mle_etudiant || '',
    code_tranche:  item?.code_tranche?.code_tranche || item?.code_tranche || '',
    code_annee:    item?.code_annee?.code_annee     || item?.code_annee   || '',
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

  const isPartiel = f.statut === 'PARTIEL';

  const submit = e => {
    e.preventDefault();
    if (isPartiel && !f.obs_paiement.trim()) {
      setFormError('Une explication est obligatoire pour un paiement partiel (champ Observations).');
      return;
    }
    setFormError('');
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
          label={labels?.studentLabel || t.fields.mleEtud} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required
          service={etudiantService}
          labelFn={e => `${e.nom} ${e.prenom || ''} — ${e.mle_etudiant}`}
          valueFn={e => e.mle_etudiant}
          initialLabel={item ? `${item.nom_etudiant || ''} ${item.prenom_etudiant || ''} — ${item.mle_etudiant?.mle_etudiant || item.mle_etudiant}`.trim() : ''}
          placeholder="Rechercher par nom ou matricule…"
        />
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.annee} *</label>
          <select className="sms-input" name="code_annee" value={f.code_annee} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        {NEEDS_TRANCHE.includes(f.type_paiement) && (
          <FormField label={t.fields.codeTrancheLabel} name="code_tranche"
            value={f.code_tranche} onChange={ch} required
            placeholder="Ex : T1"
            help="Code de la tranche de paiement rattachée à ce régime de scolarité" />
        )}
        <FormField label={t.fields.montant} name="mt_paiement" type="number"
          value={f.mt_paiement} onChange={ch} required placeholder="Ex : 75 000" />
        <FormField label={t.fields.date}    name="date_paiement" type="date"
          value={f.date_paiement} onChange={ch} help="Format : JJ/MM/AAAA" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.statut} name="statut" type="select"
          value={f.statut} onChange={ch} options={STATUTS} />
        <div className="sms-form-group" style={{ flex: 2 }}>
          <label className="sms-label">
            {t.fields.obs}
            {isPartiel && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
            {isPartiel && (
              <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 6, fontWeight: 400 }}>
                obligatoire pour paiement partiel
              </span>
            )}
          </label>
          <input
            className="sms-input"
            name="obs_paiement"
            value={f.obs_paiement}
            onChange={ch}
            required={isPartiel}
            maxLength={45}
            placeholder={isPartiel ? 'Ex : Solde du reste le 15/02 — chèque n°…' : ''}
            style={isPartiel && !f.obs_paiement.trim() ? { borderColor: 'var(--warning)' } : {}}
          />
        </div>
      </div>
      {formError && (
        <div style={{
          background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 8,
          color: '#ef9a9a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: 11 }}></i> {formError}
        </div>
      )}
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

const PAGE_SIZE = 30;

export default function Payments() {
  const { t, toast, user, anneeActive, lang } = useApp();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [showSalaires, setShowSalaires] = useState(false);
  const [depFilter,    setDepFilter]    = useState('');
  const [spFilter,     setSpFilter]     = useState('');
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);
  const [page,         setPage]         = useState(1);
  const [statsData,    setStatsData]    = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsVersion, setStatsVersion] = useState(0);
  const reloadStats = useCallback(() => setStatsVersion(v => v + 1), []);

  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
    ]).then(([dR, sR]) => {
      setDepartements(dR.data.results ?? dR.data);
      const sps = sR.data.results ?? sR.data;
      setSpecialites(sps);
      setFilteredSp(sps);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!depFilter) {
      setFilteredSp(specialites);
      setSpFilter('');
    } else {
      const f = specialites.filter(s => {
        const d = typeof s.code_dep === 'object' ? s.code_dep?.code_dep : s.code_dep;
        return d === depFilter;
      });
      setFilteredSp(f);
      if (spFilter && !f.some(s => s.code_sp === spFilter)) setSpFilter('');
    }
  }, [depFilter, specialites]);

  // Stats côté serveur — COUNT/SUM, sans rapatrier toutes les lignes
  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    const params = {};
    if (anneeActive) params.code_annee = anneeActive.code_annee;
    if (depFilter)   params.code_dep   = depFilter;
    if (spFilter)    params.code_sp    = spFilter;
    paiementService.stats(params)
      .then(r => { if (active) setStatsData(r.data); })
      .catch(() => {})
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [anneeActive, depFilter, spFilter, statsVersion]);

  // Réinitialise la page quand les filtres changent
  useEffect(() => { setPage(1); }, [anneeActive?.code_annee, depFilter, spFilter]);

  const { data, count, loading, error, reload } = useApi(
    () => paiementService.list({
      page,
      page_size: PAGE_SIZE,
      ...(anneeActive ? { code_annee: anneeActive.code_annee } : {}),
      ...(depFilter   ? { code_dep:   depFilter   } : {}),
      ...(spFilter    ? { code_sp:    spFilter    } : {}),
    }),
    [anneeActive, depFilter, spFilter, page]
  );
  const { mutate: create } = useMutation(useCallback((d) => paiementService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => paiementService.update(d.code_paiement, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => paiementService.delete(d.code_paiement), []));
  const [exporting,   setExporting]   = useState(null);
  const [emailModal,  setEmailModal]  = useState(null);
  const [emailTo,     setEmailTo]     = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  const handleExportRecu = async (p) => {
    setExporting(p.code_paiement);
    try {
      const { blob, filename } = await generateRecu(p, user);
      showPreview(blob, filename);
      toast.success(t.toast.exported);
    } catch {
      toast.error(t.toast.error);
    } finally {
      setExporting(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailModal || !emailTo) return;
    setSendingMail(true);
    const p       = emailModal;
    const mle     = typeof p.mle_etudiant === 'object' ? p.mle_etudiant?.mle_etudiant : p.mle_etudiant;
    const nom     = p.nom_etudiant || mle || '';
    const montant = Number(p.mt_paiement || 0).toLocaleString('fr-FR');
    const date    = p.date_paiement?.slice(0, 10) || '';
    const motif   = p.lib_tranche || p.type_paiement || 'Scolarité';
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#2e7d32;text-align:center;">REÇU DE PAIEMENT</h2>
        <p>Bonjour <strong>${nom}</strong>,</p>
        <p>Nous vous confirmons la réception de votre paiement.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="border-bottom:1px solid #eee;"><td style="padding:8px;color:#666;">Matricule</td><td style="padding:8px;font-weight:bold;">${mle}</td></tr>
          <tr style="border-bottom:1px solid #eee;"><td style="padding:8px;color:#666;">Motif</td><td style="padding:8px;">${motif}</td></tr>
          <tr style="border-bottom:1px solid #eee;"><td style="padding:8px;color:#666;">Date</td><td style="padding:8px;">${date}</td></tr>
          <tr><td style="padding:8px;color:#666;">Montant payé</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#2e7d32;">${montant} FCFA</td></tr>
        </table>
        <p style="font-size:12px;color:#999;text-align:center;">Ce message est automatique — SMS v2.0</p>
      </div>`;
    try {
      await api.post('/api/envoi-email/', {
        to:        emailTo,
        subject:   `Reçu de paiement — ${nom}`,
        body_html: bodyHtml,
      });
      toast.success(t.pages.payments.emailSent || 'Email envoyé avec succès.');
      setEmailModal(null);
      setEmailTo('');
    } catch (e) {
      toast.error(e.response?.data?.error || t.errors.saving);
    } finally {
      setSendingMail(false);
    }
  };

  const T_LABEL = {
    SCOLARITE:          t.pages.payments.types.scolarite,
    INSCRIPTION:        t.pages.payments.types.inscription,
    EXAMEN_BTS:         t.pages.payments.types.examenBTS,
    SOUTENANCE_BTS:     t.pages.payments.types.soutenanceBTS,
    SOUTENANCE_LICENCE: t.pages.payments.types.soutenanceLic,
    SOUTENANCE_MASTER:  t.pages.payments.types.soutenanceMas,
    APEE:               t.pages.payments.types.apee,
    EXAMEN_OFFICIEL:    t.pages.payments.types.examenOfficiel,
  };

  const totalPages    = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const statVal = (key) => statsLoading ? '…' : (statsData?.[key] ?? '—');

  const COLS = [
    { accessor:'code_paiement', label:'N°' },
    { key:'type', label: t.fields.type, searchValue: r => T_LABEL[r.type_paiement] || r.type_paiement || '', render: r => (
      <span className={`sms-badge ${T_STYLE[r.type_paiement] || 'badge-info'}`} style={{ fontSize:10, whiteSpace:'nowrap' }}>
        {T_LABEL[r.type_paiement] || t.pages.payments.types.scolarite}
      </span>
    )},
    { key:'etud',   label: lang === 'en' ? `${labels.studentLabel} ID` : `Matricule ${labels.studentLabel.toLowerCase()}`,
      render: r => r.mle_etudiant?.mle_etudiant || r.mle_etudiant },
    { key:'nom',    label: labels.studentLabel,  bold:true, render: r => r.nom_etudiant || r.mle_etudiant?.nom || '—' },
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
      <div style={{ display:'flex', gap:6 }}>
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
        <button
          className="sms-btn-icon"
          onClick={e => { e.stopPropagation(); setEmailModal(r); setEmailTo(r.email_etudiant || ''); }}
          title={t.pages.payments.sendEmail || 'Envoyer par email'}
          style={{ color:'#1a3c5e' }}
        >
          <i className="fas fa-envelope"></i>
        </button>
      </div>
    )},
  ];

  const salaireToggle = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={showSalaires} onChange={e => setShowSalaires(e.target.checked)} />
      Afficher les salaires du personnel (au lieu des frais de scolarité/inscription)
    </label>
  );

  if (showSalaires) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>{salaireToggle}</div>
        <PaymentsSalaires />
      </div>
    );
  }

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>{salaireToggle}</div>
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', marginBottom:20 }}>
        <div className="stat-card c-green"><div className="stat-icon c-green"><i className="fas fa-check-circle"></i></div>
          <div><div className="stat-value">{statVal('nb_payes')}</div><div className="stat-label">{t.fields.payes}</div></div></div>
        <div className="stat-card c-orange"><div className="stat-icon c-orange"><i className="fas fa-clock"></i></div>
          <div><div className="stat-value">{statVal('nb_partiels')}</div><div className="stat-label">{t.fields.partiels}</div></div></div>
        <div className="stat-card c-red"><div className="stat-icon c-red"><i className="fas fa-times-circle"></i></div>
          <div><div className="stat-value">{statVal('nb_impayes')}</div><div className="stat-label">{t.fields.impayes}</div></div></div>
        <div className="stat-card c-blue"><div className="stat-icon c-blue"><i className="fas fa-coins"></i></div>
          <div><div className="stat-value" style={{ fontSize:15 }}>{statsLoading ? '…' : (statsData?.total_encaisse ?? 0).toLocaleString()}</div><div className="stat-label">{t.fields.encaisse}</div></div></div>
        <div className="stat-card c-purple"><div className="stat-icon c-purple"><i className="fas fa-file-signature"></i></div>
          <div><div className="stat-value">{statVal('nb_inscriptions')}</div><div className="stat-label">{t.nav.inscriptions}</div></div></div>
      </div>
      <CrudTable
        title={t.pages.payments.title} subtitle={t.pages.payments.subtitle}
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        icon="fas fa-credit-card" columns={COLS} data={data || []} addLabel={t.common.add}
        totalCount={count}
        exportCsvUrl={`/api/paiements/export-csv/${[depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`].filter(Boolean).join('&') ? '?' + [depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`].filter(Boolean).join('&') : ''}`}
        filters={
          <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
            <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
              value={depFilter} onChange={e => setDepFilter(e.target.value)}>
              <option value="">{t.common.allDepts}</option>
              {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
            </select>
            <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
              value={spFilter} onChange={e => setSpFilter(e.target.value)} disabled={!depFilter}>
              <option value="">{t.common.allSp}</option>
              {filteredSp.map(s => <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>)}
            </select>
            {(depFilter || spFilter) && (
              <button className="sms-btn-icon" onClick={() => { setDepFilter(''); setSpFilter(''); }} title={t.common.reset}>
                <i className="fas fa-times"></i>
              </button>
            )}
            <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>
              <i className="fas fa-file-pdf" style={{ color:'var(--danger)', marginRight:4 }}></i>
              {t.pages.payments.pdfHint}
            </span>
          </div>
        }
        onAdd={async (d) => { try { await create(d); toast.success(t.toast.added); reload(); reloadStats(); } catch (e) { toast.error(e.message); } }}
        onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); reloadStats(); } catch (e) { toast.error(e.message); } }}
        onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); reloadStats(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} showSoutenances={labels.showSoutenances} isPreBac={labels.isPreBac} labels={labels} />}
      />

      {/* Pagination serveur */}
      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, padding:'0 4px' }}>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            Page {page} / {totalPages} &mdash; {count} résultats
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setPage(1)} disabled={page === 1}>
              <i className="fas fa-angle-double-left"></i>
            </button>
            <button className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <i className="fas fa-chevron-left"></i> Préc.
            </button>
            <button className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Suiv. <i className="fas fa-chevron-right"></i>
            </button>
            <button className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setPage(totalPages)} disabled={page === totalPages}>
              <i className="fas fa-angle-double-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Modal envoi email */}
      {emailModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setEmailModal(null)}>
          <div className="sms-modal" style={{ maxWidth: 420 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className="fas fa-envelope" style={{ marginRight: 8, color: '#1a3c5e' }}></i>
                {t.pages.payments.sendEmail || 'Envoyer le reçu par email'}
              </div>
              <button className="sms-btn-icon" onClick={() => setEmailModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="sms-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {emailModal.nom_etudiant} —{' '}
                {Number(emailModal.mt_paiement || 0).toLocaleString('fr-FR')} FCFA
              </p>
              <label className="sms-label">Adresse email *</label>
              <input
                className="sms-input"
                type="email"
                placeholder="Ex : jean.dupont@gmail.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                autoFocus
              />
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setEmailModal(null)}>
                {t.common.cancel}
              </button>
              <button
                className="sms-btn sms-btn-primary sms-btn-sm"
                onClick={handleSendEmail}
                disabled={sendingMail || !emailTo}
              >
                {sendingMail
                  ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                  : <><i className="fas fa-paper-plane"></i> {t.common.send}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
