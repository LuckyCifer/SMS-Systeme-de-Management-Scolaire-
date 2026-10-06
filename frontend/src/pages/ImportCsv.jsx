/**
 * pages/ImportCsv.jsx — Wizard 3 étapes pour l'import CSV en masse.
 * Étape 1 : choisir le type d'entité (+ étab si SUPER_ADMIN)
 * Étape 2 : charger le fichier CSV + options
 * Étape 3 : rapport de résultat
 */
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { importCsvService } from '../services/endpoints';
import api from '../services/api';
import ImportRapport from '../components/ImportRapport';

// ── Config entités ─────────────────────────────────────────────────────────────
const ENTITY_ICONS = {
  enseignants:  { icon: 'fas fa-chalkboard-teacher', cls: 'c-blue' },
  personnel:    { icon: 'fas fa-id-badge',            cls: 'c-purple' },
  etudiants:    { icon: 'fas fa-user-graduate',       cls: 'c-green' },
  inscriptions: { icon: 'fas fa-file-signature',      cls: 'c-orange' },
  notes:        { icon: 'fas fa-star-half-alt',       cls: 'c-red' },
  paiements:    { icon: 'fas fa-money-bill-wave',     cls: 'c-teal' },
};

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ step, t }) {
  const steps = [t.step1Title, t.step2Title, t.step3Title];
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      {steps.map((label, i) => {
        const num   = i + 1;
        const done  = step > num;
        const active = step === num;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: done ? '#1A6B3C' : active ? '#1F3864' : 'var(--border)',
                color: done || active ? '#fff' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {done ? <i className="fas fa-check" style={{ fontSize: 12 }}></i> : num}
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#1F3864' : done ? '#1A6B3C' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ flex: 1, height: 2, background: done ? '#1A6B3C' : 'var(--border)', margin: '0 12px', minWidth: 20 }}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Étape 1 — Sélection du type ────────────────────────────────────────────────
function Step1({ selected, onChange, etabs, etabTarget, onEtabChange, isSuperAdmin, t }) {
  const entities = Object.keys(ENTITY_ICONS);
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>{t.step1Sub}</p>

      {/* Grille des types d'entité */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 24 }}>
        {entities.map(key => {
          const { icon, cls } = ENTITY_ICONS[key];
          const active = selected === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              style={{
                border: `2px solid ${active ? '#1F3864' : 'var(--border)'}`,
                borderRadius: 10, padding: '16px', textAlign: 'left', cursor: 'pointer',
                background: active ? '#1F386410' : 'var(--bg-card)',
                transition: 'all .15s', display: 'flex', alignItems: 'flex-start', gap: 12,
              }}
            >
              <div className={`stat-icon ${cls}`} style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
                <i className={icon}></i>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#1F3864' : 'var(--text-primary)', marginBottom: 3 }}>
                  {t.entities[key]}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {t.entityDesc[key]}
                </div>
              </div>
              {active && (
                <i className="fas fa-check-circle" style={{ color: '#1F3864', marginLeft: 'auto', flexShrink: 0, marginTop: 2 }}></i>
              )}
            </button>
          );
        })}
      </div>

      {/* Sélecteur d'établissement (SUPER_ADMIN) */}
      {isSuperAdmin && (
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            <i className="fas fa-building" style={{ marginRight: 6, color: '#1F3864' }}></i>
            {t.etabLabel}
          </label>
          <select
            className="sms-input"
            style={{ maxWidth: 380 }}
            value={etabTarget}
            onChange={e => onEtabChange(e.target.value)}
          >
            <option value="">— Tous les établissements actifs —</option>
            {etabs.map(e => (
              <option key={e.code_etab} value={e.code_etab}>
                {e.sigle || e.code_etab} — {e.nom_etab}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Étape 2 — Chargement du fichier ────────────────────────────────────────────
function Step2({ entityType, file, onFile, dryRun, onDryRun, uploading, onSubmit, t, toast }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'csv') {
      toast.error('Format invalide — seuls les fichiers .csv sont acceptés.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (maximum 5 Mo).');
      return;
    }
    onFile(f);
  };

  const downloadTemplate = async () => {
    try {
      const res = await importCsvService.template(entityType);
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `gabarit_${entityType}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('[downloadTemplate]', err); toast.error('Impossible de télécharger le gabarit.'); }
  };

  const { icon, cls } = ENTITY_ICONS[entityType] || {};

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>{t.step2Sub}</p>

      {/* Type sélectionné (rappel) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-darkest)', border: '1px solid var(--border)', marginBottom: 20 }}>
        {icon && <i className={icon} style={{ fontSize: 16, color: '#1F3864' }}></i>}
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1F3864' }}>{t.entities[entityType]}</span>
        <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2E74B5', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginLeft: 8 }}>
          <i className="fas fa-download"></i> {t.downloadTpl}
        </button>
      </div>

      {/* Zone drag & drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1F3864' : file ? '#1A6B3C' : 'var(--border)'}`,
          borderRadius: 12, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? '#1F386408' : file ? '#1A6B3C08' : 'var(--bg-darkest)',
          transition: 'all .2s', marginBottom: 16,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {file ? (
          <div>
            <i className="fas fa-file-csv" style={{ fontSize: 40, color: '#1A6B3C', marginBottom: 10 }}></i>
            <div style={{ fontWeight: 700, color: '#1A6B3C', fontSize: 15 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} Ko
            </div>
          </div>
        ) : (
          <div>
            <i className="fas fa-cloud-upload-alt" style={{ fontSize: 40, color: 'var(--text-muted)', marginBottom: 10 }}></i>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{t.dragHint}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t.maxRows}</div>
          </div>
        )}
      </div>

      {/* Option dry_run */}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, background: dryRun ? '#1F386410' : 'var(--bg-darkest)', border: '1px solid var(--border)', marginBottom: 20, userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={dryRun}
          onChange={e => onDryRun(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#1F3864' }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.dryRunLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.dryRunHint}</div>
        </div>
      </label>

      {/* Bouton */}
      <div>
        <button
          className="sms-btn sms-btn-primary"
          disabled={!file || uploading}
          onClick={onSubmit}
          style={{ minWidth: 180 }}
        >
          {uploading
            ? <><div className="sms-spinner" style={{ width: 14, height: 14 }}></div> {dryRun ? t.simulating : t.importing}</>
            : <><i className={dryRun ? 'fas fa-flask' : 'fas fa-upload'}></i> {dryRun ? t.btnDryRun : t.btnImport}</>}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ImportCsv() {
  const { t: tAll, toast, user } = useApp();
  const t = tAll.pages.importCsv;

  const [step,         setStep]         = useState(1);
  const [entityType,   setEntityType]   = useState('');
  const [etabTarget,   setEtabTarget]   = useState('');
  const [etabs,        setEtabs]        = useState([]);
  const [file,         setFile]         = useState(null);
  const [dryRun,       setDryRun]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [result,       setResult]       = useState(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Charger les établissements si SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/api/etablissements/', { params: { page_size: 100 } })
      .then(r => setEtabs(r.data?.results ?? r.data ?? []))
      .catch(() => {});
  }, [isSuperAdmin]);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dry_run', dryRun ? 'true' : 'false');
      if (etabTarget) formData.append('code_etab', etabTarget);

      const res = await importCsvService.upload(entityType, formData);
      setResult(res.data);
      setStep(3);

      if (!dryRun) {
        const n = (res.data.created || 0) + (res.data.updated || 0);
        if (n > 0 && !res.data.errors?.length) {
          toast.success(t.successImport);
        }
      }
    } catch (e) {
      const msg = e.response?.data?.error || tAll.errors?.saving || 'Erreur import';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep(1); setEntityType(''); setFile(null);
    setDryRun(false); setResult(null); setEtabTarget('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-file-import text-blue" style={{ marginRight: 10, fontSize: 22 }}></i>
            {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </div>

      <Stepper step={step} t={t} />

      <div className="sms-card" style={{ padding: '24px 28px' }}>
        {step === 1 && (
          <>
            <Step1
              selected={entityType}
              onChange={setEntityType}
              etabs={etabs}
              etabTarget={etabTarget}
              onEtabChange={setEtabTarget}
              isSuperAdmin={isSuperAdmin}
              t={t}
            />
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="sms-btn sms-btn-primary"
                disabled={!entityType}
                onClick={() => setStep(2)}
              >
                {t.btnNext} <i className="fas fa-arrow-right" style={{ marginLeft: 6 }}></i>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Step2
              entityType={entityType}
              file={file}
              onFile={setFile}
              dryRun={dryRun}
              onDryRun={setDryRun}
              uploading={uploading}
              onSubmit={handleSubmit}
              t={t}
              toast={toast}
            />
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
              <button className="sms-btn sms-btn-outline" onClick={() => { setStep(1); setFile(null); }}>
                <i className="fas fa-arrow-left" style={{ marginRight: 6 }}></i> {t.btnBack}
              </button>
            </div>
          </>
        )}

        {step === 3 && result && (
          <>
            <ImportRapport result={result} t={t} />
            <div style={{ marginTop: 24 }}>
              <button className="sms-btn sms-btn-primary" onClick={reset}>
                <i className="fas fa-plus" style={{ marginRight: 6 }}></i> {t.btnNewImport}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
