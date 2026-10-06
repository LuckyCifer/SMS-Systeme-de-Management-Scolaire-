/**
 * pages/Bulletins.jsx — Génération des bulletins PDF par classe
 */
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { LoadingState } from '../components/ApiState';
import { generateBulletin } from '../services/pdfService';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const moyColor = v => {
  if (v >= 16) return '#2e7d32';
  if (v >= 12) return '#1a3c5e';
  if (v >= 10) return '#e65100';
  return '#c62828';
};

// Téléchargement direct (sans passer par l'aperçu) — utilisé pour la génération en lot,
// où prévisualiser un par un n'a pas de sens.
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function Bulletins() {
  const { t, toast, lang } = useApp();
  const { showPreview } = usePdfPreview();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [classes,       setClasses]       = useState([]);
  const [periodes,      setPeriodes]      = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('');
  const [inscriptions,  setInscriptions]  = useState([]);
  const [evals,         setEvals]         = useState([]);
  const [etab,          setEtab]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  // Chargements initiaux
  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=200'),
      api.get('/api/periodes/?page_size=50'),
      api.get('/api/etablissements/current/').catch(() => ({ data: null })),
    ]).then(([cRes, pRes, etabRes]) => {
      setClasses(cRes.data.results ?? cRes.data);
      setPeriodes(pRes.data.results ?? pRes.data);
      setEtab(etabRes.data);
    });
  }, []);

  // Charger étudiants de la classe + leurs évaluations
  useEffect(() => {
    if (!selectedClasse) { setInscriptions([]); setEvals([]); return; }
    setLoading(true);
    const params = { code_classe: selectedClasse, page_size: 500 };
    if (selectedPeriode) params.code_periode = selectedPeriode;
    Promise.all([
      api.get(`/api/inscriptions/?code_classe=${selectedClasse}&page_size=300`),
      api.get('/api/evaluations/', { params }),
    ]).then(([iRes, eRes]) => {
      setInscriptions(iRes.data.results ?? iRes.data);
      setEvals(eRes.data.results ?? eRes.data);
    }).catch(() => toast.error(t.errors.loading))
    .finally(() => setLoading(false));
  }, [selectedClasse, selectedPeriode]);

  // Construire données par étudiant
  const studentData = inscriptions.map(insc => {
    const mle = typeof insc.mle_etudiant === 'object'
      ? insc.mle_etudiant?.mle_etudiant
      : insc.mle_etudiant;
    const nom    = insc.nom_etudiant || mle;
    const prenom = insc.prenom_etudiant || '';
    const myEvals = evals.filter(e => {
      const eMle = typeof e.mle_etudiant === 'object' ? e.mle_etudiant?.mle_etudiant : e.mle_etudiant;
      return eMle === mle;
    });
    const notes = myEvals.map(e => parseFloat(e.note)).filter(n => !isNaN(n));
    const moy   = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2) : null;
    return { mle, nom, prenom, myEvals, moy, nbEvals: myEvals.length };
  }).sort((a, b) => {
    if (a.moy === null) return 1;
    if (b.moy === null) return -1;
    return parseFloat(b.moy) - parseFloat(a.moy);
  });

  // Rang calculé par ordre de moyenne
  const withRangs = studentData.map((s, i) => ({
    ...s,
    rang: s.moy !== null ? i + 1 : null,
  }));

  const classMoyenne = (() => {
    const validMoys = withRangs.filter(s => s.moy !== null).map(s => parseFloat(s.moy));
    return validMoys.length ? (validMoys.reduce((a, b) => a + b, 0) / validMoys.length).toFixed(2) : null;
  })();

  const buildBulletin = async (student) => {
    const periodeLabel = periodes.find(p => p.code_periode === selectedPeriode)?.lib_periode || '';
    return generateBulletin(
      { mle_etudiant: student.mle, nom: student.nom, prenom: student.prenom },
      student.myEvals,
      periodeLabel,
      etab,
      {
        rang:          student.rang,
        totalEleves:   withRangs.length,
        classMoyenne,
      }
    );
  };

  const generateOne = async (student) => {
    setGenerating(student.mle);
    try {
      const { blob, filename } = await buildBulletin(student);
      showPreview(blob, filename);
    } catch { toast.error(t.errors.saving); }
    finally  { setGenerating(null); }
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    const eligible = withRangs.filter(s => s.nbEvals > 0);
    for (const s of eligible) {
      try {
        const { blob, filename } = await buildBulletin(s);
        downloadBlob(blob, filename);
      } catch {}
      // petit délai pour éviter saturation
      await new Promise(r => setTimeout(r, 600));
    }
    setGeneratingAll(false);
    toast.success(`${eligible.length} ${t.toast.exported}`);
  };

  const classeLabel = classes.find(c => c.code_classe === selectedClasse)?.lib_classe || '';

  return (
    <div className="sms-content">
      <div className="sms-page-header">
        <div>
          <h1 className="sms-page-title">
            <i className="fas fa-file-pdf" style={{ marginRight: 10, color: '#c62828' }}></i>
            {t.pages.bulletins.title}
          </h1>
          <p className="sms-page-subtitle">{t.pages.bulletins.subtitle}</p>
        </div>
        {withRangs.some(s => s.nbEvals > 0) && (
          <button
            className="sms-btn sms-btn-primary"
            onClick={generateAll}
            disabled={generatingAll}
            style={{ whiteSpace: 'nowrap' }}
          >
            {generatingAll
              ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.pages.bulletins.generating}</>
              : <><i className="fas fa-file-pdf"></i> {t.pages.bulletins.generateAll}</>}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label className="sms-label">{t.fields.classe} *</label>
            <select className="sms-input" value={selectedClasse}
              onChange={e => { setSelectedClasse(e.target.value); setSelectedPeriode(''); }}>
              <option value="">{t.common.select}</option>
              {classes.map(c => (
                <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="sms-label">{t.pages.bulletins.selectPeriod}</label>
            <select className="sms-input" value={selectedPeriode} onChange={e => setSelectedPeriode(e.target.value)}>
              <option value="">{t.pages.bulletins.allPeriods}</option>
              {periodes.map(p => (
                <option key={p.code_periode} value={p.code_periode}>{p.lib_periode}</option>
              ))}
            </select>
          </div>
          {classMoyenne && (
            <div style={{ flex: '0 0 auto', padding: '8px 16px', background: 'var(--bg-darkest)',
              borderRadius: 8, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <i className="fas fa-chart-line" style={{ color: '#1a3c5e' }}></i>
              <span style={{ color: 'var(--text-muted)' }}>{t.common.classAvg} :</span>
              <strong style={{ color: '#1a3c5e', fontSize: 16 }}>{classMoyenne}/20</strong>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      {!selectedClasse ? (
        <div className="sms-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-door-open" style={{ fontSize: 44, marginBottom: 14, opacity: .4 }}></i>
          <p style={{ margin: 0 }}>
            {lang === 'en'
              ? `Select a class to view its ${labels.studentLabelPlural.toLowerCase()}`
              : `Sélectionnez une classe pour afficher les ${labels.studentLabelPlural.toLowerCase()}`}
          </p>
        </div>
      ) : loading ? (
        <LoadingState />
      ) : withRangs.length === 0 ? (
        <div className="sms-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-users" style={{ fontSize: 44, marginBottom: 14, opacity: .4 }}></i>
          <p style={{ margin: 0 }}>
            {lang === 'en' ? `No ${labels.studentLabel.toLowerCase()} in this class` : `Aucun ${labels.studentLabel.toLowerCase()} dans cette classe`}
          </p>
        </div>
      ) : (
        <div className="sms-card">
          <div className="sms-card-header">
            <span className="sms-card-title">
              <i className="fas fa-users" style={{ marginRight: 8 }}></i>
              {classeLabel} — {withRangs.length} {labels.studentLabelPlural.toLowerCase()}
            </span>
          </div>
          <div className="sms-table-wrap">
            <table className="sms-table">
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: 'center' }}>#</th>
                  <th>{labels.studentLabel}</th>
                  <th style={{ textAlign: 'center' }}>{t.pages.bulletins.colNbEvals}</th>
                  <th style={{ textAlign: 'center' }}>{t.pages.bulletins.colAvg}</th>
                  <th style={{ textAlign: 'center' }}>{t.pages.bulletins.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {withRangs.map(s => (
                  <tr key={s.mle}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>
                      {s.rang ?? '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.nom} {s.prenom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.mle}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="sms-badge badge-secondary">{s.nbEvals}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.moy !== null
                        ? <strong style={{ color: moyColor(parseFloat(s.moy)), fontSize: 15 }}>{s.moy}/20</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="sms-btn sms-btn-sm"
                        style={{
                          background: s.nbEvals > 0 ? '#c62828' : 'var(--bg-darkest)',
                          color: s.nbEvals > 0 ? '#fff' : 'var(--text-muted)',
                          border: 'none', fontSize: 11,
                        }}
                        onClick={() => s.nbEvals > 0 && generateOne(s)}
                        disabled={generating === s.mle || s.nbEvals === 0}
                      >
                        {generating === s.mle
                          ? <div className="sms-spinner" style={{ width: 12, height: 12 }}></div>
                          : <><i className="fas fa-file-pdf"></i> {t.pages.bulletins.generate}</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
