/**
 * pages/Stages.jsx — Gestion des stages
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { stageService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const STATUT_COLORS = { EN_COURS:'badge-info', VALIDE:'badge-success', INVALIDE:'badge-danger', EN_ATTENTE:'badge-secondary' };

function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const [etudiants, setEts] = useState([]);
  const [loading,   setLoad] = useState(true);
  const [f, setF] = useState({
    mle_etudiant: item?.mle_etudiant || '', code_annee: item?.code_annee || '',
    entreprise: item?.entreprise || '', adresse_entreprise: item?.adresse_entreprise || '',
    tuteur_entreprise: item?.tuteur_entreprise || '', date_debut: item?.date_debut || '',
    date_fin: item?.date_fin || '', sujet: item?.sujet || '',
    type_stage: item?.type_stage || 'OBSERVATION', note_stage: item?.note_stage || '',
    statut: item?.statut || 'EN_ATTENTE',
  });
  useEffect(() => {
    api.get('/api/etudiants/?page_size=200').then(r => setEts(r.data.results ?? r.data)).finally(() => setLoad(false));
  }, []);
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  if (loading) return <div style={{ padding:40, textAlign:'center' }}><div className="sms-spinner" style={{ width:32, height:32, margin:'auto' }}></div></div>;

  const TYPES = [
    { value:'OBSERVATION',     label: t.types.observation },
    { value:'PERFECTIONNEMENT',label: t.types.perfectionnement },
    { value:'FIN_ETUDE',       label: t.types.finEtude },
  ];
  const STATUTS = [
    { value:'EN_COURS',   label: t.status.enCours },
    { value:'VALIDE',     label: t.status.valide },
    { value:'INVALIDE',   label: t.status.invalide },
    { value:'EN_ATTENTE', label: t.status.enAttente },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.nomEtud} *</label>
          <select className="sms-input" name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {etudiants.map(e => <option key={e.mle_etudiant} value={e.mle_etudiant}>{e.nom} {e.prenom||''} ({e.mle_etudiant})</option>)}
          </select>
        </div>
        <FormField label={`${t.fields.annee} *`} name="code_annee" value={f.code_annee} onChange={ch} required placeholder="2025-2026" />
      </div>
      <FormField label={`${t.fields.entreprise} *`} name="entreprise" value={f.entreprise} onChange={ch} required />
      <div className="sms-form-row">
        <FormField label={t.fields.tuteurEnt} name="tuteur_entreprise" value={f.tuteur_entreprise} onChange={ch} />
        <FormField label={t.fields.adresse}   name="adresse_entreprise" value={f.adresse_entreprise} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={`${t.fields.dateDebut} *`} name="date_debut" type="date" value={f.date_debut} onChange={ch} required />
        <FormField label={`${t.fields.dateFin} *`}   name="date_fin"   type="date" value={f.date_fin}   onChange={ch} required />
      </div>
      <FormField label={t.fields.sujet} name="sujet" value={f.sujet} onChange={ch} />
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.typeStage}</label>
          <select className="sms-input" name="type_stage" value={f.type_stage} onChange={ch}>
            {TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.statut}</label>
          <select className="sms-input" name="statut" value={f.statut} onChange={ch}>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <FormField label={t.fields.note} name="note_stage" type="number" value={f.note_stage} onChange={ch} />
      </div>
      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Stages() {
  const { t, toast } = useApp();
  const { data, loading, error, reload } = useApi(() => stageService.list({ page_size: 100 }));
  const { mutate: create } = useMutation(useCallback(d => stageService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => stageService.update(d.code_stage, d), []));
  const { mutate: remove } = useMutation(useCallback(d => stageService.delete(d.code_stage), []));

  const COLS = [
    { key:'etud',     label: t.fields.nomEtud, searchValue: r => r.nom_etudiant || r.mle_etudiant || '', render:r => <strong>{r.nom_etudiant || r.mle_etudiant}</strong> },
    { accessor:'entreprise', label: t.fields.entreprise },
    { key:'dates',    label: t.fields.periode,   render:r => `${r.date_debut} → ${r.date_fin}` },
    { accessor:'type_stage', label: t.fields.typeStage },
    { key:'note',     label: t.fields.noteStage, render:r => r.note_stage ? `${r.note_stage}/20` : '—' },
    { key:'statut',   label: t.fields.statut, searchValue: r => r.statut || '', render:r => <span className={`sms-badge ${STATUT_COLORS[r.statut]||'badge-secondary'}`}>{r.statut}</span> },
    { key:'cert',     label: t.common.certif, searchValue: r => r.certificat_emis ? t.common.emis : t.common.nonEmis, render:r => r.certificat_emis ? <span className="sms-badge badge-success">{t.common.emis}</span> : <span className="sms-badge badge-secondary">{t.common.nonEmis}</span> },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;
  return (
    <CrudTable title={t.pages.stages.title} subtitle={t.pages.stages.subtitle} icon="fas fa-briefcase"
      columns={COLS} data={data||[]} addLabel={t.pages.stages.addLabel}
      onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch(e){ toast.error(e.message); } }}
      onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch(e){ toast.error(e.message); } }}
      onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch(e){ toast.error(e.message); } }}
      renderForm={p => <Form {...p} />}
    />
  );
}
