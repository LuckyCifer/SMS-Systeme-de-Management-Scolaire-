/**
 * routes/AppRoutes.jsx — Routes complètes SMS v3
 */
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout           from '../layouts/Layout';
import PrivateRoute     from '../components/PrivateRoute';
import { RoleGuard }    from '../components/RoleGuard';
import { LoadingState } from '../components/ApiState';
import Login             from '../pages/Login';

// Chargées à la demande : évite un bundle initial unique regroupant toutes les
// pages (chacune n'est téléchargée que lorsque l'utilisateur y navigue).
const Dashboard       = lazy(() => import('../pages/Dashboard'));
const Students        = lazy(() => import('../pages/Students'));
const Teachers        = lazy(() => import('../pages/Teachers'));
const Classes         = lazy(() => import('../pages/Classes'));
const Cours           = lazy(() => import('../pages/Cours'));
const Inscription     = lazy(() => import('../pages/Inscription'));
const Evaluation      = lazy(() => import('../pages/Evaluation'));
const Grades          = lazy(() => import('../pages/Grades'));
const Payments        = lazy(() => import('../pages/Payments'));
const Planning        = lazy(() => import('../pages/Planning'));
const Users           = lazy(() => import('../pages/Users'));
const Profile         = lazy(() => import('../pages/Profile'));
const Audit           = lazy(() => import('../pages/Audit'));
const NotFound        = lazy(() => import('../pages/NotFound'));

// ── Nouvelles pages ───────────────────────────────────────────────────────────
const Seances         = lazy(() => import('../pages/Seances'));
const FicheNotes      = lazy(() => import('../pages/FicheNotes'));
const Decisions       = lazy(() => import('../pages/Decisions'));
const Examens         = lazy(() => import('../pages/Examens'));
const Epreuves        = lazy(() => import('../pages/Epreuves'));
const Stages          = lazy(() => import('../pages/Stages'));
const CarteEtudiants  = lazy(() => import('../pages/CarteEtudiants'));
const RapportStat     = lazy(() => import('../pages/RapportStat'));
const Factures        = lazy(() => import('../pages/Factures'));
const Bareme          = lazy(() => import('../pages/Bareme'));
const Matieres        = lazy(() => import('../pages/Matieres'));
const Parametrage     = lazy(() => import('../pages/Parametrage'));
const Parametres      = lazy(() => import('../pages/Parametres'));
const Absences        = lazy(() => import('../pages/Absences'));
const Bulletins       = lazy(() => import('../pages/Bulletins'));
const MonDossier      = lazy(() => import('../pages/MonDossier'));
const ImportCsv       = lazy(() => import('../pages/ImportCsv'));
const Personnel       = lazy(() => import('../pages/Personnel'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState />}>
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
          <Route path="epreuves"       element={<RoleGuard page="epreuves"><Epreuves /></RoleGuard>} />
          <Route path="stages"         element={<RoleGuard page="students"><Stages /></RoleGuard>} />
          <Route path="cartes"         element={<RoleGuard page="students"><CarteEtudiants /></RoleGuard>} />
          <Route path="rapport-stat"   element={<RoleGuard page="users"><RapportStat /></RoleGuard>} />
          <Route path="factures"       element={<RoleGuard page="payments"><Factures /></RoleGuard>} />
          <Route path="bareme"         element={<RoleGuard page="payments"><Bareme /></RoleGuard>} />
          <Route path="matieres"       element={<RoleGuard page="cours"><Matieres /></RoleGuard>} />
          <Route path="parametrage"    element={<RoleGuard page="users"><Parametrage /></RoleGuard>} />
          <Route path="parametres"     element={<RoleGuard page="users"><Parametres /></RoleGuard>} />
          <Route path="absences"       element={<RoleGuard page="absences"><Absences /></RoleGuard>} />
          <Route path="bulletins"      element={<RoleGuard page="bulletins"><Bulletins /></RoleGuard>} />
          <Route path="mon-dossier"    element={<RoleGuard page="monDossier"><MonDossier /></RoleGuard>} />
          <Route path="import-csv"     element={<RoleGuard page="importCsv"><ImportCsv /></RoleGuard>} />
          <Route path="personnel"      element={<RoleGuard page="personnel"><Personnel /></RoleGuard>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
