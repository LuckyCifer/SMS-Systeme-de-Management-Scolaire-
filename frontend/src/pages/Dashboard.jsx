/**
 * pages/Dashboard.jsx — SMS v3
 * Tableau de bord — indicateurs actionnables réels depuis l'API
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import InfoBox from '../components/InfoBox';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

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

// ── Timeline d'activité récente ───────────────────────────────────────────────
const ACTION_META = {
  LOGIN_SUCCESS: { icon: 'fas fa-sign-in-alt',  color: 'var(--green)',   dot: '#4caf50' },
  LOGIN_FAILED:  { icon: 'fas fa-times-circle', color: 'var(--danger)',  dot: '#ef5350' },
  CREATE:        { icon: 'fas fa-plus-circle',  color: 'var(--green)',   dot: '#4caf50' },
  UPDATE:        { icon: 'fas fa-edit',         color: 'var(--warning)', dot: '#ffa726' },
  DELETE:        { icon: 'fas fa-trash',        color: 'var(--danger)',  dot: '#ef5350' },
  BULK_DELETE:   { icon: 'fas fa-trash-alt',    color: 'var(--danger)',  dot: '#ef5350' },
  EXPORT_CSV:    { icon: 'fas fa-download',     color: '#ab47bc',        dot: '#ab47bc' },
  LOGOUT:        { icon: 'fas fa-sign-out-alt', color: 'var(--text-muted)', dot: '#666' },
};

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

  const fmtTime = (dateStr) => {
    if (!dateStr) return '—';
    const d    = new Date(dateStr);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)    return t.dashboard.agoSec;
    if (diff < 3600)  return t.dashboard.agoMin.replace('{n}', Math.floor(diff / 60));
    if (diff < 86400) return t.dashboard.agoHour.replace('{n}', Math.floor(diff / 3600));
    return d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short' });
  };

  const actionLabel = (action) => t.dashboard.actions[action] || action;
  const modelLabel  = (model)  => t.dashboard.models[model]   || model;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div className="sms-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  if (!logs.length) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
      <i className="fas fa-history" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: .25 }} />
      {t.dashboard.noActivity}
    </div>
  );

  return (
    <div style={{ padding: '12px 16px 8px' }}>
      {logs.map((log, i) => {
        const meta = ACTION_META[log.action] || { icon: 'fas fa-circle', color: 'var(--text-muted)', dot: '#444' };
        const isLast = i === logs.length - 1;
        return (
          <div key={log.id || i} style={{ display: 'flex', gap: 0, position: 'relative' }}>

            {/* Colonne gauche : heure + ligne verticale */}
            <div style={{ width: 54, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 4, lineHeight: 1 }}>
                {fmtDate(log.date_action)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 6, lineHeight: 1 }}>
                {fmtTime(log.date_action)}
              </span>
              {/* Ligne verticale entre points */}
              {!isLast && (
                <div style={{
                  flex: 1, width: 2, minHeight: 16,
                  background: 'linear-gradient(to bottom, var(--border-light), var(--border))',
                  borderRadius: 1,
                }} />
              )}
            </div>

            {/* Point coloré */}
            <div style={{
              width: 28, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 1,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: `${meta.dot}18`, border: `2px solid ${meta.dot}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={meta.icon} style={{ color: meta.color, fontSize: 11 }} />
              </div>
              {!isLast && (
                <div style={{
                  flex: 1, width: 2,
                  background: 'linear-gradient(to bottom, var(--border-light), var(--border))',
                  borderRadius: 1,
                }} />
              )}
            </div>

            {/* Contenu à droite du point */}
            <div style={{
              flex: 1, minWidth: 0,
              paddingLeft: 12,
              paddingBottom: isLast ? 0 : 16,
              paddingTop: 4,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <span style={{ color: meta.color }}>{actionLabel(log.action)}</span>
                {' '}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>par</span>{' '}
                {log.utilisateur}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {modelLabel(log.modele)}{log.detail ? ` — ${log.detail.slice(0, 55)}` : ''}
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
  const { t, lang, toast } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const role = (JSON.parse(localStorage.getItem('sms_user') || '{}'))?.role || 'USER';
  const hideFor = (...roles) => roles.includes(role);

  // État des KPIs affichés
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);

  // Données graphiques
  const [repartition, setRepartition] = useState(null);
  const [inscMois,    setInscMois]    = useState(null);
  const [paiMois,     setPaiMois]     = useState(null);
  const [distNotes,   setDistNotes]   = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Une seule requête pour tous les KPIs + données graphiques
        const statsRes = await api.get('/api/dashboard/stats/');
        const s = statsRes.data;

        setKpis({
          nbEtudiants:      s.nb_etudiants,
          nbEnseignants:    s.nb_enseignants,
          nbClasses:        s.nb_classes,
          nbImpayes:        s.nb_impayes,
          nbInscriptions:   s.nb_inscriptions,
          soldeImpaye:      s.solde_impaye > 0 ? `${Math.round(s.solde_impaye / 1000)}k` : '0',
          tauxReussite:     s.taux_reussite     != null ? `${s.taux_reussite}%`     : '—',
          tauxRecouvrement: s.taux_recouvrement != null ? `${s.taux_recouvrement}%` : '—',
        });

        // Graphique répartition par département (doughnut) — données réelles
        const deps = s.repartition_deps || [];
        if (deps.length > 0) {
          const COLORS = ['#4caf50','#42a5f5','#ffa726','#ef5350','#ab47bc','#26c6da','#ff7043','#5c6bc0'];
          setRepartition({
            labels: deps.map(d => d.lib_dep || d.code_dep),
            datasets: [{
              data: deps.map(d => d.nb_et),
              backgroundColor: COLORS.map(c => `${c}cc`),
              borderColor: COLORS,
              borderWidth: 1,
            }],
          });
        }

        // Graphiques par mois — données réelles depuis le backend
        const today  = new Date();
        const labels8 = [];
        const monthsPai  = new Array(8).fill(0);
        const monthsInsc = new Array(8).fill(0);

        for (let i = 7; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          labels8.push(d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: '2-digit' }));
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const pEntry = (s.paiements_mois   || []).find(p => p.mois === key);
          const iEntry = (s.inscriptions_mois || []).find(p => p.mois === key);
          monthsPai [7 - i] = pEntry ? pEntry.total : 0;
          monthsInsc[7 - i] = iEntry ? iEntry.count : 0;
        }

        setInscMois({
          labels: labels8,
          datasets: [{
            label: t.nav.inscriptions,
            data: monthsInsc,
            backgroundColor: 'rgba(76,175,80,.15)',
            borderColor: '#4caf50',
            borderWidth: 2, fill: true, tension: .4,
            pointBackgroundColor: '#4caf50', pointRadius: 4,
            yAxisID: 'y',
          }],
        });
        setPaiMois({
          labels: labels8,
          datasets: [{
            label: t.dashboard.payChartLabel,
            data: monthsPai,
            backgroundColor: 'rgba(66,165,245,.18)',
            borderColor: '#42a5f5',
            borderWidth: 2, fill: true, tension: .4,
            pointBackgroundColor: '#42a5f5', pointRadius: 4,
          }],
        });

        // Distribution des notes — données réelles depuis le backend. Pas de repli sur des
        // valeurs fictives : un établissement sans notes saisies doit voir un état vide
        // explicite, pas un graphique qui laisse croire que des données existent déjà.
        const distData = s.dist_notes || [];
        const hasNotes = distData.some(v => v > 0);
        setDistNotes(hasNotes ? {
          labels: ['<8','8-10','10-12','12-14','14-16','16-20'],
          datasets: [{
            label: 'Étudiants',
            data: distData,
            backgroundColor: [
              'rgba(239,83,80,.7)','rgba(255,167,38,.7)','rgba(255,238,88,.7)',
              'rgba(102,187,106,.7)','rgba(76,175,80,.85)','rgba(56,142,60,.9)',
            ],
            borderWidth: 0, borderRadius: 4,
          }],
        } : false);

      } catch (err) {
        const status = err?.response?.status;
        const serverError = err?.response?.data?.error || err?.response?.data?.detail;
        const errType = err?.response?.data?.type;
        const msg = serverError
          ? `[${status}] ${errType ? errType + ': ' : ''}${serverError}`
          : `[${status || 'réseau'}] ${err?.message || 'Erreur inconnue'}`;
        console.error('Dashboard fetch error:', msg, err);
        if (toast?.error) toast.error(`Dashboard — ${msg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [t, lang]);

  // ── KPIs — seulement les chiffres réellement actionnables au premier coup d'œil.
  // Le reste (évaluations, séances, décisions, examens, factures, stages) est accessible
  // via l'Accès rapide ci-dessous, sans dupliquer un compteur pour chacun.
  const KPI_ROWS = [
    // Ligne 1 — Effectifs
    [
      { key:'nbEtudiants',    label:labels.studentLabelPlural, icon:'fas fa-user-graduate',    color:'c-green',  to:'/students',    hide: hideFor('ETUDIANT') },
      { key:'nbEnseignants',  label:t.dashboard.teachers,    icon:'fas fa-chalkboard-teacher', color:'c-blue',   to:'/teachers',    hide: hideFor('ETUDIANT','COMPTABLE') },
      { key:'nbClasses',      label:t.dashboard.classes,     icon:'fas fa-door-open',          color:'c-orange', to:'/classes',     hide: hideFor('ETUDIANT','COMPTABLE') },
      { key:'nbInscriptions', label:t.dashboard.inscriptions,icon:'fas fa-file-signature',     color:'c-blue',   to:'/inscription', hide: hideFor('ETUDIANT','ENSEIGNANT') },
    ],
    // Ligne 2 — À surveiller (risque financier + performance académique)
    [
      { key:'nbImpayes',    label:t.dashboard.unpaid,       icon:'fas fa-exclamation-circle', color:'c-red',   to:'/payments', hide: hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') },
      { key:'tauxReussite', label:t.dashboard.tauxReussite, icon:'fas fa-chart-line',          color:'c-green',to:'/grades',   hide: hideFor('COMPTABLE') },
    ],
  ];

  // ── Accès rapide — uniquement les destinations sans compteur KPI dédié ci-dessus,
  // pour ne pas proposer deux fois le même lien sous deux formes différentes.
  const QUICK = [
    { to:'/seances',     label:t.nav.seances,           icon:'fas fa-calendar-check',    c:'#26c6da',        hide: hideFor('COMPTABLE') },
    { to:'/fiche-notes', label:t.nav.ficheNotes,        icon:'fas fa-file-alt',          c:'var(--warning)', hide: hideFor('COMPTABLE') },
    { to:'/evaluation',  label:t.nav.evaluations,       icon:'fas fa-clipboard-check',   c:'#ab47bc',        hide: hideFor('COMPTABLE') },
    { to:'/payments',    label:t.nav.payments,          icon:'fas fa-credit-card',       c:'var(--danger)',  hide: hideFor('ETUDIANT','SCOLARITE') },
    { to:'/examens',     label:t.nav.examens,           icon:'fas fa-pen-alt',           c:'var(--orange)',  hide: hideFor('COMPTABLE') },
    { to:'/decisions',   label:t.nav.decisions,         icon:'fas fa-gavel',             c:'#5c6bc0',        hide: hideFor('COMPTABLE') },
    { to:'/stages',      label:t.nav.stages,            icon:'fas fa-briefcase',         c:'#7e57c2',        hide: hideFor('COMPTABLE') },
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

      {/* KPIs */}
      {KPI_ROWS.map((row, ri) => {
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

      {/* KPIs financiers — InfoBox avec barre de progression */}
      {!hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT') && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <InfoBox
            icon="fas fa-balance-scale"
            label={t.dashboard.soldeImpaye}
            value={kpis.soldeImpaye}
            color="var(--danger)"
            loading={loading}
            to="/factures"
          />
          <InfoBox
            icon="fas fa-percent"
            label={t.dashboard.txRecouvrmt}
            value={kpis.tauxRecouvrement}
            color="var(--green)"
            progress={kpis.tauxRecouvrement ? parseInt(kpis.tauxRecouvrement) : undefined}
            loading={loading}
            to="/factures"
          />
        </div>
      )}

      {/* Graphiques ligne 1 — colonnes calculées sur le nombre réel de cartes visibles, pour
          éviter qu'un nombre impair (ex. 3 cartes) ne s'étale mal dans une grille à 2 colonnes fixes. */}
      {(() => {
        const showInsc = !hideFor('ETUDIANT','ENSEIGNANT');
        const showPai  = !hideFor('ETUDIANT','SCOLARITE','ENSEIGNANT');
        const showRep  = !hideFor('ETUDIANT');
        const visibleCount = [showInsc, showPai, showRep].filter(Boolean).length;
        if (!visibleCount) return null;
        const rowClass = visibleCount === 3 ? 'grid-3 mb-6' : visibleCount === 2 ? 'grid-2 mb-6' : 'mb-6';
        return (
          <div className={rowClass}>
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
            {/* Graphique paiements par mois — visible COMPTABLE + ADMIN */}
            {showPai && (
              <div className="sms-card">
                <div className="sms-card-header">
                  <div className="sms-card-title">
                    <i className="fas fa-credit-card" style={{ color:'#42a5f5' }}></i>
                    &nbsp;{t.dashboard.payChart}
                  </div>
                </div>
                <div className="sms-card-body">
                  <div className="chart-box">
                    {paiMois ? (
                      <Line data={paiMois} options={{
                        ...CHART_OPTS,
                        plugins: { ...CHART_OPTS.plugins, legend: { display: false } },
                        scales: {
                          ...CHART_OPTS.scales,
                          y: { ...CHART_OPTS.scales.y, ticks: { ...CHART_OPTS.scales.y.ticks,
                            callback: v => v >= 1000 ? `${Math.round(v/1000)}k` : v,
                          }},
                        },
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
                    <i className="fas fa-chart-pie"></i> {lang === 'en' ? `Distribution by ${labels.departementLabel}` : `Répartition par ${labels.departementLabel.toLowerCase()}`}
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
                    ) : distNotes === false ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                        justifyContent:'center', height:'100%', gap:8, color:'var(--text-muted)' }}>
                        <i className="fas fa-chart-bar" style={{ fontSize:28, opacity:.25 }}></i>
                        <span style={{ fontSize:12 }}>{t.dashboard.noNotesYet}</span>
                      </div>
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
