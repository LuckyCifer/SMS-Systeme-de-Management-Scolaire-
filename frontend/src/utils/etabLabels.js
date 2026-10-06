/**
 * utils/etabLabels.js
 * Retourne des libellés ET des flags de visibilité adaptés au type d'établissement.
 * Utilisé par toutes les pages pour s'adapter automatiquement à PRIMAIRE / SECONDAIRE / SUPERIEUR.
 */
export function etabLabels(typeEtab = 'SUPERIEUR', systeme = 'FRANCOPHONE', lang = 'fr') {
  const isEN = lang === 'en' || systeme === 'ANGLOPHONE';
  const isPrimaire   = typeEtab === 'PRIMAIRE';
  const isSecondaire = typeEtab === 'SECONDAIRE';
  const isSuperieur  = typeEtab === 'SUPERIEUR';
  const isPreBac     = isPrimaire || isSecondaire;
  // Établissement où les deux sous-systèmes (francophone/anglophone) coexistent, chacun
  // avec ses propres classes — voir doc de référence système éducatif camerounais.
  const isBilingue   = systeme === 'BILINGUE';

  // ── Singuliers ───────────────────────────────────────────────────────────
  const studentLabel =
    isPreBac ? (isEN ? 'Pupil'   : 'Élève')
             : (isEN ? 'Student' : 'Étudiant');

  const classeLabel =
    isPrimaire   ? (isEN ? 'Class' : 'Classe')
  : isSecondaire ? (isEN ? 'Form'  : 'Classe')
  :                (isEN ? 'Class' : 'Classe');

  const niveauLabel =
    isPrimaire   ? (isEN ? 'Grade' : 'Classe')
  : isSecondaire ? (isEN ? 'Form'  : 'Niveau')
  :                (isEN ? 'Year'  : 'Niveau');

  const directorLabel =
    isPrimaire   ? (isEN ? 'Headmaster'      : 'Directeur')
  : isSecondaire ? (isEN ? 'Principal'       : 'Proviseur')
  :                (isEN ? 'Vice-Chancellor' : 'Directeur Général');

  const inscriptionLabel =
    isPreBac ? (isEN ? 'Registration' : 'Inscription')
             : (isEN ? 'Enrollment'   : 'Inscription');

  // ── Regroupements ─────────────────────────────────────────────────────────
  const departementLabel =
    isPrimaire   ? (isEN ? 'Level'      : 'Niveau')
  : isSecondaire ? (isEN ? 'Series'     : 'Série / Section')
  :                (isEN ? 'Department' : 'Département');

  const allDepsLabel =
    isPrimaire   ? (isEN ? 'All levels'      : 'Tous les niveaux')
  : isSecondaire ? (isEN ? 'All series'      : 'Toutes les séries')
  :                (isEN ? 'All departments' : 'Tous les départements');

  const specialiteLabel =
    isPrimaire   ? (isEN ? 'Subject'    : 'Matière')
  : isSecondaire ? (isEN ? 'Option'     : 'Option')
  :                (isEN ? 'Speciality' : 'Spécialité');

  // Faculté / École / Institut — regroupement au-dessus du département, uniquement
  // pertinent pour le supérieur (voir showFacultes ci-dessous).
  const faculteLabel = isEN ? 'Faculty / Pole' : 'Pôle / Faculté';

  // ── Périodes (semestres / trimestres) ─────────────────────────────────────
  const semestreLabel =
    isPreBac ? (isEN ? 'Term' : 'Trimestre')
             : (isEN ? 'Semester' : 'Semestre');

  const semestres = isPreBac
    ? [
        { value: 'T1', label: isEN ? 'Term 1' : 'Trimestre 1' },
        { value: 'T2', label: isEN ? 'Term 2' : 'Trimestre 2' },
        { value: 'T3', label: isEN ? 'Term 3' : 'Trimestre 3' },
      ]
    : [
        { value: 'S1', label: isEN ? 'Semester 1' : 'Semestre 1' },
        { value: 'S2', label: isEN ? 'Semester 2' : 'Semestre 2' },
      ];

  // ── Délibérations ─────────────────────────────────────────────────────────
  const juryLabel =
    isPreBac ? (isEN ? 'Class Council' : 'Conseil de classe')
             : (isEN ? 'Jury'          : 'Jury');

  const presidentLabel =
    isPreBac ? (isEN ? 'Class teacher' : 'Professeur principal')
             : (isEN ? 'Jury president' : 'Président du jury');

  // ── Pluriels ─────────────────────────────────────────────────────────────
  const studentLabelPlural =
    isPreBac ? (isEN ? 'Pupils'   : 'Élèves')
             : (isEN ? 'Students' : 'Étudiants');

  const classeLabelPlural =
    isPrimaire   ? (isEN ? 'Classes' : 'Classes')
  : isSecondaire ? (isEN ? 'Forms'   : 'Classes')
  :                (isEN ? 'Classes' : 'Classes');

  // ── Titres de pages ───────────────────────────────────────────────────────
  const studentsPageTitle =
    isEN ? `${studentLabelPlural} Management`
         : `Gestion des ${studentLabelPlural.toLowerCase()}`;

  const studentsPageSubtitle =
    isEN ? `Complete list of enrolled ${studentLabelPlural.toLowerCase()}`
         : `Liste complète des ${studentLabelPlural.toLowerCase()} inscrits`;

  const classesPageTitle =
    isEN ? `${classeLabelPlural} Management`
         : `Gestion des ${classeLabelPlural.toLowerCase()}`;

  const classesPageSubtitle =
    isEN ? `${classeLabelPlural} and cohorts of the institution`
         : `${classeLabelPlural} et promotions de l'établissement`;

  // ── Flags de visibilité (true = afficher) ─────────────────────────────────
  const showFacultes    = isSuperieur;
  const showDepartements = isSuperieur || isSecondaire;
  const showCycles      = isSuperieur;
  const showStages      = isSuperieur;
  const showCartes      = isSuperieur || isSecondaire;

  // Éléments LMD / supérieur uniquement
  const showCredits     = isSuperieur;  // crédits ECTS
  const showGroupes     = isSuperieur;  // groupes amphi / tronc commun
  const showSoutenances = isSuperieur;  // types paiement soutenance + examen BTS

  return {
    // Singuliers
    studentLabel, classeLabel, niveauLabel,
    directorLabel, inscriptionLabel,
    departementLabel, allDepsLabel, specialiteLabel, faculteLabel,
    semestreLabel, semestres,
    juryLabel, presidentLabel,
    // Pluriels
    studentLabelPlural, classeLabelPlural,
    // Titres
    studentsPageTitle, studentsPageSubtitle,
    classesPageTitle,  classesPageSubtitle,
    // Visibilité structures
    showFacultes, showDepartements, showCycles,
    showStages, showCartes,
    // Visibilité LMD
    showCredits, showGroupes, showSoutenances,
    // Méta
    isSecondaire, isPrimaire, isSuperieur, isPreBac, isBilingue,
  };
}
