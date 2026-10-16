/**
 * pages/Coefficients.jsx — Grille des coefficients (primaire / secondaire).
 * Accessible à l'administration, à la scolarité et au censeur (voir utils/roles.js),
 * comme côté backend (CoefficientMatiereViewSet.ROLES_ECRITURE).
 */
import GrilleCoefficients from '../components/GrilleCoefficients';

export default function Coefficients() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-balance-scale text-green" style={{ marginRight: 10, fontSize: 22 }}></i>
            Coefficients
          </h1>
          <p className="page-subtitle">
            Coefficient de chaque matière par niveau et par série, pour une année scolaire
          </p>
        </div>
      </div>
      <GrilleCoefficients />
    </div>
  );
}
