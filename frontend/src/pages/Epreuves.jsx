/**
 * pages/Epreuves.jsx
 * Soumission et validation des sujets d'examen (épreuves).
 *
 * - ENSEIGNANT : dépose le sujet de chacun de ses examens et le soumet pour validation.
 * - SCOLARITE / SUPER_ADMIN : valide ou rejette (avec commentaire) les épreuves soumises.
 * Le rôle backend (EpreuveViewSet) fait foi pour l'autorisation — cette page n'est qu'une
 * commodité d'affichage adaptée au rôle courant.
 */
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { epreuveService, examenService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { getUser } from '../utils/Auth';

const STATUT_INFO = {
  BROUILLON: { label: 'Brouillon',            badge: 'badge-secondary' },
  SOUMISE:   { label: 'En attente de validation', badge: 'badge-warning' },
  VALIDEE:   { label: 'Validée',               badge: 'badge-success' },
  REJETEE:   { label: 'Rejetée',               badge: 'badge-danger' },
};

const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function StatutBadge({ statut }) {
  const info = STATUT_INFO[statut] || STATUT_INFO.BROUILLON;
  return <span className={`sms-badge ${info.badge}`}>{info.label}</span>;
}

// ── Vue enseignant : mes examens + dépôt du sujet ─────────────────────────────
function VueEnseignant() {
  const { toast } = useApp();
  const [uploading, setUploading] = useState(null);

  const { data: examens, loading: lE, error: eE, reload: reloadE } = useApi(
    useCallback(() => examenService.list({ page_size: 200 }), [])
  );
  const { data: epreuves, loading: lEp, reload: reloadEp } = useApi(
    useCallback(() => epreuveService.list({ page_size: 200 }), [])
  );

  const loading = lE || lEp;
  if (loading) return <LoadingState />;
  if (eE) return <ErrorState message={eE} onRetry={reloadE} />;

  const epreuveByExamen = {};
  (epreuves || []).forEach(ep => { epreuveByExamen[ep.examen] = ep; });

  const reload = () => { reloadE(); reloadEp(); };

  const handleFile = async (examen, file) => {
    if (!file) return;
    setUploading(examen.code_examen);
    try {
      const existing = epreuveByExamen[examen.code_examen];
      const fd = new FormData();
      fd.append('fichier', file);
      let epreuveId = existing?.code_epreuve;
      if (!existing) {
        fd.append('examen', examen.code_examen);
        const res = await epreuveService.create(fd);
        epreuveId = res.data.code_epreuve;
      } else {
        await epreuveService.patch(existing.code_epreuve, fd);
      }
      await epreuveService.soumettre(epreuveId);
      toast.success('Épreuve soumise pour validation.');
      reload();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            {['Examen', 'Matière', 'Classe', 'Date', 'Statut', 'Action'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(examens || []).map(ex => {
            const ep = epreuveByExamen[ex.code_examen];
            const statut = ep?.statut || null;
            const peutDeposer = !ep || statut === 'BROUILLON' || statut === 'REJETEE';
            return (
              <tr key={ex.code_examen} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{ex.lib_examen}</td>
                <td style={{ padding: '8px 12px' }}>{ex.lib_matiere || ex.code_matiere}</td>
                <td style={{ padding: '8px 12px' }}>{ex.lib_classe || ex.code_classe}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{fmtDate(ex.date_examen)}</td>
                <td style={{ padding: '8px 12px' }}>
                  {statut ? <StatutBadge statut={statut} /> : <span style={{ color: 'var(--text-muted)' }}>Aucun sujet déposé</span>}
                  {statut === 'REJETEE' && ep?.commentaire_validation && (
                    <div style={{ fontSize: 11, color: '#ef5350', marginTop: 4, maxWidth: 240 }}>
                      <i className="fas fa-comment-dots" style={{ marginRight: 4 }} />
                      {ep.commentaire_validation}
                    </div>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {peutDeposer ? (
                    <label className="sms-btn sms-btn-outline sms-btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                      {uploading === ex.code_examen
                        ? <div className="sms-spinner" style={{ width: 12, height: 12 }} />
                        : <><i className="fas fa-upload" /> {statut === 'REJETEE' ? 'Redéposer' : 'Déposer le sujet'}</>}
                      <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx"
                        onChange={e => handleFile(ex, e.target.files[0])} />
                    </label>
                  ) : (
                    ep?.fichier_url && (
                      <a href={ep.fichier_url} target="_blank" rel="noreferrer"
                        className="sms-btn sms-btn-outline sms-btn-sm">
                        <i className="fas fa-file-download" /> Voir le sujet
                      </a>
                    )
                  )}
                </td>
              </tr>
            );
          })}
          {(examens || []).length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Aucun examen planifié pour l'instant.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Vue scolarité : validation des épreuves soumises ──────────────────────────
function VueScolarite() {
  const { toast } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [busy, setBusy] = useState(null);

  const { data: epreuves, loading, error, reload } = useApi(
    useCallback(() => epreuveService.list(showAll ? { page_size: 200 } : { statut: 'SOUMISE', page_size: 200 }), [showAll])
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const handleValider = async (ep) => {
    setBusy(ep.code_epreuve);
    try {
      await epreuveService.valider(ep.code_epreuve);
      toast.success('Épreuve validée.');
      reload();
    } catch (e) { toast.error(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const handleRejeter = async (ep) => {
    if (!commentaire.trim()) { toast.error('Un commentaire est requis pour rejeter une épreuve.'); return; }
    setBusy(ep.code_epreuve);
    try {
      await epreuveService.rejeter(ep.code_epreuve, commentaire.trim());
      toast.success('Épreuve rejetée — l\'enseignant a été notifié via le statut.');
      setRejecting(null);
      setCommentaire('');
      reload();
    } catch (e) { toast.error(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Afficher aussi les épreuves déjà traitées
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)' }}>
              {['Matière', 'Classe', 'Enseignant', 'Soumise le', 'Statut', 'Sujet', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                  color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(epreuves || []).map(ep => (
              <tr key={ep.code_epreuve} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{ep.lib_matiere}</td>
                <td style={{ padding: '8px 12px' }}>{ep.lib_classe}</td>
                <td style={{ padding: '8px 12px' }}>{ep.nom_enseignant || '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{fmtDate(ep.date_soumission)}</td>
                <td style={{ padding: '8px 12px' }}><StatutBadge statut={ep.statut} /></td>
                <td style={{ padding: '8px 12px' }}>
                  {ep.fichier_url && (
                    <a href={ep.fichier_url} target="_blank" rel="noreferrer" className="sms-btn sms-btn-outline sms-btn-sm">
                      <i className="fas fa-file-download" /> Ouvrir
                    </a>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {ep.statut === 'SOUMISE' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="sms-btn sms-btn-primary sms-btn-sm" disabled={busy === ep.code_epreuve}
                        onClick={() => handleValider(ep)}>
                        <i className="fas fa-check" /> Valider
                      </button>
                      <button className="sms-btn sms-btn-outline sms-btn-sm" disabled={busy === ep.code_epreuve}
                        onClick={() => setRejecting(ep)}>
                        <i className="fas fa-times" /> Rejeter
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(epreuves || []).length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                Aucune épreuve en attente de validation.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setRejecting(null)}>
          <div className="sms-modal" style={{ maxWidth: 480 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">Rejeter l'épreuve — {rejecting.lib_matiere}</div>
              <button className="sms-btn-icon" onClick={() => setRejecting(null)}><i className="fas fa-times" /></button>
            </div>
            <div className="sms-modal-body">
              <div className="sms-form-group">
                <label className="sms-label">Motif du rejet (visible par l'enseignant) *</label>
                <textarea className="sms-input" rows={4} value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Ex : barème manquant, sujet incomplet..." />
              </div>
              <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
                <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setRejecting(null)}>Annuler</button>
                <button className="sms-btn sms-btn-primary sms-btn-sm" disabled={busy === rejecting.code_epreuve}
                  onClick={() => handleRejeter(rejecting)}>
                  <i className="fas fa-times" /> Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Epreuves() {
  const user = getUser();
  const isValidateur = user?.role === 'SCOLARITE' || user?.role === 'SUPER_ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-file-signature text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            Épreuves
          </h1>
          <p className="page-subtitle">
            {isValidateur
              ? 'Validation des sujets d\'examen soumis par les enseignants'
              : 'Dépôt des sujets d\'examen pour validation par la scolarité'}
          </p>
        </div>
      </div>
      {isValidateur ? <VueScolarite /> : <VueEnseignant />}
    </div>
  );
}
