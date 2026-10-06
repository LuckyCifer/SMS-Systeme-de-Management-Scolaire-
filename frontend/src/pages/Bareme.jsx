/**
 * pages/Bareme.jsx
 * Barème de scolarité : gestion des régimes (Pension), de leurs tranches,
 * et rattachement des Niveaux à un régime.
 */
import { useState, useCallback, useEffect } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { pensionService, trancheService, niveauService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

// ── Formulaire Pension ────────────────────────────────────────────────────────
const TYPE_ETAB_OPTS = [
  { value: '',           label: '— Partagé (tous types) —' },
  { value: 'PRIMAIRE',   label: 'Primaire' },
  { value: 'SECONDAIRE', label: 'Secondaire' },
  { value: 'SUPERIEUR',  label: 'Supérieur' },
];

function PensionForm({ item, onClose, onSave, defaultTypeEtab }) {
  const { t } = useApp();
  const [f, setF] = useState({
    lib_pension:    item?.lib_pension    || '',
    mt_pension:     item?.mt_pension     ?? 0,
    mt_inscription: item?.mt_inscription ?? 0,
    nb_tranche:     item?.nb_tranche     ?? 3,
    obs_pension:    item?.obs_pension    || '',
    type_etab:      item?.type_etab      || defaultTypeEtab || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={`${t.pages.bareme.libelleRegime} *`} name="lib_pension" value={f.lib_pension} onChange={ch}
          required placeholder="Ex : Scolarité Terminale C…" />
      </div>
      <div className="sms-form-row">
        <FormField label={`${t.pages.bareme.scolariteAnn} *`} name="mt_pension" type="number"
          value={f.mt_pension} onChange={ch} required placeholder="Ex : 850 000" />
        <FormField label={t.fields.inscriptionFrais} name="mt_inscription" type="number"
          value={f.mt_inscription} onChange={ch} placeholder="Ex : 50 000" />
        <FormField label={t.pages.bareme.nbTranches} name="nb_tranche" type="number"
          value={f.nb_tranche} onChange={ch} placeholder="Ex : 3" />
      </div>
      <div className="sms-form-row">
        <FormField label={t.nav.typeEtab} name="type_etab" type="select"
          value={f.type_etab} onChange={ch} options={TYPE_ETAB_OPTS} />
        <FormField label={t.fields.obs} name="obs_pension" type="textarea" value={f.obs_pension} onChange={ch} />
      </div>
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Formulaire Tranche ────────────────────────────────────────────────────────
function TrancheForm({ item, pensionId, onClose, onSave }) {
  const { t } = useApp();
  const [f, setF] = useState({
    code_pension: item?.code_pension ?? pensionId,
    lib_tranche:  item?.lib_tranche  || '',
    mt_tranche:   item?.mt_tranche   ?? 0,
    obs_tranche:  item?.obs_tranche  || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <FormField label={`${t.fields.libelle} *`} name="lib_tranche" value={f.lib_tranche} onChange={ch}
          required placeholder="Ex : Tranche 1, Acompte…" />
        <FormField label={`${t.fields.montant} *`} name="mt_tranche" type="number"
          value={f.mt_tranche} onChange={ch} required placeholder="Ex : 283 000" />
      </div>
      <FormField label={t.fields.obs} name="obs_tranche" value={f.obs_tranche} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>
  );
}

// ── Panneau Rattachement Niveaux ──────────────────────────────────────────────
function NiveauxPanel({ selectedPension, selData, onNiveauxChange }) {
  const { t, toast } = useApp();
  const [allNiveaux, setAllNiveaux] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(null); // code_niveau en cours

  const reload = useCallback(() => {
    setLoading(true);
    niveauService.list({ page_size: 200 })
      .then(r => {
        const data = r.data?.results ?? r.data ?? [];
        setAllNiveaux(data);
        onNiveauxChange(data.filter(n => {
          const pk = typeof n.code_pension === 'object' ? n.code_pension?.code_pension : n.code_pension;
          return String(pk) === String(selectedPension);
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPension, onNiveauxChange]);

  useEffect(() => { reload(); }, [reload]);

  const linked = allNiveaux.filter(n => {
    const pk = typeof n.code_pension === 'object' ? n.code_pension?.code_pension : n.code_pension;
    return String(pk) === String(selectedPension);
  });
  const unlinked = allNiveaux.filter(n => {
    const pk = typeof n.code_pension === 'object' ? n.code_pension?.code_pension : n.code_pension;
    return String(pk) !== String(selectedPension);
  });

  const patch = async (niveau, newPension) => {
    setSaving(niveau.code_niveau);
    try {
      await niveauService.patch(niveau.code_niveau, { code_pension: newPension });
      toast.success(newPension
        ? `"${niveau.lib_niveau}" ${t.pages.bareme.rattacheMsg}`
        : `"${niveau.lib_niveau}" ${t.pages.bareme.detacheMsg}`);
      reload();
    } catch (e) {
      toast.error(e.message || t.pages.bareme.erreurMaj);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="sms-card" style={{ padding: 16 }}><LoadingState /></div>;

  return (
    <div className="sms-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-layer-group" style={{ color: 'var(--green)', fontSize: 13 }}></i>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          {t.pages.bareme.niveauxRattaches}
        </span>
        <span className="sms-badge badge-success" style={{ marginLeft: 'auto', fontSize: 10 }}>
          {linked.length} {t.pages.bareme.linked}
        </span>
      </div>

      {/* Niveaux déjà rattachés */}
      {linked.length > 0 && (
        <div style={{ padding: '8px 0' }}>
          {linked.map(n => (
            <div key={n.code_niveau} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 16px',
              background: 'var(--green-dark)11',
              borderLeft: '3px solid var(--green)',
              marginBottom: 1,
            }}>
              <i className="fas fa-check-circle" style={{ color: 'var(--green)', fontSize: 12 }}></i>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {n.lib_niveau}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.pages.bareme.rattache}</span>
              <button
                className="sms-btn sms-btn-outline sms-btn-sm"
                style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                disabled={saving === n.code_niveau}
                onClick={() => patch(n, null)}
              >
                {saving === n.code_niveau
                  ? <div className="sms-spinner" style={{ width: 10, height: 10 }}></div>
                  : <><i className="fas fa-unlink" style={{ marginRight: 4 }}></i>{t.pages.bareme.detacher}</>
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Niveaux non rattachés */}
      {unlinked.length > 0 && (
        <>
          {linked.length > 0 && (
            <div style={{ padding: '6px 16px 2px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {t.pages.bareme.autresNiveaux}
            </div>
          )}
          <div style={{ padding: '4px 0' }}>
            {unlinked.map(n => {
              const currentPension = typeof n.code_pension === 'object'
                ? n.code_pension?.lib_pension
                : (n.lib_pension || null);
              return (
                <div key={n.code_niveau} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 16px',
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  <i className="fas fa-circle" style={{ color: 'var(--border)', fontSize: 8 }}></i>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                    {n.lib_niveau}
                    {currentPension && (
                      <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 8 }}>
                        ({t.pages.bareme.actuellement} : {currentPension})
                      </span>
                    )}
                  </span>
                  <button
                    className="sms-btn sms-btn-primary sms-btn-sm"
                    style={{ fontSize: 11, padding: '2px 10px' }}
                    disabled={saving === n.code_niveau}
                    onClick={() => patch(n, selectedPension)}
                  >
                    {saving === n.code_niveau
                      ? <div className="sms-spinner" style={{ width: 10, height: 10 }}></div>
                      : <><i className="fas fa-link" style={{ marginRight: 4 }}></i>{t.pages.bareme.rattacher}</>
                    }
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {allNiveaux.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {t.pages.bareme.aucunNiveau}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Bareme() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [selectedPension, setSelectedPension] = useState(null);
  const [linkedNiveaux, setLinkedNiveaux]     = useState([]);

  // Pensions
  const { data: pensions, loading: pLoading, error: pError, reload: reloadP } =
    useApi(useCallback(() => pensionService.list({ page_size: 100 }), []));

  // Tranches filtrées par pension sélectionnée
  const { data: tranches, loading: tLoading, reload: reloadT } = useApi(
    useCallback(() => selectedPension
      ? trancheService.list({ code_pension: selectedPension, page_size: 50 })
      : Promise.resolve([]),
    [selectedPension])
  );

  const { mutate: createP } = useMutation(useCallback(d => pensionService.create(d), []));
  const { mutate: updateP } = useMutation(useCallback(d => pensionService.update(d.code_pension, d), []));
  const { mutate: removeP } = useMutation(useCallback(d => pensionService.delete(d.code_pension), []));

  const { mutate: createT } = useMutation(useCallback(d => trancheService.create(d), []));
  const { mutate: updateT } = useMutation(useCallback(d => trancheService.update(d.code_tranche, d), []));
  const { mutate: removeT } = useMutation(useCallback(d => trancheService.delete(d.code_tranche), []));

  const list    = pensions || [];
  const selData = list.find(p => p.code_pension === selectedPension);

  const COLS_PENSION = [
    { accessor: 'lib_pension', label: t.pages.bareme.colRegime, bold: true },
    { key: 'mt', label: t.pages.bareme.colScolariteAnn, render: r => (
      <span style={{ fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
        {Number(r.mt_pension || 0).toLocaleString('fr-FR')} FCFA
      </span>
    )},
    { key: 'ins', label: t.pages.bareme.colInscription, render: r => `${Number(r.mt_inscription || 0).toLocaleString('fr-FR')} FCFA` },
    { key: 'nb',  label: t.pages.parametrage.cols.tranches, render: r => (
      <span className="sms-badge badge-info">{r.nb_tranche || '—'}</span>
    )},
    { accessor: 'obs_pension', label: t.fields.obs, render: r => r.obs_pension || <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  const COLS_TRANCHE = [
    { accessor: 'lib_tranche', label: t.fields.tranche, bold: true },
    { key: 'mt', label: t.pages.parametrage.cols.montant, render: r => (
      <span style={{ fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
        {Number(r.mt_tranche || 0).toLocaleString('fr-FR')} FCFA
      </span>
    )},
    { accessor: 'obs_tranche', label: t.fields.obs, render: r => r.obs_tranche || <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  if (pLoading) return <LoadingState />;
  if (pError)   return <ErrorState message={pError} />;

  const totalTranches = (tranches || []).reduce((s, t) => s + Number(t.mt_tranche || 0), 0);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-coins text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            {t.pages.bareme.title}
          </h1>
          <p className="page-subtitle">
            {t.pages.bareme.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Colonne gauche : Pensions ── */}
        <div>
          <CrudTable
            title={t.pages.bareme.regimes}
            subtitle={t.pages.bareme.regimesSubtitle}
            icon="fas fa-university"
            columns={COLS_PENSION}
            data={list}
            addLabel={t.pages.bareme.newRegime}
            onAdd={async d => {
              try { await createP(d); toast.success(t.toast.added); reloadP(); }
              catch (e) { toast.error(e.message); }
            }}
            onEdit={async d => {
              try { await updateP(d); toast.success(t.toast.updated); reloadP(); }
              catch (e) { toast.error(e.message); }
            }}
            onDelete={async d => {
              try { await removeP(d); toast.success(t.toast.deleted); reloadP(); if (selectedPension === d.code_pension) setSelectedPension(null); }
              catch (e) { toast.error(e.message); }
            }}
            renderForm={p => <PensionForm {...p} defaultTypeEtab={typeEtab} />}
            onRowClick={r => setSelectedPension(r.code_pension === selectedPension ? null : r.code_pension)}
            rowStyle={r => r.code_pension === selectedPension
              ? { background: 'var(--green-dark)22', borderLeft: '3px solid var(--green)' }
              : {}}
          />
        </div>

        {/* ── Colonne droite : Tranches + Niveaux ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedPension ? (
            <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="fas fa-hand-point-left" style={{ fontSize: 32, marginBottom: 12, display: 'block' }}></i>
              {t.pages.bareme.selectPlan}
            </div>
          ) : (
            <>
              {/* Résumé */}
              {selData && (
                <div className="sms-card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    <i className="fas fa-university" style={{ marginRight: 6, color: 'var(--green)' }}></i>
                    {selData.lib_pension}
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.pages.bareme.totalTuition}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>
                        {Number(selData.mt_pension || 0).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.pages.bareme.totalDefined}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: totalTranches === Number(selData.mt_pension) ? 'var(--green)' : 'var(--warning)' }}>
                        {totalTranches.toLocaleString('fr-FR')} FCFA
                        {totalTranches !== Number(selData.mt_pension) && (
                          <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--warning)' }}>{t.pages.bareme.notExpected}</span>
                        )}
                      </div>
                    </div>
                    {linkedNiveaux.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.pages.bareme.linkedLevels}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {linkedNiveaux.map(n => (
                            <span key={n.code_niveau} className="sms-badge badge-success" style={{ fontSize: 10 }}>
                              {n.lib_niveau}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tranches */}
              {tLoading ? <LoadingState /> : (
                <CrudTable
                  title={t.pages.bareme.tranchesTitle}
                  subtitle={t.pages.bareme.tranchesSubtitle}
                  icon="fas fa-layer-group"
                  columns={COLS_TRANCHE}
                  data={tranches || []}
                  addLabel={t.pages.bareme.newTranche}
                  onAdd={async d => {
                    try { await createT({ ...d, code_pension: selectedPension }); toast.success(t.toast.added); reloadT(); }
                    catch (e) { toast.error(e.message); }
                  }}
                  onEdit={async d => {
                    try { await updateT(d); toast.success(t.toast.updated); reloadT(); }
                    catch (e) { toast.error(e.message); }
                  }}
                  onDelete={async d => {
                    try { await removeT(d); toast.success(t.toast.deleted); reloadT(); }
                    catch (e) { toast.error(e.message); }
                  }}
                  renderForm={p => <TrancheForm {...p} pensionId={selectedPension} />}
                />
              )}

              {/* Rattachement niveaux */}
              <NiveauxPanel
                selectedPension={selectedPension}
                selData={selData}
                onNiveauxChange={setLinkedNiveaux}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
