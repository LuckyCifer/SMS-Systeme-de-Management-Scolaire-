/**
 * pages/Decisions.jsx — Délibérations et décisions jury
 */
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { CrudTable, FormField } from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import { useApp } from '../context/AppContext';
import { useApi, useMutation } from '../hooks/useApi';
import { decisionService } from '../services/endpoints';
import { LoadingState, ErrorState } from '../components/ApiState';
import { useEtablissement } from '../hooks/useEtablissement';
import { etabLabels } from '../utils/etabLabels';

const RESULTAT_COLORS = {
  ADMIS: 'badge-success', AJOURNE: 'badge-warning',
  REDOUBLE: 'badge-danger', EXCLU: 'badge-secondary',
};

function Form({ item, onClose, onSave, labels }) {
  const { t } = useApp();
  const [etudiants, setEts]     = useState([]);
  const [classes,   setClasses] = useState([]);
  const [annees,    setAnnees]  = useState([]);
  const [loading,   setLoad]    = useState(true);

  const [f, setF] = useState({
    mle_etudiant:      item?.mle_etudiant || '',
    code_annee:        item?.code_annee   || '',
    code_classe:       item?.code_classe  || '',
    moyenne_annuelle:  item?.moyenne_annuelle  || '',
    total_credits:     item?.total_credits     || 0,
    credits_valides:   item?.credits_valides   || 0,
    resultat:          item?.resultat          || 'ADMIS',
    mention:           item?.mention           || '',
    rang:              item?.rang              || '',
    effectif:          item?.effectif          || '',
    date_deliberation: item?.date_deliberation?.slice(0, 10) || '',
    president_jury:    item?.president_jury    || '',
    observations:      item?.observations      || '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/api/etudiants/?page_size=200'),
      api.get('/api/classes/?page_size=100'),
      api.get('/api/annees/?page_size=20'),
    ]).then(([e, c, a]) => {
      setEts(e.data.results ?? e.data);
      setClasses(c.data.results ?? c.data);
      setAnnees(a.data.results ?? a.data);
    }).finally(() => setLoad(false));
  }, []);

  const ch = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="sms-spinner" style={{ width: 32, height: 32, margin: 'auto' }}></div></div>;

  const RESULTATS = [
    { value: 'ADMIS',     label: t.status.admis },
    { value: 'AJOURNE',   label: t.status.ajourné },
    { value: 'REDOUBLE',  label: t.status.redoublé },
    { value: 'EXCLU',     label: t.status.exclu },
  ];
  const MENTIONS = [
    { value: 'Très Bien',   label: t.mentions.tresBien },
    { value: 'Bien',        label: t.mentions.bien },
    { value: 'Assez Bien',  label: t.mentions.assezBien },
    { value: 'Passable',    label: t.mentions.passable },
    { value: 'Insuffisant', label: t.mentions.insuffisant },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="sms-form-row">
        <SearchableSelect
          label={labels?.studentLabel || t.fields.nomEtud} name="mle_etudiant" value={f.mle_etudiant} onChange={ch} required
          options={etudiants.map(e => ({ value: e.mle_etudiant, label: `${e.nom} ${e.prenom || ''} (${e.mle_etudiant})` }))}
          placeholder="Rechercher par nom ou matricule…"
        />
        <SearchableSelect
          label={t.fields.classe} name="code_classe" value={f.code_classe} onChange={ch} required
          options={classes.map(c => ({ value: c.code_classe, label: c.lib_classe }))}
        />
        <SearchableSelect
          label={t.fields.annee} name="code_annee" value={f.code_annee} onChange={ch} required
          options={annees.map(a => ({ value: a.code_annee, label: a.lib_annee || a.code_annee }))}
        />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.moyenne} name="moyenne_annuelle" type="number" value={f.moyenne_annuelle} onChange={ch} placeholder="14.50" />
        {/* Crédits ECTS — supérieur uniquement */}
        {labels?.showCredits && (
          <FormField label={t.fields.creditsTotal} name="total_credits"   type="number" value={f.total_credits}   onChange={ch} />
        )}
        {labels?.showCredits && (
          <FormField label={t.fields.creditsVal}   name="credits_valides" type="number" value={f.credits_valides} onChange={ch} />
        )}
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.resultat} name="resultat" type="select" value={f.resultat} onChange={ch} required options={RESULTATS} />
        <FormField label={t.fields.mention}  name="mention"  type="select" value={f.mention}  onChange={ch} options={[{ value:'', label: t.common.noMention }, ...MENTIONS]} />
      </div>
      <div className="sms-form-row">
        <FormField label={t.fields.rang}      name="rang"              type="number" value={f.rang}              onChange={ch} />
        <FormField label={t.fields.effectif}  name="effectif"          type="number" value={f.effectif}          onChange={ch} />
        <FormField label={t.fields.dateDelib} name="date_deliberation" type="date"   value={f.date_deliberation} onChange={ch} help="Format : JJ/MM/AAAA" />
      </div>
      <FormField label={labels?.presidentLabel || t.fields.president} name="president_jury" value={f.president_jury} onChange={ch} />
      <FormField label={t.fields.obs}       name="observations"   type="textarea" value={f.observations} onChange={ch} />
      <div className="sms-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
        <button type="button" className="sms-btn sms-btn-outline sms-btn-sm" onClick={onClose}>{t.common.cancel}</button>
        <button type="submit" className="sms-btn sms-btn-primary sms-btn-sm"><i className="fas fa-save"></i> {t.common.save}</button>
      </div>
    </form>
  );
}

