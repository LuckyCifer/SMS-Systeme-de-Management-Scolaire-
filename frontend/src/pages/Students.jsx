/**
 * pages/Students.jsx
 * Correction : filtre spécialités par filière (code_dep peut être objet ou string)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { useApi } from '../hooks/useApi';
import { etudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { generateCertificatScolarite } from '../services/pdfService';
import { useFormValidation } from '../hooks/useFormValidation';
import { PH, DATE_HELP } from '../utils/placeholders';
import PhotoProfil from '../components/PhotoProfil';
import { AvatarCircle } from '../utils/avatar';

const buildPayload = (data) => {
  const { _photoFile, ...fields } = data;
  // DateField rejects empty strings — convert to null
  if (fields.date_naiss === '') fields.date_naiss = null;
  if (!_photoFile) return fields;
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });
  fd.append('photo', _photoFile);
  return fd;
};

// ── Modal absences ────────────────────────────────────────────────────────────
function AbsencesModal({ etudiant, onClose }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/etudiants/${etudiant.mle_etudiant}/absences-stats/`)
      .then(r => setStats(r.data))
      .catch(() => setStats({ total_heures: 0, nb_absences: 0, par_matiere: [] }))
      .finally(() => setLoading(false));
  }, [etudiant.mle_etudiant]);

  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{ maxWidth: 520 }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-user-clock" style={{ marginRight: 8, color: 'var(--warning)' }} />
            Absences — {etudiant.nom} {etudiant.prenom || ''}
          </div>
          <button className="sms-btn-icon" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="sms-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div className="sms-spinner" style={{ width: 28, height: 28, margin: 'auto' }} />
            </div>
          ) : (
            <>
              {/* Résumé */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, background: 'rgba(255,167,38,.1)', border: '1px solid rgba(255,167,38,.3)',
                  borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>
                    {stats.total_heures}h
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Total heures d'absence
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)',
                  borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>
                    {stats.nb_absences}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Séances manquées
                  </div>
                </div>
              </div>

              {/* Détail par matière */}
              {stats.par_matiere.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    Détail par matière
                  </div>
                  {stats.par_matiere.map((m, i) => {
                    const pct = stats.total_heures > 0
                      ? Math.round((m.heures / stats.total_heures) * 100) : 0;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {m.matiere}
                          </span>
                          <span style={{ color: 'var(--warning)', fontWeight: 700 }}>
                            {m.heures}h ({pct}%)
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'var(--warning)',
                            height: '100%', borderRadius: 4, transition: 'width .4s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: 28, marginBottom: 8,
                    display: 'block', color: 'var(--green)' }} />
                  Aucune absence enregistrée
                </div>
              )}
            </>
          )}
        </div>
        <div className="sms-modal-footer">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>
            <i className="fas fa-times" style={{ marginRight: 5 }} />Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Utilitaire : extrait la valeur string d'un FK (objet ou string) ──────────
const fkVal = (v, key) => {
  if (!v) return '';
  const raw = typeof v === 'object' ? (v[key] ?? '') : v;
  return raw.toString().trim();
};

