/**
 * pages/Personnel.jsx
 * Gestion du personnel administratif et de soutien.
 */
import { useState } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { personnelService } from '../services/endpoints';
import { useEtablissement } from '../hooks/useEtablissement';
import { LoadingState, ErrorState } from '../components/ApiState';
import PhotoProfil from '../components/PhotoProfil';
import { AvatarCircle } from '../utils/avatar';

// ── Couleurs par catégorie ────────────────────────────────────────────────────
const CAT_STYLE = {
  DIRECTION:   { cls: 'c-purple', badgeBg: '#7B2D8B15', badgeBorder: '#7B2D8B50', badgeColor: '#7B2D8B', icon: 'fas fa-crown' },
  ADMIN:       { cls: 'c-blue',   badgeBg: '#2E74B515', badgeBorder: '#2E74B550', badgeColor: '#2E74B5', icon: 'fas fa-briefcase' },
  PEDAGOGIQUE: { cls: 'c-green',  badgeBg: '#1A6B3C15', badgeBorder: '#1A6B3C50', badgeColor: '#1A6B3C', icon: 'fas fa-chalkboard-teacher' },
  SOUTIEN:     { cls: 'c-orange', badgeBg: '#66666615', badgeBorder: '#66666650', badgeColor: '#666',    icon: 'fas fa-tools' },
};

// Mapping poste → catégorie automatique
const POSTE_TO_CAT = {
  DIRECTEUR:'DIRECTION', DIRECTEUR_ADJ:'DIRECTION', PROVISEUR:'DIRECTION',
  PROVISEUR_ADJ:'DIRECTION', DG:'DIRECTION', DGA:'DIRECTION',
  SECRETAIRE:'ADMIN', ECONOME:'ADMIN', DAC:'ADMIN', INTENDANT:'ADMIN',
  SG:'ADMIN', DAF:'ADMIN', DES:'ADMIN', RESP_SCOL:'ADMIN', CHEF_DEP:'ADMIN',
  INFORMATICIEN:'ADMIN', COMPTABLE:'ADMIN', CAISSIER:'ADMIN', AGENT_SCOL:'ADMIN',
  CENSEUR:'PEDAGOGIQUE', CENSEUR_ADJ:'PEDAGOGIQUE', CONSEILLER_ORI:'PEDAGOGIQUE',
  INFIRMIER:'PEDAGOGIQUE', BIBLIOTHECAIRE:'PEDAGOGIQUE', SURVEILLANT:'PEDAGOGIQUE',
  ENTRETIEN:'SOUTIEN', GARDIEN:'SOUTIEN', CHAUFFEUR:'SOUTIEN', AUTRE:'SOUTIEN',
};

// Postes par type d'établissement
const POSTES_PAR_TYPE = {
  PRIMAIRE: [
    { value:'DIRECTEUR', label:"Directeur d'école" },
    { value:'DIRECTEUR_ADJ', label:'Directeur adjoint' },
    { value:'SECRETAIRE', label:"Secrétaire d'école" },
    { value:'ECONOME', label:'Économe / Gestionnaire' },
    { value:'SURVEILLANT', label:'Surveillant général' },
    { value:'ENTRETIEN', label:"Agent d'entretien" },
    { value:'GARDIEN', label:'Gardien / Vigile' },
    { value:'AUTRE', label:'Autre' },
  ],
  SECONDAIRE: [
    { value:'PROVISEUR', label:'Proviseur' },
    { value:'PROVISEUR_ADJ', label:'Proviseur adjoint' },
    { value:'CENSEUR', label:'Censeur' },
    { value:'CENSEUR_ADJ', label:'Censeur adjoint' },
    { value:'SG', label:'Secrétaire Général' },
    { value:'DAC', label:'Directeur des Affaires Comptables' },
    { value:'INTENDANT', label:'Intendant' },
    { value:'CONSEILLER_ORI', label:"Conseiller d'Orientation" },
    { value:'BIBLIOTHECAIRE', label:'Bibliothécaire' },
    { value:'INFIRMIER', label:'Infirmier scolaire' },
    { value:'SURVEILLANT', label:'Surveillant général' },
    { value:'AGENT_SCOL', label:'Agent de scolarité' },
    { value:'ENTRETIEN', label:"Agent d'entretien" },
    { value:'GARDIEN', label:'Gardien / Vigile' },
    { value:'AUTRE', label:'Autre' },
  ],
  SUPERIEUR: [
    { value:'DG', label:'Directeur Général' },
    { value:'DGA', label:'Directeur Général Adjoint' },
    { value:'SG', label:'Secrétaire Général' },
    { value:'DAF', label:'Directeur Administratif et Financier' },
    { value:'DES', label:'Directeur des Études et de la Scolarité' },
    { value:'CHEF_DEP', label:'Chef de Département' },
    { value:'RESP_SCOL', label:'Responsable Scolarité' },
    { value:'BIBLIOTHECAIRE', label:'Bibliothécaire' },
    { value:'INFORMATICIEN', label:'Informaticien / Technicien réseau' },
    { value:'COMPTABLE', label:'Comptable' },
    { value:'AGENT_SCOL', label:'Agent de scolarité' },
    { value:'CAISSIER', label:'Caissier' },
    { value:'ENTRETIEN', label:"Agent d'entretien" },
    { value:'GARDIEN', label:'Gardien / Vigile' },
    { value:'CHAUFFEUR', label:'Chauffeur' },
    { value:'AUTRE', label:'Autre' },
  ],
};
const POSTES_ALL = [
  ...POSTES_PAR_TYPE.PRIMAIRE,
  ...POSTES_PAR_TYPE.SECONDAIRE.filter(p => !POSTES_PAR_TYPE.PRIMAIRE.find(x => x.value === p.value)),
  ...POSTES_PAR_TYPE.SUPERIEUR.filter(p =>
    !POSTES_PAR_TYPE.PRIMAIRE.find(x => x.value === p.value) &&
    !POSTES_PAR_TYPE.SECONDAIRE.find(x => x.value === p.value)
  ),
];