export default function Decisions() {
  const { t, toast, anneeActive, lang } = useApp();
  const { typeEtab, systeme } = useEtablissement();
  const labels = etabLabels(typeEtab, systeme, lang);

  const [classeFilter,   setClasseFilter]   = useState('');
  const [anneeFilter,    setAnneeFilter]    = useState('');
  const [depFilter,      setDepFilter]      = useState('');
  const [spFilter,       setSpFilter]       = useState('');
  const [classes,        setClasses]        = useState([]);
  const [filteredClasses,setFilteredClasses]= useState([]);
  const [annees,         setAnnees]         = useState([]);
  const [departements,   setDepartements]   = useState([]);
  const [specialites,    setSpecialites]    = useState([]);
  const [filteredSp,     setFilteredSp]     = useState([]);

  const { data, loading, error, reload } = useApi(
    () => decisionService.list({
      page_size: 200,
      ...(classeFilter ? { code_classe: classeFilter } : {}),
      ...(anneeFilter  ? { code_annee:  anneeFilter  } : {}),
      ...(depFilter    ? { code_dep:    depFilter    } : {}),
      ...(spFilter     ? { code_sp:     spFilter     } : {}),
    }),
    [classeFilter, anneeFilter, depFilter, spFilter]
  );
  const { mutate: create } = useMutation(useCallback(d => decisionService.create(d), []));
  const { mutate: update } = useMutation(useCallback(d => decisionService.update(d.code_decision, d), []));
  const { mutate: remove } = useMutation(useCallback(d => decisionService.delete(d.code_decision), []));

  useEffect(() => {
    api.get('/api/classes/?page_size=100').then(r => {
      const cls = r.data.results ?? r.data;
      setClasses(cls);
      setFilteredClasses(cls);
    }).catch(() => {});
    api.get('/api/annees/?page_size=20').then(r => setAnnees(r.data.results ?? r.data)).catch(() => {});
    if (labels.isSuperieur) {
      Promise.all([
        api.get('/api/departements/?page_size=100'),
        api.get('/api/specialites/?page_size=200'),
      ]).then(([dR, sR]) => {
        setDepartements(dR.data.results ?? dR.data);
        const sps = sR.data.results ?? sR.data;
        setSpecialites(sps);
        setFilteredSp(sps);
      }).catch(() => {});
    }
  }, [typeEtab]);

  useEffect(() => {
    if (!depFilter) {
      setFilteredSp(specialites);
      setSpFilter('');
    } else {
      const f = specialites.filter(s => {
        const d = typeof s.code_dep === 'object' ? s.code_dep?.code_dep : s.code_dep;
        return d === depFilter;
      });
      setFilteredSp(f);
      if (spFilter && !f.some(s => s.code_sp === spFilter)) setSpFilter('');
    }
  }, [depFilter, specialites]);

  // Filtre les classes selon département ET spécialité
  useEffect(() => {
    if (!depFilter && !spFilter) {
      setFilteredClasses(classes);
    } else {
      const f = classes.filter(c => {
        const cDep = typeof c.code_dep === 'object' ? c.code_dep?.code_dep : c.code_dep;
        const cSp  = typeof c.code_sp  === 'object' ? c.code_sp?.code_sp  : c.code_sp;
        const matchDep = !depFilter || cDep === depFilter;
        const matchSp  = !spFilter  || cSp  === spFilter;
        return matchDep && matchSp;
      });
      setFilteredClasses(f);
      if (classeFilter && !f.some(c => c.code_classe === classeFilter)) setClasseFilter('');
    }
  }, [depFilter, spFilter, classes]);

  const nb = (res) => (data || []).filter(d => d.resultat === res).length;

  const COLS = [
    { key: 'mle',     label: t.fields.matricule, render: r => r.mle_etudiant || '—' },
    { key: 'etud',    label: labels.studentLabel, searchValue: r => r.nom_etudiant || r.mle_etudiant, render: r => <strong>{r.nom_etudiant || r.mle_etudiant}</strong> },
    { key: 'classe',  label: t.fields.classe,    render: r => r.lib_classe || r.code_classe },
    { key: 'annee',   label: t.fields.annee,     render: r => r.lib_annee || r.code_annee || '—' },
    { key: 'session', label: t.fields.session,   searchValue: r => r.session || '', render: r => r.session
        ? <span className="sms-badge badge-info">{r.session}</span>
        : <span style={{ color:'var(--text-muted)' }}>—</span>
    },
    { accessor: 'moyenne_annuelle', label: t.common.moyenne, render: r => (
      <strong style={{ color: r.moyenne_annuelle >= 10 ? 'var(--green)' : '#c62828', fontSize: 13 }}>
        {r.moyenne_annuelle ? `${r.moyenne_annuelle}/20` : '—'}
      </strong>
    )},
    // Crédits ECTS — supérieur uniquement
    ...(labels.showCredits ? [{
      key: 'credits', label: t.fields.credits,
      render: r => `${r.credits_valides ?? 0}/${r.total_credits ?? 0}`,
    }] : []),
    { key: 'mention', label: t.fields.mention, searchValue: r => r.mention || '', render: r => r.mention ? <span className="sms-badge badge-info">{r.mention}</span> : '—' },
    { key: 'resultat', label: t.fields.resultat, searchValue: r => r.resultat || '', render: r => {
      const color = RESULTAT_COLORS[r.resultat] || 'badge-secondary';
      return <span className={`sms-badge ${color}`}>{r.resultat}</span>;
    }},
    { key: 'rang', label: t.fields.rang, render: r => r.rang ? `${r.rang}/${r.effectif}` : '—' },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={reload} />;

  const csvQuery = [
    classeFilter && `code_classe=${classeFilter}`,
    anneeFilter  && `code_annee=${anneeFilter}`,
    depFilter    && `code_dep=${depFilter}`,
    spFilter     && `code_sp=${spFilter}`,
  ].filter(Boolean).join('&');

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 16 }}>
        {[
          { label: t.status.admis,    count: nb('ADMIS'),    color: 'c-green',  icon: 'fas fa-check-circle' },
          { label: t.status.ajourné,  count: nb('AJOURNE'),  color: 'c-orange', icon: 'fas fa-clock' },
          { label: t.status.redoublé, count: nb('REDOUBLE'), color: 'c-red',    icon: 'fas fa-redo' },
          { label: t.common.total,    count: (data || []).length, color: 'c-blue', icon: 'fas fa-users' },
        ].map(s => (
          <div className={`stat-card ${s.color}`} key={s.label}>
            <div className={`stat-icon ${s.color}`}><i className={s.icon}></i></div>
            <div><div className="stat-value">{s.count}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <CrudTable
        title={t.pages.decisions.title}
        subtitle={t.pages.decisions.subtitle}
        sortBy={r => r.nom_etudiant || r.mle_etudiant || ''}
        icon="fas fa-gavel"
        columns={COLS}
        data={data || []}
        addLabel={t.pages.decisions.addLabel}
        exportCsvUrl={`/api/decisions/export-csv/${csvQuery ? `?${csvQuery}` : ''}`}
        filters={
          <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
            {/* Filière + Spécialité — supérieur uniquement */}
            {labels.isSuperieur && <>
              <select className="sms-input" style={{ height: 34, width: 'auto', minWidth: 180, fontSize: 12 }}
                value={depFilter} onChange={e => setDepFilter(e.target.value)}>
                <option value="">{t.common.allDepts}</option>
                {departements.map(d => <option key={d.code_dep} value={d.code_dep}>{d.lib_dep}</option>)}
              </select>
              <select className="sms-input" style={{ height: 34, width: 'auto', minWidth: 180, fontSize: 12 }}
                value={spFilter} onChange={e => setSpFilter(e.target.value)} disabled={!depFilter}>
                <option value="">{t.common.allSp}</option>
                {filteredSp.map(s => <option key={s.code_sp} value={s.code_sp}>{s.lib_sp}</option>)}
              </select>
            </>}
            {/* Classe — filtrée par dep/sp quand ils sont actifs */}
            <select className="sms-input" style={{ height: 34, width: 'auto', minWidth: 160, fontSize: 12 }}
              value={classeFilter} onChange={e => setClasseFilter(e.target.value)}
              disabled={labels.isSuperieur && !!depFilter && filteredClasses.length === 0}>
              <option value="">{t.common.allClasses}</option>
              {filteredClasses.map(c => <option key={c.code_classe} value={c.code_classe}>{c.lib_classe}</option>)}
            </select>
            {/* Année — tous types */}
            <select className="sms-input" style={{ height: 34, width: 'auto', minWidth: 140, fontSize: 12 }}
              value={anneeFilter} onChange={e => setAnneeFilter(e.target.value)}>
              <option value="">{t.common.allYears}</option>
              {annees.map(a => <option key={a.code_annee} value={a.code_annee}>{a.lib_annee || a.code_annee}</option>)}
            </select>
            {(depFilter || spFilter || classeFilter || anneeFilter) && (
              <button className="sms-btn-icon"
                onClick={() => { setDepFilter(''); setSpFilter(''); setClasseFilter(''); setAnneeFilter(''); }}
                title={t.common.reset}>
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        }
        onAdd={async d => { try { await create(d); toast.success(t.toast.saved); reload(); } catch (e) { toast.error(e.message); } }}
        onEdit={async d => { try { await update(d); toast.success(t.toast.updated); reload(); } catch (e) { toast.error(e.message); } }}
        onDelete={async d => { try { await remove(d); toast.success(t.toast.deleted); reload(); } catch (e) { toast.error(e.message); } }}
        renderForm={p => <Form {...p} labels={labels} />}
      />
    </div>
  );
}