// ── Formulaire ───────────────────────────────────────────────────────────────
function Form({ item, onClose, onSave, labels }) {
  const { t, toast } = useApp();
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);
  const [loadingForm,  setLoadingForm]  = useState(true);
  const [photoFile,    setPhotoFile]    = useState(null);

  const { errors, validateAll, onBlur: vBlur, onChange: vChange, reset: vReset } = useFormValidation({
    nom:   { required: true, minLen: 2 },
    email: { email: true },
    tel:   { tel: true },
  });

  const [f, setF] = useState({
    mle_etudiant: item?.mle_etudiant || '',
    nom:          item?.nom          || '',
    prenom:       item?.prenom       || '',
    sexe:         item?.sexe         || '',
    numero_cni:   item?.numero_cni   || '',
    date_naiss:   item?.date_naiss?.slice(0, 10) || '',
    lieu:         item?.lieu         || '',
    region_or:    item?.region_or    || '',
    // code_dep peut arriver comme objet {code_dep, lib_dep} ou string
    code_dep:     fkVal(item?.code_dep, 'code_dep') || '',
    code_sp:      fkVal(item?.code_sp,  'code_sp')  || '',
    nom_pere:     item?.nom_pere     || '',
    nom_mere:     item?.nom_mere     || '',
    tel:          item?.tel          || '',
    email:        item?.email        || '',
    domicile:     item?.domicile     || '',
    nom_tuteur:   item?.nom_tuteur   || '',
    adresse:      item?.adresse      || '',
  });

  // Charge les listes au montage
  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
    ]).then(([depRes, spRes]) => {
      setDepartements(depRes.data.results ?? depRes.data);
      setSpecialites(spRes.data.results  ?? spRes.data);
    }).catch(() => {
      toast.error(t.errors.loading);
    }).finally(() => {
      setLoadingForm(false);
    });
  }, []);

  // Filtre les spécialités quand la filière change
  useEffect(() => {
    if (!f.code_dep) {
      setFilteredSp(specialites);
      return;
    }
    // code_dep dans la spécialité peut être un objet ou une string
    const filtered = specialites.filter(s => {
      const spDep = fkVal(s.code_dep, 'code_dep');
      return spDep === f.code_dep;
    });
    setFilteredSp(filtered);
    // Ne resetter que quand la liste est chargée (évite le reset au montage)
    if (f.code_sp && specialites.length > 0) {
      const stillValid = filtered.some(s => s.code_sp === f.code_sp);
      if (!stillValid) {
        setF(prev => ({ ...prev, code_sp: '' }));
      }
    }
  }, [f.code_dep, specialites]);

  const ch = e => {
    const { name, value } = e.target;
    setF(prev => ({ ...prev, [name]: value }));
    vChange(name, value);
  };
  const bl = e => vBlur(e.target.name, e.target.value);

  if (loadingForm) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="sms-spinner" style={{ width: 32, height: 32 }}></div>
    </div>
  );

  const handleDeletePhoto = async () => {
    setPhotoFile(null);
    if (item?.mle_etudiant) {
      try { await api.delete(`/api/etudiants/${item.mle_etudiant}/photo/`); }
      catch { /* ignore */ }
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (!validateAll(f)) return; onSave({ ...f, _photoFile: photoFile }); }}>
      {/* Photo de profil — centré en haut du formulaire */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <PhotoProfil
          photoUrl={item?.photo_url || null}
          onChange={setPhotoFile}
          onDelete={handleDeletePhoto}
          label="Photo de profil"
        />
      </div>
      {/* Filière + Spécialité */}
      <div className="sms-form-row">
        <SearchableSelect
          label={labels?.departementLabel || t.fields.departement} name="code_dep" value={f.code_dep} onChange={ch}
          options={departements.map(d => ({ value: d.code_dep, label: d.lib_dep }))}
        />
        <SearchableSelect
          label={labels?.specialiteLabel || t.fields.specialite} name="code_sp" value={f.code_sp} onChange={ch}
          options={filteredSp.map(s => ({ value: s.code_sp, label: s.lib_sp }))}
          disabled={!f.code_dep}
        />
      </div>

      {/* Infos principales */}
      <div className="sms-form-row">
        <FormField label={t.fields.matricule} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} placeholder="Laissez vide pour auto-générer" help={item ? undefined : 'Optionnel — généré automatiquement si vide'} />
        <FormField label={t.fields.nom}       name="nom"          value={f.nom}          onChange={ch} onBlur={bl} required placeholder={PH.nom} error={errors.nom} />
        <FormField label={t.fields.prenom}    name="prenom"       value={f.prenom}       onChange={ch} placeholder={PH.prenom} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.genre} name="sexe" type="select" value={f.sexe} onChange={ch}
          options={[{ value:'M', label:t.fields.masculin }, { value:'F', label:t.fields.feminin }]} />
        <FormField label={t.fields.numeroCni} name="numero_cni" value={f.numero_cni} onChange={ch} placeholder={PH.numeroCni} />
        <FormField label={t.fields.dateNaiss} name="date_naiss" type="date" value={f.date_naiss} onChange={ch} help={DATE_HELP.date} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.lieu}   name="lieu"      value={f.lieu}      onChange={ch} placeholder={PH.lieu} />
        <FormField label={t.fields.region} name="region_or" value={f.region_or} onChange={ch} placeholder={PH.region} help="Région d'origine de l'étudiant (lieu de naissance)" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.tel}      name="tel"      type="tel"   value={f.tel}      onChange={ch} onBlur={bl} placeholder={PH.tel} error={errors.tel} />
        <FormField label={t.fields.email}    name="email"    type="email" value={f.email}    onChange={ch} onBlur={bl} placeholder={PH.email} error={errors.email} />
        <FormField label={t.fields.domicile} name="domicile" value={f.domicile} onChange={ch} placeholder={PH.domicile} help="Adresse du logement actuel de l'étudiant (différente de l'adresse d'origine)" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.pere}   name="nom_pere"   value={f.nom_pere}   onChange={ch} />
        <FormField label={t.fields.mere}   name="nom_mere"   value={f.nom_mere}   onChange={ch} />
        <FormField label={t.fields.tuteur} name="nom_tuteur" value={f.nom_tuteur} onChange={ch} required />
      </div>
      <FormField label={t.fields.adresse} name="adresse" type="textarea" value={f.adresse} onChange={ch} />

      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Students() {
  const { t, toast, lang } = useApp();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [depFilter,      setDepFilter]      = useState('');
  const [spFilter,       setSpFilter]       = useState('');
  const [niveauFilter,   setNiveauFilter]   = useState('');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [genreFilter,    setGenreFilter]    = useState('');
  const [absencesTarget,  setAbsencesTarget]  = useState(null);
  const [certLoading,     setCertLoading]     = useState(null); // mle en cours
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);
  const [niveaux,      setNiveaux]      = useState([]);

  const [page, setPage] = useState(1);

  // Reset page when categorical filters change
  useEffect(() => { setPage(1); }, [depFilter, spFilter, niveauFilter, genreFilter]);

  const { data, count, loading, error, reload } = useApi(
    () => etudiantService.list({
      page_size: 25, page,
      ...(depFilter    ? { code_dep:    depFilter    } : {}),
      ...(spFilter     ? { code_sp:     spFilter     } : {}),
      ...(niveauFilter ? { code_niveau: niveauFilter } : {}),
      ...(searchQuery  ? { search:      searchQuery  } : {}),
      ...(genreFilter  ? { sexe:        genreFilter  } : {}),
    }),
    [page, depFilter, spFilter, niveauFilter, searchQuery, genreFilter]
  );

  const handleAdd    = async (d) => { await etudiantService.create(buildPayload(d)); };
  const handleEdit   = async (d) => {
    const payload = buildPayload(d);
    if (payload instanceof FormData) {
      await etudiantService.patch(d.mle_etudiant, payload);
    } else {
      await etudiantService.update(d.mle_etudiant, payload);
    }
  };
  const handleRemove = async (d) => { await etudiantService.delete(d.mle_etudiant); };

  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
      api.get('/api/niveaux/?page_size=10'),
    ]).then(([dR, sR, nR]) => {
      setDepartements(dR.data.results ?? dR.data);
      const sps = sR.data.results ?? sR.data;
      setSpecialites(sps);
      setFilteredSp(sps);
      setNiveaux(nR.data.results ?? nR.data);
    }).catch(() => {});
  }, [typeEtab]);

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

  const COLS = useMemo(() => [
    { key: 'avatar', label: '', render: r => (
      <AvatarCircle nom={r.nom} prenom={r.prenom} photoUrl={r.photo_url} size={36} />
    )},
    { accessor: 'mle_etudiant', label: t.fields.matricule },
    { accessor: 'nom',          label: t.fields.nom,      bold: true },
    { accessor: 'prenom',       label: t.fields.prenom },
    { key: 'sexe', label: t.fields.genre, searchValue: r => r.sexe === 'M' ? t.fields.masculin : r.sexe === 'F' ? t.fields.feminin : '', render: r => r.sexe
        ? <span className={`sms-badge ${r.sexe === 'M' ? 'badge-info' : 'badge-warning'}`} style={{ gap: 5 }}>
            <i className={`fas fa-${r.sexe === 'M' ? 'mars' : 'venus'}`} style={{ fontSize: 10 }}></i>
            {r.sexe}
          </span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { accessor: 'numero_cni',   label: t.fields.numeroCni, render: r => r.numero_cni || <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'date',  label: t.fields.dateNaiss, render: r => r.date_naiss?.slice(0, 10) || '—' },
    { accessor: 'lieu',  label: t.fields.lieu, render: r => r.lieu || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor: 'region_or', label: t.fields.region, render: r => r.region_or || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor: 'nationalite', label: t.fields.nationalite, render: r => r.nationalite || <span style={{ color:'var(--text-muted)' }}>—</span> },
    { accessor: 'tel',          label: t.fields.tel },
    { key: 'dep',   label: labels.departementLabel, searchValue: r => r.lib_dep || '', render: r => r.lib_dep
        ? <span className="sms-badge badge-info" style={{ fontSize: 10 }}>{r.lib_dep}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { key: 'sp',    label: labels.specialiteLabel, render: r => r.lib_sp || '—' },
    { key: 'niv',   label: t.fields.niveau, searchValue: r => r.lib_niveau || '', render: r => r.lib_niveau
        ? <span className="sms-badge badge-secondary" style={{ fontSize: 10 }}>{r.lib_niveau}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { key: 'abs', label: 'Absences', render: r => (
      <button
        onClick={e => { e.stopPropagation(); setAbsencesTarget(r); }}
        title="Voir les heures d'absence"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,167,38,.1)', color: 'var(--warning)',
          border: '1px solid rgba(255,167,38,.3)', cursor: 'pointer',
        }}>
        <i className="fas fa-user-clock" style={{ fontSize: 10 }} />
        Absences
      </button>
    )},
    { key: 'cert', label: 'Certificat', render: r => (
      <button
        onClick={async e => {
          e.stopPropagation();
          setCertLoading(r.mle_etudiant);
          try {
            // Récupère la dernière inscription de l'étudiant
            const res = await api.get(`/api/etudiants/${r.mle_etudiant}/inscriptions/?page_size=1`);
            const inscList = res.data.results ?? res.data ?? [];
            const insc = inscList[inscList.length - 1] || {};
            const etabRaw = localStorage.getItem('sms_etab');
            const etab = etabRaw ? JSON.parse(etabRaw)?.data : null;
            const userRaw = localStorage.getItem('sms_user');
            const userObj = userRaw ? JSON.parse(userRaw) : null;
            const { blob, filename } = await generateCertificatScolarite(r, insc, etab, userObj);
            showPreview(blob, filename);
            toast.success('Certificat généré.');
          } catch { toast.error('Erreur lors de la génération.'); }
          finally { setCertLoading(null); }
        }}
        title="Générer le certificat de scolarité"
        disabled={certLoading === r.mle_etudiant}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, padding: '3px 8px', borderRadius: 6,
          background: 'rgba(66,165,245,.1)', color: '#42a5f5',
          border: '1px solid rgba(66,165,245,.3)', cursor: 'pointer',
        }}>
        {certLoading === r.mle_etudiant
          ? <div className="sms-spinner" style={{ width: 10, height: 10 }} />
          : <><i className="fas fa-file-certificate" style={{ fontSize: 10 }} />Certificat</>
        }
      </button>
    )},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, certLoading, labels]);

  const handleBulkDelete = async (ids) => {
    await api.post('/api/etudiants/bulk-delete/', { ids });
    reload();
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
    {absencesTarget && (
      <AbsencesModal etudiant={absencesTarget} onClose={() => setAbsencesTarget(null)} />
    )}
    <CrudTable
      title={labels.studentsPageTitle}
      subtitle={labels.studentsPageSubtitle}
      icon="fas fa-user-graduate"
      columns={COLS}
      data={data || []}
      loading={loading}
      totalCount={count}
      serverSide
      serverPage={page}
      serverPages={Math.max(1, Math.ceil((count || 0) / 25))}
      onServerPage={setPage}
      onServerSearch={setSearchQuery}
      addLabel={t.common.add}
      exportCsvUrl={`/api/etudiants/export-xlsx/${[depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`, niveauFilter && `code_niveau=${niveauFilter}`].filter(Boolean).join('&') ? '?' + [depFilter && `code_dep=${depFilter}`, spFilter && `code_sp=${spFilter}`, niveauFilter && `code_niveau=${niveauFilter}`].filter(Boolean).join('&') : ''}`}
      onBulkDelete={handleBulkDelete}
      filters={
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Filtre genre */}
          <select className="sms-input" style={{ height: 34, minWidth: 120, fontSize: 12 }}
            value={genreFilter} onChange={e => { setGenreFilter(e.target.value); setPage(1); }}>
            <option value="">{t.common.allGenres || 'Tous'}</option>
            <option value="M">{t.fields.masculin}</option>
            <option value="F">{t.fields.feminin}</option>
          </select>

          {/* Filtres par catégorie */}
          <select className="sms-input" style={{ height: 34, minWidth: 160, fontSize: 12 }}
            value={depFilter} onChange={e => { setDepFilter(e.target.value); setPage(1); }}>
            <option value="">{labels.allDepsLabel}</option>
            {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
          </select>
          <select className="sms-input" style={{ height: 34, minWidth: 160, fontSize: 12 }}
            value={spFilter} onChange={e => { setSpFilter(e.target.value); setPage(1); }} disabled={!depFilter}>
            <option value="">{t.common.allSp}</option>
            {filteredSp.map(s => <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>)}
          </select>
          <select className="sms-input" style={{ height: 34, minWidth: 140, fontSize: 12 }}
            value={niveauFilter} onChange={e => { setNiveauFilter(e.target.value); setPage(1); }}>
            <option value="">{t.common.allNiveaux}</option>
            {niveaux.map(n => <option key={n.code_niveau} value={n.code_niveau}>{n.lib_niveau}</option>)}
          </select>
          {(depFilter || spFilter || niveauFilter || searchQuery || genreFilter) && (
            <button className="sms-btn-icon"
              onClick={() => { setDepFilter(''); setSpFilter(''); setNiveauFilter(''); setSearchQuery(''); setGenreFilter(''); setPage(1); }}
              title={t.common.reset}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      }
      onAdd={async d => { try { await handleAdd(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      onEdit={async d => { try { await handleEdit(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      onDelete={async d => { try { await handleRemove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message || t.toast.error); } }}
      renderForm={p => <Form {...p} labels={labels} />}
    />
    </>
  );
}
