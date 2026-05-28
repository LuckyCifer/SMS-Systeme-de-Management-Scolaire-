/**
 * routes/AppRoutes.jsx — Routes complètes SMS v3
 */
import { Routes, Route } from 'react-router-dom';
import Layout          from '../layouts/Layout';
import PrivateRoute    from '../components/PrivateRoute';
import { RoleGuard }   from '../components/RoleGuard';

import Login           from '../pages/Login';
import Dashboard       from '../pages/Dashboard';
import Students        from '../pages/Students';
import Teachers        from '../pages/Teachers';
import Classes         from '../pages/Classes';
import Cours           from '../pages/Cours';
import Inscription     from '../pages/Inscription';
import Evaluation      from '../pages/Evaluation';
import Grades          from '../pages/Grades';
import Payments        from '../pages/Payments';
import Planning        from '../pages/Planning';
import Users           from '../pages/Users';
import Profile         from '../pages/Profile';
import Audit           from '../pages/Audit';
import NotFound        from '../pages/NotFound';

// ── Nouvelles pages ───────────────────────────────────────────────────────────
import Seances         from '../pages/Seances';
import FicheNotes      from '../pages/FicheNotes';
import Decisions       from '../pages/Decisions';
import Examens         from '../pages/Examens';
import Stages          from '../pages/Stages';
import CarteEtudiants  from '../pages/CarteEtudiants';
import RapportStat     from '../pages/RapportStat';
import Factures        from '../pages/Factures';
import Bareme         from '../pages/Bareme';
import Matieres       from '../pages/Matieres';
import Parametrage    from '../pages/Parametrage';
import Parametres    from '../pages/Parametres';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        {/* Pages existantes */}
        <Route index              element={<RoleGuard page="dashboard"><Dashboard /></RoleGuard>} />
        <Route path="students"    element={<RoleGuard page="students"><Students /></RoleGuard>} />
        <Route path="teachers"    element={<RoleGuard page="teachers"><Teachers /></RoleGuard>} />
        <Route path="classes"     element={<RoleGuard page="classes"><Classes /></RoleGuard>} />
        <Route path="cours"       element={<RoleGuard page="cours"><Cours /></RoleGuard>} />
        <Route path="inscription" element={<RoleGuard page="inscription"><Inscription /></RoleGuard>} />
        <Route path="evaluation"  element={<RoleGuard page="evaluation"><Evaluation /></RoleGuard>} />
        <Route path="grades"      element={<RoleGuard page="grades"><Grades /></RoleGuard>} />
        <Route path="payments"    element={<RoleGuard page="payments"><Payments /></RoleGuard>} />
        <Route path="planning"    element={<RoleGuard page="cours"><Planning /></RoleGuard>} />
        <Route path="users"       element={<RoleGuard page="users"><Users /></RoleGuard>} />
        <Route path="audit"       element={<RoleGuard page="users"><Audit /></RoleGuard>} />
        <Route path="profile"     element={<Profile />} />

        {/* Nouvelles pages */}
        <Route path="seances"        element={<RoleGuard page="evaluation"><Seances /></RoleGuard>} />
        <Route path="fiche-notes"    element={<RoleGuard page="evaluation"><FicheNotes /></RoleGuard>} />
        <Route path="decisions"      element={<RoleGuard page="grades"><Decisions /></RoleGuard>} />
        <Route path="examens"        element={<RoleGuard page="evaluation"><Examens /></RoleGuard>} />
        <Route path="stages"         element={<RoleGuard page="students"><Stages /></RoleGuard>} />
        <Route path="cartes"         element={<RoleGuard page="students"><CarteEtudiants /></RoleGuard>} />
        <Route path="rapport-stat"   element={<RoleGuard page="users"><RapportStat /></RoleGuard>} />
        <Route path="factures"       element={<RoleGuard page="payments"><Factures /></RoleGuard>} />
        <Route path="bareme"         element={<RoleGuard page="payments"><Bareme /></RoleGuard>} />
        <Route path="matieres"       element={<RoleGuard page="cours"><Matieres /></RoleGuard>} />
        <Route path="parametrage"    element={<RoleGuard page="users"><Parametrage /></RoleGuard>} />
        <Route path="parametres"     element={<RoleGuard page="users"><Parametres /></RoleGuard>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
