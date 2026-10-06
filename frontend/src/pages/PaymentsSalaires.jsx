/**
 * pages/PaymentsSalaires.jsx
 * Paiement des salaires du personnel (enseignants vacataires/contractuels, personnel
 * administratif et de soutien) — volontairement séparé des frais de scolarité/inscription
 * (voir Payments.jsx, bouton checkbox de bascule).
 */
import { useState, useCallback } from 'react';
import { CrudTable, FormField } from '../components/CrudTable';
import AutocompleteField from '../components/AutocompleteField';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { paiementSalaireService, enseignantService, personnelService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';

const MODE_LABELS = {
  ESPECES: 'Espèces', VIREMENT: 'Virement bancaire', MOBILE: 'Mobile Money', CHEQUE: 'Chèque',
};
const MODES = Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }));

function Form({ item, onClose, onSave }) {
  const [typeBenef, setTypeBenef] = useState(
    item?.type_beneficiaire || (item?.personnel ? 'PERSONNEL' : 'ENSEIGNANT')
  );
  const [f, setF] = useState({
    enseignant:    item?.enseignant?.mle_ens ?? item?.enseignant ?? '',
    personnel:     item?.personnel?.mle_personnel ?? item?.personnel ?? '',
    mois_paie:     item?.mois_paie || new Date().toISOString().slice(0, 7) + '-01',
    montant:       item?.montant || '',
    date_paiement: item?.date_paiement?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    mode_paiement: item?.mode_paiement || 'ESPECES',
    ref_paiement:  item?.ref_paiement || '',
    observation:   item?.observation || '',
  });
  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = e => {
    e.preventDefault();
    const payload = { ...f };
    if (typeBenef === 'ENSEIGNANT') { payload.personnel = null; }
    else { payload.enseignant = null; }
    onSave(payload);
  };

  return (
    <form onSubmit={submit}>
      <div className="sms-form-group">
        <label className="sms-label">Type de bénéficiaire *</label>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" checked={typeBenef === 'ENSEIGNANT'}
              onChange={() => setTypeBenef('ENSEIGNANT')} />
            Enseignant (vacataire/contractuel)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" checked={typeBenef === 'PERSONNEL'}
              onChange={() => setTypeBenef('PERSONNEL')} />
            Personnel (agent d'entretien, administratif...)
          </label>
        </div>
      </div>

      {typeBenef === 'ENSEIGNANT' ? (
        <AutocompleteField
          label="Enseignant" name="enseignant" value={f.enseignant} onChange={ch} required
          service={enseignantService}
          labelFn={e => `${e.nom_ens} ${e.prenom_ens || ''} — ${e.mle_ens}`}
          valueFn={e => e.mle_ens}
          initialLabel={item?.type_beneficiaire === 'ENSEIGNANT' ? item.nom_beneficiaire : ''}
          placeholder="Rechercher par nom ou matricule…"
        />
      ) : (
        <AutocompleteField
          label="Personnel" name="personnel" value={f.personnel} onChange={ch} required
          service={personnelService}
          labelFn={p => `${p.nom} ${p.prenom || ''} — ${p.mle_personnel}`}
          valueFn={p => p.mle_personnel}
          initialLabel={item?.type_beneficiaire === 'PERSONNEL' ? item.nom_beneficiaire : ''}
          placeholder="Rechercher par nom ou matricule…"
        />
      )}

      <div className="sms-form-row">
        <FormField label="Mois concerné *" name="mois_paie" type="date" value={f.mois_paie} onChange={ch} required
          help="Le jour n'a pas d'importance, seul le mois compte (ex : paie de juin → n'importe quelle date en juin)." />
        <FormField label="Montant (FCFA) *" name="montant" type="number" value={f.montant} onChange={ch} required placeholder="Ex : 150 000" />
      </div>
      <div className="sms-form-row">
        <FormField label="Date de paiement" name="date_paiement" type="date" value={f.date_paiement} onChange={ch} />
        <FormField label="Mode de paiement" name="mode_paiement" type="select" value={f.mode_paiement} onChange={ch} options={MODES} />
      </div>
      <div className="sms-form-row">
        <FormField label="Référence" name="ref_paiement" value={f.ref_paiement} onChange={ch} placeholder="Ex : virement n°..." />
        <FormField label="Observation" name="observation" value={f.observation} onChange={ch} />
      </div>
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>Annuler</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save" /> Enregistrer</button>
      </div>
    </form>
  );
}

export default function PaymentsSalaires() {
  const { toast } = useApp();
  const { data, loading, error, reload } = useApi(
    useCallback(() => paiementSalaireService.list({ page_size: 200 }), [])
  );
  const { data: statsData } = useApi(useCallback(() => paiementSalaireService.stats(), []));

  const { mutate: create } = useMutation(useCallback(d => paiementSalaireService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => paiementSalaireService.update(d.code_paiement_salaire, d), []));
  const { mutate: remove } = useMutation(useCallback(d => paiementSalaireService.delete(d.code_paiement_salaire), []));

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const COLS = [
    { key: 'benef', label: 'Bénéficiaire', bold: true, searchValue: r => r.nom_beneficiaire || '',
      render: r => (
        <div>
          <div>{r.nom_beneficiaire || '—'}</div>
          <span className={`sms-badge ${r.type_beneficiaire === 'ENSEIGNANT' ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: 10 }}>
            {r.type_beneficiaire === 'ENSEIGNANT' ? 'Enseignant' : 'Personnel'}{r.poste_beneficiaire ? ` · ${r.poste_beneficiaire}` : ''}
          </span>
        </div>
      ) },
    { key: 'mois', label: 'Mois', render: r => r.mois_paie ? new Date(r.mois_paie).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—' },
    { key: 'montant', label: 'Montant', render: r => <strong>{Number(r.montant || 0).toLocaleString('fr-FR')} FCFA</strong> },
    { key: 'date', label: 'Date paiement', render: r => r.date_paiement?.slice(0, 10) || '—' },
    { key: 'mode', label: 'Mode', render: r => MODE_LABELS[r.mode_paiement] || r.mode_paiement },
    { key: 'ref', label: 'Référence', render: r => r.ref_paiement || <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 20 }}>
        <div className="stat-card c-blue">
          <div className="stat-icon c-blue"><i className="fas fa-coins"></i></div>
          <div><div className="stat-value">{(statsData?.total_verse ?? 0).toLocaleString('fr-FR')}</div><div className="stat-label">Total versé (FCFA)</div></div>
        </div>
        <div className="stat-card c-green">
          <div className="stat-icon c-green"><i className="fas fa-receipt"></i></div>
          <div><div className="stat-value">{statsData?.nb_paiements ?? 0}</div><div className="stat-label">Paiements</div></div>
        </div>
      </div>
      <CrudTable
        title="Salaires du personnel" subtitle="Enseignants vacataires/contractuels, personnel administratif et de soutien"
        icon="fas fa-money-check-alt" columns={COLS} data={data || []} addLabel="Ajouter"
        exportCsvUrl="/api/paiements-salaires/export-csv/"
        onAdd={async (d) => { try { await create(d); toast.success('Paiement enregistré.'); reload(); } catch (e) { toast.error(e.message); } }}
        onEdit={async (d) => { try { await update(d); toast.success('Paiement modifié.'); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async (d) => { try { await remove(d); toast.success('Paiement supprimé.'); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} />}
      />
    </div>
  );
}
