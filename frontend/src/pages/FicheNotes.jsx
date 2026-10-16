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
import { APPRECIATION_BADGE, appreciationDepuisNote } from '../utils/notes';
import { getUser } from '../utils/Auth';

// Censeur et administration : valident, rouvrent (miroir de ROLES_GESTION_NOTES, backend).
const ROLES_GESTION_NOTES = ['SUPER_ADMIN', 'ADMIN', 'SCOLARITE', 'CENSEUR'];
const estGestionnaire = () => ROLES_GESTION_NOTES.includes(getUser()?.role);
// Notes modifiables : brouillon, ou fiche soumise pour le censeur.
const ficheModifiable = f => f.statut === 'BROUILLON' || (f.statut === 'SOUMIS' && estGestionnaire());
const sur20 = (note, bareme) => (note === '' || note === null || note === undefined)
  ? null : Math.round(Number(note) * 2000 / Number(bareme || 20)) / 100;


const STATUT_COLORS = {
  BROUILLON: 'badge-secondary',
  SOUMIS:    'badge-warning',
  VALIDE:    'badge-success',
  IMPORTE:   'badge-success',
};
const STATUT_LIBELLES = { BROUILLON: 'Brouillon', SOUMIS: 'Soumise au censeur', VALIDE: 'Validée', IMPORTE: 'Validée' };

