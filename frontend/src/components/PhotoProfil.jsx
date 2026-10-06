/**
 * components/PhotoProfil.jsx — Sélecteur de photo de profil format demi-carte.
 *
 * Props :
 *   photoUrl  string|null  URL actuelle de la photo (depuis le serveur)
 *   onChange  function     appelée avec le File brut quand l'utilisateur choisit une photo
 *   onDelete  function     appelée quand l'utilisateur clique sur "Supprimer"
 *   loading   bool         affiche un spinner à la place
 *   disabled  bool         lecture seule
 *   label     string       libellé affiché sous le cadre
 *   size      'sm'|'md'   sm = 80×103 px  |  md = 140×180 px (défaut)
 */
import { useState, useRef, useEffect } from 'react';

const SIZES = {
  sm: { w: 80,  h: 103, iconSize: 28, fontSize: 9 },
  md: { w: 140, h: 180, iconSize: 44, fontSize: 11 },
};

const ACCEPTED = '.jpg,.jpeg,.png,.webp';
const MAX_MB   = 2;

export default function PhotoProfil({
  photoUrl  = null,
  onChange  = () => {},
  onDelete  = () => {},
  loading   = false,
  disabled  = false,
  label     = 'Photo de profil',
  size      = 'md',
}) {
  const { w, h, iconSize, fontSize } = SIZES[size] || SIZES.md;
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  // Réinitialise l'aperçu local si photoUrl change (ex: après save)
  useEffect(() => {
    if (photoUrl) setPreview(null);
  }, [photoUrl]);

  const displaySrc = preview || photoUrl;

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      alert('Format invalide. Utilisez JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`Fichier trop lourd (max ${MAX_MB} Mo).`);
      return;
    }
    // Aperçu local immédiat
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    onChange(file);
  };

  const handleDelete = () => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    onDelete();
  };

  const frameStyle = {
    width: w, height: h, flexShrink: 0,
    border: displaySrc ? '1px solid var(--border-light)' : '2px dashed var(--border)',
    borderRadius: 4,
    background: displaySrc ? 'transparent' : 'var(--bg-darkest)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: displaySrc ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
    transition: 'border-color .15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={e => handleFile(e.target.files[0])}
      />

      {/* Cadre photo */}
      <div
        style={frameStyle}
        onClick={() => !disabled && !loading && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); if (!disabled) handleFile(e.dataTransfer.files[0]); }}
        title={disabled ? '' : 'Cliquer pour choisir une photo'}
      >
        {loading ? (
          <div className="sms-spinner" style={{ width: 24, height: 24 }}></div>
        ) : displaySrc ? (
          <img
            src={displaySrc}
            alt="Photo de profil"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 8, pointerEvents: 'none' }}>
            <i className="fas fa-user" style={{ fontSize: iconSize, color: 'var(--border)', display: 'block', marginBottom: 6 }}></i>
            {!disabled && (
              <span style={{ fontSize, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                Cliquer ou<br />glisser une photo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Libellé */}
      {label && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500 }}>
          {label}
        </span>
      )}

      {/* Boutons d'action */}
      {!disabled && !loading && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              background: 'var(--bg-darkest)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <i className="fas fa-folder-open" style={{ marginRight: 4 }}></i>
            {displaySrc ? 'Changer' : 'Parcourir'}
          </button>
          {displaySrc && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                background: 'rgba(239,83,80,.08)', border: '1px solid rgba(239,83,80,.3)',
                color: 'var(--danger)',
              }}
            >
              <i className="fas fa-trash-alt" style={{ marginRight: 4 }}></i>
              Supprimer
            </button>
          )}
        </div>
      )}

      {/* Indication format */}
      {!disabled && !displaySrc && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          JPG · PNG · WebP — max {MAX_MB} Mo<br />
          Ratio demi-carte (3,5 × 4,5 cm)
        </span>
      )}
    </div>
  );
}
