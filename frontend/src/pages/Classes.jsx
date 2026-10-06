import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { classeService, niveauScolaireService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

function Form({ item, onClose, onSave, niveauxOptions, labels, departements, specialites }) {
  const { t } = useApp();

  const fkStr = (v, key) => (typeof v === 'object' ? v?.[key] : v) || '';

  const [f, setF] = useState({
    code_classe:     item?.code_classe      || '',
    lib_classe:      item?.lib_classe       || '',
    code_dep:        fkStr(item?.code_dep,  'code_dep'),
    code_sp:         fkStr(item?.code_sp,   'code_sp'),
    niveau_scolaire: item?.niveau_scolaire  || '',
    code_bat:        item?.code_bat         || '',
    eff_max:         item?.eff_max          || 50,
    obs_classe:      item?.obs_classe       || '',
    systeme:         item?.systeme          || '',
  });

  // Spécialités filtrées selon le département sélectionné dans le formulaire
  const spOptions = (specialites || []).filter(s => {
    if (!f.code_dep) return true;
    const d = typeof s.code_dep === 'object' ? s.code_dep?.code_dep : s.code_dep;
    return d === f.code_dep;
  });

  const ch = e => {
    const { name, value } = e.target;
    setF(prev => {
      const next = { ...prev, [name]: value };
      // Réinitialise la spécialité si le département change
      if (name === 'code_dep') next.code_sp = '';
      return next;
    });
  };

  // Établissement BILINGUE uniquement : chaque classe suit l'un des deux sous-systèmes,
  // avec ses propres matières/coefficients/examens (voir doc de référence système
  // éducatif). Sans ambiguïté pour un établissement purement francophone/anglophone.
  const SYSTEMES_CLASSE = [
    { value: 'FRANCOPHONE', label: 'Francophone' },
    { value: 'ANGLOPHONE',  label: 'Anglophone' },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, code_sp: f.code_sp || null, code_dep: f.code_dep || null, systeme: f.systeme || null }); }}>
      <div className="sms-form-row">
        <FormField label={`${t.common.colCode} *`} name="code_classe" value={f.code_classe} onChange={ch} required disabled={!!item} placeholder="Ex : GI1-L1" />
        <FormField label={`${t.fields.libelle} *`} name="lib_classe"  value={f.lib_classe}  onChange={ch} required placeholder="Ex : Génie Informatique — Licence 1" />
      </div>

      {labels?.isBilingue && (
        <FormField
          label="Sous-système linguistique" name="systeme" type="select"
          value={f.systeme} onChange={ch} options={SYSTEMES_CLASSE} required
          help="Établissement bilingue : précisez le sous-système suivi par cette classe."
        />
      )}

      <div className="sms-form-row">
        {/* Filière / Série / Niveau selon le type d'établissement */}
        <div className="sms-form-group">
          <label className="sms-label">{labels?.departementLabel || t.fields.departement}</label>
          <select className="sms-input" name="code_dep" value={f.code_dep} onChange={ch}>
            <option value="">— {labels?.allDepsLabel || 'Toutes'} —</option>
            {(departements || []).map(d => (
              <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>
            ))}
          </select>
        </div>

        {/* Spécialité / Option — filtrée par département */}
        <div className="sms-form-group">
          <label className="sms-label">{labels?.specialiteLabel || t.fields.specialite}</label>
          <select className="sms-input" name="code_sp" value={f.code_sp} onChange={ch} disabled={!f.code_dep}>
            <option value="">— {f.code_dep ? `${spOptions.length} option(s)` : 'Choisir une filière d\'abord'} —</option>
            {spOptions.map(s => (
              <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sms-form-row">
        <FormField
          label={t.pages.parametres?.niveauScolaire || t.fields.niveau}
          name="niveau_scolaire"
          type="searchable"
          value={f.niveau_scolaire}
          onChange={ch}
          options={niveauxOptions}
          placeholder="Rechercher un niveau…"
        />
        <FormField label={t.fields.batiment} name="code_bat" value={f.code_bat} onChange={ch} placeholder="Ex : Bât. A" />
      </div>

      <div className="sms-form-row">
        <FormField label={t.fields.effMax} name="eff_max"    type="number" value={f.eff_max}    onChange={ch} placeholder="Ex : 30" />
        <FormField label={t.fields.obs}    name="obs_classe"               value={f.obs_classe} onChange={ch} />
      </div>

      <div className="sms-modal-footer" style={{ padding:'14px 0 0', border:'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Classes() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [depFilter,    setDepFilter]    = useState('');
  const [spFilter,     setSpFilter]     = useState('');
  const [departements, setDepartements] = useState([]);
  const [specialites,  setSpecialites]  = useState([]);
  const [filteredSp,   setFilteredSp]   = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/departements/?page_size=100'),
      api.get('/api/specialites/?page_size=200'),
    ]).then(([dR, sR]) => {
      setDepartements(dR.data.results ?? dR.data);
      const sps = sR.data.results ?? sR.data;
      setSpecialites(sps);
      setFilteredSp(sps);
    }).catch(() => {});
  }, []);

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

  const { data, loading, error, reload } = useApi(
    () => classeService.list({
      page_size: 200,
      ...(depFilter ? { code_dep: depFilter } : {}),
      ...(spFilter  ? { code_sp:  spFilter  } : {}),
    }),
    [depFilter, spFilter]
  );
  const { mutate: create } = useMutation(useCallback((d) => classeService.create(d), []));
  const { mutate: update } = useMutation(useCallback((d) => classeService.update(d.code_classe, d), []));
  const { mutate: remove } = useMutation(useCallback((d) => classeService.delete(d.code_classe), []));

  const { data: niveaux } = useApi(useCallback(() =>
    niveauScolaireService.list({ type_etab: typeEtab, systeme, page_size: 100 }),
    [typeEtab, systeme]
  ));

  const niveauxOptions = (niveaux || [])
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    .map(n => ({ value: n.code_niveau, label: n.lib_niveau }));

  const SYSTEME_BADGE = { FRANCOPHONE: 'badge-info', ANGLOPHONE: 'badge-warning' };
  const SYSTEME_LABEL = { FRANCOPHONE: 'FR', ANGLOPHONE: 'EN' };

  const COLS = [
    { accessor:'code_classe',      label: t.common.colCode },
    { accessor:'lib_classe',       label: t.fields.libelle,         bold: true },
    ...(labels.isBilingue ? [{
      key: 'systeme', label: 'Système', searchValue: r => r.systeme || '', render: r => (
        r.systeme
          ? <span className={`sms-badge ${SYSTEME_BADGE[r.systeme] || 'badge-secondary'}`}>{SYSTEME_LABEL[r.systeme] || r.systeme}</span>
          : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
      ),
    }] : []),
    { accessor:'lib_dep',          label: labels.departementLabel },
    { accessor:'lib_niv_scolaire', label: t.pages.parametres?.niveauScolaire || labels.niveauLabel },
    { accessor:'lib_bat',        label: t.fields.batiment },
    { key:'eff', label: t.fields.effMax, render: r => (
      <div className="flex items-center gap-2">
        <div className="sms-progress" style={{ width:55 }}>
          <div className="sms-progress-bar" style={{ width:'60%' }} />
        </div>
        <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.eff_max}</span>
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  return (
    <CrudTable
      title={labels.classesPageTitle} subtitle={labels.classesPageSubtitle}
      icon="fas fa-door-open" columns={COLS} data={data || []} addLabel={t.common.add}
      filters={
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          {/* Filière / Série / Niveau selon le type */}
          <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
            value={depFilter} onChange={e => setDepFilter(e.target.value)}>
            <option value="">{labels.allDepsLabel}</option>
            {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
          </select>
          {/* Spécialité / Option — supérieur + secondaire */}
          {labels.showDepartements && (
            <select className="sms-input" style={{ height: 34, minWidth: 180, fontSize: 12 }}
              value={spFilter} onChange={e => setSpFilter(e.target.value)} disabled={!depFilter}>
              <option value="">{labels.isSuperieur ? t.common.allSp : 'Toutes les options'}</option>
              {filteredSp.map(s => <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>)}
            </select>
          )}
          {(depFilter || spFilter) && (
            <button className="sms-btn-icon" onClick={() => { setDepFilter(''); setSpFilter(''); }} title={t.common.reset}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      }
      onAdd={async (d) => { try { await create(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message); } }}
      onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
      onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
      renderForm={p => <Form {...p} niveauxOptions={niveauxOptions} labels={labels} departements={departements} specialites={specialites} />}
    />
  );
}
