/**
 * pages/Seances.jsx — Séances de cours et feuille d'émargement
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { seanceService, absenceService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const STATUT_COLORS = {
  TENU: 'badge-success', ANNULE: 'badge-danger',
  REPORTE: 'badge-warning', EN_ATTENTE: 'badge-secondary',
};

// ── Modale Présences ─────────────────────────────────────────────────────────
function PresencesModal({ seance, onClose, toast }) {
  const { t } = useApp();
  const [presences, setPresences]   = useState([]);
  const [etudiants, setEtudiants]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [saving,    setSaving]      = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [presRes, etudRes] = await Promise.all([
          api.get(`/api/seances/${seance.code_seance}/presences/`),
          api.get(`/api/inscriptions/?code_classe=${seance.code_classe}&page_size=100`),
        ]);
        const presData  = presRes.data.results ?? presRes.data;
        const inscData  = etudRes.data.results ?? etudRes.data;
        const mles      = inscData.map(i => ({
          mle: i.mle_etudiant?.mle_etudiant || i.mle_etudiant,
          nom: i.nom_etudiant || i.mle_etudiant?.nom || i.mle_etudiant,
        }));
        const merged = mles.map(m => {
          const p = presData.find(p => (p.mle_etudiant?.mle_etudiant || p.mle_etudiant) === m.mle);
          return { mle: m.mle, nom: m.nom, present: p?.present ?? false, signe: p?.signe ?? false };
        });
        setEtudiants(merged);
        setPresences(merged);
      } catch { toast.error(t.errors.loading); }
      finally  { setLoading(false); }
    };
    load();
  }, [seance.code_seance]);

  const toggle = (mle, field) => {
    setPresences(prev => prev.map(p =>
      p.mle === mle ? { ...p, [field]: !p[field] } : p
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/api/seances/${seance.code_seance}/saisir-presences/`, {
        presences: presences.map(p => ({
          mle_etudiant: p.mle, present: p.present, signe: p.signe
        }))
      });
      toast.success(`${presences.filter(p => p.present).length} ${t.common.presences.toLowerCase()}.`);
      onClose();
    } catch { toast.error(t.errors.saving); }
    finally   { setSaving(false); }
  };

  const nbPresents = presences.filter(p => p.present).length;

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 600 }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-calendar-check" style={{ marginRight: 8, color: 'var(--green)' }}></i>
            {t.common.emargement} — {seance.lib_matiere || seance.code_matiere}
          </div>
          <button className="sms-btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="sms-modal-body">
          {loading ? <LoadingState /> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                padding: '8px 12px', background: 'var(--bg-darkest)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {seance.date_seance} · {seance.h_debut} – {seance.h_fin}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                  {nbPresents}/{presences.length} {t.common.present.toLowerCase()}s
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button className="sms-btn sms-btn-outline sms-btn-sm"
                  onClick={() => setPresences(p => p.map(x => ({ ...x, present: true, signe: true })))}>
                  {t.common.allPresent}
                </button>
                <button className="sms-btn sms-btn-outline sms-btn-sm"
                  onClick={() => setPresences(p => p.map(x => ({ ...x, present: false, signe: false })))}>
                  {t.common.allAbsent}
                </button>
              </div>
              <div className="sms-table-wrap">
                <table className="sms-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>{t.fields.nomEtud}</th>
                      <th style={{ textAlign: 'center', width: 80 }}>{t.common.present}</th>
                      <th style={{ textAlign: 'center', width: 80 }}>{t.common.signed}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presences.map(p => (
                      <tr key={p.mle}>
                        <td>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{p.mle}</span>
                          <strong>{p.nom}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={p.present}
                            onChange={() => toggle(p.mle, 'present')}
                            style={{ accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer' }} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={p.signe}
                            onChange={() => toggle(p.mle, 'signe')}
                            disabled={!p.present}
                            style={{ accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
          <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
              : <><i className="fas fa-save"></i> {t.common.savePresences}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire Séance ────────────────────────────────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const [classes,   setClasses]   = useState([]);
  const [matieres,  setMatieres]  = useState([]);
  const [enseignants, setEns]     = useState([]);
  const [annees,    setAnnees]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [f, setF] = useState({
    code_matiere:         item?.code_matiere || '',
    code_classe:          item?.code_classe  || '',
    mle_ens:              item?.mle_ens      || '',
    code_annee:           item?.code_annee   || '',
    date_seance:          item?.date_seance  || new Date().toISOString().slice(0, 10),
    h_debut:              item?.h_debut      || '08:00',
    h_fin:                item?.h_fin        || '10:00',
    salle:                item?.salle        || '',
    nb_heures_effectuees: item?.nb_heures_effectuees || 2,
    statut:               item?.statut       || 'TENU',
    observations:         item?.observations || '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=100'),
      api.get('/api/matieres/?page_size=200'),
      api.get('/api/enseignants/?page_size=200'),
      api.get('/api/annees/?page_size=20'),
    ]).then(([c, m, e, a]) => {
      setClasses(c.data.results ?? c.data);
      setMatieres(m.data.results ?? m.data);
      setEns(e.data.results ?? e.data);
      setAnnees(a.data.results ?? a.data);
    }).finally(() => setLoading(false));
  }, []);

  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="sms-spinner" style={{ width: 32, height: 32, margin: 'auto' }}></div></div>;

  const STATUTS_SEANCE = [
    { value: 'TENU',       label: t.status.tenu },
    { value: 'ANNULE',     label: t.status.annule },
    { value: 'REPORTE',    label: t.status.reporte },
    { value: 'EN_ATTENTE', label: t.status.enAttente },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.matiere} <span style={{ color: 'var(--green)' }}>*</span></label>
          <select className="sms-input" name="code_matiere" value={f.code_matiere} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {matieres.map(m => <option key={m.code_matiere} value={m.code_matiere}>{m.lib_matiere}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.classe} <span style={{ color: 'var(--green)' }}>*</span></label>
          <select className="sms-input" name="code_classe" value={f.code_classe} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {classes.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.enseignant} <span style={{ color: 'var(--green)' }}>*</span></label>
          <select className="sms-input" name="mle_ens" value={f.mle_ens} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {enseignants.map(e => <option key={e.mle_ens} value={e.mle_ens}>{e.nom_ens} {e.prenom_ens || ''}</option>)}
          </select>
        </div>
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.annee} <span style={{ color: 'var(--green)' }}>*</span></label>
          <select className="sms-input" name="code_annee" value={f.code_annee} onChange={ch} required>
            <option value="">{t.common.select}</option>
            {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
          </select>
        </div>
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.date}      name="date_seance" type="date" value={f.date_seance} onChange={ch} required />
        <FormField label={t.fields.heureDebut} name="h_debut" type="time" value={f.h_debut} onChange={ch} required />
        <FormField label={t.fields.heureFin}   name="h_fin"   type="time" value={f.h_fin}   onChange={ch} required />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.salle}    name="salle"                value={f.salle}                onChange={ch} />
        <FormField label={t.fields.heuresEff} name="nb_heures_effectuees" type="number" value={f.nb_heures_effectuees} onChange={ch} />
        <div className="sms-form-group">
          <label className="sms-label">{t.fields.statut}</label>
          <select className="sms-input" name="statut" value={f.statut} onChange={ch}>
            {STATUTS_SEANCE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <FormField label={t.fields.obs} name="observations" type="textarea" value={f.observations} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Seances() {
  const { t, toast } = useApp();
  const [presModal, setPresModal] = useState(null);
  const [classeFilter, setClasseFilter] = useState('');
  const [classes, setClasses] = useState([]);

  const { data, loading, error, reload } = useApi(
    () => seanceService.list({ page_size: 100, ...(classeFilter ? { code_classe: classeFilter } : {}) }),
    [classeFilter]
  );
  const { mutate: create } = useMutation(useCallback(d => seanceService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => seanceService.update(d.code_seance, d), []));
  const { mutate: remove } = useMutation(useCallback(d => seanceService.delete(d.code_seance), []));

  useEffect(() => {
    api.get('/api/classes/?page_size=100').then(r => setClasses(r.data.results ?? r.data)).catch(() => {});
  }, []);

  const COLS = [
    { key: 'mat',    label: t.fields.matiere,   render: r => r.lib_matiere || r.code_matiere },
    { key: 'classe', label: t.fields.classe,     render: r => r.lib_classe  || r.code_classe },
    { key: 'ens',    label: t.fields.enseignant, render: r => r.nom_ens     || r.mle_ens },
    { accessor: 'date_seance', label: t.fields.date },
    { key: 'horaire', label: t.fields.heure,     render: r => `${r.h_debut} – ${r.h_fin}` },
    { key: 'h',       label: t.fields.heuresEff, render: r => `${r.nb_heures_effectuees}h` },
    { key: 'statut',  label: t.fields.statut, searchValue: r => r.statut || '', render: r => (
      <span className={`sms-badge ${STATUT_COLORS[r.statut] || 'badge-secondary'}`}>{r.statut}</span>
    )},
    { key: 'pres', label: '', render: r => (
      <button className="sms-btn sms-btn-outline sms-btn-sm"
        onClick={e => { e.stopPropagation(); setPresModal(r); }}
        title={t.common.presences}>
        <i className="fas fa-calendar-check"></i> {t.common.presences}
      </button>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <CrudTable
        title={t.pages.seances.title}
        subtitle={t.pages.seances.subtitle}
        icon="fas fa-calendar-check"
        columns={COLS}
        data={data || []}
        addLabel={t.pages.seances.addLabel}
        filters={
          <div className="flex gap-2 items-center">
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t.fields.classe} :</label>
            <select className="sms-input" style={{ height: 34, minWidth: 160, fontSize: 12 }}
              value={classeFilter} onChange={e => setClasseFilter(e.target.value)}>
              <option value="">{t.common.allClasses}</option>
              {classes.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
            </select>
            {classeFilter && (
              <button className="sms-btn-icon" onClick={() => setClasseFilter('')}>
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        }
        onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
        onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />
      {presModal && (
        <PresencesModal
          seance={presModal}
          toast={toast}
          onClose={() => { setPresModal(null); reload(); }}
        />
      )}
    </>
  );
}
