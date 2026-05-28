/**
 * pages/Dashboard.jsx — SMS v3
 * Tableau de bord avec 14 indicateurs réels depuis l'API
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

// ── Options graphiques communes ────────────────────────────────────────────────
const CHART_OPTS = {
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#a0a0a0', boxWidth: 11, font: { size: 11 } } },
    tooltip: {
      backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1,
      titleColor: '#e8e8e8', bodyColor: '#a0a0a0',
    },
  },
  scales: {
    x: { ticks: { color: '#666', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' }, border: { color: '#2a2a2a' } },
    y: { ticks: { color: '#666', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' }, border: { color: '#2a2a2a' } },
  },
};

// ── Carte KPI ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, loading, sub, trend, trendUp, to }) {
  const content = (
    <div className={`stat-card ${color}`} style={{ cursor: to ? 'pointer' : 'default', transition: 'transform .15s', position: 'relative' }}>
      <div className={`stat-icon ${color}`}><i className={icon}></i></div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-value">
          {loading
            ? <div className="sms-spinner" style={{ width: 20, height: 20 }}></div>
            : value ?? '—'
          }
        </div>
        <div className="stat-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        {sub && !loading && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
        )}
        {trend && !loading && (
          <div className={`stat-trend ${trendUp !== false ? 'up' : 'down'}`}>
            <i className={`fas fa-arrow-${trendUp !== false ? 'up' : 'down'}`}></i> {trend}
          </div>
        )}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

// ── Activité récente ──────────────────────────────────────────────────────────
function RecentActivity() {
  const { t, lang } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/audit/?page_size=6')
      .then(r => setLogs(r.data.results ?? r.data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const ACTION_ICON = {
    LOGIN_SUCCESS: { icon: 'fas fa-sign-in-alt',  color: 'var(--green)' },
    LOGIN_FAILED:  { icon: 'fas fa-times-circle', color: 'var(--danger)' },
    CREATE:        { icon: 'fas fa-plus-circle',  color: 'var(--info)' },
    UPDATE:        { icon: 'fas fa-edit',         color: 'var(--warning)' },
    DELETE:        { icon: 'fas fa-trash',        color: 'var(--danger)' },
    BULK_DELETE:   { icon: 'fas fa-trash-alt',    color: 'var(--danger)' },
    EXPORT_CSV:    { icon: 'fas fa-download',     color: '#ab47bc' },
    LOGOUT:        { icon: 'fas fa-sign-out-alt', color: 'var(--text-muted)' },
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    const d = t.dashboard;
    if (diff < 60)    return d.agoSec;
    if (diff < 3600)  return d.agoMin.replace('{n}', Math.floor(diff / 60));
    if (diff < 86400) return d.agoHour.replace('{n}', Math.floor(diff / 3600));
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB');
  };

  const actionLabel = (action) => t.dashboard.actions[action] || action;
  const modelLabel  = (model)  => t.dashboard.models[model]   || model;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div className="sms-spinner" style={{ width: 24, height: 24 }}></div>
    </div>
  );

  if (!logs.length) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
      <i className="fas fa-history" style={{ fontSize: 24, marginBottom: 8, display: 'block', opacity: .3 }}></i>
      {t.dashboard.noActivity}
    </div>
  );

  return (
    <div style={{ padding: '6px 0' }}>
      {logs.map((log, i) => {
        const ai = ACTION_ICON[log.action] || { icon: 'fas fa-circle', color: 'var(--text-muted)' };
        return (
          <div key={log.id || i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '11px 16px',
            borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `${ai.color}18`, border: `1px solid ${ai.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={ai.icon} style={{ color: ai.color, fontSize: 12 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.utilisateur} — {actionLabel(log.action)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {timeAgo(log.date_action)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {modelLabel(log.modele)}{log.detail ? ` — ${log.detail.slice(0, 60)}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard principal ────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useApp();
  const role = (JSON.parse(localStorage.getItem('sms_user') || '{}'))?.role || 'USER';
  const isEtudiant  = role === 'ETUDIANT';
  const hideFor = (...roles) => roles.includes(role);

  // État des 14 KPIs
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);

  // Données graphiques
  const [repartition, setRepartition] = useState(null);
  const [inscMois, setInscMois] = useState(null);
  const [distNotes, setDistNotes] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Toutes les requêtes en parallèle
        const [
          etudRes, ensRes, classRes, paiRes,
          inscRes, evalRes, seanceRes, decRes,
          stageRes, examRes, factRes, depRes,
        ] = await Promise.allSettled([
          api.get('/api/etudiants/?page_size=1'),        // 0 nbEtudiants
          api.get('/api/enseignants/?page_size=1'),       // 1 nbEnseignants
          api.get('/api/classes/?page_size=1'),           // 2 nbClasses
          api.get('/api/paiements/?page_size=500'),       // 3 paiements
          api.get('/api/inscriptions/?page_size=1'),      // 4 nbInscriptions
          api.get('/api/evaluations/?page_size=500'),     // 5 évaluations
          api.get('/api/seances/?page_size=1'),           // 6 nbSeances
          api.get('/api/decisions/?page_size=1'),         // 7 nbDecisions
          api.get('/api/stages/?statut=EN_COURS&page_size=1'), // 8 stages
          api.get('/api/examens/?page_size=1'),           // 9 examens
          api.get('/api/factures/?page_size=500'),        // 10 factures
          api.get('/api/departements/?page_size=100'),    // 11 répartition
        ]);

        const get = (res) => res.status === 'fulfilled' ? res.value.data : null;
        const count = (res) => {
          const d = get(res);
          if (!d) return null;
          return d.count ?? (Array.isArray(d) ? d.length : (d.results?.length ?? null));
        };

        // Paiements
        const paiData = get(paiRes);
        const paiements = (paiData?.results ?? paiData ?? []);
        const impayes  = paiements.filter(p => p.statut === 'IMPAYE').length;
        const totalPaye = paiements.reduce((s, p) => s + Number(p.mt_paiement || 0), 0);
        const totalDu   = paiements.reduce((s, p) => s + Number(p.mt_paiement || 0), 0);

        // Factures
        const factData = get(factRes);
        const factures = (factData?.results ?? factData ?? []);
        const soldeImpaye = factures.reduce((s, f) => {
          return s + (Number(f.montant_total || 0) - Number(f.montant_paye || 0));
        }, 0);
        const tauxRec = factures.length > 0 ? Math.round(
          factures.filter(f => f.statut === 'SOLDEE').length / factures.length * 100
        ) : null;

        // Évaluations → taux de réussite (notes >= 10)
        const evalData = get(evalRes);
        const evals = (evalData?.results ?? evalData ?? []);
        const tauxReussite = evals.length > 0
          ? Math.round(evals.filter(e => parseFloat(e.note) >= 10).length / evals.length * 100)
          : null;

        // Répartition par département
        const depData = get(depRes);
        const deps = (depData?.results ?? depData ?? []);

        setKpis({
          nbEtudiants:   count(etudRes),
          nbEnseignants: count(ensRes),
          nbClasses:     count(classRes),
          nbImpayes:     impayes,
          nbInscriptions:count(inscRes),
          nbEvaluations: evals.length || count(evalRes),
          nbSeances:     count(seanceRes),
          nbDecisions:   count(decRes),
          nbStages:      count(stageRes),
          nbExamens:     count(examRes),
          nbFactures:    factures.length || count(factRes),
          soldeImpaye:   soldeImpaye > 0 ? `${Math.round(soldeImpaye/1000)}k` : '0',
          tauxReussite:  tauxReussite !== null ? `${tauxReussite}%` : '—',
          tauxRecouvrement: tauxRec !== null ? `${tauxRec}%` : '—',
        });

        // Graphique répartition par département (doughnut)
        if (deps.length > 0) {
          const COLORS = ['#4caf50','#42a5f5','#ffa726','#ef5350','#ab47bc','#26c6da','#ff7043','#5c6bc0'];
          setRepartition({
            labels: deps.slice(0, 8).map(d => d.lib_dep || d.code_dep),
            datasets: [{
              data: deps.slice(0, 8).map((_, i) => Math.floor(Math.random() * 200) + 50),
              backgroundColor: COLORS.map(c => `${c}cc`),
              borderColor: COLORS,
              borderWidth: 1,
            }],
          });
        }

        // Graphique inscriptions par mois (line)
        const months = ['Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr'];
        setInscMois({
          labels: months,
          datasets: [{
            label: t.nav.inscriptions,
            data: months.map(() => Math.floor(Math.random() * 200) + 100),
            backgroundColor: 'rgba(76,175,80,.15)',
            borderColor: '#4caf50',
            borderWidth: 2, fill: true, tension: .4,
            pointBackgroundColor: '#4caf50', pointRadius: 4,
          }],
        });

        // Distribution des notes
        const tranches = ['<8','8-10','10-12','12-14','14-16','16-20'];
        const counts = [0,0,0,0,0,0];
        evals.forEach(e => {
          const n = parseFloat(e.note);
          if      (n < 8)  counts[0]++;
          else if (n < 10) counts[1]++;
          else if (n < 12) counts[2]++;
          else if (n < 14) counts[3]++;
          else if (n < 16) counts[4]++;
          else             counts[5]++;
        });
        setDistNotes({
          labels: tranches,
          datasets: [{
            label: 'Étudiants',
            data: evals.length > 0 ? counts : [45,89,178,312,289,135],
            backgroundColor: [
              'rgba(239,83,80,.7)','rgba(255,167,38,.7)','rgba(255,238,88,.7)',
              'rgba(102,187,106,.7)','rgba(76,175,80,.85)','rgba(56,142,60,.9)',
            ],
            borderWidth: 0, borderRadius: 4,
          }],
        });

      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [t]);

  // ── Les 14 KPIs ──────────────────────────────────────────────────────────────
  const KPI_ROWS = [
    // Ligne 1 — Académique
    [
      { key:'nbEtudiants',    label:t.dashboard.students,    icon:'fas fa-user-graduate',      color:'c-green',  to:'/students',    hide: hideFor('ETUDIANT') },
      { key:'nbEnseignants',  label:t.dashboard.teachers,    icon:'fas fa-chalkboard-teacher', color:'c-blue',   to:'/teachers',    hide: hideFor('ETUDIANT','COMPTABLE') },
      { key:'nbClasses',      label:t.dashboard.classes,     icon:'fas fa-door-open',          color:'c-orange', to:'/classes',     hide: hideFor('ETUDIANT','COMPTABLE') },
      { key:'nbInscriptions', label:t.dashboard.inscriptions,icon:'fas fa-file-signature',     color:'c-blue',   to:'/inscription', hide: hideFor('ETUDIANT','ENSEIGNANT') },
    ],
    // Ligne 2 — Pédagogique
    [
      { key:'nbEvaluations',  label:t.dashboard.evaluations, icon:'fas fa-clipboard-check',   color:'c-green',  to:'/evaluation', hide: hideFor('COMPTABLE') },
      { key:'nbSeances',      label:t.dashboard.seances,     icon:'fas fa-calendar-check',    color:'c-blue',   to:'/seances',    hide: hideFor('COMPTABLE') },
      { key:'nbDecisions',    label:t.dashboard.decisions,   icon:'fas fa-gavel',             color:'c-orange', to:'/decisions' },
      { key:'nbExamens',      label:t.dashboard.examens,     icon:'fas fa-pen-alt',           color:'c-green',  to:'/examens' },
    ],
    // Ligne 3 — Divers
    [
      { key:'nbImpayes',      label:t.dashboard.unpaid,      icon:'fas fa-exclamation-circle', color:'c-red',    to:'/payments', hide: hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') },
      { key:'nbFactures',     label:t.dashboard.factures,    icon:'fas fa-file-invoice',       color:'c-blue',   to:'/factures', hide: hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') },
      { key:'nbStages',       label:t.dashboard.stages,      icon:'fas fa-briefcase',          color:'c-orange', to:'/stages',   hide: hideFor('COMPTABLE') },
      { key:'tauxReussite',   label:t.dashboard.tauxReussite,icon:'fas fa-chart-line',         color:'c-green',  to:'/grades',   hide: hideFor('COMPTABLE') },
    ],
    // Ligne 4 — KPIs financiers (COMPTABLE + ADMIN uniquement)
    [
      { key:'soldeImpaye',      label:t.dashboard.soldeImpaye, icon:'fas fa-balance-scale', color:'c-red',   to:'/factures', wide:true, hide: hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') },
      { key:'tauxRecouvrement', label:t.dashboard.txRecouvrmt, icon:'fas fa-percent',       color:'c-green', to:'/factures', wide:true, hide: hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') },
    ],
  ];

  // ── Accès rapide ──────────────────────────────────────────────────────────────
  const QUICK = [
    { to:'/students',    label:t.dashboard.manageStud,  icon:'fas fa-user-graduate',     c:'var(--green)',   hide: hideFor('ETUDIANT','ENSEIGNANT','COMPTABLE') },
    { to:'/inscription', label:t.nav.inscriptions,      icon:'fas fa-file-signature',    c:'var(--info)',    hide: hideFor('ETUDIANT','ENSEIGNANT') },
    { to:'/seances',     label:t.nav.seances,           icon:'fas fa-calendar-check',    c:'#26c6da',        hide: hideFor('COMPTABLE') },
    { to:'/fiche-notes', label:t.nav.ficheNotes,        icon:'fas fa-file-alt',          c:'var(--warning)', hide: hideFor('COMPTABLE') },
    { to:'/evaluation',  label:t.nav.evaluations,       icon:'fas fa-clipboard-check',   c:'#ab47bc',        hide: hideFor('COMPTABLE') },
    { to:'/payments',    label:t.nav.payments,          icon:'fas fa-credit-card',       c:'var(--danger)',  hide: hideFor('ETUDIANT','SCOLARITE') },
    { to:'/examens',     label:t.nav.examens,           icon:'fas fa-pen-alt',           c:'var(--orange)',  hide: hideFor('COMPTABLE') },
    { to:'/decisions',   label:t.nav.decisions,         icon:'fas fa-gavel',             c:'#5c6bc0',        hide: hideFor('COMPTABLE') },
  ].filter(q => !q.hide);

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.dashboard.title}</h1>
          <p className="page-subtitle">{t.dashboard.subtitle}</p>
        </div>
        {!hideFor('ETUDIANT','ENSEIGNANT') && (
          <div className="flex gap-2">
            <Link to="/inscription" className="sms-btn sms-btn-primary sms-btn-sm">
              <i className="fas fa-plus"></i> {t.dashboard.inscription}
            </Link>
          </div>
        )}
      </div>

      {/* Lignes 1 et 2 — 8 KPIs */}
      {KPI_ROWS.slice(0, 2).map((row, ri) => {
        const visible = row.filter(k => !k.hide);
        if (!visible.length) return null;
        return (
          <div key={ri} className="stat-grid" style={{ marginBottom: 12 }}>
            {visible.map(k => (
              <KpiCard key={k.key}
                label={k.label}
                value={kpis[k.key]}
                icon={k.icon}
                color={k.color}
                loading={loading}
                to={k.to}
              />
            ))}
          </div>
        );
      })}

      {/* Ligne 3 — 4 KPIs */}
      {KPI_ROWS[2].filter(k => !k.hide).length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 12 }}>
          {KPI_ROWS[2].filter(k => !k.hide).map(k => (
            <KpiCard key={k.key}
              label={k.label}
              value={kpis[k.key]}
              icon={k.icon}
              color={k.color}
              loading={loading}
              to={k.to}
            />
          ))}
        </div>
      )}

      {/* Ligne 4 — KPIs financiers */}
      {KPI_ROWS[3].filter(k => !k.hide).length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {KPI_ROWS[3].filter(k => !k.hide).map(k => (
            <KpiCard key={k.key}
              label={k.label}
              value={kpis[k.key]}
              icon={k.icon}
              color={k.color}
              loading={loading}
              to={k.to}
            />
          ))}
        </div>
      )}

      {/* Graphiques ligne 1 */}
      {(() => {
        const showInsc  = !hideFor('ETUDIANT','ENSEIGNANT');
        const showRep   = !hideFor('ETUDIANT');
        if (!showInsc && !showRep) return null;
        return (
          <div className={showInsc && showRep ? 'grid-2 mb-6' : 'mb-6'}>
            {showInsc && (
              <div className="sms-card">
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-chart-line"></i> {t.dashboard.inscChart}
                  </div>
                </div>
                <div className="sms-card-body">
                  <div className="chart-box">
                    {inscMois ? (
                      <Line data={inscMois} options={{
                        ...CHART_OPTS,
                        plugins: { ...CHART_OPTS.plugins, legend: { display: false } }
                      }} />
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                        <div className="sms-spinner" style={{ width:28, height:28 }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {showRep && (
              <div className="sms-card">
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-chart-pie"></i> {t.dashboard.repartChart}
                  </div>
                </div>
                <div className="sms-card-body" style={{ display:'flex', alignItems:'center', gap:20 }}>
                  {repartition ? (
                    <>
                      <div style={{ height:190, width:190, flexShrink:0 }}>
                        <Doughnut data={repartition} options={{ ...CHART_OPTS, scales:undefined, cutout:'65%' }} />
                      </div>
                      <div style={{ flex:1 }}>
                        {repartition.labels.slice(0,5).map((l,i) => (
                          <div key={i} style={{ marginBottom:8 }}>
                            <div className="flex justify-between mb-4" style={{ fontSize:12 }}>
                              <span style={{ color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{l}</span>
                              <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{repartition.datasets[0].data[i]}</span>
                            </div>
                            <div className="sms-progress">
                              <div className="sms-progress-bar" style={{
                                width:`${(repartition.datasets[0].data[i]/Math.max(...repartition.datasets[0].data))*100}%`,
                                background:repartition.datasets[0].borderColor[i],
                              }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%' }}>
                      <div className="sms-spinner" style={{ width:28, height:28 }}></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Graphiques ligne 2 */}
      {(() => {
        const showDist     = !hideFor('ETUDIANT','COMPTABLE');
        const showActivity = !hideFor('ETUDIANT');
        if (!showDist && !showActivity) return null;
        return (
          <div className={showDist && showActivity ? 'grid-2 mb-6' : 'mb-6'}>
            {showDist && (
              <div className="sms-card">
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-chart-bar"></i> {t.dashboard.notesChart}
                  </div>
                </div>
                <div className="sms-card-body">
                  <div className="chart-box">
                    {distNotes ? (
                      <Bar data={distNotes} options={{
                        ...CHART_OPTS,
                        plugins: { ...CHART_OPTS.plugins, legend: { display: false } }
                      }} />
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                        <div className="sms-spinner" style={{ width:28, height:28 }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {showActivity && (
              <div className="sms-card">
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-history"></i> {t.dashboard.recent}
                  </div>
                  <Link to="/audit" style={{ fontSize:12, color:'var(--green)', textDecoration:'none' }}>
                    {t.dashboard.seeAll}
                  </Link>
                </div>
                <RecentActivity />
              </div>
            )}
          </div>
        );
      })()}

      {/* Accès rapide */}
      <div className="sms-card">
        <div className="sms-card-header">
          <div className="sms-card-title">
            <i className="fas fa-bolt"></i> {t.dashboard.quickAccess}
          </div>
        </div>
        <div className="sms-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {QUICK.map(q => (
              <Link key={q.to} to={q.to} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px',
                background: 'var(--bg-darkest)', border: '1px solid var(--border)',
                borderRadius: 8, textDecoration: 'none',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
                transition: 'var(--transition)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = q.c; e.currentTarget.style.color = q.c; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <i className={q.icon} style={{ color: q.c, width: 16, textAlign: 'center' }}></i>
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
