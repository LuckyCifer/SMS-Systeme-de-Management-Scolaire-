import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { FormField } from '../components/CrudTable';
import { LoadingState, ErrorState } from '../components/ApiState';
import { etablissementService, configBulletinService } from '../services/endpoints';
import { notifyEtabUpdated, connectToEtab } from '../hooks/useEtablissement';

// ── Options statiques ──────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'PRIMAIRE',   label: 'Primaire' },
  { value: 'SECONDAIRE', label: 'Secondaire' },
  { value: 'SUPERIEUR',  label: 'Supérieur' },
];
const STATUT_OPTIONS = [
  { value: 'PUBLIC',        label: 'Public' },
  { value: 'PRIVE_LAIQUE',  label: 'Privé laïque' },
  { value: 'CONFESSIONNEL', label: 'Confessionnel' },
];
const SYSTEME_OPTIONS = [
  { value: 'FRANCOPHONE', label: 'Francophone' },
  { value: 'ANGLOPHONE',  label: 'Anglophone' },
  { value: 'BILINGUE',    label: 'Bilingue' },
];
const REGION_OPTIONS = [
  { value: '',              label: '— Aucune —' },
  { value: 'ADAMAOUA',     label: 'Adamaoua' },
  { value: 'CENTRE',       label: 'Centre' },
  { value: 'EST',          label: 'Est' },
  { value: 'EXTREME_NORD', label: 'Extrême-Nord' },
  { value: 'LITTORAL',     label: 'Littoral' },
  { value: 'NORD',         label: 'Nord' },
  { value: 'NORD_OUEST',   label: 'Nord-Ouest' },
  { value: 'OUEST',        label: 'Ouest' },
  { value: 'SUD',          label: 'Sud' },
  { value: 'SUD_OUEST',    label: 'Sud-Ouest' },
];

const TYPE_COLORS = {
  PRIMAIRE:   '#4caf50',
  SECONDAIRE: '#2196f3',
  SUPERIEUR:  '#9c27b0',
};

const EMPTY_ETAB = {
  code_etab: '', lib_etab: '', sigle: '', type_etab: 'SUPERIEUR',
  statut: 'PRIVE_LAIQUE', systeme: 'FRANCOPHONE',
  region: '', ville: '', adresse: '',
  telephone: '', email: '', site_web: '',
  directeur: '', ministere_tutelle: '',
  numero_autorisation: '', date_creation: '',
  statut_agrement: '', etablissement_tutelle: '',
};

// Cycle de vie d'agrément — voir doc de référence système éducatif (IPES : création →
// ouverture → homologation ; non homologué → tutelle académique d'un établissement agréé).
const STATUT_AGREMENT_OPTIONS = [
  { value: '',          label: '— Non renseigné —' },
  { value: 'DECLARE',   label: 'Déclaré' },
  { value: 'CREE',      label: 'Créé (autorisation de création obtenue)' },
  { value: 'OUVERT',    label: "Ouvert (autorisation d'ouverture obtenue)" },
  { value: 'HOMOLOGUE', label: 'Homologué (habilité à délivrer directement des diplômes nationaux)' },
];

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <div className="sms-card" style={{ marginBottom: 20 }}>
      <div className="sms-card-header">
        <h3 className="sms-card-title" style={{ fontSize: 15, margin: 0 }}>
          <i className={icon} style={{ marginRight: 8 }} />{title}
        </h3>
      </div>
      <div className="sms-card-body">{children}</div>
    </div>
  );
}

// ── Lecture de l'établissement actif depuis le cache localStorage ─────────────
function readActiveEtabCode() {
  try {
    const raw = localStorage.getItem('sms_etab');
    if (!raw) return null;
    return JSON.parse(raw)?.data?.code_etab ?? null;
  } catch { return null; }
}

