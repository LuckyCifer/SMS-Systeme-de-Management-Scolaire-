/**
 * pages/Planning.jsx
 * Emploi du temps — HEBDO (grille semaine) + INTENSIF (semaine dédiée).
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { FormField } from '../components/CrudTable';
import { LoadingState, ErrorState } from '../components/ApiState';
import {
  planningService, coursService,
  jourService, salleService, classeService,
} from '../services/endpoints';
import SearchableSelect from '../components/SearchableSelect';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';
import { CoursForm } from './Cours';

const PAUSE_STORAGE_KEY = 'sms_planning_pauses_v3';
// Chaque entrée : { label, h_debut, h_fin, active }
// pauses[0] = 1ère pause (toujours visible), pauses[1] = 2ème pause (désactivée par défaut)
// overrides: { 'Lundi': [ pause0, pause1 ] }  — remplace toutes les pauses du jour
const DEFAULT_PAUSE_CONFIG = {
  pauses: [
    { label: 'Pause',   h_debut: '10:00', h_fin: '10:30', active: true  },
    { label: 'Pause 2', h_debut: '12:00', h_fin: '12:30', active: false },
  ],
  overrides: {},
};

const JOURS_FR        = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOUR_FR_TO_CODE = { Lundi: 'LUN', Mardi: 'MAR', Mercredi: 'MER', Jeudi: 'JEU', Vendredi: 'VEN', Samedi: 'SAM' };
const HOUR_HEIGHT = 64;   // px par heure
const GRID_START  = 7;    // 07:00
const GRID_END    = 22;   // 22:00 (cours du soir jusqu'à 21h)
const GRID_HOURS  = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const TOTAL_H     = GRID_HOURS.length * HOUR_HEIGHT;

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

const COLORS = [
  '#4caf50','#42a5f5','#ffa726','#ef5350','#ab47bc',
  '#26c6da','#66bb6a','#ff7043','#5c6bc0','#26a69a',
];
function getColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

const SEANCE_COLORS = { CM: '#42a5f5', TD: '#66bb6a', TP: '#ffa726', SOIR: '#ab47bc' };

// ── Générateur HTML pour impression / PDF ────────────────────────────────────
function buildPrintHTML(hebdo, classeLabel, semestreLabel, joursLabels) {
  const PH = 44; // px par heure dans la feuille print
  const TOTAL = GRID_HOURS.length * PH;

  const byDay = {};
  JOURS_FR.forEach(j => { byDay[j] = []; });
  hebdo.forEach(p => {
    const jour = p.lib_jour || '';
    if (byDay[jour]) byDay[jour].push(p);
  });

  const dayColsHtml = JOURS_FR.map(j =>
    `<div style="position:relative;flex:1;height:${TOTAL}px;border-left:1px solid #ddd;">
      ${GRID_HOURS.map((_, i) =>
        `<div style="position:absolute;top:${i * PH}px;left:0;right:0;border-top:1px solid #f0f0f0;"></div>`
      ).join('')}
      ${(byDay[j] || []).map(p => {
        const startMin = timeToMin(p.h_debut);
        const endMin   = timeToMin(p.h_fin);
        const top    = (startMin - GRID_START * 60) / 60 * PH + 1;
        const height = Math.max((endMin - startMin) / 60 * PH - 2, 20);
        const color  = getColor(p.lib_matiere || '');
        const tsCol  = SEANCE_COLORS[p.type_seance] || color;
        return `<div style="position:absolute;top:${top}px;left:2px;right:2px;height:${height}px;
            background:${color}20;border:1px solid ${color}60;border-left:3px solid ${color};
            border-radius:3px;padding:2px 4px;overflow:hidden;box-sizing:border-box;">
          <div style="font-size:9px;font-weight:bold;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.lib_matiere || '—'}</div>
          <div style="font-size:8px;color:#555;">${(p.h_debut || '').slice(0, 5)} – ${(p.h_fin || '').slice(0, 5)}</div>
          ${height > 42 && p.nom_ens ? `<div style="font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nom_ens}</div>` : ''}
          ${height > 28 ? `<span style="font-size:7px;font-weight:bold;background:${tsCol}20;color:${tsCol};border-radius:2px;padding:0 3px;">${p.type_seance || ''}</span>` : ''}
          ${height > 52 && p.groupes ? `<div style="font-size:7px;color:#e65100;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Gr. ${p.groupes}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`
  ).join('');

  const timeHtml = GRID_HOURS.map((h, i) =>
    `<div style="position:absolute;top:${i * PH - 7}px;right:5px;font-size:9px;color:#999;white-space:nowrap;">
      ${String(h).padStart(2, '0')}:00
    </div>`
  ).join('');

  const subtitle = [classeLabel, semestreLabel].filter(Boolean).join(' — ') || 'Toutes les classes';
  const legend = Object.entries({ CM: 'Cours Magistral', TD: 'Travaux Dirigés', TP: 'Travaux Pratiques', SOIR: 'Cours du soir' })
    .map(([k, v]) => {
      const col = SEANCE_COLORS[k] || '#888';
      return `<span style="display:flex;align-items:center;gap:5px;font-size:9px;color:#555;">
        <span style="display:inline-block;width:10px;height:10px;background:${col};border-radius:2px;flex-shrink:0;"></span>
        <strong>${k}</strong>&nbsp;${v}
      </span>`;
    }).join('');

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>Emploi du temps — ${subtitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .actions { text-align: center; padding: 16px 0; }
    .actions button { padding: 10px 24px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin: 0 6px; }
    .btn-print { background: #2d6a4f; color: #fff; }
    .btn-close  { background: #e0e0e0; color: #333; }
    @media print { .actions { display: none; } body { background: #fff; } .sheet { box-shadow: none !important; } }
    @media screen { body { background: #f0f2f5; } .sheet { max-width: 1100px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,.12); } }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
    <button class="btn-close"  onclick="window.close()">✕ Fermer</button>
  </div>
  <div class="sheet">
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#1a1a2e;">Emploi du Temps</div>
      <div style="font-size:12px;color:#555;margin-top:5px;">${subtitle}</div>
      <div style="font-size:10px;color:#aaa;margin-top:3px;">Généré le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>

    <div style="display:flex;margin-left:44px;">
      ${(joursLabels || JOURS_FR).map(j =>
        `<div style="flex:1;text-align:center;font-size:11px;font-weight:bold;color:#fff;background:#2d6a4f;padding:7px 4px;border-right:1px solid #1e4d3a;">${j}</div>`
      ).join('')}
    </div>

    <div style="display:flex;border:1px solid #ddd;border-top:none;">
      <div style="position:relative;width:44px;flex-shrink:0;height:${TOTAL}px;border-right:1px solid #ddd;">${timeHtml}</div>
      <div style="display:flex;flex:1;">${dayColsHtml}</div>
    </div>

    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #eee;display:flex;gap:18px;flex-wrap:wrap;">${legend}</div>
  </div>
</body></html>`;
}

// ── Formulaire ajout / modification ──────────────────────────────────────────
function PlanningForm({ item, onClose, onSave, labels }) {
  const { t, toast } = useApp();
  const [f, setF] = useState({
    code_cours:    item?.code_cours    || '',
    type_planning: item?.type_planning || 'HEBDO',
    type_seance:   item?.type_seance   || 'CM',
    h_debut:       item?.h_debut?.slice(0, 5) || '08:00',
    h_fin:         item?.h_fin?.slice(0, 5)   || '10:00',
    code_jour:     item?.code_jour     || '',
    code_salle:    item?.code_salle    || '',
    date_debut:    item?.date_debut    || '',
    date_fin:      item?.date_fin      || '',
  });
  const ch = e => setF(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const { data: cours, reload: reloadCours } = useApi(useCallback(() => coursService.list({ page_size: 500 }), []));
  const { data: jours }  = useApi(useCallback(() => jourService.list({ page_size: 10 }),  []));
  const { data: salles } = useApi(useCallback(() => salleService.list({ page_size: 100 }), []));
  const { mutate: createCours } = useMutation(useCallback(d => coursService.create(d), []));

  // Permet de créer à la volée un cours (matière/classe/enseignant/semestre) qui n'existe
  // pas encore, sans quitter le formulaire du créneau — un créneau ne peut être affecté
  // qu'à un cours déjà attribué, donc réaffecter une classe passe par ici.
  const [showNewCours, setShowNewCours] = useState(false);

  // Le catalogue de cours est plafonné à 500 lignes (perf) : le cours déjà affecté à ce
  // créneau peut donc être absent de la page chargée (tri par année/classe/matière), ce qui
  // viderait son libellé dans le menu. On le récupère individuellement dans ce cas.
  const [editedCoursOpt, setEditedCoursOpt] = useState(null);
  useEffect(() => {
    if (!item?.code_cours || !cours) { setEditedCoursOpt(null); return; }
    if (cours.some(c => String(c.id) === String(item.code_cours))) { setEditedCoursOpt(null); return; }
    let cancelled = false;
    coursService.get(item.code_cours).then(({ data: c }) => {
      if (cancelled) return;
      setEditedCoursOpt({
        value: c.id,
        label: `${c.lib_matiere || c.code_matiere} · ${c.lib_classe || c.code_classe} · ${c.semestre}`,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [item, cours]);

  const isHebdo    = f.type_planning === 'HEBDO';
  const isIntensif = f.type_planning === 'INTENSIF';

  return (
    <>
    <form onSubmit={e => {
      e.preventDefault();
      onSave({
        ...f,
        code_salle:  f.code_salle  || null,
        code_jour:   f.code_jour   || null,
        date_debut:  f.date_debut  || null,
        date_fin:    f.date_fin    || null,
      });
    }}>
      {/* Cours */}
      <FormField
        label={t.pages.planning.form.coursLabel} name="code_cours" type="searchable"
        value={f.code_cours} onChange={ch} required
        options={[
          ...(editedCoursOpt ? [editedCoursOpt] : []),
          ...(cours || []).map(c => ({
            value: c.id,
            label: `${c.lib_matiere || c.code_matiere} · ${c.lib_classe || c.code_classe} · ${c.semestre}`,
          })),
        ]}
      />
      <div style={{ margin: '-8px 0 14px', textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => setShowNewCours(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: 'var(--accent)' }}
        >
          <i className="fas fa-plus" style={{ marginRight: 4 }}></i>
          {t.pages.planning.form.newCoursLink}
        </button>
      </div>

      {/* Système + type de séance */}
      <div className="sms-form-row">
        <FormField
          label={t.pages.planning.form.systeme} name="type_planning" type="select"
          value={f.type_planning} onChange={ch} required
          options={[
            { value: 'HEBDO',    label: t.pages.planning.form.hebdoLabel },
            { value: 'INTENSIF', label: t.pages.planning.form.intensifLabel },
          ]}
        />
        <FormField
          label={t.pages.planning.form.typeSeance} name="type_seance" type="select"
          value={f.type_seance} onChange={ch} required
          options={[
            { value: 'CM',   label: t.pages.planning.form.cm },
            { value: 'TD',   label: t.pages.planning.form.td },
            { value: 'TP',   label: t.pages.planning.form.tp },
            { value: 'SOIR', label: t.pages.planning.form.soir },
          ]}
        />
      </div>

      {/* HEBDO : sélecteur de jour */}
      {isHebdo && (
        <FormField
          label={t.pages.planning.form.jour} name="code_jour" type="select"
          value={f.code_jour} onChange={ch} required
          options={(jours || []).map(j => ({ value: j.code_jour, label: t.common.jours[j.code_jour] || j.lib_jour }))}
        />
      )}

      {/* INTENSIF : semaine (lundi → vendredi/samedi) */}
      {isIntensif && (
        <div className="sms-form-row">
          <FormField label={t.pages.planning.form.weekStart} name="date_debut" type="date" value={f.date_debut} onChange={ch} required help="La date doit être un lundi (début de semaine)" />
          <FormField label={t.pages.planning.form.weekEnd}   name="date_fin"   type="date" value={f.date_fin}   onChange={ch} required help="Dernier jour de la semaine intensive (vendredi ou samedi)" />
        </div>
      )}

      {/* Horaires (communs) */}
      <div className="sms-form-row">
        <FormField label={t.pages.planning.form.heureDebut} name="h_debut" type="time" value={f.h_debut} onChange={ch} required />
        <FormField label={t.pages.planning.form.heureFin}   name="h_fin"   type="time" value={f.h_fin}   onChange={ch} required />
      </div>

      {/* Salle */}
      <FormField
        label={t.pages.planning.form.salleOpt} name="code_salle" type="searchable"
        value={f.code_salle} onChange={ch}
        options={(salles || []).map(s => ({ value: s.code_salle, label: s.lib_salle || s.code_salle }))}
      />

      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit"  className="sms-btn sms-btn-primary sms-btn-sm">
          <i className="fas fa-save"></i> {t.common.save}
        </button>
      </div>
    </form>

    {/* Création rapide d'un cours (matière/classe/enseignant/semestre) sans quitter le créneau */}
    {showNewCours && (
      <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setShowNewCours(false)}>
        <div className="sms-modal" style={{ maxWidth: 560 }}>
          <div className="sms-modal-header">
            <div className="sms-modal-title">
              <i className="fas fa-book-open" style={{ marginRight: 8 }}></i>
              {t.pages.planning.form.newCoursModalTitle}
            </div>
          </div>
          <div className="sms-modal-body">
            <CoursForm
              labels={labels}
              onClose={() => setShowNewCours(false)}
              onSave={async d => {
                try {
                  const created = await createCours(d);
                  await reloadCours();
                  setF(prev => ({ ...prev, code_cours: created.id }));
                  setShowNewCours(false);
                  toast.success(t.toast.added);
                } catch (err) { toast.error(err.message); }
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Planning() {
  const { t, toast, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);
  const [classeFilter,   setClasseFilter]   = useState('');  // stocke code_classe
  const [semestreFilter, setSemestreFilter] = useState('');
  const [view,      setView]      = useState('grid'); // 'grid' | 'list'
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [delItem,   setDelItem]   = useState(null);

  // ── Pauses ─────────────────────────────────────────────────────────────────
  const [pauseConfig, setPauseConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PAUSE_STORAGE_KEY));
      return saved?.pauses ? saved : DEFAULT_PAUSE_CONFIG;
    } catch { return DEFAULT_PAUSE_CONFIG; }
  });
  const [showPauseModal, setShowPauseModal] = useState(false);

  // PRIMAIRE / SECONDAIRE supportent 2 pauses, SUPERIEUR 1 seule
  const maxPauses = labels.isSuperieur ? 1 : 2;

  useEffect(() => {
    localStorage.setItem(PAUSE_STORAGE_KEY, JSON.stringify(pauseConfig));
  }, [pauseConfig]);

  const getPausesForDay = day => pauseConfig.overrides[day] || pauseConfig.pauses;

  const updatePause = (idx, field, val) =>
    setPauseConfig(c => {
      const next = c.pauses.map((p, i) => i === idx ? { ...p, [field]: val } : p);
      return { ...c, pauses: next };
    });
  const togglePauseActive = idx =>
    setPauseConfig(c => {
      const next = c.pauses.map((p, i) => i === idx ? { ...p, active: !p.active } : p);
      return { ...c, pauses: next };
    });

  const enableDayOverride = day =>
    setPauseConfig(c => ({
      ...c, overrides: { ...c.overrides, [day]: c.pauses.map(p => ({ ...p })) },
    }));
  const updateDayPause = (day, idx, field, val) =>
    setPauseConfig(c => {
      const base = c.overrides[day] || c.pauses.map(p => ({ ...p }));
      const next = base.map((p, i) => i === idx ? { ...p, [field]: val } : p);
      return { ...c, overrides: { ...c.overrides, [day]: next } };
    });
  const toggleDayPauseActive = (day, idx) =>
    setPauseConfig(c => {
      const base = c.overrides[day] || c.pauses.map(p => ({ ...p }));
      const next = base.map((p, i) => i === idx ? { ...p, active: !p.active } : p);
      return { ...c, overrides: { ...c.overrides, [day]: next } };
    });
  const removeDayOverride = day =>
    setPauseConfig(c => {
      const { [day]: _, ...rest } = c.overrides;
      return { ...c, overrides: rest };
    });

  const { data: planningData, loading, error, reload } = useApi(
    useCallback(() => {
      // Charge tout pour le filtre actif (max 200 créneaux par classe = bien suffisant)
      const params = { page_size: 200 };
      if (classeFilter)   params['code_cours__code_classe'] = classeFilter;
      if (semestreFilter) params['code_cours__semestre']    = semestreFilter;
      return planningService.list(params);
    }, [classeFilter, semestreFilter]),
    [classeFilter, semestreFilter]
  );
  const { data: classes } = useApi(
    useCallback(() => classeService.list({ page_size: 200 }), [])
  );

  const { mutate: create } = useMutation(useCallback(d => planningService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => planningService.update(d.id, d), []));
  const { mutate: remove } = useMutation(useCallback(d => planningService.delete(d.id), []));

  const planning = planningData || [];

  const filtered = useMemo(() => [...planning].sort((a, b) => {
    if (a.type_planning !== b.type_planning) return a.type_planning === 'HEBDO' ? -1 : 1;
    if (a.type_planning === 'INTENSIF') {
      const da = a.date_debut || '', db = b.date_debut || '';
      return da < db ? -1 : da > db ? 1 : 0;
    }
    return 0;
  }), [planning]);

  const hebdo    = useMemo(() => filtered.filter(p => p.type_planning === 'HEBDO'),    [filtered]);
  const intensif = useMemo(() => filtered.filter(p => p.type_planning === 'INTENSIF'), [filtered]);

  const byDay = useMemo(() => {
    const map = {};
    JOURS_FR.forEach(j => { map[j] = []; });
    hebdo.forEach(p => { const jour = p.lib_jour || ''; if (map[jour]) map[jour].push(p); });
    return map;
  }, [hebdo]);

  // Bascule automatiquement en vue liste si la classe sélectionnée n'a que des créneaux INTENSIF
  useEffect(() => {
    if (classeFilter && hebdo.length === 0 && intensif.length > 0) {
      setView('list');
    }
  }, [classeFilter, hebdo.length, intensif.length]);

  const openAdd  = ()     => { setEditItem(null); setShowModal(true); };
  const openEdit = item   => { setEditItem(item);  setShowModal(true); };
  const close    = ()     => { setShowModal(false); setEditItem(null); };

  // ── Génération automatique des séances ────────────────────────────────────
  const [genModal,    setGenModal]    = useState(false);
  const [genDate,     setGenDate]     = useState(() => {
    // Calculer le prochain lundi
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  });
  const [genAnnee,    setGenAnnee]    = useState('');
  const [genLoading,  setGenLoading]  = useState(false);

  const handleGenererSeances = async () => {
    if (!genDate || !genAnnee) { toast.error('Sélectionnez une date et une année.'); return; }
    setGenLoading(true);
    try {
      const res = await planningService.genererSeances(genDate, genAnnee);
      const { created, skipped } = res.data;
      toast.success(`${created} séance(s) créée(s)${skipped > 0 ? ` — ${skipped} déjà existante(s)` : ''}.`);
      setGenModal(false);
    } catch (e) { toast.error(e.message); }
    finally { setGenLoading(false); }
  };

  // ── Génération sur toute une période (HEBDO + INTENSIF) ──────────────────
  const [genPeriodeModal,   setGenPeriodeModal]   = useState(false);
  const [genPeriodeDebut,   setGenPeriodeDebut]   = useState('');
  const [genPeriodeFin,     setGenPeriodeFin]     = useState('');
  const [genPeriodeAnnee,   setGenPeriodeAnnee]   = useState('');
  const [genPeriodeLoading, setGenPeriodeLoading] = useState(false);

  const handleGenererPeriode = async () => {
    if (!genPeriodeDebut || !genPeriodeFin || !genPeriodeAnnee) {
      toast.error('Date de début, date de fin et année scolaire sont requis.');
      return;
    }
    if (genPeriodeFin < genPeriodeDebut) {
      toast.error('La date de fin doit être postérieure à la date de début.');
      return;
    }
    setGenPeriodeLoading(true);
    try {
      const res = await planningService.genererPeriode(genPeriodeDebut, genPeriodeFin, genPeriodeAnnee);
      const { created, skipped } = res.data;
      toast.success(`${created} séance(s) créée(s)${skipped > 0 ? ` — ${skipped} déjà existante(s)` : ''}.`);
      setGenPeriodeModal(false);
    } catch (e) { toast.error(e?.response?.data?.detail || e.message); }
    finally { setGenPeriodeLoading(false); }
  };

  // Détecte un chevauchement horaire entre deux créneaux
  const hasOverlap = (formData) => {
    if (formData.type_planning !== 'HEBDO') return null;
    const h1Start = formData.h_debut;
    const h1End   = formData.h_fin;
    if (!h1Start || !h1End || !formData.code_jour) return null;

    // Cherche le cours sélectionné pour obtenir classe et enseignant
    const coursId = Number(formData.code_cours);
    const coursObj = (planningData || []).find(p => Number(p.code_cours) === coursId);

    const conflicts = (planningData || []).filter(p => {
      // Ignorer le créneau en cours de modification
      if (editItem && p.id === editItem.id) return false;
      // Doit être HEBDO et même jour
      if (p.type_planning !== 'HEBDO') return false;

      const pJour = typeof p.code_jour === 'object' ? p.code_jour?.code_jour : p.code_jour;
      const fJour = typeof formData.code_jour === 'object' ? formData.code_jour?.code_jour : formData.code_jour;
      if (pJour !== fJour) return false;

      // Vérifier le chevauchement horaire
      const p2Start = p.h_debut?.slice(0, 5) || '';
      const p2End   = p.h_fin?.slice(0, 5)   || '';
      const overlap = h1Start < p2End && h1End > p2Start;
      if (!overlap) return false;

      // Conflit si même classe OU même enseignant
      const sameClasse = p.lib_classe && coursObj?.lib_classe &&
        p.lib_classe === coursObj.lib_classe;
      const sameEns = p.nom_ens && coursObj?.nom_ens &&
        p.nom_ens === coursObj.nom_ens;
      return sameClasse || sameEns;
    });

    if (conflicts.length === 0) return null;

    const c = conflicts[0];
    const pJour = typeof c.code_jour === 'object' ? c.code_jour?.code_jour : c.code_jour;
    return `Chevauchement détecté : "${c.lib_matiere || ''}" · ${c.lib_classe || ''} · ${c.h_debut?.slice(0,5)}–${c.h_fin?.slice(0,5)} (${pJour})`;
  };

  const handleSave = async formData => {
    // Vérification anti-chevauchement avant envoi
    const conflict = hasOverlap(formData);
    if (conflict) {
      toast.error(conflict);
      return;
    }
    try {
      if (editItem) await update({ ...editItem, ...formData });
      else          await create(formData);
      toast.success(editItem ? t.pages.planning.slotUpdated : t.pages.planning.slotAdded);
      reload();
      close();
    } catch (e) { toast.error(e.message); }
  };

  const handleExportPDF = () => {
    const classeLabel   = (classes || []).find(c => c.code_classe === classeFilter)?.lib_classe || classeFilter || '';
    const allOpts = [...labels.semestres];
    const found = allOpts.find(o => o.value === semestreFilter);
    const semestreLabel = found?.label || '';
    const joursLabels   = JOURS_FR.map(j => t.common.jours[JOUR_FR_TO_CODE[j]] || j);
    const win = window.open('', '_blank');
    if (!win) { toast.error(t.pages.planning.popupBlocked); return; }
    win.document.write(buildPrintHTML(hebdo, classeLabel, semestreLabel, joursLabels));
    win.document.close();
  };

  const handleDelete = async item => {
    try {
      await remove(item);
      toast.success(t.pages.planning.slotDeleted);
      reload();
      setDelItem(null);
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-calendar-alt text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            {t.pages.planning.title}
          </h1>
          <p className="page-subtitle">{t.pages.planning.subtitle}</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {/* Bascule vue */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              ['grid', 'fas fa-th',   t.pages.planning.labelHebdo],
              ['list', 'fas fa-list', t.common.all],
            ].map(([v, ic, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                background: view === v ? 'var(--green-dark)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'var(--transition)',
              }}>
                <i className={ic}></i> {label}
              </button>
            ))}
          </div>

          {/* Pauses */}
          <button className="sms-btn sms-btn-outline" onClick={() => setShowPauseModal(true)}
            title={t.pages.planning.pauseTitle}>
            <i className="fas fa-coffee"></i> {t.pages.planning.pauseBtn}
          </button>

          {/* Export PDF */}
          <button className="sms-btn sms-btn-outline" onClick={handleExportPDF}
            title={t.pages.planning.exportPdfTitle}>
            <i className="fas fa-file-pdf"></i> {t.pages.planning.exportPdf}
          </button>

          {/* Générer séances (1 semaine, HEBDO uniquement) */}
          <button className="sms-btn sms-btn-outline" onClick={() => setGenModal(true)}
            title="Générer les séances de la semaine depuis le planning"
            style={{ borderColor: 'rgba(66,165,245,.4)', color: '#42a5f5' }}>
            <i className="fas fa-magic"></i> Générer séances
          </button>

          {/* Générer toute la période (HEBDO + INTENSIF) */}
          <button className="sms-btn sms-btn-outline" onClick={() => setGenPeriodeModal(true)}
            title={t.pages.planning.genPeriode.btnLabel}
            style={{ borderColor: 'rgba(102,187,106,.4)', color: '#66bb6a' }}>
            <i className="fas fa-calendar-alt"></i> {t.pages.planning.genPeriode.btnLabel}
          </button>

          {/* Ajouter */}
          <button className="sms-btn sms-btn-primary" onClick={openAdd}>
            <i className="fas fa-plus"></i> {t.pages.planning.newSlot}
          </button>
        </div>
      </div>

      {/* ── Modal génération séances ── */}
      {genModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setGenModal(false)}>
          <div className="sms-modal" style={{ maxWidth: 420 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className="fas fa-magic" style={{ marginRight: 8, color: '#42a5f5' }} />
                {t.pages.planning.genSeances.title}
              </div>
              <button className="sms-btn-icon" onClick={() => setGenModal(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="sms-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {t.pages.planning.genSeances.desc}
              </p>
              <div className="sms-form-row">
                <div className="sms-form-group">
                  <label className="sms-label">{t.pages.planning.genSeances.mondayLabel} *</label>
                  <input className="sms-input" type="date" value={genDate}
                    onChange={e => setGenDate(e.target.value)} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                    {t.pages.planning.genSeances.mondayHelp}
                  </span>
                </div>
                <div className="sms-form-group">
                  <label className="sms-label">{t.pages.planning.genSeances.anneeLabel} *</label>
                  <input className="sms-input" type="text" value={genAnnee}
                    onChange={e => setGenAnnee(e.target.value)}
                    placeholder="Ex : 2025-2026" />
                </div>
              </div>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setGenModal(false)}>
                {t.common.cancel}
              </button>
              <button className="sms-btn sms-btn-primary sms-btn-sm"
                onClick={handleGenererSeances} disabled={genLoading}>
                {genLoading
                  ? <><div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }} />{t.pages.planning.genSeances.generating}</>
                  : <><i className="fas fa-magic" style={{ marginRight: 6 }} />{t.pages.planning.genSeances.generate}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal génération période (HEBDO + INTENSIF) ── */}
      {genPeriodeModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setGenPeriodeModal(false)}>
          <div className="sms-modal" style={{ maxWidth: 440 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className="fas fa-calendar-alt" style={{ marginRight: 8, color: '#66bb6a' }} />
                {t.pages.planning.genPeriode.title}
              </div>
              <button className="sms-btn-icon" onClick={() => setGenPeriodeModal(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="sms-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {t.pages.planning.genPeriode.desc}
              </p>
              <div className="sms-form-row">
                <div className="sms-form-group">
                  <label className="sms-label">{t.pages.planning.genPeriode.dateDebut} *</label>
                  <input className="sms-input" type="date" value={genPeriodeDebut}
                    onChange={e => setGenPeriodeDebut(e.target.value)} />
                </div>
                <div className="sms-form-group">
                  <label className="sms-label">{t.pages.planning.genPeriode.dateFin} *</label>
                  <input className="sms-input" type="date" value={genPeriodeFin}
                    onChange={e => setGenPeriodeFin(e.target.value)} />
                </div>
              </div>
              <div className="sms-form-group">
                <label className="sms-label">{t.pages.planning.genPeriode.anneeLabel} *</label>
                <input className="sms-input" type="text" value={genPeriodeAnnee}
                  onChange={e => setGenPeriodeAnnee(e.target.value)}
                  placeholder="Ex : 2025-2026" />
              </div>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setGenPeriodeModal(false)}>
                {t.common.cancel}
              </button>
              <button className="sms-btn sms-btn-primary sms-btn-sm"
                onClick={handleGenererPeriode} disabled={genPeriodeLoading}
                style={{ background: '#66bb6a', borderColor: '#66bb6a' }}>
                {genPeriodeLoading
                  ? <><div className="sms-spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }} />{t.pages.planning.genPeriode.generating}</>
                  : <><i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />{t.pages.planning.genPeriode.generate}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="flex gap-2" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
          <SearchableSelect
            name="classeFilter"
            value={classeFilter}
            onChange={e => setClasseFilter(e.target.value)}
            options={(classes || []).map(c => ({ value: c.code_classe, label: c.lib_classe || c.code_classe }))}
            placeholder={t.common.allClasses}
          />
        </div>
        <select className="sms-input" style={{ height: 36, minWidth: 130 }}
          value={semestreFilter} onChange={e => setSemestreFilter(e.target.value)}>
          <option value="">
            {labels.isPreBac ? t.pages.planning.allTrimesters : t.pages.planning.allSemesters}
          </option>
          {labels.semestres.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Compteurs rapides ── */}
      <div className="flex gap-2" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: t.pages.planning.labelTotal,    val: filtered.length,  icon: 'fas fa-calendar-check', color: '#42a5f5' },
          { label: t.pages.planning.labelHebdo,    val: hebdo.length,     icon: 'fas fa-sync-alt',       color: '#4caf50' },
          { label: t.pages.planning.labelIntensif, val: intensif.length,  icon: 'fas fa-bolt',           color: '#ffa726' },
        ].map(s => (
          <div key={s.label} className="sms-card" style={{
            flex: 1, minWidth: 130, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={s.icon} style={{ color: s.color, fontSize: 14 }}></i>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Vue Grille HEBDO (positionnement absolu, hauteur ∝ durée) ── */}
      {view === 'grid' && (
        <div className="sms-card" style={{ overflow: 'auto', padding: 0 }}>
          {!classeFilter ? (
            <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-muted)' }}>
              <i className="fas fa-hand-point-up" style={{ fontSize: 40, marginBottom: 14, display: 'block', opacity: .5 }}></i>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.pages.planning.selectClass}
              </div>
              <div style={{ fontSize: 12 }}>
                {t.pages.planning.selectClassHint}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                <i className="fas fa-list" style={{ marginRight: 6 }}></i>
                {t.pages.planning.selectClassTip}
              </div>
            </div>
          ) : !semestreFilter ? (
            // Une grille hebdomadaire ne peut représenter qu'une seule période à la fois :
            // deux semestres/trimestres ne se déroulent pas simultanément dans l'année, mais
            // leurs créneaux peuvent tomber sur le même jour/heure et se superposer visuellement
            // (un bloc en cache alors un autre, sans indication). On force donc à choisir une
            // période précise pour la vue grille ; la vue « Tous » reste disponible sans filtre.
            <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-muted)' }}>
              <i className="fas fa-layer-group" style={{ fontSize: 40, marginBottom: 14, display: 'block', opacity: .5 }}></i>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {labels.isPreBac ? t.pages.planning.selectTrimester : t.pages.planning.selectSemester}
              </div>
              <div style={{ fontSize: 12, maxWidth: 420, margin: '0 auto' }}>
                {t.pages.planning.selectPeriodHint}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                <i className="fas fa-list" style={{ marginRight: 6 }}></i>
                {t.pages.planning.selectClassTip}
              </div>
            </div>
          ) : hebdo.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <i className="fas fa-bolt" style={{ fontSize: 36, marginBottom: 10, display: 'block', color: '#ffa726' }}></i>
              {intensif.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {t.pages.planning.intensifMode}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 16 }}>
                    {intensif.length} {intensif.length > 1 ? t.pages.planning.intensifSlotsPlural : t.pages.planning.intensifSlotSingular}
                  </div>
                  <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={() => setView('list')}>
                    <i className="fas fa-list"></i> {t.pages.planning.viewIntensif}
                  </button>
                </>
              ) : t.pages.planning.noHebdo}
            </div>
          ) : (
            <div style={{ minWidth: 740 }}>

              {/* En-têtes jours */}
              <div style={{
                display: 'grid', gridTemplateColumns: '52px repeat(6,1fr)',
                borderBottom: '2px solid var(--border)',
                position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2,
              }}>
                <div />
                {JOURS_FR.map(j => (
                  <div key={j} style={{
                    padding: '10px 6px', textAlign: 'center',
                    fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                    borderLeft: '1px solid var(--border)',
                  }}>{t.common.jours[JOUR_FR_TO_CODE[j]] || j}</div>
                ))}
              </div>

              {/* Corps : colonne heures + colonnes jours */}
              <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6,1fr)' }}>

                {/* Colonne heures */}
                <div style={{ position: 'relative', height: TOTAL_H }}>
                  {GRID_HOURS.map((h, i) => (
                    <div key={h} style={{
                      position: 'absolute', top: i * HOUR_HEIGHT - 7,
                      width: '100%', textAlign: 'right',
                      paddingRight: 8, fontSize: 10, color: 'var(--text-muted)',
                    }}>
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                  {/* Indicateurs de pauses actives */}
                  {pauseConfig.pauses.filter(p => p.active).map((p, idx) => {
                    const startMin = timeToMin(p.h_debut);
                    if (startMin < GRID_START * 60 || startMin >= GRID_END * 60) return null;
                    const top = (startMin - GRID_START * 60) / 60 * HOUR_HEIGHT;
                    return (
                      <div key={idx} style={{
                        position: 'absolute', top, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <i className="fas fa-coffee" style={{ fontSize: 9, color: '#ffa726', opacity: .85 }}></i>
                      </div>
                    );
                  })}
                </div>

                {/* Colonnes jours */}
                {JOURS_FR.map(j => (
                  <div key={j} style={{
                    position: 'relative', height: TOTAL_H,
                    borderLeft: '1px solid var(--border)',
                  }}>
                    {/* Lignes horaires de fond */}
                    {GRID_HOURS.map((_, i) => (
                      <div key={i} style={{
                        position: 'absolute', top: i * HOUR_HEIGHT,
                        left: 0, right: 0,
                        borderTop: i === 0
                          ? 'none'
                          : '1px solid rgba(255,255,255,.05)',
                      }} />
                    ))}

                    {/* Bandes de pause propres à ce jour (1 ou 2 selon typeEtab) */}
                    {(() => {
                      const pauses   = getPausesForDay(j);
                      const isCustom = Boolean(pauseConfig.overrides[j]);
                      return pauses
                        .slice(0, maxPauses)
                        .filter(p => p.active)
                        .map((pause, idx) => {
                          const startMin = timeToMin(pause.h_debut);
                          const endMin   = timeToMin(pause.h_fin);
                          if (startMin < GRID_START * 60 || endMin > GRID_END * 60) return null;
                          const top    = (startMin - GRID_START * 60) / 60 * HOUR_HEIGHT;
                          const height = Math.max((endMin - startMin) / 60 * HOUR_HEIGHT, 8);
                          const color  = idx === 1 ? '#ab47bc' : (isCustom ? '#ef5350' : '#ffa726');
                          return (
                            <div key={idx} style={{
                              position: 'absolute', top, left: 0, right: 0, height,
                              background: `repeating-linear-gradient(45deg,${color}18,${color}18 4px,${color}08 4px,${color}08 8px)`,
                              borderTop: `1px dashed ${color}50`,
                              borderBottom: `1px dashed ${color}50`,
                              zIndex: 0, pointerEvents: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <span style={{ fontSize: 9, color, opacity: .75, fontStyle: 'italic', userSelect: 'none' }}>
                                {pause.label}{isCustom ? ' ★' : ''}
                              </span>
                            </div>
                          );
                        });
                    })()}

                    {/* Blocs de cours positionnés absolument */}
                    {byDay[j].map((p, i) => {
                      const startMin = timeToMin(p.h_debut);
                      const endMin   = timeToMin(p.h_fin);
                      const top    = (startMin - GRID_START * 60) / 60 * HOUR_HEIGHT + 1;
                      const height = Math.max((endMin - startMin) / 60 * HOUR_HEIGHT - 2, 24);
                      const mat    = p.lib_matiere || '—';
                      const color  = getColor(mat);
                      const tsCol  = SEANCE_COLORS[p.type_seance] || color;
                      return (
                        <div
                          key={i}
                          className="planning-bloc"
                          onClick={() => openEdit(p)}
                          style={{
                            top, left: 3, right: 3, height,
                            background: `${color}22`,
                            border: `1px solid ${color}55`,
                            borderLeft: `3px solid ${color}`,
                            borderRadius: 6, padding: '3px 22px 3px 6px',
                          }}
                        >
                          {/* Bouton supprimer — visible au survol */}
                          <button
                            className="planning-del"
                            onClick={e => { e.stopPropagation(); setDelItem(p); }}
                            title={t.pages.planning.deleteSlotTitle}
                          >
                            <i className="fas fa-times"></i>
                          </button>

                          <div style={{
                            fontSize: 11, fontWeight: 700, color,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{mat}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {p.h_debut?.slice(0, 5)} – {p.h_fin?.slice(0, 5)}
                          </div>
                          {height > 50 && p.nom_ens && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.nom_ens}
                            </div>
                          )}
                          {height > 36 && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: tsCol,
                              background: `${tsCol}25`, borderRadius: 3, padding: '1px 4px',
                            }}>{p.type_seance}</span>
                          )}
                          {height > 48 && p.groupes && (
                            <div style={{ fontSize: 9, color: '#ffa726', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <i className="fas fa-users" style={{ marginRight: 3 }}></i>{p.groupes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vue Liste (HEBDO + INTENSIF) ── */}
      {view === 'list' && (
        <div className="sms-card">
          <div className="sms-table-wrap">
            <table className="sms-table">
              <thead>
                <tr>
                  <th>{t.pages.planning.cols.systeme}</th>
                  <th>{t.pages.planning.cols.seance}</th>
                  <th>{t.fields.matiere}</th>
                  <th>{t.fields.classe}</th>
                  <th>{t.pages.planning.cols.sem}</th>
                  <th>{t.fields.enseignant}</th>
                  <th>{t.pages.planning.cols.groupes}</th>
                  <th>{t.pages.planning.cols.jourSemaine}</th>
                  <th>{t.pages.planning.cols.horaires}</th>
                  <th>{t.fields.salle}</th>
                  <th style={{ width: 90 }}>{t.common.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {t.pages.planning.noSlots}
                    </td>
                  </tr>
                ) : filtered.map((p, i) => {
                  const tsCol = SEANCE_COLORS[p.type_seance] || '#999';
                  return (
                    <tr key={p.id || i}>
                      <td>
                        <span className={`sms-badge ${p.type_planning === 'HEBDO' ? 'badge-success' : 'badge-warning'}`}>
                          {p.type_planning}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 4, color: tsCol, background: `${tsCol}20`,
                        }}>
                          {p.type_seance}
                        </span>
                      </td>
                      <td><strong>{p.lib_matiere || '—'}</strong></td>
                      <td>{p.lib_classe || '—'}</td>
                      <td><span className="sms-badge badge-info">{p.semestre || '—'}</span></td>
                      <td>{p.nom_ens || '—'}</td>
                      <td>
                        {p.groupes
                          ? <span style={{ fontSize: 11, color: '#ffa726', fontStyle: 'italic' }}>
                              <i className="fas fa-users" style={{ marginRight: 4 }}></i>{p.groupes}
                            </span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        {p.type_planning === 'HEBDO'
                          ? <span className="sms-badge badge-info">{t.common.jours[p.code_jour] || p.lib_jour || p.code_jour || '—'}</span>
                          : <span style={{ fontSize: 12 }}>{p.date_debut} → {p.date_fin}</span>
                        }
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {p.h_debut?.slice(0, 5)} – {p.h_fin?.slice(0, 5)}
                      </td>
                      <td>{p.lib_salle || p.code_salle || <span className="text-muted">—</span>}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="sms-btn-icon" onClick={() => openEdit(p)} title={t.common.edit}>
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="sms-btn-icon danger" onClick={() => setDelItem(p)} title={t.common.delete}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal formulaire ── */}
      {showModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="sms-modal" style={{ maxWidth: 560 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                {editItem ? t.pages.planning.editSlot : t.pages.planning.newSlot}
              </div>
              <button className="sms-btn-icon" onClick={close}><i className="fas fa-times"></i></button>
            </div>
            <div className="sms-modal-body">
              <PlanningForm item={editItem} onClose={close} onSave={handleSave} labels={labels} />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pauses ── */}
      {showPauseModal && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setShowPauseModal(false)}>
          <div className="sms-modal" style={{ maxWidth: 520 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title">
                <i className="fas fa-coffee" style={{ marginRight: 8, color: '#ffa726' }}></i>
                {t.pages.planning.pauseTitle}
              </div>
              <button className="sms-btn-icon" onClick={() => setShowPauseModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="sms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* ── Pauses par défaut (1 ou 2 selon typeEtab) ── */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  <i className="fas fa-globe" style={{ marginRight: 6, color: '#ffa726' }}></i>
                  {t.pages.planning.defaultPause}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pauseConfig.pauses.slice(0, maxPauses).map((pause, idx) => {
                    const colors = ['#ffa726', '#ab47bc'];
                    const color  = colors[idx];
                    return (
                      <div key={idx} style={{
                        display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px',
                        gap: 8, padding: '12px 14px',
                        background: `${color}10`, borderRadius: 8,
                        border: `1px solid ${color}40`,
                        opacity: pause.active ? 1 : .5,
                      }}>
                        {/* Toggle actif */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            onClick={() => togglePauseActive(idx)}
                            title={pause.active ? 'Désactiver' : 'Activer'}
                            style={{
                              width: 22, height: 22, border: `2px solid ${color}`,
                              borderRadius: 4, background: pause.active ? color : 'transparent',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {pause.active && <i className="fas fa-check" style={{ fontSize: 10, color: '#fff' }}></i>}
                          </button>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                            {t.pages.planning.labelField} {idx + 1}
                          </div>
                          <input
                            className="sms-input" style={{ height: 32, fontSize: 12 }}
                            value={pause.label}
                            onChange={e => updatePause(idx, 'label', e.target.value)}
                            disabled={!pause.active}
                            placeholder={`Pause ${idx + 1}`}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{t.pages.planning.startField}</div>
                          <input type="time" className="sms-input"
                            style={{ height: 32, fontSize: 12, padding: '0 6px' }}
                            value={pause.h_debut}
                            onChange={e => updatePause(idx, 'h_debut', e.target.value)}
                            disabled={!pause.active}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{t.pages.planning.endField}</div>
                          <input type="time" className="sms-input"
                            style={{ height: 32, fontSize: 12, padding: '0 6px' }}
                            value={pause.h_fin}
                            onChange={e => updatePause(idx, 'h_fin', e.target.value)}
                            disabled={!pause.active}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Personnalisation par jour ── */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  <i className="fas fa-sliders-h" style={{ marginRight: 6, color: '#ef5350' }}></i>
                  {t.pages.planning.perDay} <span style={{ color: '#ef5350' }}>★</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {JOURS_FR.map(jour => {
                    const hasOverride = Boolean(pauseConfig.overrides[jour]);
                    const ovPauses    = pauseConfig.overrides[jour] || pauseConfig.pauses;
                    const summary     = ovPauses
                      .slice(0, maxPauses)
                      .filter(p => p.active)
                      .map(p => `${p.h_debut}–${p.h_fin}`)
                      .join(', ');
                    return (
                      <div key={jour} style={{
                        borderRadius: 8, border: `1px solid ${hasOverride ? '#ef535050' : 'var(--border)'}`,
                        background: hasOverride ? '#ef535008' : 'var(--bg-hover)',
                        overflow: 'hidden',
                      }}>
                        {/* En-tête jour */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: hasOverride ? '#ef5350' : 'var(--text-primary)', minWidth: 70 }}>
                              {t.common.jours[JOUR_FR_TO_CODE[jour]] || jour}
                            </span>
                            <span style={{ fontSize: 10, color: hasOverride ? '#ef5350' : 'var(--text-muted)', fontStyle: 'italic' }}>
                              {summary || '—'} {hasOverride ? t.pages.planning.customTag : `(${t.pages.planning.defaultTag})`}
                            </span>
                          </div>
                          <button
                            className="sms-btn sms-btn-sm sms-btn-outline"
                            style={{
                              fontSize: 10, padding: '3px 10px', height: 26,
                              borderColor: hasOverride ? '#ef5350' : 'var(--border)',
                              color: hasOverride ? '#ef5350' : 'var(--text-muted)',
                            }}
                            onClick={() => hasOverride ? removeDayOverride(jour) : enableDayOverride(jour)}
                          >
                            {hasOverride
                              ? <><i className="fas fa-times" style={{ marginRight: 4 }}></i>{t.pages.planning.removeOverride}</>
                              : <><i className="fas fa-edit" style={{ marginRight: 4 }}></i>{t.pages.planning.customizeDay}</>
                            }
                          </button>
                        </div>

                        {/* Champs éditables par pause — visibles seulement si override actif */}
                        {hasOverride && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px 12px' }}>
                            {ovPauses.slice(0, maxPauses).map((ov, idx) => {
                              const colors = ['#ffa726', '#ab47bc'];
                              const color  = colors[idx];
                              return (
                                <div key={idx} style={{
                                  display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px',
                                  gap: 6, padding: '8px 10px',
                                  background: `${color}08`, borderRadius: 6,
                                  border: `1px solid ${color}30`,
                                  opacity: ov.active ? 1 : .5,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <button
                                      onClick={() => toggleDayPauseActive(jour, idx)}
                                      style={{
                                        width: 20, height: 20, border: `2px solid ${color}`,
                                        borderRadius: 3, background: ov.active ? color : 'transparent',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      {ov.active && <i className="fas fa-check" style={{ fontSize: 9, color: '#fff' }}></i>}
                                    </button>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{t.pages.planning.labelField} {idx + 1}</div>
                                    <input className="sms-input" style={{ height: 28, fontSize: 11 }}
                                      value={ov.label} disabled={!ov.active}
                                      onChange={e => updateDayPause(jour, idx, 'label', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{t.pages.planning.startField}</div>
                                    <input type="time" className="sms-input" style={{ height: 28, fontSize: 11, padding: '0 4px' }}
                                      value={ov.h_debut} disabled={!ov.active}
                                      onChange={e => updateDayPause(jour, idx, 'h_debut', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{t.pages.planning.endField}</div>
                                    <input type="time" className="sms-input" style={{ height: 28, fontSize: 11, padding: '0 4px' }}
                                      value={ov.h_fin} disabled={!ov.active}
                                      onChange={e => updateDayPause(jour, idx, 'h_fin', e.target.value)}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                {t.pages.planning.autoSave}
              </p>
            </div>

            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-primary sms-btn-sm" onClick={() => setShowPauseModal(false)}>
                <i className="fas fa-check"></i> {t.pages.planning.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ── */}
      {delItem && (
        <div className="sms-overlay" onClick={e => e.target === e.currentTarget && setDelItem(null)}>
          <div className="sms-modal" style={{ maxWidth: 400 }}>
            <div className="sms-modal-header">
              <div className="sms-modal-title" style={{ color: 'var(--danger)' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>
                {t.pages.planning.confirmDelete}
              </div>
            </div>
            <div className="sms-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {t.pages.planning.deleteSlotMsg}
              </p>
            </div>
            <div className="sms-modal-footer">
              <button className="sms-btn sms-btn-outline sms-btn-sm" onClick={() => setDelItem(null)}>{t.common.cancel}</button>
              <button className="sms-btn sms-btn-danger sms-btn-sm" onClick={() => handleDelete(delItem)}>
                <i className="fas fa-trash"></i> {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
