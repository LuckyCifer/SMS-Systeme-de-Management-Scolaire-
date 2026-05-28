import { useState, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { FormField } from '../components/CrudTable';
import { LoadingState, ErrorState } from '../components/ApiState';
import { etablissementService, configBulletinService } from '../services/endpoints';
import { notifyEtabUpdated } from '../hooks/useEtablissement';

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
  { value: '',             label: '— Aucune —' },
  { value: 'ADAMAOUA',    label: 'Adamaoua' },
  { value: 'CENTRE',      label: 'Centre' },
  { value: 'EST',         label: 'Est' },
  { value: 'EXTREME_NORD', label: 'Extrême-Nord' },
  { value: 'LITTORAL',    label: 'Littoral' },
  { value: 'NORD',        label: 'Nord' },
  { value: 'NORD_OUEST',  label: 'Nord-Ouest' },
  { value: 'OUEST',       label: 'Ouest' },
  { value: 'SUD',         label: 'Sud' },
  { value: 'SUD_OUEST',   label: 'Sud-Ouest' },
];

const EMPTY_ETAB = {
  lib_etab: '', sigle: '', type_etab: 'SUPERIEUR',
  statut: 'PRIVE_LAIQUE', systeme: 'FRANCOPHONE',
  region: '', ville: '', adresse: '',
  telephone: '', email: '', site_web: '',
  directeur: '', ministere_tutelle: '',
  numero_autorisation: '', date_creation: '',
};

function Section({ icon, title, children }) {
  return (
    <div className="sms-card" style={{ marginBottom: 20 }}>
      <div className="sms-card-header">
        <h3 className="sms-card-title" style={{ fontSize: 15, margin: 0 }}>
          <i className={icon} style={{ marginRight: 8 }}></i>{title}
        </h3>
      </div>
      <div className="sms-card-body">{children}</div>
    </div>
  );
}