// ── Modale saisie des notes ──────────────────────────────────────────────────
// Notes saisies sur le barème de la fiche (ex : /10), converties sur 20 au report. Absent
// non justifié = 0 ; absent justifié = neutralisé dans la moyenne. Enregistrement en une
// seule opération (tout ou rien) via /saisir/.
function SaisieModal({ fiche, onClose, toast }) {
  const { t, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const isPrimaire = typeEtab === 'PRIMAIRE';
  const bareme = Number(fiche.bareme || 20);
  const modifiable = ficheModifiable(fiche);
  const [details, setDetails]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [detRes, inscRes] = await Promise.all([
          api.get(`/api/fiches-notes-detail/?code_fiche=${fiche.code_fiche}&page_size=500`),
          // Inscrits de l'année de la fiche uniquement (pas ceux des années précédentes).
          api.get(`/api/inscriptions/?code_classe=${fiche.code_classe}&code_annee=${fiche.code_annee}&page_size=500`),
        ]);
        const existing = detRes.data.results ?? detRes.data;
        const vus = new Set();
        const inscrits = (inscRes.data.results ?? inscRes.data)
          .map(i => ({ mle: i.mle_etudiant?.mle_etudiant || i.mle_etudiant, nom: `${i.nom_etudiant || ''} ${i.prenom_etudiant || ''}`.trim() || i.mle_etudiant }))
          .filter(i => !vus.has(i.mle) && vus.add(i.mle));
        setDetails(inscrits.map(insc => {
          const ex = existing.find(e => (e.mle_etudiant?.mle_etudiant || e.mle_etudiant) === insc.mle);
          return { mle: insc.mle, nom: insc.nom, note: ex?.note ?? '', absent: ex?.absent ?? false, justifie: ex?.justifie ?? false };
        }));
      } catch { toast.error(t.errors.loading); }
      finally  { setLoading(false); }
    };
    load();
  }, [fiche.code_fiche]);

  const maj = (mle, champs) => setDetails(prev => prev.map(d => d.mle === mle ? { ...d, ...champs } : d));

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheNotesService.saisir(fiche.code_fiche, details.map(d => ({
        mle_etudiant: d.mle, note: d.absent || d.note === '' ? null : Number(d.note),
        absent: d.absent, justifie: d.absent && d.justifie,
      })));
      toast.success(`${details.filter(d => d.absent || d.note !== '').length} ${t.common.saveNotes.toLowerCase()}.`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || t.errors.saving);
    } finally { setSaving(false); }
  };

  const notes20 = details.filter(d => !d.absent && d.note !== '').map(d => sur20(d.note, bareme));
  const moy = notes20.length ? (notes20.reduce((a, b) => a + b, 0) / notes20.length).toFixed(2) : '—';
  const repartition = { A: 0, ECA: 0, NA: 0 };
  notes20.forEach(n => { repartition[appreciationDepuisNote(n)]++; });
  const horsBareme = details.some(d => !d.absent && d.note !== '' && (Number(d.note) < 0 || Number(d.note) > bareme));
  const input = { padding: '4px 6px', background: 'var(--bg-darkest)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' };

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 720 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8,
                padding: '8px 12px', background: 'var(--bg-darkest)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {fiche.lib_classe} · {fiche.date_evaluation} · Notes sur <strong>{bareme}</strong>
                  {bareme !== 20 && ' (converties sur 20 à la validation)'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', gap: 10, color: 'var(--green)' }}>
                  <span>{t.common.classAvg} : <strong>{moy}</strong>/20</span>
                  {isPrimaire && ['A', 'ECA', 'NA'].map(a => (
                    <span key={a} style={{ color: 'var(--text-secondary)' }}>{a} : <strong style={{ color: 'var(--green)' }}>{repartition[a]}</strong></span>
                  ))}
                </span>
              </div>
              {!modifiable && (
                <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--warning)' }}>
                  <i className="fas fa-lock"></i> Fiche {STATUT_LIBELLES[fiche.statut]?.toLowerCase()} : consultation seule.
                  {fiche.statut !== 'BROUILLON' && ' Le censeur peut la rouvrir pour correction.'}
                </div>
              )}
              <div className="sms-table-wrap">
                <table className="sms-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>{labels.studentLabel}</th>
                      <th style={{ textAlign: 'center', width: 90 }}>Note /{bareme}</th>
                      {bareme !== 20 && <th style={{ textAlign: 'center', width: 70 }}>/20</th>}
                      {isPrimaire && <th style={{ textAlign: 'center', width: 80 }}>{t.fields.appreciation}</th>}
                      <th style={{ textAlign: 'center', width: 70 }}>Absent</th>
                      <th style={{ textAlign: 'center', width: 80 }}>Justifiée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map(d => {
                      const n20 = d.absent ? null : sur20(d.note, bareme);
                      const app = n20 !== null ? appreciationDepuisNote(n20) : null;
                      const invalide = !d.absent && d.note !== '' && (Number(d.note) < 0 || Number(d.note) > bareme);
                      return (
                        <tr key={d.mle}>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{d.mle}</span><strong>{d.nom}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="number" min="0" max={bareme} step="0.25" value={d.note}
                              disabled={d.absent || !modifiable}
                              onChange={e => maj(d.mle, { note: e.target.value })}
                              style={{ ...input, width: 70, textAlign: 'center', opacity: d.absent ? 0.4 : 1,
                                borderColor: invalide ? '#ef5350' : 'var(--border)' }} />
                          </td>
                          {bareme !== 20 && <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{n20 ?? '—'}</td>}
                          {isPrimaire && (
                            <td style={{ textAlign: 'center' }}>
                              {app ? <span className={`sms-badge ${APPRECIATION_BADGE[app]}`}>{app}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={d.absent} disabled={!modifiable}
                              onChange={e => maj(d.mle, { absent: e.target.checked, note: e.target.checked ? '' : d.note, justifie: false })}
                              style={{ accentColor: '#c62828', width: 16, height: 16, cursor: 'pointer' }} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={d.justifie} disabled={!d.absent || !modifiable}
                              title="Absence justifiée : neutralisée dans la moyenne (sinon 0)"
                              onChange={e => maj(d.mle, { justifie: e.target.checked })}
                              style={{ accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                Absent non justifié : 0. Absent justifié : l'évaluation est neutralisée dans la moyenne de l'élève.
              </p>
            </>
          )}
        </div>
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.close}</button>
          {modifiable && (
            <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={handleSave} disabled={saving || loading || horsBareme}
              title={horsBareme ? `Une note dépasse le barème (${bareme})` : undefined}>
              {saving ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                : <><i className="fas fa-save"></i> {t.common.saveNotes}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulaire fiche ─────────────────────────────────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t } = useApp();
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
    <form onSubmit={e => {
      e.preventDefault();
      // Année déduite de la période côté serveur ; statut géré par le circuit (soumettre/valider).
      const { code_annee, statut, ...rest } = f;
      onSave(code_annee ? { ...rest, code_annee } : rest);
    }}>
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
          options={periodes.map(p => ({ value: p.code_periode, label: p.lib_parent ? `${p.lib_periode} (${p.lib_parent})` : p.lib_periode }))}
        />
        <FormField label={t.fields.annee} name="code_annee" value={
            periodes.find(p => String(p.code_periode) === String(f.code_periode))?.code_annee || f.code_annee || '—'}
          onChange={() => {}} disabled help="Déduite automatiquement de la période" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.dateCours} name="date_evaluation" type="date" value={f.date_evaluation} onChange={ch} required help="Format : JJ/MM/AAAA" />
        <FormField label={t.fields.bareme} name="bareme" type="number" value={f.bareme} onChange={ch} />
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
  const [enCours,     setEnCours]     = useState(null);
  const gestion = estGestionnaire();
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

  // Circuit : l'enseignant soumet ; le censeur valide (notes reportées aussitôt) ou rouvre.
  const lancer = async (fiche, action, message) => {
    setEnCours(`${action}-${fiche.code_fiche}`);
    try {
      const res = await ficheNotesService[action](fiche.code_fiche);
      toast.success(message(res.data));
      reload();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || t.errors.saving);
    } finally { setEnCours(null); }
  };

  const COLS = useMemo(() => [
    { key: 'mat',     label: t.fields.matiere,   render: r => r.lib_matiere || r.code_matiere },
    { key: 'classe',  label: t.fields.classe,     render: r => r.lib_classe  || r.code_classe },
    { key: 'ens',     label: t.fields.enseignant, render: r => r.nom_ens     || r.mle_ens },
    { key: 'type',    label: t.fields.typeEval,   render: r => r.lib_type_eval || '—' },
    { accessor: 'date_evaluation', label: t.fields.date },
    { accessor: 'bareme', label: t.fields.bareme },
    { key: 'statut',  label: t.fields.statut, searchValue: r => STATUT_LIBELLES[r.statut] || '', render: r => (
      <span className={`sms-badge ${STATUT_COLORS[r.statut] || 'badge-secondary'}`}>{STATUT_LIBELLES[r.statut] || r.statut}</span>
    )},
    { key: 'actions', label: '', render: r => {
      const bouton = (action, libelle, icone, style, message) => (
        <button className="sms-btn sms-btn-sm" style={style}
          onClick={e => { e.stopPropagation(); lancer(r, action, message); }}
          disabled={enCours === `${action}-${r.code_fiche}`}>
          {enCours === `${action}-${r.code_fiche}`
            ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
            : <><i className={icone}></i> {libelle}</>}
        </button>
      );
      return (
        <div className="flex gap-2">
          <button className="sms-btn sms-btn-outline sms-btn-sm"
            onClick={e => { e.stopPropagation(); setSaisieModal(r); }}>
            <i className={ficheModifiable(r) ? 'fas fa-edit' : 'fas fa-eye'}></i> {ficheModifiable(r) ? 'Saisir' : 'Voir'}
          </button>
          {r.statut === 'BROUILLON' && !gestion && bouton('soumettre', 'Soumettre', 'fas fa-paper-plane',
            { background: 'var(--warning)', color: '#fff', border: 'none' }, () => 'Fiche soumise au censeur.')}
          {gestion && ['BROUILLON', 'SOUMIS'].includes(r.statut) && bouton('valider', 'Valider', 'fas fa-check',
            { background: 'var(--green)', color: '#fff', border: 'none' }, d => `Fiche validée : ${d.imported} note(s) reportée(s).`)}
          {gestion && ['SOUMIS', 'VALIDE', 'IMPORTE'].includes(r.statut) && bouton('rouvrir', 'Rouvrir', 'fas fa-unlock',
            { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }, () => 'Fiche rouverte pour correction.')}
        </div>
      );
    }},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, enCours, gestion]);

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
