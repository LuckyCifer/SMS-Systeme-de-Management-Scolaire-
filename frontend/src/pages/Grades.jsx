/**
 * pages/Grades.jsx
 * Relevé de notes avec export PDF du bulletin.
 */
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { evaluationService, etudiantService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { generateBulletin } from '../services/pdfService';
import { CanDo } from '../components/RoleGuard';

const moyColor = v => {
  if (v >= 16) return 'var(--green)';
  if (v >= 12) return 'var(--info)';
  if (v >= 10) return 'var(--warning)';
  return 'var(--danger)';
};

const getMention = (moy, t) => {
  if (moy >= 16) return { key:'tresBien',  badge:'badge-success' };
  if (moy >= 14) return { key:'bien',      badge:'badge-info' };
  if (moy >= 12) return { key:'assezBien', badge:'badge-warning' };
  return           { key:'passable',  badge:'badge-secondary' };
};

export default function Grades() {
  const { t, toast } = useApp();
  const [search, setSearch]       = useState('');
  const [exporting, setExporting] = useState(null);

  const { data: evaluations, loading: evalLoading, error: evalError, reload } = useApi(
    () => evaluationService.list({ page_size: 500 })
  );
  const { data: etudiants, loading: etudLoading } = useApi(
    () => etudiantService.list({ page_size: 200 })
  );

  const loading = evalLoading || etudLoading;

  if (loading) return <LoadingState />;
  if (evalError) return <ErrorState message={evalError} onRetry={reload} />;

  // Calcul des moyennes par étudiant
  const moyennesMap = {};
  (evaluations || []).forEach(e => {
    const mle = e.mle_etudiant?.mle_etudiant || e.mle_etudiant;
    if (!moyennesMap[mle]) moyennesMap[mle] = { notes: [], nom: e.nom_etudiant || e.mle_etudiant?.nom || mle };
    moyennesMap[mle].notes.push(parseFloat(e.note));
  });

  const rows = Object.entries(moyennesMap).map(([mle, d]) => {
    const moy = d.notes.length > 0
      ? parseFloat((d.notes.reduce((a, b) => a + b, 0) / d.notes.length).toFixed(2))
      : 0;
    const etud = (etudiants || []).find(e => e.mle_etudiant === mle);
    return { mle, nom: d.nom, moy, nbNotes: d.notes.length, etud };
  });

  const filtered = rows.filter(r =>
    r.nom.toLowerCase().includes(search.toLowerCase()) ||
    r.mle.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportBulletin = async (row) => {
    setExporting(row.mle);
    try {
      const evals = (evaluations || []).filter(e =>
        (e.mle_etudiant?.mle_etudiant || e.mle_etudiant) === row.mle
      );
      await generateBulletin(row.etud || { mle_etudiant: row.mle, nom: row.nom }, evals, 'Année 2025/2026');
      toast.success(t.toast.exported);
    } catch (err) {
      toast.error(t.toast.error);
    } finally {
      setExporting(null);
    }
  };

  const counts = key => rows.filter(r => getMention(r.moy, t).key === key).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-star-half-alt text-green" style={{ marginRight:10, fontSize:22 }}></i>
            {t.pages.grades.title}
          </h1>
          <p className="page-subtitle">{t.pages.grades.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => window.print()}>
            <i className="fas fa-print"></i> {t.common.print}
          </button>
        </div>
      </div>

      {/* Stats mentions */}
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))' }}>
        {[
          { key:'tresBien',  color:'c-green',  icon:'fas fa-trophy' },
          { key:'bien',      color:'c-blue',   icon:'fas fa-medal' },
          { key:'assezBien', color:'c-orange', icon:'fas fa-award' },
          { key:'passable',  color:'c-red',    icon:'fas fa-graduation-cap' },
        ].map(s => (
          <div className={`stat-card ${s.color}`} key={s.key}>
            <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
            <div>
              <div className="stat-value">{counts(s.key)}</div>
              <div className="stat-label">{t.mentions[s.key]}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sms-card">
        <div className="sms-card-header">
          <div className="sms-card-title"><i className="fas fa-table"></i> {t.common.list} ({filtered.length})</div>
          <div className="sms-search">
            <i className="fas fa-search"></i>
            <input type="text" placeholder={t.common.search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="sms-table-wrap">
          <table className="sms-table">
            <thead>
              <tr>
                <th>{t.fields.matricule}</th>
                <th>{t.fields.nomEtud}</th>
                <th>{t.common.nbEval}</th>
                <th>{t.common.moyenne}</th>
                <th>{t.fields.mention}</th>
                <th>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>
                  {t.common.noResult}
                </td></tr>
              ) : filtered.map((r, i) => {
                const mention = getMention(r.moy, t);
                return (
                  <tr key={i}>
                    <td>{r.mle}</td>
                    <td><strong>{r.nom}</strong></td>
                    <td style={{ color:'var(--text-muted)' }}>{r.nbNotes}</td>
                    <td>
                      <strong style={{ color:moyColor(r.moy), fontSize:14, fontFamily:'var(--font-display)' }}>
                        {r.moy}/20
                      </strong>
                    </td>
                    <td><span className={`sms-badge ${mention.badge}`}>{t.mentions[mention.key]}</span></td>
                    <td>
                      <button
                        className="sms-btn sms-btn-outline sms-btn-sm"
                        onClick={() => handleExportBulletin(r)}
                        disabled={exporting === r.mle}
                        title="Exporter le bulletin PDF"
                      >
                        {exporting === r.mle
                          ? <><div className="sms-spinner" style={{ width:12, height:12 }}></div> Export…</>
                          : <><i className="fas fa-file-pdf"></i> {t.common.bulletin}</>
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
