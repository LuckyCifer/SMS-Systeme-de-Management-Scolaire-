/**
 * utils/avatar.js — Helper pour l'affichage des avatars (photo ou initiales).
 *
 * Utilisation :
 *   const av = getAvatarProps(nom, prenom, photoUrl);
 *   if (av.type === 'photo') <img src={av.src} />;
 *   if (av.type === 'initiales') <div style={{background: av.color}}>{av.text}</div>;
 */

const AVATAR_COLORS = [
  '#1F4E79', // bleu marine
  '#1A6B3C', // vert forêt
  '#7B2D8B', // violet
  '#8B4513', // brun
  '#2E74B5', // bleu moyen
  '#C0392B', // rouge foncé
  '#16A085', // teal
  '#D35400', // orange foncé
];

/**
 * Retourne les propriétés d'affichage d'un avatar.
 *
 * @param {string} nom      — Nom de famille
 * @param {string} prenom   — Prénom (optionnel)
 * @param {string|null} photoUrl — URL de la photo (null si absente)
 * @returns {{ type: 'photo'|'initiales', src?: string, text?: string, color?: string }}
 */
export function getAvatarProps(nom, prenom, photoUrl) {
  if (photoUrl) {
    return { type: 'photo', src: photoUrl };
  }
  const n1 = (nom   || '?')[0]?.toUpperCase() || '?';
  const n2 = (prenom || '' )[0]?.toUpperCase() || '';
  const colorIndex = ((nom || '').charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return {
    type  : 'initiales',
    text  : `${n1}${n2}`,
    color : AVATAR_COLORS[colorIndex],
  };
}

/**
 * Composant inline React pour afficher un avatar circulaire.
 * Usage :
 *   <AvatarCircle nom={r.nom} prenom={r.prenom} photoUrl={r.photo_url} size={36} />
 */
export function AvatarCircle({ nom, prenom, photoUrl, size = 36 }) {
  const av = getAvatarProps(nom, prenom, photoUrl);
  const style = {
    width        : size,
    height       : size,
    borderRadius : '50%',
    overflow     : 'hidden',
    flexShrink   : 0,
    display      : 'flex',
    alignItems   : 'center',
    justifyContent: 'center',
    fontSize     : Math.round(size * 0.38),
    fontWeight   : 700,
    color        : '#fff',
    background   : av.color || 'var(--border)',
    border       : '1px solid var(--border-light)',
  };

  if (av.type === 'photo') {
    return (
      <div style={style}>
        <img
          src={av.src}
          alt={`${nom} ${prenom || ''}`.trim()}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => {
            // En cas d'erreur de chargement, afficher les initiales
            e.target.style.display = 'none';
            e.target.parentElement.textContent = `${(nom||'?')[0]}${(prenom||'')[0]||''}`.toUpperCase();
          }}
        />
      </div>
    );
  }
  return <div style={style}>{av.text}</div>;
}
