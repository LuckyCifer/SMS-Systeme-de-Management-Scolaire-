/**
 * pages/Factures.jsx — Gestion des factures
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { factureService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const STATUT_VALUE_COLORS = {
  EN_ATTENTE: 'badge-secondary',
  PARTIELLEMENT_PAYE: 'badge-warning',
  SOLDEE: 'badge-success',
  ANNULEE: 'badge-danger',
};

// ── Vue détaillée d'une facture ───────────────────────────────────────────────
function DetailModal({ facture, onClose }) {
  const { t } = useApp();
  const [detail, setDetail] = useState(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    api.get(`/api/factures/${facture.code_facture}/`)
      .then(r => setDetail(r.data))
      .finally(() => setLoad(false));
  }, [facture.code_facture]);

  const restant = detail ? (parseFloat(detail.montant_total) - parseFloat(detail.montant_paye)) : 0;

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 580 }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-file-invoice" style={{ marginRight: 8, color: 'var(--green)' }}></i>
            {t.fields.numeroFact} {facture.numero_facture}
          </div>
          <button className="sms-btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="sms-modal-body">
          {loading ? <LoadingState /> : detail ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16,
                padding:12, background:'var(--bg-darkest)', borderRadius:8 }}>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{t.fields.nomEtud.toUpperCase()}</div>
                  <div style={{ fontWeight:700 }}>{detail.nom_etudiant || detail.mle_etudiant}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{t.fields.annee.toUpperCase()}</div>
                  <div style={{ fontWeight:700 }}>{detail.code_annee}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{t.fields.date.toUpperCase()}</div>
                  <div>{detail.date_emission?.slice(0,10)}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{t.fields.statut.toUpperCase()}</div>
                  <span className={`sms-badge ${STATUT_VALUE_COLORS[detail.statut] || 'badge-secondary'}`}>
                    {detail.statut}
                  </span>
                </div>
              </div>

              {detail.lignes?.length > 0 && (
                <div className="sms-table-wrap" style={{ marginBottom:16 }}>
                  <table className="sms-table" style={{ fontSize:12 }}>
                    <thead><tr>
                      <th>{t.fields.libelle}</th>
                      <th>{t.fields.type}</th>
                      <th style={{ textAlign:'right' }}>{t.fields.montant}</th>
                      <th>{t.fields.dateFin}</th>
                    </tr></thead>
                    <tbody>
                      {detail.lignes.map((l, i) => (
                        <tr key={i}>
                          <td>{l.libelle}</td>
                          <td>{l.type_frais}</td>
                          <td style={{ textAlign:'right', fontWeight:600, color:'var(--green)' }}>
                            {Number(l.montant).toLocaleString()} FCFA
                          </td>
                          <td style={{ color:'var(--text-muted)' }}>{l.date_echeance || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end',
                padding:'12px 16px', background:'var(--bg-darkest)', borderRadius:8 }}>
                {[
                  { label: t.common.totalDue,    value:detail.montant_total,  color:'var(--text-primary)' },
                  { label: t.fields.payes,        value:detail.montant_paye,   color:'var(--green)' },
                  { label: t.common.remaining,    value:restant,               color: restant > 0 ? '#c62828' : 'var(--green)', bold:true },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', width:240 }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: row.bold ? 15 : 13, fontWeight: row.bold ? 800 : 600, color:row.color }}>
                      {Number(row.value).toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ color:'var(--text-muted)', textAlign:'center' }}>{t.errors.loading}</p>}
        </div>
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.close}</button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire ────────────────────────────────────────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const [etudiants, setEts] = useState([]);
  const [loading, setLoad]  = useState(true);
  const [f, setF] = useState({
    numero_facture: item?.numero_facture || `FAC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`,
    mle_etudiant:   item?.mle_etudiant || '',
    code_annee:     item?.code_annee   || '2025-2026',
    montant_total:  item?.montant_total || 0,
    montant_paye:   item?.montant_paye  || 0,
    statut:         item?.statut       || 'EN_ATTENTE',
    observations:   item?.observations || '',
  });
  useEffect(() => {
    api.get('/api/etudiants/?page_size=200').then(r => setEts(r.data.results ?? r.data)).finally(() => setLoad(false));
  }, []);
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  if (loading) return <div style={{ padding:40, textAlign:'center' }}><div className="sms-spinner" style={{ width:32, height:32, margin:'auto' }}></div></div>;

  const STATUTS = [
    { value:'EN_ATTENTE',         label: t.status.enAttente },
    { value:'PARTIELLEMENT_PAYE', label: t.status.partPaye },
    { value:'SOLDEE',             label: t.status.soldee },
    { value:'ANNULEE',            label: t.status.annulee },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={`${t.fields.numeroFact} *`} name="numero_facture" value={f.numero_facture} onChange={ch} required />
        <FormField label={`${t.fields.annee} *`}      name="code_annee"     value={f.code_annee}     onChange={ch} required />
      </div>
      <div className="sms-form-group">
        <label className="sms-label">{t.fields.nomEtud} *</label>
        <select className="sms-input" name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required>
          <option value="">{t.common.select}</option>
          {etudiants.map(e => <option key={e.mle_etudiant} value={e.mle_etudiant}>{e.nom} {e.prenom||''} ({e.mle_etudiant})</option>)}
        </select>
      </div>
      <div className="sms-form-row">
        <FormField label={`${t.fields.montantTotal} *`} name="montant_total" type="number" value={f.montant_total} onChange={ch} required />
        <FormField label={t.fields.montantPaye}          name="montant_paye"  type="number" value={f.montant_paye}  onChange={ch} />
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.statut}</label>
          <select className="sms-input" name="statut" value={f.statut} onChange={ch}>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <FormField label={t.fields.obs} name="observations" type="textarea" value={f.observations} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-file-invoice"></i> {t.pages.factures.addLabel}</button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Factures() {
  const { t, toast } = useApp();
  const [detailModal, setDetailModal] = useState(null);

  const { data, loading, error, reload } = useApi(() => factureService.list({ page_size: 100 }));
  const { mutate: create } = useMutation(useCallback(d => factureService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => factureService.update(d.code_facture, d), []));
  const { mutate: remove } = useMutation(useCallback(d => factureService.delete(d.code_facture), []));

  const totalDu   = (data||[]).reduce((s,f) => s + Number(f.montant_total||0), 0);
  const totalPaye = (data||[]).reduce((s,f) => s + Number(f.montant_paye||0), 0);
  const totalRest = totalDu - totalPaye;

  const COLS = [
    { accessor:'numero_facture', label: t.fields.numeroFact, bold:true },
    { key:'etud',     label: t.fields.nomEtud,     render:r => r.nom_etudiant || r.mle_etudiant },
    { accessor:'code_annee', label: t.fields.annee },
    { key:'total',    label: t.common.totalDue,    render:r => <span style={{ color:'var(--text-primary)', fontWeight:700 }}>{Number(r.montant_total||0).toLocaleString()} FCFA</span> },
    { key:'paye',     label: t.fields.payes,        render:r => <span style={{ color:'var(--green)', fontWeight:600 }}>{Number(r.montant_paye||0).toLocaleString()} FCFA</span> },
    { key:'restant',  label: t.common.remaining,    render:r => {
      const rest = Number(r.montant_total||0) - Number(r.montant_paye||0);
      return <span style={{ color: rest > 0 ? '#c62828' : 'var(--green)', fontWeight:700 }}>{rest.toLocaleString()} FCFA</span>;
    }},
    { key:'statut',   label: t.fields.statut, searchValue: r => r.statut || '', render:r => {
      const color = STATUT_VALUE_COLORS[r.statut] || 'badge-secondary';
      return <span className={`sms-badge ${color}`}>{r.statut}</span>;
    }},
    { key:'detail',   label:'',                     render:r => (
      <button className="sms-btn sms-btn-outline sms-btn-sm"
        onClick={e => { e.stopPropagation(); setDetailModal(r); }}>
        <i className="fas fa-eye"></i> {t.common.details}
      </button>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', marginBottom:16 }}>
        {[
          { label: t.common.totalDue,       value:totalDu.toLocaleString()+' FCFA',   color:'c-blue',   icon:'fas fa-file-invoice-dollar' },
          { label: t.common.totalCollected, value:totalPaye.toLocaleString()+' FCFA', color:'c-green',  icon:'fas fa-check-circle' },
          { label: t.common.balance,        value:totalRest.toLocaleString()+' FCFA', color: totalRest > 0 ? 'c-red' : 'c-green', icon:'fas fa-balance-scale' },
          { label: t.pages.factures.title,  value:(data||[]).length,                   color:'c-orange', icon:'fas fa-file-alt' },
        ].map(s => (
          <div className={`stat-card ${s.color}`} key={s.label}>
            <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
            <div><div className="stat-value" style={{ fontSize:14 }}>{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <CrudTable
        title={t.pages.factures.title} subtitle={t.pages.factures.subtitle} icon="fas fa-file-invoice"
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        columns={COLS} data={data||[]} addLabel={t.pages.factures.addLabel}
        onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch(e){ toast.error(e.message); } }}
        onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch(e){ toast.error(e.message); } }}
        onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch(e){ toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />

      {detailModal && <DetailModal facture={detailModal} onClose={() => setDetailModal(null)} />}
    </>
  );
}