const CONTRATS = [
  { value:'TITULAIRE',   label:'Titulaire' },
  { value:'CONTRACTUEL', label:'Contractuel' },
  { value:'VACATAIRE',   label:'Vacataire' },
  { value:'BENEVOLE',    label:'Bénévole' },
];
const CATEGORIES = [
  { value:'DIRECTION',   label:'Direction' },
  { value:'ADMIN',       label:'Administratif' },
  { value:'PEDAGOGIQUE', label:'Pédagogique' },
  { value:'SOUTIEN',     label:'Soutien' },
];
const GENRES = [
  { value:'M', label:'Masculin' },
  { value:'F', label:'Féminin' },
];

// ── Badge catégorie ───────────────────────────────────────────────────────────
function CatBadge({ cat, label }) {
  const s = CAT_STYLE[cat] || CAT_STYLE.SOUTIEN;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:700,
      background:s.badgeBg, border:`1px solid ${s.badgeBorder}`, color:s.badgeColor,
    }}>
      <i className={s.icon} style={{ fontSize:9 }} />
      {label}
    </span>
  );
}

// ── Formulaire ────────────────────────────────────────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t, toast } = useApp();
  const { typeEtab } = useEtablissement();

  const postes = POSTES_PAR_TYPE[typeEtab] || POSTES_ALL;
  const [photoFile, setPhotoFile] = useState(null);

  const handleDeletePhoto = async () => {
    if (!item?.mle_personnel) { setPhotoFile(null); return; }
    try {
      await api.delete(`/api/personnel/${item.mle_personnel}/photo/`);
      toast.success('Photo supprimée.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const [f, setF] = useState({
    mle_personnel:   item?.mle_personnel   || '',
    nom:             item?.nom             || '',
    prenom:          item?.prenom          || '',
    sexe:            item?.sexe            || '',
    date_naiss:      item?.date_naiss      || '',
    lieu_naiss:      item?.lieu_naiss      || '',
    tel:             item?.tel             || '',
    email:           item?.email           || '',
    adresse:         item?.adresse         || '',
    poste:           item?.poste           || '',
    categorie:       item?.categorie       || '',
    type_contrat:    item?.type_contrat    || '',
    date_embauche:   item?.date_embauche   || '',
    date_fin:        item?.date_fin        || '',
    actif:           item?.actif ?? true,
    matricule_fonct: item?.matricule_fonct || '',
    obs:             item?.obs             || '',
  });

  const ch = e => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setF(prev => {
      const next = { ...prev, [name]: val };
      // Auto-remplir catégorie selon le poste choisi
      if (name === 'poste' && POSTE_TO_CAT[value]) {
        next.categorie = POSTE_TO_CAT[value];
      }
      return next;
    });
  };

  const submit = e => {
    e.preventDefault();
    if (!f.mle_personnel.trim()) { toast.error('Matricule requis'); return; }
    if (!f.nom.trim())           { toast.error('Nom requis'); return; }
    if (!f.poste)                { toast.error('Poste requis'); return; }
    if (!f.type_contrat)         { toast.error('Type de contrat requis'); return; }
    onSave({
      ...f,
      date_naiss:    f.date_naiss    || null,
      date_embauche: f.date_embauche || null,
      date_fin:      f.date_fin      || null,
      _photoFile:    photoFile,
    });
  };

  const isEdit = !!item;
  const sectionTitle = (label) => (
    <div style={{ gridColumn:'1/-1', borderBottom:'1px solid var(--border)',
      paddingBottom:4, marginTop:8, marginBottom:4,
      fontSize:11, fontWeight:700, color:'var(--text-muted)',
      textTransform:'uppercase', letterSpacing:'0.06em' }}>
      {label}
    </div>
  );

  return (
    <form onSubmit={submit}>
      {/* Section 1 — Identité */}
      {sectionTitle('Identité')}
      <div style={{ display:'flex', gap:20, alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ flex:1 }}>
          <div className="sms-form-row">
            <FormField label="Matricule *" name="mle_personnel" value={f.mle_personnel}
              onChange={ch} disabled={isEdit} placeholder="PRV001 / ADM001 / SOU001" />
            <FormField label="Nom *" name="nom" value={f.nom} onChange={ch} placeholder="NOM" />
            <FormField label="Prénom" name="prenom" value={f.prenom} onChange={ch} placeholder="Prénom(s)" />
          </div>
          <div className="sms-form-row">
            <FormField label="Genre" name="sexe" type="select" value={f.sexe} onChange={ch} options={GENRES} />
            <FormField label="Date de naissance" name="date_naiss" type="date" value={f.date_naiss} onChange={ch} />
            <FormField label="Lieu de naissance" name="lieu_naiss" value={f.lieu_naiss} onChange={ch} placeholder="Yaoundé" />
          </div>
        </div>
        <div style={{ paddingTop:4 }}>
          <PhotoProfil
            photoUrl={item?.photo_url || null}
            onChange={setPhotoFile}
            onDelete={handleDeletePhoto}
            label="Photo du personnel"
            size="sm"
          />
        </div>
      </div>

      {/* Section 2 — Poste */}
      <div className="sms-form-row">
        {sectionTitle('Poste & Contrat')}
        <FormField label="Poste *" name="poste" type="select" value={f.poste} onChange={ch}
          options={postes} />
        <FormField label="Catégorie" name="categorie" type="select" value={f.categorie} onChange={ch}
          options={CATEGORIES} />
        <FormField label="Type contrat *" name="type_contrat" type="select" value={f.type_contrat}
          onChange={ch} options={CONTRATS} />
      </div>
      <div className="sms-form-row">
        <FormField label="Date d'embauche" name="date_embauche" type="date" value={f.date_embauche} onChange={ch} />
        <FormField label="Date de fin (si applicable)" name="date_fin" type="date" value={f.date_fin} onChange={ch} />
        <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
          <input type="checkbox" name="actif" id="actif_pers" checked={f.actif} onChange={ch}
            style={{ width:16, height:16, cursor:'pointer' }} />
          <label htmlFor="actif_pers" style={{ fontSize:13, cursor:'pointer', color:'var(--text-secondary)' }}>
            En poste (actif)
          </label>
        </div>
      </div>

      {/* Section 3 — Contact */}
      <div className="sms-form-row">
        {sectionTitle('Contact')}
        <FormField label="Téléphone" name="tel" value={f.tel} onChange={ch} placeholder="+237 6XX XXX XXX" />
        <FormField label="Email" name="email" type="email" value={f.email} onChange={ch} placeholder="prenom.nom@etab.cm" />
        <FormField label="Matricule Fonction Publique" name="matricule_fonct" value={f.matricule_fonct}
          onChange={ch} placeholder="ex: 1234567A" />
      </div>
      <div className="sms-form-row">
        <div style={{ gridColumn:'1/-1' }}>
          <FormField label="Adresse" name="adresse" value={f.adresse} onChange={ch} placeholder="Quartier, arrondissement, ville" />
        </div>
      </div>

      {/* Section 4 — Observations */}
      <div className="sms-form-row">
        {sectionTitle('Observations')}
        <div style={{ gridColumn:'1/-1' }}>
          <label className="sms-label">Observations</label>
          <textarea name="obs" value={f.obs} onChange={ch} rows={2}
            className="sms-input" style={{ width:'100%', resize:'vertical' }}
            placeholder="Remarques optionnelles sur ce membre du personnel…" />
        </div>
      </div>

      <div className="sms-form-actions">
        <button type="button" className="sms-btn sms-btn-outline" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button type="submit" className="sms-btn sms-btn-primary">
          {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildPayload = (data) => {
  const { _photoFile, ...fields } = data;
  if (!_photoFile) return fields;
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
  });
  fd.append('photo', _photoFile);
  return fd;
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function Personnel() {
  const { t, toast } = useApp();
  const [catFilter,   setCatFilter]   = useState('');
  const [actifFilter, setActifFilter] = useState('true');

  const { data, loading, error, reload } = useApi(
    () => personnelService.list({ page_size: 200, ordering: 'categorie,poste,nom' }),
    []
  );

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const all = data ?? [];
  const filtered = all.filter(p => {
    if (catFilter  && p.categorie !== catFilter)  return false;
    if (actifFilter === 'true'  && !p.actif)      return false;
    if (actifFilter === 'false' &&  p.actif)      return false;
    return true;
  });

  const handleAdd = async (formData) => {
    try {
      await personnelService.create(buildPayload(formData));
      toast.success(t.toast.saved);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = async (formData) => {
    try {
      const payload = buildPayload(formData);
      if (payload instanceof FormData) {
        await personnelService.patch(formData.mle_personnel, payload);
      } else {
        await personnelService.update(formData.mle_personnel, payload);
      }
      toast.success(t.toast.saved);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (item) => {
    try {
      await personnelService.delete(item.mle_personnel);
      toast.success(t.toast.deleted);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  // Stats par catégorie (actifs)
  const counts = { DIRECTION:0, ADMIN:0, PEDAGOGIQUE:0, SOUTIEN:0 };
  all.filter(p => p.actif).forEach(p => { if (counts[p.categorie] !== undefined) counts[p.categorie]++; });

  const tp = t.pages?.personnel;

  return (
    <div>
      {/* Cartes stats */}
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', marginBottom:20 }}>
        {Object.entries(CAT_STYLE).map(([cat, s]) => (
          <div key={cat} className={`stat-card ${s.cls}`}>
            <div className={`stat-icon ${s.cls}`}>
              <i className={s.icon}></i>
            </div>
            <div>
              <div className="stat-value">{counts[cat]}</div>
              <div className="stat-label">{CATEGORIES.find(c => c.value === cat)?.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table CRUD */}
      <CrudTable
        title={tp?.title || 'Gestion du personnel'}
        subtitle={tp?.subtitle || 'Employés administratifs et de soutien'}
        icon="fas fa-id-badge"
        data={filtered}
        exportCsvUrl="/api/personnel/export-csv/"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        renderForm={({ item, onClose, onSave }) => (
          <Form item={item} onClose={onClose} onSave={onSave} />
        )}
        filters={
          <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
            <select className="sms-input" style={{ height:36, fontSize:12, minWidth:160 }}
              value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="sms-input" style={{ height:36, fontSize:12, minWidth:130 }}
              value={actifFilter} onChange={e => setActifFilter(e.target.value)}>
              <option value="true">Actifs uniquement</option>
              <option value="">Tous</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        }
        columns={[
          {
            key: 'avatar',
            label: '',
            render: (row) => <AvatarCircle nom={row.nom} prenom={row.prenom} photoUrl={row.photo_url} size={36} />,
          },
          {
            key: 'mle_personnel',
            label: 'Matricule',
            searchValue: (row) => row.mle_personnel || '',
            render: (row) => (
              <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-muted)' }}>
                {row.mle_personnel}
              </span>
            ),
          },
          {
            key: 'nom',
            label: 'Nom complet',
            searchValue: (row) => `${row.nom} ${row.prenom || ''}`.trim(),
            render: (row) => (
              <div>
                <strong>{row.nom}</strong>
                {row.prenom ? ` ${row.prenom}` : ''}
                {row.est_signataire && (
                  <span title="Signataire de documents officiels"
                    style={{ marginLeft:6, color:'var(--warning)', fontSize:10 }}>
                    <i className="fas fa-pen-nib"></i>
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'poste',
            label: 'Poste',
            searchValue: (row) => row.poste_display || row.poste || '',
            render: (row) => (
              <CatBadge cat={row.categorie} label={row.poste_display || row.poste} />
            ),
          },
          {
            key: 'type_contrat',
            label: 'Contrat',
            searchValue: (row) => row.type_contrat || '',
            render: (row) => {
              const v = row.type_contrat;
              const cls = v === 'TITULAIRE'   ? 'badge-success' :
                          v === 'CONTRACTUEL' ? 'badge-info' :
                          v === 'VACATAIRE'   ? 'badge-warning' : 'badge-secondary';
              return <span className={`sms-badge ${cls}`}>{v}</span>;
            },
          },
          {
            key: 'tel',
            label: 'Téléphone',
            searchValue: (row) => row.tel || '',
            render: (row) => row.tel || '—',
          },
          {
            key: 'actif',
            label: 'Statut',
            searchValue: (row) => row.actif ? 'Actif' : 'Inactif',
            render: (row) => (
              <span className={`sms-badge ${row.actif ? 'badge-success' : 'badge-secondary'}`}>
                {row.actif ? 'Actif' : 'Inactif'}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
