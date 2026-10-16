/**
 * pages/Bulletins.jsx — Génération des bulletins PDF par classe.
 * Moyennes, rangs et appréciations viennent de /api/evaluations/moyennes/ (api/notes.py) :
 * les bulletins affichent exactement les mêmes chiffres que la page Notes.
 */
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { usePdfPreview } from '../context/PdfPreviewContext';
import { LoadingState } from '../components/ApiState';
import { generateBulletin } from '../services/pdfService';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { periodeOptions, parsePeriodeChoice, rangLabel } from '../utils/notes';

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
  const [resultats,     setResultats]     = useState([]);
  const [etab,          setEtab]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  // Chargements initiaux
  useEffect(() => {
    Promise.all([
      api.get('/api/classes/?page_size=200'),
      api.get('/api/periodes/?page_size=200'),
      api.get('/api/etablissements/current/').catch(() => ({ data: null })),
    ]).then(([cRes, pRes, etabRes]) => {
      setClasses(cRes.data.results ?? cRes.data);
      setPeriodes(pRes.data.results ?? pRes.data);
      setEtab(etabRes.data);
    });
  }, []);

  // Élèves inscrits dans la classe + résultats calculés par le backend.
  useEffect(() => {
    const choix = parsePeriodeChoice(selectedPeriode);
    if (!selectedClasse) { setInscriptions([]); setResultats([]); return; }
    setLoading(true);
    // Année de la période choisie (ou « Année complète ») : seuls ses inscrits sont listés.
    const codeAnnee = choix?.code_annee
      || periodes.find(p => String(p.code_periode) === String(choix?.code_periode))?.code_annee;
    Promise.all([
      api.get('/api/inscriptions/', { params: { code_classe: selectedClasse, page_size: 500, ...(codeAnnee ? { code_annee: codeAnnee } : {}) } }),
      choix
        ? api.get('/api/evaluations/moyennes/', { params: { code_classe: selectedClasse, ...choix } })
        : Promise.resolve({ data: [] }),
    ]).then(([iRes, mRes]) => {
      setInscriptions(iRes.data.results ?? iRes.data);
      setResultats(mRes.data ?? []);
    }).catch(() => toast.error(t.errors.loading))
    .finally(() => setLoading(false));
  }, [selectedClasse, selectedPeriode]);

  // Élèves classés (ordre du rang), puis inscrits sans aucune note sur la période.
  const students = (() => {
    const avecNotes = resultats.map(r => {
      const insc = inscriptions.find(i => (i.mle_etudiant?.mle_etudiant || i.mle_etudiant) === r.mle_etudiant);
      return {
        mle: r.mle_etudiant,
        nom: insc?.nom_etudiant || r.nom_etudiant,
        prenom: insc?.prenom_etudiant || '',
        resultat: r,
        nbEvals: r.matieres.reduce((s, m) => s + (m.nb_evals || 0), 0),
      };
    });
    const vus = new Set(avecNotes.map(s => s.mle));
    const sansNotes = inscriptions
      .map(i => ({ mle: i.mle_etudiant?.mle_etudiant || i.mle_etudiant, nom: i.nom_etudiant, prenom: i.prenom_etudiant || '' }))
      .filter(i => i.mle && !vus.has(i.mle))
      .map(i => ({ ...i, nom: i.nom || i.mle, resultat: null, nbEvals: 0 }));
    return [...avecNotes, ...sansNotes];
  })();

  const classMoyenne = resultats[0]?.moyenne_classe ?? null;
  const periodeLabel = periodeOptions(periodes).find(o => o.value === selectedPeriode)?.label || '';

  const buildBulletin = async (student) => {
    let etud = {};
    try { etud = (await api.get(`/api/etudiants/${student.mle}/`)).data; } catch {}
    return generateBulletin(
      { ...etud, mle_etudiant: student.mle, nom: etud.nom || student.nom, prenom: etud.prenom || student.prenom,
        lib_classe: classeLabel },
      student.resultat,
      periodeLabel,
      etab,
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
    const eligible = students.filter(s => s.resultat);
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
        {students.some(s => s.resultat) && (
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
              onChange={e => setSelectedClasse(e.target.value)}>
              <option value="">{t.common.select}</option>
              {classes.map(c => (
                <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="sms-label">{lang === 'en' ? 'Period or full year' : 'Période ou année complète'} *</label>
            <select className="sms-input" value={selectedPeriode} onChange={e => setSelectedPeriode(e.target.value)}>
              <option value="">{t.common.select}</option>
              {periodeOptions(periodes).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {classMoyenne !== null && (
            <div style={{ flex: '0 0 auto', padding: '8px 16px', background: 'var(--bg-darkest)',
              borderRadius: 8, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <i className="fas fa-chart-line" style={{ color: '#1a3c5e' }}></i>
              <span style={{ color: 'var(--text-muted)' }}>{t.common.classAvg} :</span>
              <strong style={{ color: '#1a3c5e', fontSize: 16 }}>{classMoyenne.toFixed(2)}/20</strong>
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
      ) : !selectedPeriode ? (
        <div className="sms-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-calendar-alt" style={{ fontSize: 44, marginBottom: 14, opacity: .4 }}></i>
          <p style={{ margin: 0 }}>
            {lang === 'en' ? 'Select a period or the full year' : "Sélectionnez une période ou l'année complète"}
          </p>
        </div>
      ) : students.length === 0 ? (
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
              {classeLabel} — {students.length} {labels.studentLabelPlural.toLowerCase()}
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
                {students.map(s => (
                  <tr key={s.mle}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>
                      {s.resultat ? rangLabel(s.resultat) : '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.nom} {s.prenom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.mle}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="sms-badge badge-secondary">{s.nbEvals}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.resultat?.moyenne_generale != null
                        ? <strong style={{ color: moyColor(s.resultat.moyenne_generale), fontSize: 15 }}>
                            {s.resultat.moyenne_generale.toFixed(2)}/20
                            {s.resultat.appreciation_generale && <span style={{ fontSize: 11, marginLeft: 6 }}>({s.resultat.appreciation_generale})</span>}
                          </strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="sms-btn sms-btn-sm"
                        style={{
                          background: s.resultat ? '#c62828' : 'var(--bg-darkest)',
                          color: s.resultat ? '#fff' : 'var(--text-muted)',
                          border: 'none', fontSize: 11,
                        }}
                        onClick={() => s.resultat && generateOne(s)}
                        disabled={generating === s.mle || !s.resultat}
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
