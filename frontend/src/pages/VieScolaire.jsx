/**
 * pages/VieScolaire.jsx — Appel journalier, absences et retards du jour, alertes de seuil.
 *
 * - Appel du jour : appel d'une classe le matin ou l'après-midi (primaire surtout), tout le
 *   monde présent par défaut. Un enseignant ne fait l'appel que dans ses classes.
 * - Absences du jour : vue du surveillant général, toutes classes, appel journalier et appel
 *   par séance confondus, avec justification.
 * - Alertes : élèves ayant atteint un seuil d'heures d'absence non justifiées dans l'année.
 * Calculs et contrôles côté serveur : backend/api/vie_scolaire.py.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { getUser } from '../utils/Auth';
import { classeService } from '../services/endpoints';
import { LoadingState } from '../components/ApiState';

const ROLES_SUIVI = ['SUPER_ADMIN', 'ADMIN', 'SCOLARITE', 'CENSEUR', 'SURVEILLANT_GENERAL', 'DIRECTION'];
const ROLES_JUSTIFICATION = ['SUPER_ADMIN', 'ADMIN', 'SCOLARITE', 'CENSEUR', 'SURVEILLANT_GENERAL'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const STATUTS = [
  { value: 'PRESENT', label: 'Présent', color: 'var(--green)' },
  { value: 'ABSENT',  label: 'Absent',  color: '#ef5350' },
  { value: 'RETARD',  label: 'Retard',  color: 'var(--warning)' },
];
const erreurApi = (err, t) => err.response?.data?.error || err.response?.data?.detail || t.errors.saving;

// ── Appel du jour ─────────────────────────────────────────────────────────────
function AppelDuJour({ labels }) {
  const { t, toast } = useApp();
  const [classe,  setClasse]  = useState('');
  const [date,    setDate]    = useState(aujourdhui());
  const [creneau, setCreneau] = useState('MATIN');
  const [feuille, setFeuille] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const { data: classes } = useApi(useCallback(() => classeService.list({ page_size: 300 }), []));

  useEffect(() => {
    if (!classe) { setFeuille(null); return; }
    setLoading(true);
    api.get('/api/appels/feuille/', { params: { code_classe: classe, date, creneau } })
      .then(res => setFeuille(res.data))
      .catch(err => { setFeuille(null); toast.error(erreurApi(err, t)); })
      .finally(() => setLoading(false));
  }, [classe, date, creneau]);

  const maj = (mle, champs) => setFeuille(f => ({ ...f, eleves: f.eleves.map(e => e.mle_etudiant === mle ? { ...e, ...champs } : e) }));

  const enregistrer = async () => {
    setSaving(true);
    try {
      const res = await api.post('/api/appels/enregistrer/', {
        code_classe: classe, date, creneau,
        lignes: feuille.eleves.map(e => ({ mle_etudiant: e.mle_etudiant, statut: e.statut, minutes_retard: Number(e.minutes_retard) || 0 })),
      });
      toast.success(`Appel enregistré : ${res.data.absents} absent(s).`);
      setFeuille(f => ({ ...f, appel: res.data.appel }));
    } catch (err) { toast.error(erreurApi(err, t)); }
    finally { setSaving(false); }
  };

  const compte = s => (feuille?.eleves || []).filter(e => e.statut === s).length;

  return (
    <div>
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="sms-label">{t.fields.classe}</label>
          <select className="sms-input" value={classe} onChange={e => setClasse(e.target.value)}>
            <option value="">{t.common.select}</option>
            {(classes || []).map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 1 170px' }}>
          <label className="sms-label">{t.fields.date}</label>
          <input type="date" className="sms-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ flex: '0 1 170px' }}>
          <label className="sms-label">Créneau</label>
          <select className="sms-input" value={creneau} onChange={e => setCreneau(e.target.value)}>
            <option value="MATIN">Matin</option>
            <option value="APRES_MIDI">Après-midi</option>
          </select>
        </div>
      </div>

      {!classe ? (
        <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Choisissez une classe pour faire l'appel.
        </div>
      ) : loading || !feuille ? <LoadingState /> : (
        <div className="sms-card">
          <div className="sms-card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="sms-card-title">
              {feuille.eleves.length} {labels.studentLabelPlural.toLowerCase()} · {compte('ABSENT')} absent(s) · {compte('RETARD')} retard(s)
              {feuille.appel
                ? <span className="sms-badge badge-success" style={{ marginLeft: 8 }}>appel déjà fait{feuille.fait_par ? ` (${feuille.fait_par})` : ''}</span>
                : <span className="sms-badge badge-warning" style={{ marginLeft: 8 }}>appel non fait</span>}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tous présents par défaut : indiquez les absents et les retards.</span>
          </div>
          <div className="sms-table-wrap">
            <table className="sms-table" style={{ fontSize: 12 }}>
              <thead><tr><th>{labels.studentLabel}</th><th style={{ textAlign: 'center' }}>Statut</th><th style={{ textAlign: 'center', width: 120 }}>Retard (min)</th></tr></thead>
              <tbody>
                {feuille.eleves.map(e => (
                  <tr key={e.mle_etudiant} style={{ background: e.statut === 'ABSENT' ? 'rgba(239,83,80,.08)' : undefined }}>
                    <td><span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{e.mle_etudiant}</span><strong>{e.nom} {e.prenom}</strong>
                      {e.justifiee && <span className="sms-badge badge-secondary" style={{ marginLeft: 6 }}>justifiée</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {STATUTS.map(s => (
                          <button key={s.value} type="button" onClick={() => maj(e.mle_etudiant, { statut: s.value, minutes_retard: s.value === 'RETARD' ? e.minutes_retard : 0 })}
                            style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${s.color}`, background: e.statut === s.value ? s.color : 'transparent',
                              color: e.statut === s.value ? '#fff' : s.color }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" min="0" max="240" step="5" disabled={e.statut !== 'RETARD'}
                        value={e.statut === 'RETARD' ? (e.minutes_retard || '') : ''}
                        onChange={ev => maj(e.mle_etudiant, { minutes_retard: ev.target.value })}
                        style={{ width: 70, textAlign: 'center', padding: '4px 6px', background: 'var(--bg-darkest)',
                          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', opacity: e.statut === 'RETARD' ? 1 : .4 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="sms-btn sms-btn-outline sms-btn-sm"
              onClick={() => setFeuille(f => ({ ...f, eleves: f.eleves.map(e => ({ ...e, statut: 'PRESENT', minutes_retard: 0 })) }))}>
              {t.common.allPresent}
            </button>
            <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={enregistrer} disabled={saving}>
              {saving ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {t.common.loading}</>
                : <><i className="fas fa-save"></i> Enregistrer l'appel</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Absences et retards du jour ───────────────────────────────────────────────
function AbsencesDuJour({ labels, peutJustifier }) {
  const { t, toast } = useApp();
  const [date, setDate] = useState(aujourdhui());
  const [donnees, setDonnees] = useState(null);

  const charger = useCallback(() => {
    setDonnees(null);
    api.get('/api/vie-scolaire/jour/', { params: { date } })
      .then(res => setDonnees(res.data.lignes))
      .catch(err => { setDonnees([]); toast.error(erreurApi(err, t)); });
  }, [date]);
  useEffect(() => { charger(); }, [charger]);

  const basculer = async (l) => {
    let motif = l.motif;
    if (!l.justifiee) {
      motif = window.prompt('Motif de la justification (certificat médical, convocation…)', l.motif || '');
      if (motif === null) return;
    }
    try {
      await api.post('/api/vie-scolaire/justifier/', { source: l.source, id: l.id, justifiee: !l.justifiee, motif: l.justifiee ? '' : motif });
      charger();
    } catch (err) { toast.error(erreurApi(err, t)); }
  };

  const absences = (donnees || []).filter(l => l.type === 'ABSENCE').length;
  return (
    <div>
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="sms-label">{t.fields.date}</label>
          <input type="date" className="sms-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {donnees && (
          <span style={{ fontSize: 13, paddingBottom: 8 }}>
            <strong style={{ color: '#ef5350' }}>{absences}</strong> absence(s) ·{' '}
            <strong style={{ color: 'var(--warning)' }}>{donnees.length - absences}</strong> retard(s)
          </span>
        )}
      </div>
      {donnees === null ? <LoadingState /> : donnees.length === 0 ? (
        <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucune absence ni aucun retard enregistré ce jour.
        </div>
      ) : (
        <div className="sms-card"><div className="sms-table-wrap">
          <table className="sms-table" style={{ fontSize: 12 }}>
            <thead><tr><th>{t.fields.classe}</th><th>{labels.studentLabel}</th><th>Type</th><th>Quand</th><th>Justification</th></tr></thead>
            <tbody>
              {donnees.map(l => (
                <tr key={`${l.source}-${l.id}`}>
                  <td>{l.lib_classe}</td>
                  <td><strong>{l.eleve}</strong> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.mle_etudiant}</span></td>
                  <td>{l.type === 'ABSENCE'
                    ? <span className="sms-badge badge-danger">Absence</span>
                    : <span className="sms-badge badge-warning">Retard{l.minutes_retard ? ` ${l.minutes_retard} min` : ''}</span>}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{l.quand}</td>
                  <td>
                    {l.justifiee
                      ? <span className="sms-badge badge-success" title={l.motif}>Justifiée{l.motif ? ` — ${l.motif}` : ''}</span>
                      : <span className="sms-badge badge-secondary">Non justifiée</span>}
                    {peutJustifier && (
                      <button className="sms-btn sms-btn-outline sms-btn-sm" style={{ marginLeft: 8 }} onClick={() => basculer(l)}>
                        {l.justifiee ? 'Annuler' : 'Justifier'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}

// ── Alertes de seuil ──────────────────────────────────────────────────────────
function Alertes({ labels }) {
  const { t, toast } = useApp();
  const [seuils, setSeuils] = useState({ seuil_avertissement: 10, seuil_conseil: 20, heures_demi_journee: 4 });
  const [donnees, setDonnees] = useState(null);
  const charger = () => {
    setDonnees(null);
    api.get('/api/vie-scolaire/alertes/', { params: seuils })
      .then(res => setDonnees(res.data.eleves))
      .catch(err => { setDonnees([]); toast.error(erreurApi(err, t)); });
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const champ = (nom, libelle) => (
    <div style={{ flex: '0 1 190px' }}>
      <label className="sms-label">{libelle}</label>
      <input type="number" min="0" className="sms-input" value={seuils[nom]} onChange={e => setSeuils(s => ({ ...s, [nom]: e.target.value }))} />
    </div>
  );
  return (
    <div>
      <div className="sms-card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {champ('seuil_avertissement', 'Avertissement à (heures)')}
        {champ('seuil_conseil', 'Conseil de discipline à (heures)')}
        {champ('heures_demi_journee', 'Heures par demi-journée')}
        <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={charger}><i className="fas fa-sync"></i> Actualiser</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6 }}>
        Heures d'absence <strong>non justifiées</strong> de l'année : séances manquées + demi-journées d'absence à l'appel journalier.
      </p>
      {donnees === null ? <LoadingState /> : donnees.length === 0 ? (
        <div className="sms-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucun {labels.studentLabel.toLowerCase()} n'atteint le seuil d'avertissement.
        </div>
      ) : (
        <div className="sms-card"><div className="sms-table-wrap">
          <table className="sms-table" style={{ fontSize: 12 }}>
            <thead><tr><th>{labels.studentLabel}</th><th style={{ textAlign: 'center' }}>Heures non justifiées</th><th style={{ textAlign: 'center' }}>Retards</th><th>Niveau</th></tr></thead>
            <tbody>
              {donnees.map(e => (
                <tr key={e.mle_etudiant}>
                  <td><strong>{e.eleve}</strong> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.mle_etudiant}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{e.heures_non_justifiees} h</td>
                  <td style={{ textAlign: 'center' }}>{e.retards}</td>
                  <td>{e.niveau === 'CONSEIL_DISCIPLINE'
                    ? <span className="sms-badge badge-danger">Conseil de discipline</span>
                    : <span className="sms-badge badge-warning">Avertissement</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VieScolaire() {
  const { lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const role = getUser()?.role;
  const suivi = ROLES_SUIVI.includes(role);
  const onglets = [
    { key: 'appel', label: 'Appel du jour', icon: 'fas fa-clipboard-list' },
    ...(suivi ? [
      { key: 'jour', label: 'Absences du jour', icon: 'fas fa-user-clock' },
      { key: 'alertes', label: 'Alertes', icon: 'fas fa-exclamation-triangle' },
    ] : []),
  ];
  const [onglet, setOnglet] = useState(suivi ? 'jour' : 'appel');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fas fa-user-check text-green" style={{ marginRight: 10, fontSize: 22 }}></i>Vie scolaire</h1>
          <p className="page-subtitle">Appel, absences et retards du jour, alertes d'assiduité</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {onglets.map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)}
            className={`sms-btn sms-btn-sm ${onglet === o.key ? 'sms-btn-primary' : 'sms-btn-outline'}`}>
            <i className={o.icon}></i> {o.label}
          </button>
        ))}
      </div>
      {onglet === 'appel' && <AppelDuJour labels={labels} />}
      {onglet === 'jour' && suivi && <AbsencesDuJour labels={labels} peutJustifier={ROLES_JUSTIFICATION.includes(role)} />}
      {onglet === 'alertes' && suivi && <Alertes labels={labels} />}
    </div>
  );
}
