/**
 * components/PrivateRoute.jsx
 * Protège les routes — exige user ET token valide.
 */
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/Auth';

export default function PrivateRoute({ children }) {
  // Double vérification : sms_user + sms_access doivent exister
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
