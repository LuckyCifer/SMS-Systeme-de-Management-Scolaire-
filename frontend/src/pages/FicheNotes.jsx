/**
 * pages/FicheNotes.jsx — Fiches de notes enseignant
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { ficheNotesService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const APPRECIATIONS = ['A', 'ECA', 'NA'];

const STATUT_COLORS = {
  BROUILLON: 'badge-secondary',
  VALIDE:    'badge-success',
  IMPORTE:   'badge-warning',
};

// ── Modale saisie des notes ──────────────────────────────────────────────────
function SaisieModal({ fiche, onClose, toast }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const [details, setDetails]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [detRes, inscRes] = await Promise.all([
          api.get(`/api/fiches-notes-detail/?code_fiche=${fiche.code_fiche}&page_size=200`),
          api.get(`/api/inscriptions/?code_classe=${fiche.code_classe}&page_size=200`),
        ]);
        const existing = detRes.data.results ?? detRes.data;
        const inscrits = (inscRes.data.results ?? inscRes.data).map(i => ({
          mle: i.mle_etudiant?.mle_etudiant || i.mle_etudiant,
          nom: i.nom_etudiant || i.mle_etudiant,
        }));
        const merged = inscrits.map(insc => {
          const ex = existing.find(e => (e.mle_etudiant?.mle_etudiant || e.mle_etudiant) === insc.mle);
          return {
            mle: insc.mle, nom: insc.nom,
            note: ex?.note ?? '', appreciation: ex?.appreciation ?? '',
            absent: ex?.absent ?? false,
          };
        });
        setDetails(merged);
      } catch { toast.error(t.errors.loading); }
      finally  { setLoading(false); }
    };
    load();
  }, [fiche.code_fiche]);

  const setNote   = (mle, note)   => setDetails(prev => prev.map(d => d.mle === mle ? { ...d, note } : d));
  const setAppreciation = (mle, appreciation) => setDetails(prev => prev.map(d => d.mle === mle ? { ...d, appreciation } : d));
  const setAbsent = (mle, absent) => setDetails(prev => prev.map(d => d.mle === mle
    ? { ...d, absent, note: absent ? '' : d.note, appreciation: absent ? '' : d.appreciation }
    : d));

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await api.get(`/api/fiches-notes-detail/?code_fiche=${fiche.code_fiche}&page_size=200`);
      const toDelete = (existing.data.results ?? existing.data);
      await Promise.all(toDelete.map(d => api.delete(`/api/fiches-notes-detail/${d.id}/`)));
      await Promise.all(details.map(d => api.post('/api/fiches-notes-detail/', {
        code_fiche: fiche.code_fiche, mle_etudiant: d.mle,
        note: (!isPrimaire && !d.absent && d.note !== '') ? parseFloat(d.note) : null,
        appreciation: (isPrimaire && !d.absent && d.appreciation) ? d.appreciation : null,
        absent: d.absent,
      })));
      const nbSaisies = isPrimaire
        ? details.filter(d => !d.absent && d.appreciation).length
        : details.filter(d => !d.absent && d.note !== '').length;
      toast.success(`${nbSaisies} ${t.common.saveNotes.toLowerCase()}.`);
      onClose();
    } catch { toast.error(t.errors.saving); }
    finally  { setSaving(false); }
  };

  const moy = () => {
    const notes = details.filter(d => !d.absent && d.note !== '').map(d => parseFloat(d.note));
    if (!notes.length) return '—';
    return (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2);
  };

  // Primaire (évaluation par compétences) : pas de moyenne numérique — répartition A/ECA/NA.
  const repartition = () => {
    const counts = { A: 0, ECA: 0, NA: 0 };
    details.forEach(d => { if (!d.absent && d.appreciation) counts[d.appreciation]++; });
    return counts;
  };

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 620 }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-file-alt" style={{ marginRight: 8, color: 'var(--green)' }}></i>
            {t.common.enterNotes} — {fiche.lib_matiere || fiche.code_matiere}
          </div>
          <button className="sms-btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="sms-modal-body">
          {loading ? <LoadingState /> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                padding: '8px 12px', background: 'var(--bg-darkest)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {fiche.lib_classe} · {fiche.date_evaluation}
                  {!isPrimaire && <> · {t.fields.bareme} : {fiche.bareme}/20</>}
                </span>
                {isPrimaire ? (
                  <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', gap: 10 }}>
                    {APPRECIATIONS.map(a => (
                      <span key={a} style={{ color: 'var(--text-secondary)' }}>
                        {a} : <strong style={{ color: 'var(--green)' }}>{repartition()[a]}</strong>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                    {t.common.classAvg} : <strong>{moy()}</strong>
                  </span>
                )}
              </div>
              <div className="sms-table-wrap">
                <table className="sms-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>{labels.studentLabel}</th>
                      <th style={{ textAlign: 'center', width: 100 }}>
                        {isPrimaire ? t.fields.appreciation : t.fields.note}
                      </th>
                      <th style={{ textAlign: 'center', width: 80 }}>{t.fields.statut}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map(d => (
                      <tr key={d.mle}>
                        <td>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{d.mle}</span>
                          <strong>{d.nom}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isPrimaire ? (
                            <select
                              value={d.appreciation} disabled={d.absent}
                              onChange={e => setAppreciation(d.mle, e.target.value)}
                              style={{ width: 90, textAlign: 'center', padding: '4px 6px',
                                background: 'var(--bg-darkest)', border: '1px solid var(--border)',
                                borderRadius: 6, color: 'var(--text-primary)',
                                opacity: d.absent ? 0.4 : 1 }}
                            >
                              <option value="">—</option>
                              {APPRECIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          ) : (
                            <input
                              type="number" min="0" max="20" step="0.25"
                              value={d.note} disabled={d.absent}
                              onChange={e => setNote(d.mle, e.target.value)}
                              style={{ width: 70, textAlign: 'center', padding: '4px 6px',
                                background: 'var(--bg-darkest)', border: '1px solid var(--border)',
                                borderRadius: 6, color: 'var(--text-primary)',
                                opacity: d.absent ? 0.4 : 1 }}
                            />
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={d.absent}
                            onChange={e => setAbsent(d.mle, e.target.checked)}
                            style={{ accentColor: '#c62828', width: 16, height: 16, cursor: 'pointer' }} />
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
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.close}</button>
          <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
              : <><i className="fas fa-save"></i> {t.common.saveNotes}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire fiche ─────────────────────────────────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const { typeEtab } = useEtablissement();
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const [matieres,    setMatieres]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [enseignants, setEns]         = useState([]);
  const [periodes,    setPeriodes]    = useState([]);
  const [typeEvals,   setTypeEvals]   = useState([]);
  const [examens,     setExamens]     = useState([]);
  const [cours,       setCours]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [codeExamen,  setCodeExamen]  = useState('');

  const [f, setF] = useState({
    code_matiere:    item?.code_matiere    || '',
    code_classe:     item?.code_classe     || '',
    mle_ens:         item?.mle_ens         || '',
    code_periode:    item?.code_periode    || '',
    code_annee:      item?.code_annee      || '',
    code_type_eval:  item?.code_type_eval  || '',
    date_evaluation: item?.date_evaluation || new Date().toISOString().slice(0, 10),
    bareme:          item?.bareme          || 20,
    statut:          item?.statut          || 'BROUILLON',
    observations:    item?.observations    || '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/matieres/?page_size=200'),
      api.get('/api/classes/?page_size=100'),
      api.get('/api/enseignants/?page_size=200'),
      api.get('/api/periodes/?page_size=50'),
      api.get('/api/type-evaluations/?page_size=50'),
      api.get('/api/examens/?page_size=200'),
      api.get('/api/cours/?page_size=500'),
    ]).then(([m, c, e, p, tv, ex, co]) => {
      setMatieres(m.data.results ?? m.data);
      setClasses(c.data.results ?? c.data);
      setEns(e.data.results ?? e.data);
      setPeriodes(p.data.results ?? p.data);
      setTypeEvals(tv.data.results ?? tv.data);
      setExamens(ex.data.results ?? ex.data);
      setCours(co.data.results ?? co.data);
    }).finally(() => setLoading(false));
  }, []);

  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  // Reprend matière/classe/année/période/date d'un examen déjà planifié — évite de ressaisir
  // ces informations que la scolarité ou l'enseignant a déjà renseignées lors de la planification
  // de l'examen. L'enseignant est déduit du Cours correspondant (matière + classe + année) quand
  // il existe. Tout reste modifiable après coup — c'est un pré-remplissage, pas une contrainte.
  const applyExamen = (e) => {
    const codeEx = e.target.value;
    setCodeExamen(codeEx);
    if (!codeEx) return;
    const ex = examens.find(x => String(x.code_examen) === String(codeEx));
    if (!ex) return;
    const matiereId = ex.code_matiere?.code_matiere ?? ex.code_matiere;
    const classeId   = ex.code_classe?.code_classe   ?? ex.code_classe;
    const anneeId    = ex.code_annee?.code_annee     ?? ex.code_annee;
    const periodeId  = ex.code_periode?.code_periode ?? ex.code_periode ?? '';
    const coursMatch = cours.find(c => {
      const cm = c.code_matiere?.code_matiere ?? c.code_matiere;
      const cc = c.code_classe?.code_classe   ?? c.code_classe;
      const ca = c.code_annee?.code_annee     ?? c.code_annee;
      return String(cm) === String(matiereId) && String(cc) === String(classeId) && String(ca) === String(anneeId);
    });
    const ensId = coursMatch ? (coursMatch.mle_ens?.mle_ens ?? coursMatch.mle_ens) : '';
    setF(p => ({
      ...p,
      code_matiere:    matiereId ?? p.code_matiere,
      code_classe:      classeId ?? p.code_classe,
      code_annee:        anneeId ?? p.code_annee,
      code_periode:    periodeId || p.code_periode,
      mle_ens:            ensId || p.mle_ens,
      date_evaluation: ex.date_examen ? ex.date_examen.slice(0, 10) : p.date_evaluation,
    }));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="sms-spinner" style={{ width: 32, height: 32, margin: 'auto' }}></div></div>;

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <SearchableSelect
        label={t.fields.examenPlanifie} name="code_examen" value={codeExamen} onChange={applyExamen}
        placeholder={t.fields.examenPlanifieHint}
        options={examens.map(ex => {
          const lib     = ex.lib_examen || '';
          const classeL = ex.lib_classe || ex.code_classe?.lib_classe || ex.code_classe || '';
          const date    = ex.date_examen ? ex.date_examen.slice(0, 10) : '';
          return { value: ex.code_examen, label: [lib, classeL, date].filter(Boolean).join(' — ') };
        })}
      />
      <div className="sms-form-row">
        <SearchableSelect
          label={t.fields.matiere} name="code_matiere" value={f.code_matiere} onChange={ch} required
          options={matieres.map(m => ({ value: m.code_matiere, label: m.lib_matiere }))}
        />
        <SearchableSelect
          label={t.fields.classe} name="code_classe" value={f.code_classe} onChange={ch} required
          options={classes.map(c => ({ value: c.code_classe, label: c.lib_classe }))}
        />
      </div>
      <div className="sms-form-row">
        <SearchableSelect
          label={t.fields.enseignant} name="mle_ens" value={f.mle_ens} onChange={ch} required
          options={enseignants.map(e => ({ value: e.mle_ens, label: `${e.nom_ens} ${e.prenom_ens || ''}` }))}
        />
        <SearchableSelect
          label={t.fields.typeEval} name="code_type_eval" value={f.code_type_eval} onChange={ch} required
          options={typeEvals.map(tv => ({ value: tv.code_type_eval, label: tv.lib_type_eval }))}
        />
      </div>
      <div className="sms-form-row">
        <SearchableSelect
          label={t.fields.periode} name="code_periode" value={f.code_periode} onChange={ch} required
          options={periodes.map(p => ({ value: p.code_periode, label: p.lib_periode }))}
        />
        <FormField label={t.fields.annee} name="code_annee" value={f.code_annee} onChange={ch} required placeholder="2025-2026" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.dateCours} name="date_evaluation" type="date" value={f.date_evaluation} onChange={ch} required help="Format : JJ/MM/AAAA" />
        {/* Barème /20 sans objet en évaluation par compétences (primaire réformé) */}
        {!isPrimaire && (
          <FormField label={t.fields.bareme} name="bareme" type="number" value={f.bareme} onChange={ch} />
        )}
      </div>
      <FormField label={t.fields.obs} name="observations" type="textarea" value={f.observations} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.pages.ficheNotes.addLabel}</button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

