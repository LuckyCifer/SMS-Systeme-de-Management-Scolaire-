/**
 * pages/Absences.jsx — Suivi des absences étudiants
 */
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { LoadingState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="sms-card" style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={icon} style={{ color, fontSize: 20 }}></i>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Absences() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [etudiants,    setEtudiants]    = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedEtu,  setSelectedEtu]  = useState('');
  const [absences,     setAbsences]     = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loadingEtu,   setLoadingEtu]   = useState(false);
  const [loadingAbs,   setLoadingAbs]   = useState(false);
  const [filterPresent, setFilter]      = useState('false');
  const [justifying,   setJustifying]   = useState(null);
  const [motifModal,   setMotifModal]   = useState(null);
  const [motif,        setMotif]        = useState('');

  // Charger les classes au montage
  useEffect(() => {
    api.get('/api/classes/?page_size=200')
      .then(res => setClasses(res.data.results ?? res.data));
  }, []);

  // Charger les étudiants quand une classe est sélectionnée
  useEffect(() => {
    if (!selectedClasse) { setEtudiants([]); return; }
    setLoadingEtu(true);
    api.get(`/api/etudiants/?code_classe=${selectedClasse}&page_size=500`)
      .then(res => setEtudiants(res.data.results ?? res.data))
      .finally(() => setLoadingEtu(false));
  }, [selectedClasse]);

  const etudiantsFiltres = etudiants;

  // Charger absences quand étudiant sélectionné
  useEffect(() => {
    if (!selectedEtu) { setAbsences([]); setStats(null); return; }
    setLoadingAbs(true);
    const params = { mle_etudiant: selectedEtu, page_size: 500 };
    if (filterPresent !== 'all') params.present = filterPresent;
    Promise.all([
      api.get('/api/absences/', { params }),
      api.get(`/api/etudiants/${selectedEtu}/absences-stats/`),
    ]).then(([aRes, sRes]) => {
      setAbsences(aRes.data.results ?? aRes.data);
      setStats(sRes.data);
    }).catch(() => toast.error(t.errors.loading))
    .finally(() => setLoadingAbs(false));
  }, [selectedEtu, filterPresent]);

  const refreshAbsences = async () => {
    if (!selectedEtu) return;
    const params = { mle_etudiant: selectedEtu, page_size: 500 };
    if (filterPresent !== 'all') params.present = filterPresent;
    const [aRes, sRes] = await Promise.all([
      api.get('/api/absences/', { params }),
      api.get(`/api/etudiants/${selectedEtu}/absences-stats/`),
    ]);
    setAbsences(aRes.data.results ?? aRes.data);
    setStats(sRes.data);
  };

  const handleJustify = async (absence) => {
    if (!absence.justifiee && !motifModal) {
      setMotifModal(absence);
      setMotif(absence.motif || '');
      return;
    }
    setJustifying(absence.code_absence);
    try {
      await api.patch(`/api/absences/${absence.code_absence}/`, {
        justifiee: !absence.justifiee,
        motif: absence.justifiee ? '' : motif,
      });
      toast.success(t.toast.updated);
      setMotifModal(null);
      setMotif('');
      await refreshAbsences();
    } catch { toast.error(t.errors.saving); }
    finally  { setJustifying(null); }
  };

  const etudiantSelectionne = etudiants.find(e => e.mle_etudiant === selectedEtu);

  return (
    <div className="sms-content">
      <div className="sms-page-header">
        <div>
          <h1 className="sms-page-title">
            <i className="fas fa-user-times" style={{ marginRight: 10, color: '#c62828' }}></i>
            {t.pages.absences.title}
          </h1>
          <p className="sms-page-subtitle">
            {lang === 'en'
              ? `Absences by ${labels.studentLabel.toLowerCase()} — missed hours and justifications`
              : `Absences par ${labels.studentLabel.toLowerCase()} — heures manquées et justifications`}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="sms-label">{t.fields.classe}</label>
            <select className="sms-input" value={selectedClasse}
              onChange={e => { setSelectedClasse(e.target.value); setSelectedEtu(''); }}>
              <option value="">{t.common.allClasses}</option>
              {classes.map(c => (
                <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 280px' }}>
            <label className="sms-label">{labels.studentLabelPlural} *</label>
            {loadingEtu ? (
              <div className="sms-input" style={{ color: 'var(--text-muted)' }}>{t.common.loading}</div>
            ) : (
              <select className="sms-input" value={selectedEtu} onChange={e => setSelectedEtu(e.target.value)}>
                <option value="">{t.common.select}</option>
                {etudiantsFiltres.map(e => (
                  <option key={e.mle_etudiant} value={e.mle_etudiant}>
                    {e.nom} {e.prenom || ''} — {e.mle_etudiant}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ flex: '0 1 180px' }}>
            <label className="sms-label">{t.pages.absences.filterType}</label>
            <select className="sms-input" value={filterPresent} onChange={e => setFilter(e.target.value)}>
              <option value="all">{t.common.all}</option>
              <option value="false">{t.pages.absences.absOnly}</option>
              <option value="true">{t.pages.absences.presOnly}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard label={t.pages.absences.totalAbs}    value={stats.nb_absences}       icon="fas fa-user-times"  color="#c62828" />
          <StatCard label={t.pages.absences.totalHeures} value={`${stats.total_heures}h`} icon="fas fa-clock"       color="#e65100" />
          {(stats.par_matiere || []).slice(0, 2).map(m => (
            <StatCard key={m.matiere} label={m.matiere} value={`${m.heures}h`} icon="fas fa-book" color="#1a3c5e" />
          ))}
        </div>
      )}

      {/* Tableau */}
      {!selectedEtu ? (
        <div className="sms-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-user-graduate" style={{ fontSize: 44, marginBottom: 14, opacity: .4 }}></i>
          <p style={{ margin: 0 }}>
            {lang === 'en'
              ? `Select a ${labels.studentLabel.toLowerCase()} to view their absences`
              : `Sélectionnez un ${labels.studentLabel.toLowerCase()} pour afficher ses absences`}
          </p>
        </div>
      ) : loadingAbs ? (
        <LoadingState />
      ) : absences.length === 0 ? (
        <div className="sms-card" style={{ padding: 48, textAlign: 'center' }}>
          <i className="fas fa-check-circle" style={{ fontSize: 44, marginBottom: 14, color: '#2e7d32' }}></i>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {lang === 'en'
              ? `No absence recorded for this ${labels.studentLabel.toLowerCase()}.`
              : `Aucune absence enregistrée pour cet ${labels.studentLabel.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="sms-card">
          <div className="sms-card-header">
            <span className="sms-card-title">
              <i className="fas fa-list" style={{ marginRight: 8 }}></i>
              {etudiantSelectionne
                ? `${etudiantSelectionne.nom} ${etudiantSelectionne.prenom || ''} — `
                : ''}
              {absences.length} {t.pages.absences.entries}
            </span>
          </div>
          <div className="sms-table-wrap">
            <table className="sms-table">
              <thead>
                <tr>
                  <th>{t.fields.date}</th>
                  <th>{t.fields.matiere}</th>
                  <th style={{ textAlign: 'center' }}>{t.pages.absences.present}</th>
                  <th style={{ textAlign: 'center' }}>{t.pages.absences.justified}</th>
                  <th>{t.fields.obs}</th>
                  <th style={{ textAlign: 'center' }}>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {absences.map(a => (
                  <tr key={a.code_absence}>
                    <td style={{ fontSize: 12 }}>{a.date_seance || '—'}</td>
                    <td style={{ fontSize: 12 }}>{a.lib_matiere || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {a.present
                        ? <span className="sms-badge badge-success"><i className="fas fa-check"></i></span>
                        : <span className="sms-badge badge-danger"><i className="fas fa-times"></i></span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {a.present ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                        : a.justifiee
                          ? <span className="sms-badge badge-success">{t.pages.absences.yes}</span>
                          : <span className="sms-badge badge-warning">{t.pages.absences.no}</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.motif || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {!a.present && (
                        <button
                          className={`sms-btn sms-btn-sm ${a.justifiee ? 'sms-btn-outline' : 'sms-btn-primary'}`}
                          style={{ fontSize: 11 }}
                          disabled={justifying === a.code_absence}
                          onClick={() => handleJustify(a)}
                        >
                          {justifying === a.code_absence
                            ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
                            : a.justifiee
                              ? <><i className="fas fa-undo"></i> {t.pages.absences.unjustify}</>
                              : <><i className="fas fa-check"></i> {t.pages.absences.justify}</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Répartition par matière */}
      {stats?.par_matiere?.length > 0 && (
        <div className="sms-card" style={{ marginTop: 16 }}>
          <div className="sms-card-header">
            <span className="sms-card-title">
              <i className="fas fa-chart-bar" style={{ marginRight: 8 }}></i>
              {t.pages.absences.bySubject}
            </span>
          </div>
          <div style={{ padding: '4px 18px 18px' }}>
            {stats.par_matiere.map(m => {
              const maxH = Math.max(...stats.par_matiere.map(x => x.heures));
              const pct  = maxH > 0 ? (m.heures / maxH) * 100 : 0;
              return (
                <div key={m.matiere} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{m.matiere}</span>
                    <strong style={{ color: '#c62828' }}>{m.heures}h</strong>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-darkest)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#c62828', borderRadius: 3, transition: 'width .4s' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal motif justification */}
      {motifModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setMotifModal(null)}>
          <div className="sms-modal" style={{ maxWidth: 440 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className="fas fa-check-circle" style={{ marginRight: 8, color: 'var(--green)' }}></i>
                {t.pages.absences.justify}
              </div>
              <button className="sms-btn-icon" onClick={() => setMotifModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="sms-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {motifModal.lib_matiere} — {motifModal.date_seance}
              </p>
              <label className="sms-label">{t.fields.obs}</label>
              <textarea
                className="sms-input"
                rows={3}
                placeholder={t.pages.absences.motifPlaceholder}
                value={motif}
                onChange={e => setMotif(e.target.value)}
              />
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setMotifModal(null)}>
                {t.common.cancel}
              </button>
              <button
                className="sms-btn sms-btn-primary sms-btn-sm"
                onClick={() => handleJustify(motifModal)}
                disabled={justifying === motifModal.code_absence}
              >
                {justifying === motifModal.code_absence
                  ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                  : <><i className="fas fa-check"></i> {t.pages.absences.justify}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