// ── Liste des établissements ───────────────────────────────────────────────────
function EtabList({ onAdd, onEdit, onReload }) {
  const { t, toast } = useApp();
  const tp = t.pages.parametres;
  const [delTarget,      setDelTarget]      = useState(null);
  const [activeEtabCode, setActiveEtabCode] = useState(() => readActiveEtabCode());

  const { data: etabs, loading, error, reload } = useApi(
    useCallback(() => etablissementService.list({ page_size: 100 }), [])
  );

  useEffect(() => {
    if (onReload) onReload(reload);
  }, [reload, onReload]);

  // Synchronise le badge "Connecté" quand un autre composant change l'étab actif
  useEffect(() => {
    const sync = () => setActiveEtabCode(readActiveEtabCode());
    window.addEventListener('sms:etab-connected', sync);
    window.addEventListener('sms:etab-updated',   sync);
    return () => {
      window.removeEventListener('sms:etab-connected', sync);
      window.removeEventListener('sms:etab-updated',   sync);
    };
  }, []);

  const handleConnect = (row) => {
    connectToEtab(row);
    setActiveEtabCode(row.code_etab);
    toast.success(`Connecté à : ${row.lib_etab}`);
  };

  const { mutate: deleteEtab, loading: deleting } = useMutation(
    useCallback((id) => etablissementService.delete(id), [])
  );

  const handleDelete = async () => {
    try {
      await deleteEtab(delTarget.code_etab);
      toast.success(tp.etabDeleted);
      setDelTarget(null);
      reload();
      notifyEtabUpdated();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const list = etabs || [];

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-school text-green" style={{ marginRight: 10, fontSize: 22 }} />
            {t.pages.parametres.title}
          </h1>
          <p className="page-subtitle">{tp.listTitle} — {list.length} enregistrement{list.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="sms-btn sms-btn-primary" onClick={onAdd}>
          <i className="fas fa-plus" style={{ marginRight: 6 }} />
          {tp.addTitle}
        </button>
      </div>

      {/* Tableau */}
      <div className="sms-card" style={{ overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <i className="fas fa-school" style={{ fontSize: 40, display: 'block', marginBottom: 12, opacity: .2 }} />
            <p style={{ margin: 0, fontSize: 14 }}>{tp.noEtab}</p>
            <button className="sms-btn sms-btn-primary" onClick={onAdd} style={{ marginTop: 16 }}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />{tp.addTitle}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '2px solid var(--border)' }}>
                  {['Code', tp.nomEtab, 'Sigle', tp.typeEtab, tp.statut, tp.ville, ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => {
                  const isActive = row.code_etab === activeEtabCode;
                  return (
                    <tr key={row.code_etab}
                      style={{
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        transition: 'background .15s',
                        background: isActive ? 'rgba(34,197,94,.06)' : '',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(34,197,94,.06)' : ''; }}>

                      {/* Code + badge actif */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700,
                            color: 'var(--green)', background: 'var(--bg-hover)',
                            padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                            {row.code_etab}
                          </span>
                          {isActive && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                              background: 'rgba(34,197,94,.15)', color: '#22c55e',
                              border: '1px solid rgba(34,197,94,.4)',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              <i className="fas fa-circle" style={{ fontSize: 6 }} /> Actif
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{row.lib_etab}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{row.sigle || '—'}</td>

                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                          background: `${TYPE_COLORS[row.type_etab] || '#888'}20`,
                          color: TYPE_COLORS[row.type_etab] || '#888',
                          border: `1px solid ${TYPE_COLORS[row.type_etab] || '#888'}40`,
                        }}>
                          {TYPE_OPTIONS.find(o => o.value === row.type_etab)?.label || row.type_etab}
                        </span>
                      </td>

                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {STATUT_OPTIONS.find(o => o.value === row.statut)?.label || row.statut || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {row.ville || '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>

                          {/* Bouton connexion */}
                          {isActive ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                              background: 'rgba(34,197,94,.12)', color: '#22c55e',
                              border: '1px solid rgba(34,197,94,.35)',
                            }}>
                              <i className="fas fa-check-circle" style={{ fontSize: 11 }} />
                              Connecté
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConnect(row)}
                              title={`Se connecter à ${row.lib_etab}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                background: 'rgba(59,130,246,.10)', color: '#60a5fa',
                                border: '1px solid rgba(59,130,246,.3)',
                                cursor: 'pointer', transition: 'all .15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,.22)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,.6)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,.10)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,.3)'; }}>
                              <i className="fas fa-plug" style={{ fontSize: 11 }} />
                              Se connecter
                            </button>
                          )}

                          <button className="sms-btn-icon" onClick={() => onEdit(row)} title={t.common.edit}>
                            <i className="fas fa-edit" />
                          </button>
                          <button className="sms-btn-icon danger" onClick={() => setDelTarget(row)} title={t.common.delete}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal confirmation suppression */}
      {delTarget && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setDelTarget(null)}>
          <div className="sms-modal" style={{ maxWidth: 420 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color: 'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
                {t.common.confirm}
              </div>
              <button className="sms-btn-icon" onClick={() => setDelTarget(null)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="sms-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                {tp.confirmDelete}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                <strong>{delTarget.code_etab}</strong> — {delTarget.lib_etab}
              </p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelTarget(null)}>
                {t.common.cancel}
              </button>
              <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? <><div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }} />{t.common.loading}</>
                  : <><i className="fas fa-trash" /> {t.common.delete}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire établissement ───────────────────────────────────────────────────
function EtabForm({ item, onCancel, onSaved }) {
  const { t, toast } = useApp();
  const tp = t.pages.parametres;
  const isEdit = Boolean(item);

  const [f, setF] = useState(() => isEdit ? {
    code_etab:           item.code_etab            || '',
    lib_etab:            item.lib_etab             || '',
    sigle:               item.sigle                || '',
    type_etab:           item.type_etab            || 'SUPERIEUR',
    statut:              item.statut               || 'PRIVE_LAIQUE',
    systeme:             item.systeme              || 'FRANCOPHONE',
    region:              item.region               || '',
    ville:               item.ville                || '',
    adresse:             item.adresse              || '',
    telephone:           item.telephone            || '',
    email:               item.email                || '',
    site_web:            item.site_web             || '',
    directeur:           item.directeur            || '',
    ministere_tutelle:   item.ministere_tutelle    || '',
    numero_autorisation: item.numero_autorisation  || '',
    date_creation:       item.date_creation        || '',
    statut_agrement:       item.statut_agrement                             || '',
    etablissement_tutelle: item.etablissement_tutelle?.code_etab || item.etablissement_tutelle || '',
  } : { ...EMPTY_ETAB });

  const [logoFile,    setLogoFile]    = useState(null);
  const [logoPreview, setLogoPreview] = useState(isEdit ? (item.logo || null) : null);
  const [deleteLogo,  setDeleteLogo]  = useState(false);
  const logoInputRef = useRef(null);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setDeleteLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    setDeleteLogo(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const [bulletinConf,  setBulletinConf]  = useState({ afficher_rang: true, afficher_mention: true, id: null });
  const [bulletinDirty, setBulletinDirty] = useState(false);

  const { data: bulletins } = useApi(
    useCallback(() => configBulletinService.list({ page_size: 10 }), [])
  );

  // Établissements homologués pouvant servir de tutelle académique à un IPES non
  // homologué (voir Etablissement.etablissement_tutelle) — exclut l'établissement courant.
  const { data: etabsHomologues } = useApi(
    useCallback(() => etablissementService.list({ type_etab: 'SUPERIEUR', statut_agrement: 'HOMOLOGUE', page_size: 100 }), [])
  );

  useEffect(() => {
    if (!bulletins?.length) return;
    const bc = bulletins.find(b => b.type_etab === f.type_etab) || bulletins[0];
    if (bc) setBulletinConf({ afficher_rang: bc.afficher_rang, afficher_mention: bc.afficher_mention, id: bc.id ?? bc.code_config ?? null });
  }, [bulletins, f.type_etab]);

  const { mutate: createEtab, loading: creating } = useMutation(
    useCallback((d) => etablissementService.create(d), [])
  );
  const { mutate: updateEtab, loading: updating } = useMutation(
    useCallback((d) => etablissementService.patch(item?.code_etab, d), [item?.code_etab])
  );
  const { mutate: patchBulletin, loading: savingBulletin } = useMutation(
    useCallback((d) => {
      if (bulletinConf.id) return configBulletinService.patch(bulletinConf.id, d);
      return configBulletinService.create({ ...d, type_etab: f.type_etab });
    }, [bulletinConf.id, f.type_etab])
  );

  const saving = creating || updating;
  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...f };
      if (!payload.date_creation) delete payload.date_creation;
      payload.statut_agrement = payload.statut_agrement || null;
      payload.etablissement_tutelle = payload.etablissement_tutelle || null;

      let savedCode = item?.code_etab;
      if (isEdit) {
        const { code_etab, ...rest } = payload;
        await updateEtab(rest);
      } else {
        const created = await createEtab(payload);
        savedCode = created?.code_etab;
      }

      // Handle logo upload / removal as a separate multipart PATCH
      if (logoFile && savedCode) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await etablissementService.patch(savedCode, fd);
      } else if (deleteLogo && savedCode) {
        const fd = new FormData();
        fd.append('clear_logo', '1');
        await etablissementService.patch(savedCode, fd);
      }

      notifyEtabUpdated();
      toast.success(tp.etabSaved);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveBulletin = async () => {
    try {
      await patchBulletin({ afficher_rang: bulletinConf.afficher_rang, afficher_mention: bulletinConf.afficher_mention });
      toast.success(tp.bulletinSaved);
      setBulletinDirty(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-school text-green" style={{ marginRight: 10, fontSize: 22 }} />
            {isEdit ? tp.editTitle : tp.addTitle}
          </h1>
          {isEdit && (
            <p className="page-subtitle">
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--green)' }}>
                {item.code_etab}
              </span>
              {' — '}{item.lib_etab}
            </p>
          )}
        </div>
        {/* Boutons Annuler + Enregistrer dans l'en-tête pour une visibilité immédiate */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="sms-btn sms-btn-outline" onClick={onCancel}>
            <i className="fas fa-times" style={{ marginRight: 6 }} />
            {t.common.cancel}
          </button>
          <button type="button" className="sms-btn sms-btn-primary" disabled={saving}
            onClick={handleSubmit}>
            {saving
              ? <><div className="sms-spinner" style={{ width: 14, height: 14, display: 'inline-block', marginRight: 8 }} />{t.common.loading}</>
              : <><i className="fas fa-save" style={{ marginRight: 6 }} />{t.common.save}</>}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Identité */}
        <Section icon="fas fa-id-card" title={tp.identity}>
          {!isEdit && (
            <div className="sms-form-row" style={{ marginBottom: 0 }}>
              <div>
                <label className="sms-label">
                  {tp.codeEtab} <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input className="sms-input" name="code_etab" value={f.code_etab} onChange={ch}
                  required maxLength={10}
                  placeholder="Ex : ETAB001"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                  onInput={e => { e.target.value = e.target.value.toUpperCase(); }} />
              </div>
              <FormField label={`${tp.nomEtab} *`} name="lib_etab" value={f.lib_etab} onChange={ch} required />
            </div>
          )}
          {isEdit && (
            <div className="sms-form-row" style={{ marginBottom: 0 }}>
              <FormField label={`${tp.nomEtab} *`} name="lib_etab" value={f.lib_etab} onChange={ch} required />
              <FormField label={tp.sigle} name="sigle" value={f.sigle} onChange={ch} />
            </div>
          )}
          {!isEdit && (
            <FormField label={tp.sigle} name="sigle" value={f.sigle} onChange={ch} />
          )}
          <div className="sms-form-row">
            <FormField label={tp.typeEtab} name="type_etab" type="select" value={f.type_etab} onChange={ch} options={TYPE_OPTIONS} />
            <FormField label={tp.statut}   name="statut"    type="select" value={f.statut}    onChange={ch} options={STATUT_OPTIONS} />
            <FormField label={tp.systeme}  name="systeme"   type="select" value={f.systeme}   onChange={ch} options={SYSTEME_OPTIONS} />
          </div>

          {/* Logo */}
          <div className="sms-form-group" style={{ marginTop: 6 }}>
            <label className="sms-label">Logo de l'établissement</label>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
              {logoPreview ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={logoPreview} alt="Logo"
                    style={{ height: 80, maxWidth: 160, objectFit: 'contain', borderRadius: 8,
                      border: '2px solid var(--border)', background: '#fff', padding: 4, display: 'block' }} />
                  <button type="button" onClick={handleRemoveLogo}
                    style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)',
                      color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, padding: 0 }}
                    title="Supprimer le logo">
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 8, border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-hover)', color: 'var(--text-muted)', gap: 4, flexShrink: 0 }}>
                  <i className="fas fa-image" style={{ fontSize: 22 }} />
                  <span style={{ fontSize: 10 }}>Aucun logo</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                <input ref={logoInputRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handleLogoChange} />
                <button type="button" className="sms-btn sms-btn-outline sms-btn-sm"
                  onClick={() => logoInputRef.current?.click()}>
                  <i className="fas fa-upload" style={{ marginRight: 6 }} />
                  {logoPreview ? 'Modifier le logo' : 'Choisir un logo'}
                </button>
                {logoFile && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <i className="fas fa-paperclip" style={{ marginRight: 4 }} />
                    {logoFile.name}
                  </span>
                )}
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  PNG, JPG ou SVG — recommandé : 200×200 px
                </small>
              </div>
            </div>
          </div>
        </Section>

        {/* Localisation */}
        <Section icon="fas fa-map-marker-alt" title={tp.location}>
          <div className="sms-form-row">
            <FormField label={tp.region} name="region" type="select" value={f.region} onChange={ch} options={REGION_OPTIONS} />
            <FormField label={tp.ville}  name="ville"  value={f.ville}  onChange={ch} />
          </div>
          <FormField label={tp.adresse} name="adresse" value={f.adresse} onChange={ch} />
        </Section>

        {/* Contact */}
        <Section icon="fas fa-phone-alt" title={tp.contact}>
          <div className="sms-form-row">
            <FormField label={tp.telephone} name="telephone" value={f.telephone} onChange={ch}
              placeholder="Ex : +237 652 62 25 32 / +237 674 66 35 26 / +237 699 00 00 00" />
            <FormField label={tp.email}     name="email"     type="email" value={f.email} onChange={ch} />
          </div>
          <FormField label={tp.siteWeb} name="site_web" value={f.site_web} onChange={ch} />
        </Section>

        {/* Direction */}
        <Section icon="fas fa-user-tie" title={tp.direction}>
          <div className="sms-form-row">
            <FormField label={tp.directeur} name="directeur"         value={f.directeur}         onChange={ch} />
            <FormField label={tp.ministere} name="ministere_tutelle" value={f.ministere_tutelle} onChange={ch} />
          </div>
          <div className="sms-form-row">
            <FormField label={tp.numAutorisation} name="numero_autorisation" value={f.numero_autorisation} onChange={ch} />
            <FormField label={tp.dateCreation}    name="date_creation"       type="date" value={f.date_creation} onChange={ch} help="Format : JJ/MM/AAAA" />
          </div>
        </Section>

        {/* Agrément — pertinent surtout pour un IPES (institut privé d'enseignement
            supérieur) : cycle création → ouverture → homologation, et tutelle académique
            d'un établissement homologué tant que celui-ci ne l'est pas lui-même. */}
        {f.type_etab === 'SUPERIEUR' && f.statut !== 'PUBLIC' && (
          <Section icon="fas fa-stamp" title="Agrément (IPES)">
            <div className="sms-form-row">
              <FormField label="Statut d'agrément" name="statut_agrement" type="select"
                value={f.statut_agrement} onChange={ch} options={STATUT_AGREMENT_OPTIONS} />
              {f.statut_agrement !== 'HOMOLOGUE' && (
                <FormField label="Établissement de tutelle académique" name="etablissement_tutelle" type="select"
                  value={f.etablissement_tutelle} onChange={ch}
                  options={[
                    { value: '', label: '— Aucune —' },
                    ...(etabsHomologues || [])
                      .filter(e => e.code_etab !== f.code_etab)
                      .map(e => ({ value: e.code_etab, label: e.lib_etab })),
                  ]}
                  help="Requis tant que l'établissement n'est pas lui-même homologué : garantit la qualité de l'enseignement et co-signe les diplômes délivrés."
                />
              )}
            </div>
          </Section>
        )}

        {/* Boutons Annuler + Enregistrer en bas du formulaire */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
          <button type="button" className="sms-btn sms-btn-outline" onClick={onCancel}>
            <i className="fas fa-times" style={{ marginRight: 6 }} />
            {t.common.cancel}
          </button>
          <button type="submit" className="sms-btn sms-btn-primary" disabled={saving}>
            {saving
              ? <><div className="sms-spinner" style={{ width: 14, height: 14, display: 'inline-block', marginRight: 8 }} />{t.common.loading}</>
              : <><i className="fas fa-save" style={{ marginRight: 6 }} />{t.common.save}</>}
          </button>
        </div>
      </form>

      {/* Configuration bulletin — uniquement en mode édition */}
      {isEdit && (
        <Section icon="fas fa-file-alt" title={tp.bulletin}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={bulletinConf.afficher_rang}
                onChange={e => { setBulletinConf(p => ({ ...p, afficher_rang: e.target.checked })); setBulletinDirty(true); }} />
              <span>{tp.afficherRang}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={bulletinConf.afficher_mention}
                onChange={e => { setBulletinConf(p => ({ ...p, afficher_mention: e.target.checked })); setBulletinDirty(true); }} />
              <span>{tp.afficherMention}</span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" className="sms-btn sms-btn-outline sms-btn-sm"
                onClick={() => setBulletinDirty(false)} disabled={!bulletinDirty}>
                <i className="fas fa-times" style={{ marginRight: 5 }} />{t.common.cancel}
              </button>
              <button type="button" className="sms-btn sms-btn-primary sms-btn-sm"
                onClick={handleSaveBulletin} disabled={savingBulletin || !bulletinDirty}>
                <i className="fas fa-save" style={{ marginRight: 5 }} />
                {savingBulletin ? t.common.loading : t.common.save}
              </button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function Parametres() {
  const [mode,     setMode]     = useState('list'); // 'list' | 'form'
  const [editItem, setEditItem] = useState(null);   // null = nouveau, objet = édition

  const handleAdd  = ()     => { setEditItem(null); setMode('form'); };
  const handleEdit = (item) => { setEditItem(item); setMode('form'); };
  const handleBack = ()     => { setEditItem(null); setMode('list'); };

  if (mode === 'form') {
    return (
      <EtabForm
        item={editItem}
        onCancel={handleBack}
        onSaved={handleBack}
      />
    );
  }

  return (
    <EtabList
      onAdd={handleAdd}
      onEdit={handleEdit}
    />
  );
}
