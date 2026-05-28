import { useState, useCallback, useEffect } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import AutocompleteField from '../components/AutocompleteField';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { inscriptionService, paiementService, etudiantService, classeService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateRecu } from '../services/pdfService';
import api from '../services/api';

const SP_STYLE = { PAYE:'badge-success', PARTIEL:'badge-warning', EN_ATTENTE:'badge-danger' };
const SP_LABEL = { PAYE:'Payé', PARTIEL:'Partiel', EN_ATTENTE:'En attente' };

// ── Formulaire Inscription + Paiement simultané ───────────────────────────────
function Form({ item, onClose, onSave }) {
  const { t } = useApp();
  const isEdit = Boolean(item?.code_inscription);
  // Afficher le bloc paiement si création OU si la situation n'est pas soldée
  const showPaiement = !isEdit || item?.statut_paiement !== 'PAYE';
  const [anneeEnCours, setAnneeEnCours] = useState('');

  useEffect(() => {
    if (!item) {
      api.get('/annees/en-cours/')
        .then(res => setAnneeEnCours(res.data.code_annee || ''))
        .catch(() => {});
    }
  }, [item]);

  const today = new Date().toISOString().slice(0, 10);

  const [f, setF] = useState({
    // Inscription administrative
    mle_etudiant:     item?.mle_etudiant?.mle_etudiant || item?.mle_etudiant || '',
    code_classe:      item?.code_classe?.code_classe   || item?.code_classe  || '',
    code_annee:       item?.code_annee?.code_annee     || item?.code_annee   || '',
    date_inscription: item?.date_inscription?.slice(0, 10) || today,
    mt_inscription:   item?.mt_inscription || 0,
    // Paiement des frais
    statut_paiement:  'PAYE',
    mt_paye:          isEdit ? 0 : (item?.mt_inscription || 0),
    date_paiement:    today,
    obs_paiement:     '',
  });

  useEffect(() => {
    if (!item && anneeEnCours && !f.code_annee) {
      setF(p => ({ ...p, code_annee: anneeEnCours }));
    }
  }, [anneeEnCours, item]);

  const ch = e => {
    const { name, value } = e.target;
    setF(p => {
      const next = { ...p, [name]: value };
      if (name === 'mt_inscription' && !isEdit) next.mt_paye = value;
      return next;
    });
  };

  const btnLabel = !isEdit
    ? t.pages.inscriptions.inscBtn
    : showPaiement
      ? t.pages.inscriptions.encaisserBtn
      : t.common.save;

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>

      {/* ── Bloc 1 : Inscription administrative ── */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 8,
        padding: '12px 14px', marginBottom: 14,
        borderLeft: '3px solid var(--green)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase',
                      letterSpacing: '.5px', marginBottom: 10 }}>
          <i className="fas fa-file-signature" style={{ marginRight: 6 }}></i>
          {t.pages.inscriptions.adminSection}
        </div>
        <div className="sms-form-row">
          <AutocompleteField
            label={t.fields.mleEtud} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required
            service={etudiantService}
            labelFn={e => `${e.nom} ${e.prenom || ''} — ${e.mle_etudiant}`}
            valueFn={e => e.mle_etudiant}
            initialLabel={item ? `${item.nom_etudiant || ''} — ${item.mle_etudiant?.mle_etudiant || item.mle_etudiant}`.trim() : ''}
            placeholder="Rechercher par nom ou matricule…"
          />
          <AutocompleteField
            label={t.fields.classe} name="code_classe" value={f.code_classe} onChange={ch} required
            service={classeService}
            labelFn={c => `${c.lib_classe || c.code_classe} (${c.code_classe})`}
            valueFn={c => c.code_classe}
            initialLabel={item ? (item.lib_classe || item.code_classe?.code_classe || item.code_classe || '') : ''}
            placeholder="Rechercher une classe…"
          />
        </div>
        <div className="sms-form-row">
          <FormField label={t.fields.annee} name="code_annee"
            value={f.code_annee} onChange={ch}
            placeholder={anneeEnCours || 'ex: 2025-2026'} />
          <FormField label={t.fields.dateInscription} name="date_inscription"
            type="date" value={f.date_inscription} onChange={ch} />
          <FormField label={t.fields.inscriptionFrais} name="mt_inscription"
            type="number" value={f.mt_inscription} onChange={ch} />
        </div>
      </div>

      {/* ── Bloc 2 : Paiement des frais ── */}
      {showPaiement && (
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 8,
          padding: '12px 14px', marginBottom: 14,
          borderLeft: '3px solid var(--blue)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase',
                        letterSpacing: '.5px', marginBottom: 10 }}>
            <i className="fas fa-money-bill-wave" style={{ marginRight: 6 }}></i>
            {isEdit ? t.pages.inscription.encaisserSupp : t.pages.inscription.paiementFrais}
          </div>
          {isEdit && item?.mt_paye_inscription > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10,
                          background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 10px' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 5, color: 'var(--blue)' }}></i>
              {t.pages.inscription.dejaEncaisse}&nbsp;:&nbsp;
              <strong>{Number(item.mt_paye_inscription).toLocaleString('fr-FR')} FCFA</strong>
              {item.mt_inscription > 0 && (
                <span> / {Number(item.mt_inscription).toLocaleString('fr-FR')} {t.pages.inscription.attendus}</span>
              )}
            </div>
          )}
          <div className="sms-form-row">
            <FormField label={t.fields.statutPaiement} name="statut_paiement" type="select"
              value={f.statut_paiement} onChange={ch}
              options={[
                { value: 'PAYE',       label: t.pages.inscription.payeIntegralement },
                { value: 'PARTIEL',    label: t.pages.inscription.paiementPartiel },
                { value: 'EN_ATTENTE', label: t.pages.inscription.nonPaye },
              ]} />
            <FormField label={t.fields.montantRecu} name="mt_paye"
              type="number" value={f.mt_paye} onChange={ch}
              disabled={f.statut_paiement === 'EN_ATTENTE'} />
            <FormField label={t.fields.date} name="date_paiement"
              type="date" value={f.date_paiement} onChange={ch}
              disabled={f.statut_paiement === 'EN_ATTENTE'} />
          </div>
          <FormField label={t.fields.obs} name="obs_paiement"
            value={f.obs_paiement} onChange={ch}
            placeholder="Ex : Reçu espèces, chèque n°…" />
        </div>
      )}

      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i>{' '}
          {btnLabel}
        </button>
      </div>
    </form>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Inscription() {
  const { t, toast, user } = useApp();
  const { data, loading, error, reload } =
    useApi(() => inscriptionService.list({ page_size: 50 }));

  const { mutate: createInsc } = useMutation(
    useCallback(d => inscriptionService.create(d), [])
  );
  const { mutate: updateInsc } = useMutation(
    useCallback(d => inscriptionService.update(d.code_inscription, d), [])
  );
  const { mutate: removeInsc } = useMutation(
    useCallback(d => inscriptionService.delete(d.code_inscription), [])
  );

  const [printing, setPrinting] = useState(null);

  // Imprime un reçu d'inscription en cherchant le dernier paiement lié
  const handleRecu = async (insc) => {
    if (insc.mt_paye_inscription <= 0) {
      toast.error('Aucun paiement enregistré pour cette inscription.');
      return;
    }
    setPrinting(insc.code_inscription);
    try {
      const mle = insc.mle_etudiant?.mle_etudiant || insc.mle_etudiant;
      const annee = insc.code_annee?.code_annee || insc.code_annee;
      const resp = await paiementService.list({
        mle_etudiant: mle,
        code_annee: annee,
        type_paiement: 'INSCRIPTION',
        page_size: 10,
      });
      const paiements = resp.data?.results ?? resp.data ?? [];
      const p = [...paiements].sort((a, b) => b.code_paiement - a.code_paiement)[0];

      if (!p) { toast.error('Reçu introuvable.'); return; }
      await generateRecu(p, user);
      toast.success(t.toast.exported);
    } catch {
      toast.error(t.toast.error);
    } finally {
      setPrinting(null);
    }
  };

  // Création simultanée inscription + paiement
  const handleAdd = async (formData) => {
    const { statut_paiement, mt_paye, date_paiement, obs_paiement, ...inscData } = formData;
    try {
      const inscResp = await createInsc(inscData);
      const code_annee = inscData.code_annee;
      const mle = inscData.mle_etudiant;

      // Créer le paiement si un montant est renseigné
      if (statut_paiement !== 'EN_ATTENTE' && Number(mt_paye) > 0) {
        await paiementService.create({
          mle_etudiant:  mle,
          code_annee,
          type_paiement: 'INSCRIPTION',
          mt_paiement:   Number(mt_paye),
          date_paiement: date_paiement || inscData.date_inscription,
          statut:        statut_paiement,
          obs_paiement:  obs_paiement || '',
        });
      }
      toast.success(t.toast.added);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const COLS = [
    { accessor: 'code_inscription', label: t.fields.noInscription },
    { key:'etud', label: t.fields.mleEtud, render: r => r.mle_etudiant?.mle_etudiant || r.mle_etudiant },
    { key:'nom',  label: t.fields.nomEtud, bold: true,
      render: r => r.nom_etudiant || r.mle_etudiant?.nom || '—' },
    { key:'cls',  label: t.fields.classe,
      render: r => r.lib_classe || r.code_classe?.code_classe || r.code_classe },
    { key:'ann',  label: t.fields.annee,
      render: r => r.lib_annee  || r.code_annee?.code_annee   || r.code_annee },
    { key:'date', label: t.fields.date,
      render: r => r.date_inscription?.slice(0, 10) || '—' },
    { key:'frais', label: t.pages.bareme.colInscription, render: r => {
      const attendu = Number(r.mt_inscription || 0);
      const paye    = Number(r.mt_paye_inscription || 0);
      const statut  = r.statut_paiement || 'EN_ATTENTE';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={`sms-badge ${SP_STYLE[statut]}`} style={{ fontSize: 10 }}>
            {SP_LABEL[statut]}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {paye.toLocaleString('fr-FR')} / {attendu.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
      );
    }},
    { key:'recu', label: '', render: r => (
      <button
        className="sms-btn-icon"
        title="Imprimer le reçu d'inscription"
        style={{ color: 'var(--danger)' }}
        disabled={!r.mt_paye_inscription || printing === r.code_inscription}
        onClick={e => { e.stopPropagation(); handleRecu(r); }}
      >
        {printing === r.code_inscription
          ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
          : <i className="fas fa-file-pdf"></i>
        }
      </button>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const nbPayes    = (data || []).filter(d => d.statut_paiement === 'PAYE').length;
  const nbPartiels = (data || []).filter(d => d.statut_paiement === 'PARTIEL').length;
  const nbAttente  = (data || []).filter(d => d.statut_paiement === 'EN_ATTENTE').length;
  const totalRecu  = (data || []).reduce((s, d) => s + Number(d.mt_paye_inscription || 0), 0);

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 20 }}>
        <div className="stat-card c-green">
          <div className="stat-icon c-green"><i className="fas fa-check-circle"></i></div>
          <div><div className="stat-value">{nbPayes}</div><div className="stat-label">{t.pages.inscriptions.fraisSoldes}</div></div>
        </div>
        <div className="stat-card c-orange">
          <div className="stat-icon c-orange"><i className="fas fa-clock"></i></div>
          <div><div className="stat-value">{nbPartiels}</div><div className="stat-label">{t.pages.inscriptions.paiementsPartiels}</div></div>
        </div>
        <div className="stat-card c-red">
          <div className="stat-icon c-red"><i className="fas fa-times-circle"></i></div>
          <div><div className="stat-value">{nbAttente}</div><div className="stat-label">{t.pages.inscriptions.nonPayes}</div></div>
        </div>
        <div className="stat-card c-blue">
          <div className="stat-icon c-blue"><i className="fas fa-coins"></i></div>
          <div>
            <div className="stat-value" style={{ fontSize: 14 }}>{totalRecu.toLocaleString('fr-FR')}</div>
            <div className="stat-label">{t.pages.inscriptions.fcfaEncaisses}</div>
          </div>
        </div>
      </div>

      <CrudTable
        title={t.pages.inscriptions.title}
        subtitle={t.pages.inscriptions.subtitle}
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        icon="fas fa-file-signature"
        columns={COLS}
        data={data || []}
        addLabel={t.pages.inscriptions.addLabel}
        onAdd={handleAdd}
        onEdit={async d => {
          try {
            const { statut_paiement, mt_paye, date_paiement, obs_paiement, ...inscData } = d;
            await updateInsc(inscData);
            // Créer un paiement supplémentaire si un montant a été saisi
            if (statut_paiement !== 'EN_ATTENTE' && Number(mt_paye) > 0) {
              await paiementService.create({
                mle_etudiant:  inscData.mle_etudiant?.mle_etudiant || inscData.mle_etudiant,
                code_annee:    inscData.code_annee?.code_annee     || inscData.code_annee,
                type_paiement: 'INSCRIPTION',
                mt_paiement:   Number(mt_paye),
                date_paiement: date_paiement || inscData.date_inscription,
                statut:        statut_paiement,
                obs_paiement:  obs_paiement || '',
              });
              toast.success(t.pages.inscriptions.inscUpdated);
            } else {
              toast.success(t.toast.updated);
            }
            reload();
          } catch (e) { toast.error(e.message); }
        }}
        onDelete={async d => {
          try { await removeInsc(d); toast.success(t.toast.deleted); reload(); }
          catch (e) { toast.error(e.message); }
        }}
        renderForm={p => <Form {...p} />}
      />
    </div>
  );
}