export default function FicheNotes() {
  const { t, toast } = useApp();
  const [saisieModal, setSaisieModal] = useState(null);
  const [importing,  setImporting]   = useState(null);
  const [validating, setValidating]  = useState(null);
  const [page,         setPage]      = useState(1);
  const [serverSearch, setSearch]    = useState('');

  const { data, count, loading, error, reload } = useApi(
    () => ficheNotesService.list({
      page_size: PAGE_SIZE, page,
      ...(serverSearch ? { search: serverSearch } : {}),
    }),
    [page, serverSearch]
  );
  const { mutate: create } = useMutation(useCallback(d => ficheNotesService.create(d), []));
  const { mutate: remove } = useMutation(useCallback(d => ficheNotesService.delete(d.code_fiche), []));

  const handleValider = async (fiche) => {
    setValidating(fiche.code_fiche);
    try {
      await ficheNotesService.valider(fiche.code_fiche);
      toast.success(t.toast.updated);
      reload();
    } catch { toast.error(t.errors.saving); }
    finally  { setValidating(null); }
  };

  const handleImport = async (fiche) => {
    setImporting(fiche.code_fiche);
    try {
      const res = await ficheNotesService.importer(fiche.code_fiche);
      toast.success(`${res.data.imported} ${t.toast.imported}`);
      reload();
    } catch { toast.error(t.errors.saving); }
    finally  { setImporting(null); }
  };

  const COLS = useMemo(() => [
    { key: 'mat',     label: t.fields.matiere,   render: r => r.lib_matiere || r.code_matiere },
    { key: 'classe',  label: t.fields.classe,     render: r => r.lib_classe  || r.code_classe },
    { key: 'ens',     label: t.fields.enseignant, render: r => r.nom_ens     || r.mle_ens },
    { key: 'type',    label: t.fields.typeEval,   render: r => r.lib_type_eval || '—' },
    { accessor: 'date_evaluation', label: t.fields.date },
    { accessor: 'bareme', label: t.fields.bareme },
    { key: 'statut',  label: t.fields.statut, searchValue: r => r.statut || '', render: r => (
      <span className={`sms-badge ${STATUT_COLORS[r.statut] || 'badge-secondary'}`}>{r.statut}</span>
    )},
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-2">
        {/* Saisir les notes — toujours accessible sauf après import */}
        {r.statut !== 'IMPORTE' && (
          <button className="sms-btn sms-btn-outline sms-btn-sm" title={t.common.enterNotes}
            onClick={e => { e.stopPropagation(); setSaisieModal(r); }}>
            <i className="fas fa-edit"></i> {t.common.saveNotes.split(' ')[0]}
          </button>
        )}
        {/* Valider — visible uniquement en statut BROUILLON */}
        {r.statut === 'BROUILLON' && (
          <button className="sms-btn sms-btn-sm"
            style={{ background: 'var(--warning)', color: '#fff', border: 'none' }}
            onClick={e => { e.stopPropagation(); handleValider(r); }}
            disabled={validating === r.code_fiche}
            title={t.common.validate}>
            {validating === r.code_fiche
              ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
              : <><i className="fas fa-check"></i> {t.common.validate}</>}
          </button>
        )}
        {/* Importer vers Évaluations — visible uniquement si VALIDE */}
        {r.statut === 'VALIDE' && (
          <button className="sms-btn sms-btn-primary sms-btn-sm"
            onClick={e => { e.stopPropagation(); handleImport(r); }}
            disabled={importing === r.code_fiche}
            title={t.common.import}>
            {importing === r.code_fiche
              ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
              : <><i className="fas fa-upload"></i> {t.common.import}</>}
          </button>
        )}
      </div>
    )},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, validating, importing]);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <CrudTable
        title={t.pages.ficheNotes.title}
        subtitle={t.pages.ficheNotes.subtitle}
        icon="fas fa-file-alt"
        columns={COLS}
        data={data || []}
        loading={loading}
        totalCount={count}
        serverSide
        serverPage={page}
        serverPages={Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))}
        onServerPage={setPage}
        onServerSearch={setSearch}
        addLabel={t.pages.ficheNotes.addLabel}
        onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />
      {saisieModal && (
        <SaisieModal
          fiche={saisieModal}
          toast={toast}
          onClose={() => { setSaisieModal(null); reload(); }}
        />
      )}
    </>
  );
}
