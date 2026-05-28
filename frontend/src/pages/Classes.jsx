import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { classeService, niveauScolaireService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

function Form({ item, onClose, onSave, niveauxOptions }) {
  const { t } = useApp();
  const { t: tp } = { t: t.pages.parametres };
  const [f, setF] = useState({
    code_classe:     item?.code_classe      || '',
    lib_classe:      item?.lib_classe       || '',
    code_dep:        item?.code_dep         || '',
    niveau_scolaire: item?.niveau_scolaire  || '',
    code_bat:        item?.code_bat         || '',
    eff_max:         item?.eff_max          || 50,
    obs_classe:      item?.obs_classe       || '',
  });
  const ch = e => setF({ ...f, [e.target.name]: e.target.value });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={t.fields.matricule} name="code_classe" value={f.code_classe} onChange={ch} required disabled={!!item} />
        <FormField label={t.fields.libelle}   name="lib_classe"  value={f.lib_classe}  onChange={ch} required />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.departement} name="code_dep" value={f.code_dep} onChange={ch} />
        <FormField
          label={t.pages.parametres?.niveauScolaire || t.fields.niveau}
          name="niveau_scolaire"
          type="searchable"
          value={f.niveau_scolaire}
          onChange={ch}
          options={niveauxOptions}
          placeholder="Rechercher un niveau…"
        />
        <FormField label={t.fields.batiment} name="code_bat" value={f.code_bat} onChange={ch} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.effMax} name="eff_max"    type="number" value={f.eff_max}    onChange={ch} />
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

  const { data, loading, error, reload } = useApi(() => classeService.list({ page_size: 200 }));
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

  const COLS = [
    { accessor:'code_classe',    label: t.fields.matricule },
    { accessor:'lib_classe',     label: t.fields.libelle,     bold: true },
    { accessor:'lib_dep',        label: t.fields.departement },
    { accessor:'lib_niv_scolaire', label: t.pages.parametres?.niveauScolaire || t.fields.niveau },
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
      onAdd={async (d) => { try { await create(d); toast.success(t.toast.added); reload(); } catch (e) { toast.error(e.message); } }}
      onEdit={async (d) => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
      onDelete={async (d) => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
      renderForm={p => <Form {...p} niveauxOptions={niveauxOptions} />}
    />
  );
}