export default function Parametres() {
  const { t, toast } = useApp();
  const tp = t.pages.parametres;

  const [f,           setF]           = useState(EMPTY_ETAB);
  const [bulletinConf, setBulletinConf] = useState({ afficher_rang: true, afficher_mention: true, id: null });
  const [bulletinDirty, setBulletinDirty] = useState(false);

  const { data: etab, loading, error, reload } = useApi(
    useCallback(() => etablissementService.current(), [])
  );

  const { data: bulletins } = useApi(
    useCallback(() => configBulletinService.list({ page_size: 10 }), [])
  );

  useEffect(() => {
    if (!etab) return;
    setF({
      lib_etab:           etab.lib_etab            || '',
      sigle:              etab.sigle               || '',
      type_etab:          etab.type_etab           || 'SUPERIEUR',
      statut:             etab.statut              || 'PRIVE_LAIQUE',
      systeme:            etab.systeme             || 'FRANCOPHONE',
      region:             etab.region              || '',
      ville:              etab.ville               || '',
      adresse:            etab.adresse             || '',
      telephone:          etab.telephone           || '',
      email:              etab.email               || '',
      site_web:           etab.site_web            || '',
      directeur:          etab.directeur           || '',
      ministere_tutelle:  etab.ministere_tutelle   || '',
      numero_autorisation:etab.numero_autorisation || '',
      date_creation:      etab.date_creation       || '',
    });
  }, [etab]);

  useEffect(() => {
    if (!bulletins?.length) return;
    const bc = bulletins.find(b => b.type_etab === (etab?.type_etab || 'SUPERIEUR')) || bulletins[0];
    if (bc) setBulletinConf({ afficher_rang: bc.afficher_rang, afficher_mention: bc.afficher_mention, id: bc.id });
  }, [bulletins, etab]);

  const { mutate: patchEtab, loading: saving } = useMutation(
    useCallback((d) => etablissementService.patchCurrent(d), [])
  );

  const { mutate: patchBulletin, loading: savingBulletin } = useMutation(
    useCallback((d) => {
      if (bulletinConf.id) return configBulletinService.patch(bulletinConf.id, d);
      return configBulletinService.create({ ...d, type_etab: etab?.type_etab || 'SUPERIEUR' });
    }, [bulletinConf.id, etab?.type_etab])
  );

  const ch = e => {
    const { name, value } = e.target;
    setF(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEtab = async (e) => {
    e.preventDefault();
    try {
      await patchEtab(f);
      notifyEtabUpdated(); // vide le cache ET notifie Sidebar + tous les composants
      toast.success(tp.etabSaved);
      reload();
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

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="sms-page">
      <div className="sms-page-header">
        <div>
          <h1 className="sms-page-title"><i className="fas fa-school"></i> {tp.title}</h1>
          <p className="sms-page-subtitle">{tp.subtitle}</p>
        </div>
        {etab && (
          <span className="sms-badge sms-badge-info" style={{ fontSize: 13 }}>
            {etab.code_etab}
          </span>
        )}
      </div>

      <form onSubmit={handleSaveEtab}>
        <Section icon="fas fa-id-card" title={tp.identity}>
          <div className="sms-form-row">
            <FormField label={tp.nomEtab} name="lib_etab"  value={f.lib_etab}  onChange={ch} required />
            <FormField label={tp.sigle}   name="sigle"     value={f.sigle}     onChange={ch} />
          </div>
          <div className="sms-form-row">
            <FormField label={tp.typeEtab} name="type_etab" type="select" value={f.type_etab} onChange={ch} options={TYPE_OPTIONS} />
            <FormField label={tp.statut}   name="statut"    type="select" value={f.statut}    onChange={ch} options={STATUT_OPTIONS} />
            <FormField label={tp.systeme}  name="systeme"   type="select" value={f.systeme}   onChange={ch} options={SYSTEME_OPTIONS} />
          </div>
        </Section>

        <Section icon="fas fa-map-marker-alt" title={tp.location}>
          <div className="sms-form-row">
            <FormField label={tp.region} name="region" type="select" value={f.region} onChange={ch} options={REGION_OPTIONS} />
            <FormField label={tp.ville}  name="ville"  value={f.ville}  onChange={ch} />
          </div>
          <FormField label={tp.adresse} name="adresse" value={f.adresse} onChange={ch} />
        </Section>

        <Section icon="fas fa-phone-alt" title={tp.contact}>
          <div className="sms-form-row">
            <FormField label={tp.telephone} name="telephone" value={f.telephone} onChange={ch} />
            <FormField label={tp.email}     name="email"     type="email" value={f.email} onChange={ch} />
          </div>
          <FormField label={tp.siteWeb} name="site_web" value={f.site_web} onChange={ch} />
        </Section>

        <Section icon="fas fa-user-tie" title={tp.direction}>
          <div className="sms-form-row">
            <FormField label={tp.directeur} name="directeur"         value={f.directeur}          onChange={ch} />
            <FormField label={tp.ministere} name="ministere_tutelle" value={f.ministere_tutelle}  onChange={ch} />
          </div>
          <div className="sms-form-row">
            <FormField label={tp.numAutorisation} name="numero_autorisation" value={f.numero_autorisation} onChange={ch} />
            <FormField label={tp.dateCreation}    name="date_creation"       type="date" value={f.date_creation} onChange={ch} />
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button type="submit" className="sms-btn sms-btn-primary" disabled={saving}>
            <i className="fas fa-save"></i> {saving ? t.common.loading : t.common.save}
          </button>
        </div>
      </form>

      {/* Section bulletin — séparée car ne fait pas partie du formulaire Etablissement */}
      <Section icon="fas fa-file-alt" title={tp.bulletin}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bulletinConf.afficher_rang}
              onChange={e => { setBulletinConf(p => ({ ...p, afficher_rang: e.target.checked })); setBulletinDirty(true); }}
            />
            <span>{tp.afficherRang}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bulletinConf.afficher_mention}
              onChange={e => { setBulletinConf(p => ({ ...p, afficher_mention: e.target.checked })); setBulletinDirty(true); }}
            />
            <span>{tp.afficherMention}</span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              className="sms-btn sms-btn-primary sms-btn-sm"
              onClick={handleSaveBulletin}
              disabled={savingBulletin || !bulletinDirty}
            >
              <i className="fas fa-save"></i> {savingBulletin ? t.common.loading : t.common.save}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
