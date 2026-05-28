/**
 * utils/etabLabels.js
 * Retourne des libellés adaptés au type et au système de l'établissement.
 */
export function etabLabels(typeEtab = 'SUPERIEUR', systeme = 'FRANCOPHONE', lang = 'fr') {
  const isEN = lang === 'en' || systeme === 'ANGLOPHONE';
  const isPrimaire   = typeEtab === 'PRIMAIRE';
  const isSecondaire = typeEtab === 'SECONDAIRE';
  const isSuperieur  = typeEtab === 'SUPERIEUR';

  // ── Singuliers ───────────────────────────────────────────────────────────
  const studentLabel =
    isPrimaire || isSecondaire
      ? (isEN ? 'Pupil'    : 'Élève')
      : (isEN ? 'Student'  : 'Étudiant');

  const classeLabel =
    isPrimaire   ? (isEN ? 'Class'     : 'Classe')
  : isSecondaire ? (isEN ? 'Form'      : 'Classe')
  :                (isEN ? 'Programme' : 'Filière');

  const niveauLabel =
    isPrimaire   ? (isEN ? 'Grade' : 'Classe')
  : isSecondaire ? (isEN ? 'Form'  : 'Niveau')
  :                (isEN ? 'Year'  : 'Niveau');

  // ── Pluriels ─────────────────────────────────────────────────────────────
  const studentLabelPlural =
    isPrimaire || isSecondaire
      ? (isEN ? 'Pupils'    : 'Élèves')
      : (isEN ? 'Students'  : 'Étudiants');

  const classeLabelPlural =
    isPrimaire   ? (isEN ? 'Classes'    : 'Classes')
  : isSecondaire ? (isEN ? 'Forms'      : 'Classes')
  :                (isEN ? 'Programmes' : 'Filières');

  // ── Titres de pages adaptés ───────────────────────────────────────────────
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

  const directorLabel =
    isPrimaire   ? (isEN ? 'Headmaster'     : 'Directeur')
  : isSecondaire ? (isEN ? 'Principal'      : 'Proviseur')
  :                (isEN ? 'Vice-Chancellor': 'Directeur Général');

  const inscriptionLabel =
    isPrimaire || isSecondaire
      ? (isEN ? 'Registration' : 'Inscription')
      : (isEN ? 'Enrollment'   : 'Inscription');

  // Regroupement / département
  const departementLabel =
    isPrimaire   ? (isEN ? 'Level'      : 'Niveau')
  : isSecondaire ? (isEN ? 'Series'     : 'Série / Section')
  :                (isEN ? 'Department' : 'Filière (Département)');

  const allDepsLabel =
    isPrimaire   ? (isEN ? 'All levels'  : 'Tous les niveaux')
  : isSecondaire ? (isEN ? 'All series'  : 'Toutes les séries')
  :                (isEN ? 'All departments' : 'Toutes les filières');

  const specialiteLabel =
    isPrimaire   ? (isEN ? 'Subject'  : 'Matière')
  : isSecondaire ? (isEN ? 'Option'   : 'Option')
  :                (isEN ? 'Speciality' : 'Spécialité');

  return {
    // Singuliers
    studentLabel,
    classeLabel,
    niveauLabel,
    directorLabel,
    inscriptionLabel,
    // Pluriels
    studentLabelPlural,
    classeLabelPlural,
    // Titres de pages
    studentsPageTitle,
    studentsPageSubtitle,
    classesPageTitle,
    classesPageSubtitle,
    departementLabel,
    allDepsLabel,
    specialiteLabel,
    // Visibilité de sections
    showFacultes:     isSuperieur,
    showDepartements: isSuperieur || isSecondaire,
    showCycles:       isSuperieur,
    showStages:       isSuperieur,
    showCartes:       isSuperieur || isSecondaire,
  };
}
