/**
 * context/PdfPreviewContext.jsx
 * Prévisualisation des documents PDF (bulletins, reçus, certificats...) dans l'application
 * avant de les exporter/télécharger, plutôt qu'un téléchargement immédiat et silencieux.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const PdfPreviewContext = createContext(null);

function PdfPreviewModal({ url, filename, onClose }) {
  return (
    <div className="sms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sms-modal" style={{
        maxWidth: 900, width: '90vw', height: '88vh',
        display: 'flex', flexDirection: 'column', padding: 0,
      }}>
        <div className="sms-modal-header">
          <div className="sms-modal-title">
            <i className="fas fa-file-pdf" style={{ marginRight: 8, color: '#c62828' }} />
            {filename}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={url} download={filename} className="sms-btn sms-btn-primary sms-btn-sm">
              <i className="fas fa-download" /> Télécharger
            </a>
            <button className="sms-btn-icon" onClick={onClose} title="Fermer">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
        <iframe src={url} title={filename} style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>
  );
}

export function PdfPreviewProvider({ children }) {
  const [preview, setPreview] = useState(null); // { url, filename }
  const urlRef = useRef(null);

  const showPreview = useCallback((blob, filename) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setPreview({ url, filename });
  }, []);

  const closePreview = useCallback(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setPreview(null);
  }, []);

  return (
    <PdfPreviewContext.Provider value={{ showPreview }}>
      {children}
      {preview && (
        <PdfPreviewModal url={preview.url} filename={preview.filename} onClose={closePreview} />
      )}
    </PdfPreviewContext.Provider>
  );
}

export const usePdfPreview = () => useContext(PdfPreviewContext);
