/**
 * pages/CarteEtudiants.jsx — Cartes scolaires avec QR code
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { carteEtudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { AvatarCircle } from '../utils/avatar';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const STATUT_COLORS = { ACTIVE:'badge-success', PERDUE:'badge-warning', EXPIREE:'badge-secondary', ANNULEE:'badge-danger' };

function Form({ item, onClose, onSave }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [etudiants, setEts] = useState([]);
  const [loading, setLoad]  = useState(true);
  const [f, setF] = useState({
    mle_etudiant: item?.mle_etudiant || '', code_annee: item?.code_annee || '',
    numero_carte: item?.numero_carte || '', date_expiration: item?.date_expiration || '',
    statut: item?.statut || 'ACTIVE',
    qr_code_data: item?.qr_code_data || '',
  });
  useEffect(() => {
    api.get('/api/etudiants/?page_size=200').then(r => setEts(r.data.results ?? r.data)).finally(() => setLoad(false));
  }, []);
  useEffect(() => {
    if (f.mle_etudiant && f.code_annee) {
      setF(p => ({ ...p, qr_code_data: `SMS-CARTE:${f.mle_etudiant}:${f.code_annee}:${Date.now()}` }));
    }
  }, [f.mle_etudiant, f.code_annee]);
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  if (loading) return <div style={{ padding:40, textAlign:'center' }}><div className="sms-spinner" style={{ width:32, height:32, margin:'auto' }}></div></div>;

  const STATUTS = [
    { value:'ACTIVE',  label: t.status.active },
    { value:'PERDUE',  label: t.status.perdue },
    { value:'EXPIREE', label: t.status.expiree },
    { value:'ANNULEE', label: t.status.annulee },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{labels.studentLabel} *</label>
          <select className="sms-input" name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {etudiants.map(e => <option key={e.mle_etudiant} value={e.mle_etudiant}>{e.nom} {e.prenom||''} ({e.mle_etudiant})</option>)}
          </select>
        </div>
        <FormField label={`${t.fields.annee} *`} name="code_annee" value={f.code_annee} onChange={ch} required placeholder="2025-2026" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.numeroCarte} name="numero_carte"    value={f.numero_carte}    onChange={ch} placeholder="CARTE-2026-001" />
        <FormField label={t.fields.expiration}  name="date_expiration" type="date" value={f.date_expiration} onChange={ch} help="Format : JJ/MM/AAAA" />
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.statut}</label>
          <select className="sms-input" name="statut" value={f.statut} onChange={ch}>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-group">
        <label className="sms-label">{t.fields.qrCode}</label>
        <input className="sms-input" name="qr_code_data" value={f.qr_code_data} onChange={ch}
          style={{ fontFamily:'monospace', fontSize:11 }} readOnly />
        <small style={{ color:'var(--text-muted)', fontSize:11 }}>{t.common.select}</small>
      </div>
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-id-card"></i> {t.common.generate}</button>
      </div>
    </form>
  );
}

const PAGE_SIZE = 25;

export default function CarteEtudiants() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [page,         setPage]   = useState(1);
  const [serverSearch, setSearch] = useState('');

  const { data, count, loading, error, reload } = useApi(
    () => carteEtudiantService.list({
      page_size: PAGE_SIZE, page,
      ...(serverSearch ? { search: serverSearch } : {}),
    }),
    [page, serverSearch]
  );
  const { mutate: create } = useMutation(useCallback(d => carteEtudiantService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => carteEtudiantService.update(d.code_carte, d), []));
  const { mutate: remove } = useMutation(useCallback(d => carteEtudiantService.delete(d.code_carte), []));

  const COLS = useMemo(() => [
    { key:'avatar', label:'', render: r => {
        const nom = (r.nom_etudiant || r.mle_etudiant || '').split(' ');
        return <AvatarCircle nom={nom[0]} prenom={nom[1]} photoUrl={r.photo_url || null} size={36} />;
      }
    },
    { key:'etud',    label: labels.studentLabel, searchValue: r => r.nom_etudiant || r.mle_etudiant || '', render:r => <strong>{r.nom_etudiant || r.mle_etudiant}</strong> },
    { accessor:'numero_carte',    label: t.fields.numeroCarte },
    { accessor:'code_annee',      label: t.fields.annee },
    { accessor:'date_expiration', label: t.fields.expiration },
    { key:'statut',  label: t.fields.statut, searchValue: r => r.statut || '', render:r => <span className={`sms-badge ${STATUT_COLORS[r.statut]||'badge-secondary'}`}>{r.statut}</span> },
    { key:'qr',      label: t.fields.qrCode, render:r => <code style={{ fontSize:10, color:'var(--text-muted)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{r.qr_code_data?.slice(0,30)}...</code> },
  ], [t]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <CrudTable title={t.pages.cartes.title} subtitle={t.pages.cartes.subtitle} icon="fas fa-id-card"
      columns={COLS} data={data||[]} addLabel={t.pages.cartes.addLabel}
      loading={loading}
      totalCount={count}
      serverSide
      serverPage={page}
      serverPages={Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))}
      onServerPage={setPage}
      onServerSearch={setSearch}
      onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch(e){ toast.error(e.message); } }}
      onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch(e){ toast.error(e.message); } }}
      onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch(e){ toast.error(e.message); } }}
      renderForm={p => <Form {...p} />}
    />
  );
}
