/**
 * components/GrilleCoefficients.jsx — Grille des coefficients (primaire / secondaire).
 *
 * Un coefficient par année, niveau, série et matière : toutes les classes d'un même
 * niveau et d'une même série (2nde A1, 2nde A2…) le partagent pendant toute l'année.
 * Les moyennes (backend api/notes.py) l'utilisent ; une matière absente de la grille
 * compte pour 1 et la page Notes le signale.
 */
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { useEtablissement } from '../hooks/useEtablissement';
import { getUser } from '../utils/Auth';
import { useTr } from '../hooks/useTr';
import { anneeService, niveauScolaireService, matiereService, coefficientService, classeService } from '../services/endpoints';
import { LoadingState } from './ApiState';
import { LIB_SERIE } from '../utils/notes';

const ROLES_ECRITURE = ['SUPER_ADMIN', 'ADMIN', 'SCOLARITE', 'CENSEUR'];

export default function GrilleCoefficients() {
  const { t, toast, anneeActive } = useApp();
  const tr = useTr();
  // Libellé d'une colonne de série (sans série : une seule colonne « Coefficient »).
  const libSerie = s => (s ? (LIB_SERIE[s] || s) : 'Coefficient');
  // Grille de l'école connectée (celle du compte, ou celle choisie par le SUPER_ADMIN).
  const { etab } = useEtablissement();
  const typeEtab = etab?.type_etab;
  const systeme  = etab?.systeme;
  const peutModifier = ROLES_ECRITURE.includes(getUser()?.role);

  const [codeAnnee, setCodeAnnee] = useState(anneeActive?.code_annee || '');
  const [niveau,    setNiveau]    = useState('');
  const [grille,    setGrille]    = useState(null);   // réponse /grille/
  const [valeurs,   setValeurs]   = useState({});     // { code_matiere: { serie: coef } }
  const [ajoutees,  setAjoutees]  = useState([]);     // matières ajoutées à la main
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [source,    setSource]    = useState('');

  const { data: annees }   = useApi(useCallback(() => anneeService.list({ page_size: 50 }), []));
  const { data: niveaux }  = useApi(useCallback(() => typeEtab ? niveauScolaireService.list({
    type_etab: typeEtab, ...(systeme && systeme !== 'BILINGUE' ? { systeme } : {}), page_size: 100,
  }) : Promise.resolve({ data: [] }), [typeEtab, systeme]), [typeEtab, systeme]);

  const { data: matieres } = useApi(useCallback(() => matiereService.list({ page_size: 500 }), []));
  // Niveaux proposés : ceux où l'école a des classes (un lycée technique ne voit pas la 6ème
  // du général) ; tous les niveaux de son type tant qu'elle n'a aucune classe.
  const { data: classesEcole } = useApi(useCallback(() => classeService.list({ page_size: 1000 }), []));
  const niveauxEcole = new Set((classesEcole || []).map(c => c.niveau_scolaire).filter(Boolean));
  const niveauxProposes = (niveaux || []).filter(n => !niveauxEcole.size || niveauxEcole.has(n.code_niveau));

  const charger = useCallback(async () => {
    if (!codeAnnee || !niveau) { setGrille(null); return; }
    setLoading(true);
    try {
      const { data } = await coefficientService.grille({ code_annee: codeAnnee, niveau_scolaire: niveau });
      setGrille(data);
      setValeurs(Object.fromEntries(data.matieres.map(m => [m.code_matiere, { ...m.coefs }])));
      setAjoutees([]);
    } catch (err) {
      toast.error(err.response?.data?.error || t.errors.loading);
    } finally {
      setLoading(false);
    }
  }, [codeAnnee, niveau]);

  useEffect(() => { charger(); }, [charger]);

  if (typeEtab === 'SUPERIEUR') {
    return (
      <div className="sms-card" style={{ padding: 24, color: 'var(--text-muted)' }}>
        {tr("Au supérieur, le poids d'une matière est son nombre de crédits, saisi dans la page ",
            "In higher education, a subject's weight is its number of credits, entered on the ")}
        <strong>{t.nav.courses}</strong>{tr('.', ' page.')}
      </div>
    );
  }

  const lignes = [
    ...(grille?.matieres || []),
    ...ajoutees.map(code => ({
      code_matiere: code, enseignee: false,
      lib_matiere: (matieres || []).find(m => m.code_matiere === code)?.lib_matiere || code,
    })),
  ];
  const series = grille?.series || [''];
  const setCoef = (code, serie, v) => setValeurs(prev => ({ ...prev, [code]: { ...(prev[code] || {}), [serie]: v } }));
  const disponibles = (matieres || []).filter(m => !lignes.some(l => l.code_matiere === m.code_matiere));
  const classesSansSerie = (grille?.classes || []).filter(c => series[0] !== '' && !c.serie);

  const enregistrer = async () => {
    setSaving(true);
    try {
      const payload = lignes.flatMap(l => series.map(serie => ({
        code_matiere: l.code_matiere, serie, coef: valeurs[l.code_matiere]?.[serie] ?? '',
      })));
      const { data } = await coefficientService.enregistrer({ code_annee: codeAnnee, niveau_scolaire: niveau, lignes: payload });
      toast.success(tr(`Grille enregistrée : ${data.crees} ajouté(s), ${data.modifies} modifié(s), ${data.supprimes} retiré(s)`,
                       `Grid saved: ${data.crees} added, ${data.modifies} updated, ${data.supprimes} removed`));
      charger();
    } catch (err) {
      toast.error(err.response?.data?.error || t.errors.saving);
    } finally {
      setSaving(false);
    }
  };

  const copier = async () => {
    try {
      const { data } = await coefficientService.copier({ source_annee: source, cible_annee: codeAnnee });
      toast.success(tr(`${data.copies} coefficient(s) copié(s) depuis ${source}`, `${data.copies} coefficient(s) copied from ${source}`));
      charger();
    } catch (err) {
      toast.error(err.response?.data?.error || t.errors.saving);
    }
  };

  const inputStyle = { width: 64, textAlign: 'center', padding: '4px 6px', background: 'var(--bg-darkest)',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' };

  return (
    <div>
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 1 180px' }}>
            <label className="sms-label">{t.fields.annee}</label>
            <select className="sms-input" value={codeAnnee} onChange={e => setCodeAnnee(e.target.value)}>
              <option value="">{t.common.select}</option>
              {(annees || []).map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label className="sms-label">{t.fields.niveau}</label>
            <select className="sms-input" value={niveau} onChange={e => setNiveau(e.target.value)}>
              <option value="">{t.common.select}</option>
              {niveauxProposes.map(n => <option key={n.code_niveau} value={n.code_niveau}>{n.lib_niveau}</option>)}
            </select>
          </div>
          {peutModifier && codeAnnee && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginLeft: 'auto' }}>
              <div>
                <label className="sms-label">{tr('Copier la grille de', 'Copy the grid from')}</label>
                <select className="sms-input" value={source} onChange={e => setSource(e.target.value)} style={{ minWidth: 140 }}>
                  <option value="">{t.common.select}</option>
                  {(annees || []).filter(a => a.code_annee !== codeAnnee)
                    .map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
                </select>
              </div>
              <button className="sms-btn sms-btn-outline sms-btn-sm" disabled={!source} onClick={copier}
                title={tr('Copie tous les niveaux ; les cases déjà remplies ne sont pas écrasées', 'Copies every level; cells already filled in are not overwritten')}>
                <i className="fas fa-copy"></i> {tr('Copier', 'Copy')}
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>
          {tr("Un coefficient par matière et par série, valable toute l'année pour toutes les classes de ce niveau. Case vide = matière comptée avec le coefficient 1 (signalé dans la page Notes).",
              'One coefficient per subject and series, valid all year for every class of this level. Empty cell = subject counted with coefficient 1 (flagged on the Grades page).')}
        </p>
      </div>

      {!codeAnnee || !niveau ? (
        <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          {tr(`Choisissez une année et un niveau pour afficher la grille de coefficients de ${etab?.lib_etab || 'votre établissement'}.`,
              `Choose a year and a level to display the coefficient grid of ${etab?.lib_etab || 'your school'}.`)}
        </div>
      ) : loading || !grille ? <LoadingState /> : (
        <div className="sms-card">
          {(grille.classes || []).length > 0 && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              {tr('Classes concernées', 'Classes concerned')} : {grille.classes.map(c => `${c.lib_classe}${c.serie ? ` (${libSerie(c.serie)})` : ''}`).join(' · ')}
              {classesSansSerie.length > 0 && (
                <div style={{ color: 'var(--warning)', marginTop: 4 }}>
                  <i className="fas fa-exclamation-triangle"></i> {tr("Sans série (coefficient 1 partout tant qu'elle n'est pas renseignée dans Classes) :", 'No series (coefficient 1 everywhere until it is set in Classes):')}
                  {' '}{classesSansSerie.map(c => c.lib_classe).join(', ')}
                </div>
              )}
            </div>
          )}
          <div className="sms-table-wrap">
            <table className="sms-table">
              <thead>
                <tr>
                  <th>{t.fields.matiere}</th>
                  {series.map(s => <th key={s} style={{ textAlign: 'center' }}>{libSerie(s)}</th>)}
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr><td colSpan={series.length + 1} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    {tr('Aucune matière enseignée à ce niveau cette année. Ajoutez-en une ci-dessous.', 'No subject taught at this level this year. Add one below.')}
                  </td></tr>
                ) : lignes.map(l => (
                  <tr key={l.code_matiere}>
                    <td>
                      <strong>{l.lib_matiere}</strong>
                      {!l.enseignee && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{tr('(aucun cours à ce niveau)', '(no course at this level)')}</span>}
                    </td>
                    {series.map(s => (
                      <td key={s} style={{ textAlign: 'center' }}>
                        <input type="number" min="1" max="20" step="1" style={inputStyle} disabled={!peutModifier}
                          value={valeurs[l.code_matiere]?.[s] ?? ''}
                          onChange={e => setCoef(l.code_matiere, s, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {peutModifier && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="sms-input" style={{ width: 'auto', minWidth: 220, height: 34, fontSize: 12 }} value=""
                onChange={e => e.target.value && setAjoutees(prev => [...prev, e.target.value])}>
                <option value="">{tr('+ Ajouter une matière…', '+ Add a subject…')}</option>
                {disponibles.map(m => <option key={m.code_matiere} value={m.code_matiere}>{m.lib_matiere}</option>)}
              </select>
              <button className="sms-btn sms-btn-primary sms-btn-sm" style={{ marginLeft: 'auto' }} disabled={saving} onClick={enregistrer}>
                {saving ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                  : <><i className="fas fa-save"></i> {tr('Enregistrer la grille', 'Save grid')}</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
