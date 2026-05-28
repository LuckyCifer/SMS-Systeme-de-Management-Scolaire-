-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : lun. 20 avr. 2026 à 12:38
-- Version du serveur : 9.5.0
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `sms`
--

-- --------------------------------------------------------

--
-- Structure de la table `absence`
--

CREATE TABLE `absence` (
  `code_absence` int UNSIGNED NOT NULL,
  `code_seance` int UNSIGNED NOT NULL COMMENT 'FK → seance',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `present` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = présent, 0 = absent',
  `signe` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = a signé la feuille d''émargement',
  `motif` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Motif de l''absence',
  `justifiee` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = absence justifiée',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Présences et absences des étudiants par séance';

-- --------------------------------------------------------

--
-- Structure de la table `annee`
--

CREATE TABLE `annee` (
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'code de l''annee scolaire',
  `lib_annee` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'libelle de l''annee scolaire',
  `obs_annee` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'observation d''une annee',
  `date_deb` datetime DEFAULT NULL COMMENT 'date de debut d''annee scolaire',
  `date_fin` datetime DEFAULT NULL COMMENT 'date de fin d''une annee scolaire',
  `statut` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `annee`
--

INSERT INTO `annee` (`code_annee`, `lib_annee`, `obs_annee`, `date_deb`, `date_fin`, `statut`) VALUES
('2025-2026', NULL, NULL, '2025-09-14 10:00:00', '2026-09-07 23:59:59', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `audit_log`
--

CREATE TABLE `audit_log` (
  `id` bigint NOT NULL,
  `utilisateur` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Login de l''utilisateur',
  `action` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'LOGIN_SUCCESS | CREATE | UPDATE | DELETE | EXPORT_CSV...',
  `modele` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nom de la table/entité concernée',
  `objet_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Identifiant de l''objet modifié',
  `detail` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Description détaillée de l''action',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Adresse IP de l''utilisateur',
  `date_action` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Date et heure exactes'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Journal d''audit — toutes les actions du système';

--
-- Déchargement des données de la table `audit_log`
--

INSERT INTO `audit_log` (`id`, `utilisateur`, `action`, `modele`, `objet_id`, `detail`, `ip_address`, `date_action`) VALUES
(1, 'Yemeya Luc', 'LOGIN_FAILED', 'Utilisateur', 'Yemeya Luc', 'Utilisateur inexistant', '127.0.0.1', '2026-04-08 14:39:35.964352'),
(2, 'Lucky', 'LOGIN_FAILED', 'Utilisateur', 'Lucky', 'Mot de passe incorrect', '127.0.0.1', '2026-04-08 14:51:09.284439'),
(3, 'Lucky', 'LOGIN_FAILED', 'Utilisateur', 'Lucky', 'Mot de passe incorrect', '127.0.0.1', '2026-04-08 14:52:30.174087'),
(4, 'Lucky', 'LOGIN_FAILED', 'Utilisateur', 'Lucky', 'Mot de passe incorrect', '127.0.0.1', '2026-04-08 14:56:10.366820'),
(5, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-10 13:40:30.610864'),
(6, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-10 13:42:35.955551'),
(7, 'Lucky', 'UPDATE', 'Classe', 'LRAS1', '', '127.0.0.1', '2026-04-10 13:44:26.401965'),
(8, 'Lucky', 'UPDATE', 'Classe', 'LRAS1', '', '127.0.0.1', '2026-04-10 13:44:39.757290'),
(9, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-11 17:42:11.691363'),
(10, 'Lucky', 'CREATE', 'Etudiant', 'ETU001', '', '127.0.0.1', '2026-04-11 17:56:22.493237'),
(11, 'Lucky', 'CREATE', 'Etudiant', 'ETU002', '', '127.0.0.1', '2026-04-11 18:14:04.156874'),
(12, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-11 18:47:23.660282'),
(13, 'Lucky', 'CREATE', 'CarteEtudiant', '1', '', '127.0.0.1', '2026-04-11 19:01:28.826780'),
(14, 'Lucky', 'CREATE', 'CarteEtudiant', '2', '', '127.0.0.1', '2026-04-11 19:02:20.765412'),
(15, 'Lucky', 'UPDATE', 'Classe', 'LGEE1', '', '127.0.0.1', '2026-04-12 17:43:47.015995'),
(16, 'Lucky', 'UPDATE', 'Classe', 'LGEE1', '', '127.0.0.1', '2026-04-12 17:44:04.990530'),
(17, 'Lucky', 'UPDATE', 'Classe', 'LIA1', '', '127.0.0.1', '2026-04-12 17:44:30.047750'),
(18, 'Lucky', 'UPDATE', 'Classe', 'LRAS1', '', '127.0.0.1', '2026-04-12 17:44:58.991158'),
(19, 'Lucky', 'CREATE', 'Inscription', '1', '', '127.0.0.1', '2026-04-12 18:54:16.986884'),
(20, 'Lucky', 'CREATE', 'Inscription', '2', '', '127.0.0.1', '2026-04-12 18:59:44.229274'),
(21, 'Lucky', 'CREATE', 'Paiement', '1', '', '127.0.0.1', '2026-04-12 19:01:45.970061'),
(22, 'Lucky', 'CREATE', 'Paiement', '2', '', '127.0.0.1', '2026-04-12 19:02:29.638228'),
(23, 'Lucky', 'CREATE', 'Etudiant', 'ETU003', '', '127.0.0.1', '2026-04-12 19:08:49.492193'),
(24, 'Lucky', 'CREATE', 'Etudiant', 'ETU004', '', '127.0.0.1', '2026-04-12 19:17:37.592917'),
(25, 'Lucky', 'CREATE', 'Etudiant', 'ETU005', '', '127.0.0.1', '2026-04-12 19:22:56.235188'),
(26, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-12 19:24:08.939531'),
(27, 'Lucky', 'LOGIN_SUCCESS', 'Utilisateur', 'Lucky', 'Connexion depuis 127.0.0.1', '127.0.0.1', '2026-04-14 12:35:35.730657');

-- --------------------------------------------------------

--
-- Structure de la table `auth_group`
--

CREATE TABLE `auth_group` (
  `id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `auth_permission`
--

CREATE TABLE `auth_permission` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `auth_permission`
--

INSERT INTO `auth_permission` (`id`, `name`, `content_type_id`, `codename`) VALUES
(1, 'Can add log entry', 1, 'add_logentry'),
(2, 'Can change log entry', 1, 'change_logentry'),
(3, 'Can delete log entry', 1, 'delete_logentry'),
(4, 'Can view log entry', 1, 'view_logentry'),
(5, 'Can add permission', 2, 'add_permission'),
(6, 'Can change permission', 2, 'change_permission'),
(7, 'Can delete permission', 2, 'delete_permission'),
(8, 'Can view permission', 2, 'view_permission'),
(9, 'Can add group', 3, 'add_group'),
(10, 'Can change group', 3, 'change_group'),
(11, 'Can delete group', 3, 'delete_group'),
(12, 'Can view group', 3, 'view_group'),
(13, 'Can add user', 4, 'add_user'),
(14, 'Can change user', 4, 'change_user'),
(15, 'Can delete user', 4, 'delete_user'),
(16, 'Can view user', 4, 'view_user'),
(17, 'Can add content type', 5, 'add_contenttype'),
(18, 'Can change content type', 5, 'change_contenttype'),
(19, 'Can delete content type', 5, 'delete_contenttype'),
(20, 'Can view content type', 5, 'view_contenttype'),
(21, 'Can add session', 6, 'add_session'),
(22, 'Can change session', 6, 'change_session'),
(23, 'Can delete session', 6, 'delete_session'),
(24, 'Can view session', 6, 'view_session'),
(25, 'Can add Blacklisted Token', 7, 'add_blacklistedtoken'),
(26, 'Can change Blacklisted Token', 7, 'change_blacklistedtoken'),
(27, 'Can delete Blacklisted Token', 7, 'delete_blacklistedtoken'),
(28, 'Can view Blacklisted Token', 7, 'view_blacklistedtoken'),
(29, 'Can add Outstanding Token', 8, 'add_outstandingtoken'),
(30, 'Can change Outstanding Token', 8, 'change_outstandingtoken'),
(31, 'Can delete Outstanding Token', 8, 'delete_outstandingtoken'),
(32, 'Can view Outstanding Token', 8, 'view_outstandingtoken'),
(33, 'Can add annee', 9, 'add_annee'),
(34, 'Can change annee', 9, 'change_annee'),
(35, 'Can delete annee', 9, 'delete_annee'),
(36, 'Can view annee', 9, 'view_annee'),
(37, 'Can add Journal d\'audit', 10, 'add_auditlog'),
(38, 'Can change Journal d\'audit', 10, 'change_auditlog'),
(39, 'Can delete Journal d\'audit', 10, 'delete_auditlog'),
(40, 'Can view Journal d\'audit', 10, 'view_auditlog'),
(41, 'Can add batiment', 11, 'add_batiment'),
(42, 'Can change batiment', 11, 'change_batiment'),
(43, 'Can delete batiment', 11, 'delete_batiment'),
(44, 'Can view batiment', 11, 'view_batiment'),
(45, 'Can add cycle', 12, 'add_cycle'),
(46, 'Can change cycle', 12, 'change_cycle'),
(47, 'Can delete cycle', 12, 'delete_cycle'),
(48, 'Can view cycle', 12, 'view_cycle'),
(49, 'Can add departement', 13, 'add_departement'),
(50, 'Can change departement', 13, 'change_departement'),
(51, 'Can delete departement', 13, 'delete_departement'),
(52, 'Can view departement', 13, 'view_departement'),
(53, 'Can add etablissement', 14, 'add_etablissement'),
(54, 'Can change etablissement', 14, 'change_etablissement'),
(55, 'Can delete etablissement', 14, 'delete_etablissement'),
(56, 'Can view etablissement', 14, 'view_etablissement'),
(57, 'Can add jour', 15, 'add_jour'),
(58, 'Can change jour', 15, 'change_jour'),
(59, 'Can delete jour', 15, 'delete_jour'),
(60, 'Can view jour', 15, 'view_jour'),
(61, 'Can add langue', 16, 'add_langue'),
(62, 'Can change langue', 16, 'change_langue'),
(63, 'Can delete langue', 16, 'delete_langue'),
(64, 'Can view langue', 16, 'view_langue'),
(65, 'Can add mention', 17, 'add_mention'),
(66, 'Can change mention', 17, 'change_mention'),
(67, 'Can delete mention', 17, 'delete_mention'),
(68, 'Can view mention', 17, 'view_mention'),
(69, 'Can add module', 18, 'add_module'),
(70, 'Can change module', 18, 'change_module'),
(71, 'Can delete module', 18, 'delete_module'),
(72, 'Can view module', 18, 'view_module'),
(73, 'Can add pension', 19, 'add_pension'),
(74, 'Can change pension', 19, 'change_pension'),
(75, 'Can delete pension', 19, 'delete_pension'),
(76, 'Can view pension', 19, 'view_pension'),
(77, 'Can add rapport', 20, 'add_rapport'),
(78, 'Can change rapport', 20, 'change_rapport'),
(79, 'Can delete rapport', 20, 'delete_rapport'),
(80, 'Can view rapport', 20, 'view_rapport'),
(81, 'Can add salle', 21, 'add_salle'),
(82, 'Can change salle', 21, 'change_salle'),
(83, 'Can delete salle', 21, 'delete_salle'),
(84, 'Can view salle', 21, 'view_salle'),
(85, 'Can add type etab', 22, 'add_typeetab'),
(86, 'Can change type etab', 22, 'change_typeetab'),
(87, 'Can delete type etab', 22, 'delete_typeetab'),
(88, 'Can view type etab', 22, 'view_typeetab'),
(89, 'Can add type evaluation', 23, 'add_typeevaluation'),
(90, 'Can change type evaluation', 23, 'change_typeevaluation'),
(91, 'Can delete type evaluation', 23, 'delete_typeevaluation'),
(92, 'Can view type evaluation', 23, 'view_typeevaluation'),
(93, 'Can add utilisateur', 24, 'add_utilisateur'),
(94, 'Can change utilisateur', 24, 'change_utilisateur'),
(95, 'Can delete utilisateur', 24, 'delete_utilisateur'),
(96, 'Can view utilisateur', 24, 'view_utilisateur'),
(97, 'Can add classe', 25, 'add_classe'),
(98, 'Can change classe', 25, 'change_classe'),
(99, 'Can delete classe', 25, 'delete_classe'),
(100, 'Can view classe', 25, 'view_classe'),
(101, 'Can add enseignant', 26, 'add_enseignant'),
(102, 'Can change enseignant', 26, 'change_enseignant'),
(103, 'Can delete enseignant', 26, 'delete_enseignant'),
(104, 'Can view enseignant', 26, 'view_enseignant'),
(105, 'Can add etudiant', 27, 'add_etudiant'),
(106, 'Can change etudiant', 27, 'change_etudiant'),
(107, 'Can delete etudiant', 27, 'delete_etudiant'),
(108, 'Can view etudiant', 27, 'view_etudiant'),
(109, 'Can add frais', 28, 'add_frais'),
(110, 'Can change frais', 28, 'change_frais'),
(111, 'Can delete frais', 28, 'delete_frais'),
(112, 'Can view frais', 28, 'view_frais'),
(113, 'Can add inscription', 29, 'add_inscription'),
(114, 'Can change inscription', 29, 'change_inscription'),
(115, 'Can delete inscription', 29, 'delete_inscription'),
(116, 'Can view inscription', 29, 'view_inscription'),
(117, 'Can add frais inscription', 30, 'add_fraisinscription'),
(118, 'Can change frais inscription', 30, 'change_fraisinscription'),
(119, 'Can delete frais inscription', 30, 'delete_fraisinscription'),
(120, 'Can view frais inscription', 30, 'view_fraisinscription'),
(121, 'Can add matiere', 31, 'add_matiere'),
(122, 'Can change matiere', 31, 'change_matiere'),
(123, 'Can delete matiere', 31, 'delete_matiere'),
(124, 'Can view matiere', 31, 'view_matiere'),
(125, 'Can add moratoire', 32, 'add_moratoire'),
(126, 'Can change moratoire', 32, 'change_moratoire'),
(127, 'Can delete moratoire', 32, 'delete_moratoire'),
(128, 'Can view moratoire', 32, 'view_moratoire'),
(129, 'Can add niveau', 33, 'add_niveau'),
(130, 'Can change niveau', 33, 'change_niveau'),
(131, 'Can delete niveau', 33, 'delete_niveau'),
(132, 'Can view niveau', 33, 'view_niveau'),
(133, 'Can add periode', 34, 'add_periode'),
(134, 'Can change periode', 34, 'change_periode'),
(135, 'Can delete periode', 34, 'delete_periode'),
(136, 'Can view periode', 34, 'view_periode'),
(137, 'Can add rapport cours', 35, 'add_rapportcours'),
(138, 'Can change rapport cours', 35, 'change_rapportcours'),
(139, 'Can delete rapport cours', 35, 'delete_rapportcours'),
(140, 'Can view rapport cours', 35, 'view_rapportcours'),
(141, 'Can add specialite', 36, 'add_specialite'),
(142, 'Can change specialite', 36, 'change_specialite'),
(143, 'Can delete specialite', 36, 'delete_specialite'),
(144, 'Can view specialite', 36, 'view_specialite'),
(145, 'Can add tranche', 37, 'add_tranche'),
(146, 'Can change tranche', 37, 'change_tranche'),
(147, 'Can delete tranche', 37, 'delete_tranche'),
(148, 'Can view tranche', 37, 'view_tranche'),
(149, 'Can add paiement', 38, 'add_paiement'),
(150, 'Can change paiement', 38, 'change_paiement'),
(151, 'Can delete paiement', 38, 'delete_paiement'),
(152, 'Can view paiement', 38, 'view_paiement'),
(153, 'Can add evaluation', 39, 'add_evaluation'),
(154, 'Can change evaluation', 39, 'change_evaluation'),
(155, 'Can delete evaluation', 39, 'delete_evaluation'),
(156, 'Can view evaluation', 39, 'view_evaluation'),
(157, 'Can add cours', 40, 'add_cours'),
(158, 'Can change cours', 40, 'change_cours'),
(159, 'Can delete cours', 40, 'delete_cours'),
(160, 'Can view cours', 40, 'view_cours'),
(161, 'Can add mention classe', 41, 'add_mentionclasse'),
(162, 'Can change mention classe', 41, 'change_mentionclasse'),
(163, 'Can delete mention classe', 41, 'delete_mentionclasse'),
(164, 'Can view mention classe', 41, 'view_mentionclasse'),
(165, 'Can add planning', 42, 'add_planning'),
(166, 'Can change planning', 42, 'change_planning'),
(167, 'Can delete planning', 42, 'delete_planning'),
(168, 'Can view planning', 42, 'view_planning'),
(169, 'Can add qualification', 43, 'add_qualification'),
(170, 'Can change qualification', 43, 'change_qualification'),
(171, 'Can delete qualification', 43, 'delete_qualification'),
(172, 'Can view qualification', 43, 'view_qualification'),
(173, 'Can add unite enseignement', 44, 'add_uniteenseignement'),
(174, 'Can change unite enseignement', 44, 'change_uniteenseignement'),
(175, 'Can delete unite enseignement', 44, 'delete_uniteenseignement'),
(176, 'Can view unite enseignement', 44, 'view_uniteenseignement'),
(177, 'Can add rapport financier', 45, 'add_rapportfinancier'),
(178, 'Can change rapport financier', 45, 'change_rapportfinancier'),
(179, 'Can delete rapport financier', 45, 'delete_rapportfinancier'),
(180, 'Can view rapport financier', 45, 'view_rapportfinancier'),
(181, 'Can add rapport statistique', 46, 'add_rapportstatistique'),
(182, 'Can change rapport statistique', 46, 'change_rapportstatistique'),
(183, 'Can delete rapport statistique', 46, 'delete_rapportstatistique'),
(184, 'Can view rapport statistique', 46, 'view_rapportstatistique'),
(185, 'Can add tuteur', 47, 'add_tuteur'),
(186, 'Can change tuteur', 47, 'change_tuteur'),
(187, 'Can delete tuteur', 47, 'delete_tuteur'),
(188, 'Can view tuteur', 47, 'view_tuteur'),
(189, 'Can add badge acces', 48, 'add_badgeacces'),
(190, 'Can change badge acces', 48, 'change_badgeacces'),
(191, 'Can delete badge acces', 48, 'delete_badgeacces'),
(192, 'Can view badge acces', 48, 'view_badgeacces'),
(193, 'Can add diplome', 49, 'add_diplome'),
(194, 'Can change diplome', 49, 'change_diplome'),
(195, 'Can delete diplome', 49, 'delete_diplome'),
(196, 'Can view diplome', 49, 'view_diplome'),
(197, 'Can add document genere', 50, 'add_documentgenere'),
(198, 'Can change document genere', 50, 'change_documentgenere'),
(199, 'Can delete document genere', 50, 'delete_documentgenere'),
(200, 'Can view document genere', 50, 'view_documentgenere'),
(201, 'Can add examen', 51, 'add_examen'),
(202, 'Can change examen', 51, 'change_examen'),
(203, 'Can delete examen', 51, 'delete_examen'),
(204, 'Can view examen', 51, 'view_examen'),
(205, 'Can add convocation', 52, 'add_convocation'),
(206, 'Can change convocation', 52, 'change_convocation'),
(207, 'Can delete convocation', 52, 'delete_convocation'),
(208, 'Can view convocation', 52, 'view_convocation'),
(209, 'Can add facture', 53, 'add_facture'),
(210, 'Can change facture', 53, 'change_facture'),
(211, 'Can delete facture', 53, 'delete_facture'),
(212, 'Can view facture', 53, 'view_facture'),
(213, 'Can add facture detail', 54, 'add_facturedetail'),
(214, 'Can change facture detail', 54, 'change_facturedetail'),
(215, 'Can delete facture detail', 54, 'delete_facturedetail'),
(216, 'Can view facture detail', 54, 'view_facturedetail'),
(217, 'Can add fiche notes', 55, 'add_fichenotes'),
(218, 'Can change fiche notes', 55, 'change_fichenotes'),
(219, 'Can delete fiche notes', 55, 'delete_fichenotes'),
(220, 'Can view fiche notes', 55, 'view_fichenotes'),
(221, 'Can add lettre admission', 56, 'add_lettreadmission'),
(222, 'Can change lettre admission', 56, 'change_lettreadmission'),
(223, 'Can delete lettre admission', 56, 'delete_lettreadmission'),
(224, 'Can view lettre admission', 56, 'view_lettreadmission'),
(225, 'Can add seance', 57, 'add_seance'),
(226, 'Can change seance', 57, 'change_seance'),
(227, 'Can delete seance', 57, 'delete_seance'),
(228, 'Can view seance', 57, 'view_seance'),
(229, 'Can add stage', 58, 'add_stage'),
(230, 'Can change stage', 58, 'change_stage'),
(231, 'Can delete stage', 58, 'delete_stage'),
(232, 'Can view stage', 58, 'view_stage'),
(233, 'Can add carte etudiant', 59, 'add_carteetudiant'),
(234, 'Can change carte etudiant', 59, 'change_carteetudiant'),
(235, 'Can delete carte etudiant', 59, 'delete_carteetudiant'),
(236, 'Can view carte etudiant', 59, 'view_carteetudiant'),
(237, 'Can add decision', 60, 'add_decision'),
(238, 'Can change decision', 60, 'change_decision'),
(239, 'Can delete decision', 60, 'delete_decision'),
(240, 'Can view decision', 60, 'view_decision'),
(241, 'Can add fiche notes detail', 61, 'add_fichenotesdetail'),
(242, 'Can change fiche notes detail', 61, 'change_fichenotesdetail'),
(243, 'Can delete fiche notes detail', 61, 'delete_fichenotesdetail'),
(244, 'Can view fiche notes detail', 61, 'view_fichenotesdetail'),
(245, 'Can add absence', 62, 'add_absence'),
(246, 'Can change absence', 62, 'change_absence'),
(247, 'Can delete absence', 62, 'delete_absence'),
(248, 'Can view absence', 62, 'view_absence'),
(249, 'Can add etudiant tuteur', 63, 'add_etudianttuteur'),
(250, 'Can change etudiant tuteur', 63, 'change_etudianttuteur'),
(251, 'Can delete etudiant tuteur', 63, 'delete_etudianttuteur'),
(252, 'Can view etudiant tuteur', 63, 'view_etudianttuteur');

-- --------------------------------------------------------

--
-- Structure de la table `auth_user`
--

CREATE TABLE `auth_user` (
  `id` int NOT NULL,
  `password` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `auth_user`
--

INSERT INTO `auth_user` (`id`, `password`, `last_login`, `is_superuser`, `username`, `first_name`, `last_name`, `email`, `is_staff`, `is_active`, `date_joined`) VALUES
(1, 'pbkdf2_sha256$1000000$XJLc67i6b6PfBvkFQd814r$cJOzVuQggW2IArf3IVDT1reHvGDIxrZSDYUTSupQ4yc=', NULL, 0, 'Lucky', 'Luc', 'Yemeya', 'lucyemeya1@gmail.com', 1, 1, '2026-04-06 21:26:36.116592');

-- --------------------------------------------------------

--
-- Structure de la table `badge_acces`
--

CREATE TABLE `badge_acces` (
  `code_badge` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'FK → etudiant (si étudiant)',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'FK → enseignant (si enseignant)',
  `type_porteur` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ETUDIANT' COMMENT 'ETUDIANT | ENSEIGNANT | PERSONNEL | VISITEUR',
  `numero_badge` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Numéro unique du badge',
  `qr_code_data` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Données encodées dans le QR code',
  `date_emission` date NOT NULL DEFAULT (curdate()),
  `date_expiration` date DEFAULT NULL,
  `zones_acces` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Zones autorisées (ex: SALLE_INFO,BIBLIO)',
  `statut` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIF' COMMENT 'ACTIF | SUSPENDU | EXPIRE | PERDU',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Badges d''accès avec QR code pour contrôle d''accès physique';

-- --------------------------------------------------------

--
-- Structure de la table `batiment`
--

CREATE TABLE `batiment` (
  `code_bat` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_bat` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `obs_bat` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='stocke les differentes classes';

--
-- Déchargement des données de la table `batiment`
--

INSERT INTO `batiment` (`code_bat`, `lib_bat`, `obs_bat`) VALUES
('BAT01', 'Bâtiment numéro 1', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `carte_etudiant`
--

CREATE TABLE `carte_etudiant` (
  `code_carte` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Année de validité',
  `numero_carte` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Numéro unique de la carte',
  `date_emission` date NOT NULL DEFAULT (curdate()),
  `date_expiration` date DEFAULT NULL COMMENT 'Date de fin de validité',
  `qr_code_data` text COLLATE utf8mb4_unicode_ci COMMENT 'Données QR code (mle + annee + hash)',
  `statut` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE | PERDUE | EXPIREE | ANNULEE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cartes étudiantes avec QR code, générables et imprimables';

--
-- Déchargement des données de la table `carte_etudiant`
--

INSERT INTO `carte_etudiant` (`code_carte`, `mle_etudiant`, `code_annee`, `numero_carte`, `date_emission`, `date_expiration`, `qr_code_data`, `statut`, `created_at`) VALUES
(1, 'ETU001', '2025-2026', 'CARTE-2026-001', '2026-04-11', '2026-06-04', 'SMS-CARTE:ETU001:2025-2026:1775933974811', 'ACTIVE', '2026-04-11 19:01:29'),
(2, 'ETU002', '2025-2026', 'CARTE-2026-002', '2026-04-11', '2026-06-04', 'SMS-CARTE:ETU002:2025-2026:1775934128465', 'ACTIVE', '2026-04-11 19:02:20');

-- --------------------------------------------------------

--
-- Structure de la table `classe`
--

CREATE TABLE `classe` (
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_classe` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `obs_classe` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_dep` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_niveau` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_bat` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_salle` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `EffMax` int UNSIGNED NOT NULL DEFAULT '50',
  `code_sp` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `classe`
--

INSERT INTO `classe` (`code_classe`, `lib_classe`, `obs_classe`, `code_dep`, `code_niveau`, `code_bat`, `code_salle`, `EffMax`, `code_sp`) VALUES
('LCS1', 'Licence Cybersécurité 1', NULL, 'GI', '1', 'BAT01', NULL, 70, 'CS'),
('LEC1', 'Licence E-Commerce et Marketing Digital 1', NULL, 'GI', '1', 'BAT01', NULL, 70, 'EC'),
('LGEE1', 'Licence Génie Electrique / Electrotechnique 1', '', 'GIT', '1', 'BAT01', NULL, 70, 'GEE'),
('LGL1', 'Licence Génie Logiciel 1', '', 'GI', '1', 'BAT01', NULL, 70, 'GL'),
('LIA1', 'Licence Intelligence Artificielle et data 1', '', 'GI', '1', 'BAT01', NULL, 70, 'IA'),
('LRAS1', 'Licence Réseaux et Administration Système 1', '', 'GI', '1', 'BAT01', NULL, 70, 'RAS');

-- --------------------------------------------------------

--
-- Structure de la table `convocation`
--

CREATE TABLE `convocation` (
  `code_convocation` int UNSIGNED NOT NULL,
  `type_convocation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EXAMEN' COMMENT 'EXAMEN | REUNION | DELIBERATION | AUTRE',
  `destinataire_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ETUDIANT' COMMENT 'ETUDIANT | ENSEIGNANT | PARENT',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Si destinataire = ETUDIANT',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Si destinataire = ENSEIGNANT',
  `code_examen` int UNSIGNED DEFAULT NULL COMMENT 'FK → examen (si type EXAMEN)',
  `objet` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Objet de la convocation',
  `date_evenement` datetime NOT NULL COMMENT 'Date de l''événement',
  `lieu` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci COMMENT 'Corps du message',
  `date_envoi` datetime DEFAULT NULL COMMENT 'Date d''envoi effectif',
  `statut` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREEE' COMMENT 'CREEE | ENVOYEE | RECUE | ANNULEE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Convocations pour examens, réunions et délibérations';

-- --------------------------------------------------------

--
-- Structure de la table `cours`
--

CREATE TABLE `cours` (
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `h_debut` datetime DEFAULT NULL,
  `date_cours` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `cycle`
--

CREATE TABLE `cycle` (
  `code_cycle` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_cycle` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_cycle` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Code_pension` int UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `decision`
--

CREATE TABLE `decision` (
  `code_decision` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → classe',
  `moyenne_annuelle` decimal(5,2) DEFAULT NULL COMMENT 'Moyenne générale calculée',
  `total_credits` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Total crédits inscrits',
  `credits_valides` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Crédits validés (UE >= 10)',
  `resultat` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ADMIS | AJOURNÉ | REDOUBLÉ | EXCLU',
  `mention` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Passable | Assez Bien | Bien | Très Bien',
  `rang` int UNSIGNED DEFAULT NULL COMMENT 'Rang dans la classe',
  `effectif` int UNSIGNED DEFAULT NULL COMMENT 'Effectif total de la classe',
  `date_deliberation` datetime DEFAULT NULL COMMENT 'Date du jury',
  `president_jury` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nom du président du jury',
  `observations` text COLLATE utf8mb4_unicode_ci COMMENT 'Observations du jury',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Décisions du jury de délibération par étudiant et par année';

-- --------------------------------------------------------

--
-- Structure de la table `departement`
--

CREATE TABLE `departement` (
  `Code_dep` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_dep` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_dep` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_etab` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `departement`
--

INSERT INTO `departement` (`Code_dep`, `lib_dep`, `obs_dep`, `code_etab`) VALUES
('GAE', 'Génie Agricole et Environnement', NULL, NULL),
('GCG', 'Génie Commercial et Gestion', NULL, NULL),
('GCM', 'Génie Communication et Médias', NULL, NULL),
('GHT', 'Génie Hôtelier et Tourisme', NULL, NULL),
('GI', 'Génie Informatique', '', NULL),
('GIT', 'Génie Industriel et Technique', NULL, NULL),
('GJA', 'Génie Juridique et Administratif', NULL, NULL),
('GSS', 'Génie Sanitaire et Social', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `diplome`
--

CREATE TABLE `diplome` (
  `code_diplome` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `lib_diplome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Intitulé du diplôme',
  `specialite` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Spécialité mentionnée',
  `mention` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mention obtenue',
  `annee_obtention` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Année scolaire de fin de cycle',
  `numero_serie` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Numéro de série unique du diplôme',
  `date_emission` date DEFAULT NULL COMMENT 'Date d''émission du diplôme',
  `signe_par` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Signataire',
  `qr_code_data` text COLLATE utf8mb4_unicode_ci COMMENT 'Données encodées dans le QR code',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Diplômes émis aux étudiants ayant validé leur cycle';

-- --------------------------------------------------------

--
-- Structure de la table `django_admin_log`
--

CREATE TABLE `django_admin_log` (
  `id` int NOT NULL,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext COLLATE utf8mb4_unicode_ci,
  `object_repr` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_flag` smallint UNSIGNED NOT NULL,
  `change_message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` int NOT NULL
) ;

-- --------------------------------------------------------

--
-- Structure de la table `django_content_type`
--

CREATE TABLE `django_content_type` (
  `id` int NOT NULL,
  `app_label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `django_content_type`
--

INSERT INTO `django_content_type` (`id`, `app_label`, `model`) VALUES
(1, 'admin', 'logentry'),
(62, 'api', 'absence'),
(9, 'api', 'annee'),
(10, 'api', 'auditlog'),
(48, 'api', 'badgeacces'),
(11, 'api', 'batiment'),
(59, 'api', 'carteetudiant'),
(25, 'api', 'classe'),
(52, 'api', 'convocation'),
(40, 'api', 'cours'),
(12, 'api', 'cycle'),
(60, 'api', 'decision'),
(13, 'api', 'departement'),
(49, 'api', 'diplome'),
(50, 'api', 'documentgenere'),
(26, 'api', 'enseignant'),
(14, 'api', 'etablissement'),
(27, 'api', 'etudiant'),
(63, 'api', 'etudianttuteur'),
(39, 'api', 'evaluation'),
(51, 'api', 'examen'),
(53, 'api', 'facture'),
(54, 'api', 'facturedetail'),
(55, 'api', 'fichenotes'),
(61, 'api', 'fichenotesdetail'),
(28, 'api', 'frais'),
(30, 'api', 'fraisinscription'),
(29, 'api', 'inscription'),
(15, 'api', 'jour'),
(16, 'api', 'langue'),
(56, 'api', 'lettreadmission'),
(31, 'api', 'matiere'),
(17, 'api', 'mention'),
(41, 'api', 'mentionclasse'),
(18, 'api', 'module'),
(32, 'api', 'moratoire'),
(33, 'api', 'niveau'),
(38, 'api', 'paiement'),
(19, 'api', 'pension'),
(34, 'api', 'periode'),
(42, 'api', 'planning'),
(43, 'api', 'qualification'),
(20, 'api', 'rapport'),
(35, 'api', 'rapportcours'),
(45, 'api', 'rapportfinancier'),
(46, 'api', 'rapportstatistique'),
(21, 'api', 'salle'),
(57, 'api', 'seance'),
(36, 'api', 'specialite'),
(58, 'api', 'stage'),
(37, 'api', 'tranche'),
(47, 'api', 'tuteur'),
(22, 'api', 'typeetab'),
(23, 'api', 'typeevaluation'),
(44, 'api', 'uniteenseignement'),
(24, 'api', 'utilisateur'),
(3, 'auth', 'group'),
(2, 'auth', 'permission'),
(4, 'auth', 'user'),
(5, 'contenttypes', 'contenttype'),
(6, 'sessions', 'session'),
(7, 'token_blacklist', 'blacklistedtoken'),
(8, 'token_blacklist', 'outstandingtoken');

-- --------------------------------------------------------

--
-- Structure de la table `django_migrations`
--

CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL,
  `app` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `django_migrations`
--

INSERT INTO `django_migrations` (`id`, `app`, `name`, `applied`) VALUES
(1, 'contenttypes', '0001_initial', '2026-04-06 10:30:54.080851'),
(2, 'auth', '0001_initial', '2026-04-06 10:30:54.356306'),
(3, 'admin', '0001_initial', '2026-04-06 10:30:59.966077'),
(4, 'admin', '0002_logentry_remove_auto_add', '2026-04-06 10:31:00.073827'),
(5, 'admin', '0003_logentry_add_action_flag_choices', '2026-04-06 10:31:00.210636'),
(6, 'api', '0001_initial', '2026-04-06 10:31:00.916053'),
(7, 'api', '0002_alter_auditlog_options_and_more', '2026-04-06 10:35:04.205617'),
(8, 'contenttypes', '0002_remove_content_type_name', '2026-04-06 10:38:23.687403'),
(9, 'auth', '0002_alter_permission_name_max_length', '2026-04-06 10:38:23.769204'),
(10, 'auth', '0003_alter_user_email_max_length', '2026-04-06 10:38:23.844623'),
(11, 'auth', '0004_alter_user_username_opts', '2026-04-06 10:38:23.919122'),
(12, 'auth', '0005_alter_user_last_login_null', '2026-04-06 10:38:24.020021'),
(13, 'auth', '0006_require_contenttypes_0002', '2026-04-06 10:38:24.087031'),
(14, 'auth', '0007_alter_validators_add_error_messages', '2026-04-06 10:38:24.143152'),
(15, 'auth', '0008_alter_user_username_max_length', '2026-04-06 10:38:24.230901'),
(16, 'auth', '0009_alter_user_last_name_max_length', '2026-04-06 10:38:24.287070'),
(17, 'auth', '0010_alter_group_name_max_length', '2026-04-06 10:38:24.417731'),
(18, 'auth', '0011_update_proxy_permissions', '2026-04-06 10:38:24.542320'),
(19, 'auth', '0012_alter_user_first_name_max_length', '2026-04-06 10:38:24.620504'),
(20, 'sessions', '0001_initial', '2026-04-06 10:38:24.743628'),
(21, 'token_blacklist', '0001_initial', '2026-04-06 10:38:25.253551'),
(22, 'token_blacklist', '0002_outstandingtoken_jti_hex', '2026-04-06 10:38:25.345120'),
(23, 'token_blacklist', '0003_auto_20171017_2007', '2026-04-06 10:38:25.453417'),
(24, 'token_blacklist', '0004_auto_20171017_2013', '2026-04-06 10:38:25.542087'),
(25, 'token_blacklist', '0005_remove_outstandingtoken_jti', '2026-04-06 10:38:25.619975'),
(26, 'token_blacklist', '0006_auto_20171017_2113', '2026-04-06 10:38:25.815936'),
(27, 'token_blacklist', '0007_auto_20171017_2214', '2026-04-06 10:38:25.931154'),
(28, 'token_blacklist', '0008_migrate_to_bigautofield', '2026-04-06 10:38:26.009262'),
(29, 'token_blacklist', '0010_fix_migrate_to_bigautofield', '2026-04-06 10:38:26.119355'),
(30, 'token_blacklist', '0011_linearizes_history', '2026-04-06 10:38:26.319420'),
(31, 'token_blacklist', '0012_alter_outstandingtoken_user', '2026-04-06 10:38:26.420547'),
(32, 'token_blacklist', '0013_alter_blacklistedtoken_options_and_more', '2026-04-06 10:38:26.487193'),
(33, 'api', '0003_rapportfinancier_rapportstatistique_tuteur_and_more', '2026-04-06 10:58:43.243552');

-- --------------------------------------------------------

--
-- Structure de la table `django_session`
--

CREATE TABLE `django_session` (
  `session_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expire_date` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `document_genere`
--

CREATE TABLE `document_genere` (
  `code_document` int UNSIGNED NOT NULL,
  `type_document` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'RELEVE_NOTES | DIPLOME | CARTE_ETUDIANT | FACTURE | BULLETIN | FEUILLE_EMARGEMENT | CONVOCATION | RAPPORT_STAT | RAPPORT_FINANCIER | CERTIFICAT_STAGE | LETTRE_ADMISSION | BADGE | FICHE_INSCRIPTION | EMPLOI_TEMPS',
  `format` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PDF' COMMENT 'PDF | XLSX | CSV',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Si document lié à un étudiant',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Si document lié à une classe',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Année scolaire concernée',
  `reference_id` int UNSIGNED DEFAULT NULL COMMENT 'ID de l''objet source (ex: code_decision)',
  `nom_fichier` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom du fichier généré',
  `chemin_stockage` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Chemin de stockage sur le serveur',
  `taille_octets` int UNSIGNED DEFAULT NULL COMMENT 'Taille du fichier en octets',
  `genere_par` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Login de l''utilisateur',
  `genere_le` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historique de tous les documents générés depuis le SMS';

-- --------------------------------------------------------

--
-- Structure de la table `enseignant`
--

CREATE TABLE `enseignant` (
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nom_ens` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `prenom_ens` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse_ens` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tel_ens` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_ens` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_dep` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `etablissement`
--

CREATE TABLE `etablissement` (
  `code_etab` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_etab` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `adresse` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tel` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fax` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_type` int UNSIGNED NOT NULL DEFAULT '0',
  `Siteweb` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stocke les etablissement';

-- --------------------------------------------------------

--
-- Structure de la table `etudiant`
--

CREATE TABLE `etudiant` (
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'matricule de l''etudiant',
  `nom` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'nom de l''etudiant',
  `prenom` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_naiss` datetime DEFAULT NULL,
  `lieu` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region_or` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'region d''origine',
  `code_dep` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_sp` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nom_pere` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nom_mere` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tel` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `domicile` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Nom_tuteur` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `photo` blob,
  `chemin` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de dernière modification'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `etudiant`
--

INSERT INTO `etudiant` (`mle_etudiant`, `nom`, `prenom`, `date_naiss`, `lieu`, `region_or`, `code_dep`, `code_sp`, `nom_pere`, `nom_mere`, `adresse`, `tel`, `email`, `domicile`, `Nom_tuteur`, `photo`, `chemin`, `created_at`, `updated_at`) VALUES
('ETU001', 'Kemogne Tassi', 'Fred Cyril', '2001-11-08 23:00:00', 'Yaoundé', 'Ouest', 'GI', 'CS', 'Kemogne Leroi', 'Kemogne Solange', '', '+237679865434', 'fredkemogne@gmail.com', 'Elig-edzoa', 'Kemogne Solange', NULL, NULL, '2026-04-11 17:56:22', '2026-04-11 17:56:22'),
('ETU002', 'Mol', 'Rodrigue', '1999-05-13 23:00:00', 'Yaoundé', 'Sud', 'GI', 'EC', 'Mol David', 'Mol Flore', '', '+237678270881', 'rodriguemol@gmail.com', 'Emana Pont', 'Mol David', NULL, NULL, '2026-04-11 18:14:04', '2026-04-11 18:14:04'),
('ETU003', 'Moghang Diffo', 'Jaurès Hernandez', '2000-03-06 23:00:00', 'Mbouda', 'Ouest', 'GAE', 'AGRO', 'Diffo Cédric', 'Diffo Chantal', '', '+237654356789', 'jauresmoghang@gmail.com', 'Bastos', 'Diffo Cédric', NULL, NULL, '2026-04-12 19:08:49', '2026-04-12 19:08:49'),
('ETU004', 'Abdoulaziz', 'Faroukou', '2004-08-28 23:00:00', 'Ngaoundal', 'Nord', 'GCG', 'GEA', 'Abdoulaziz Hamed', 'Abdoulaziz Aïssatou', '', '+237678270881', 'faroukouabdoulaziz@gmail.com', 'Olembé', 'Abdoulaziz Hamed', NULL, NULL, '2026-04-12 19:17:37', '2026-04-12 19:17:37'),
('ETU005', 'Adjuka', 'Fatoumata', '2005-06-23 23:00:00', 'Batouri', 'Adamaoua', 'GCG', 'MC', 'Adjuka Rashid', 'Adjuka Farida', '', '+237679865434', 'fatoumataadjuka@gmail.com', 'Limbé', 'Adjuka Rashid', NULL, NULL, '2026-04-12 19:22:56', '2026-04-12 19:22:56');

-- --------------------------------------------------------

--
-- Structure de la table `etudiant_tuteur`
--

CREATE TABLE `etudiant_tuteur` (
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_tuteur` int UNSIGNED NOT NULL,
  `est_contact_principal` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = contact principal à appeler en premier'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liaison entre étudiants et tuteurs (relation N:N)';

-- --------------------------------------------------------

--
-- Structure de la table `evaluation`
--

CREATE TABLE `evaluation` (
  `code_eval` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `date_eval` datetime DEFAULT NULL,
  `note` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Note sur 20 — ex: 15.75',
  `obs_eval` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_periode` int UNSIGNED NOT NULL DEFAULT '0',
  `code_typeEval` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de saisie',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de modification'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `examen`
--

CREATE TABLE `examen` (
  `code_examen` int UNSIGNED NOT NULL,
  `lib_examen` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ex: Examen de mi-semestre S1',
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → matiere',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → classe',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `code_periode` int UNSIGNED DEFAULT NULL COMMENT 'FK → periode',
  `code_salle` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Salle d''examen',
  `date_examen` datetime NOT NULL COMMENT 'Date et heure de l''examen',
  `duree_minutes` int UNSIGNED NOT NULL DEFAULT '60',
  `type_examen` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ECRIT' COMMENT 'ECRIT | ORAL | TP | MIXTE',
  `surveillant` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'mle_ens du surveillant principal',
  `convocation_envoyee` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = convocations envoyées',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Planning des examens — base des convocations officielles';

-- --------------------------------------------------------

--
-- Structure de la table `facture`
--

CREATE TABLE `facture` (
  `code_facture` int UNSIGNED NOT NULL,
  `numero_facture` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ex: FAC-2026-0001',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `date_emission` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `montant_total` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Total dû',
  `montant_paye` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'Total déjà payé',
  `montant_restant` decimal(12,2) GENERATED ALWAYS AS ((`montant_total` - `montant_paye`)) STORED COMMENT 'Solde restant (calculé automatiquement)',
  `statut` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EN_ATTENTE' COMMENT 'EN_ATTENTE | PARTIELLEMENT_PAYE | SOLDEE | ANNULEE',
  `observations` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Factures émises aux étudiants — détail des montants dus';

-- --------------------------------------------------------

--
-- Structure de la table `facture_detail`
--

CREATE TABLE `facture_detail` (
  `id` int UNSIGNED NOT NULL,
  `code_facture` int UNSIGNED NOT NULL COMMENT 'FK → facture',
  `libelle` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Description du frais',
  `type_frais` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SCOLARITE | INSCRIPTION | AUTRE',
  `montant` decimal(10,2) NOT NULL,
  `date_echeance` date DEFAULT NULL COMMENT 'Date d''échéance du paiement'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lignes détaillées d''une facture';

-- --------------------------------------------------------

--
-- Structure de la table `fiche_notes`
--

CREATE TABLE `fiche_notes` (
  `code_fiche` int UNSIGNED NOT NULL,
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → matiere',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → classe',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → enseignant',
  `code_periode` int UNSIGNED NOT NULL COMMENT 'FK → periode',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `code_type_eval` int UNSIGNED NOT NULL COMMENT 'FK → type_evaluation',
  `date_evaluation` date NOT NULL,
  `duree_minutes` int UNSIGNED DEFAULT NULL COMMENT 'Durée de l''évaluation en minutes',
  `bareme` decimal(5,2) NOT NULL DEFAULT '20.00' COMMENT 'Barème (20 par défaut)',
  `statut` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BROUILLON' COMMENT 'BROUILLON | SOUMIS | VALIDE | IMPORTE',
  `observations` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fiche de notes créée par l''enseignant avant validation';

-- --------------------------------------------------------

--
-- Structure de la table `fiche_notes_detail`
--

CREATE TABLE `fiche_notes_detail` (
  `id` int UNSIGNED NOT NULL,
  `code_fiche` int UNSIGNED NOT NULL COMMENT 'FK → fiche_notes',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `note` decimal(5,2) DEFAULT NULL COMMENT 'Note obtenue (NULL = absent)',
  `absent` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = absent lors de l''évaluation',
  `observation` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Notes individuelles dans une fiche de notes enseignant';

-- --------------------------------------------------------

--
-- Structure de la table `frais`
--

CREATE TABLE `frais` (
  `code_frais` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'code d''un frais de scolarite',
  `lib_frais` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'libelle de frais de scolarite',
  `obs_frais` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'observation de frais de scolarite',
  `type_frais` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'type de frais de scolarite',
  `mt_frais` double NOT NULL DEFAULT '0',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='frais de scolarite';

-- --------------------------------------------------------

--
-- Structure de la table `frais_inscription`
--

CREATE TABLE `frais_inscription` (
  `code_inscription` int UNSIGNED NOT NULL DEFAULT '0',
  `code_frais` int UNSIGNED NOT NULL DEFAULT '0',
  `date_frais` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `inscription`
--

CREATE TABLE `inscription` (
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'code d''une inscription',
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'matricule d''un etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'code de l''annee academique',
  `date_inscription` datetime DEFAULT NULL COMMENT 'date de l''inscription',
  `mt_inscription` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'montant de l''inscription paye',
  `code_inscription` int UNSIGNED NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de dernière modification'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='inscription d''un etudiant';

--
-- Déchargement des données de la table `inscription`
--

INSERT INTO `inscription` (`code_classe`, `mle_etudiant`, `code_annee`, `date_inscription`, `mt_inscription`, `code_inscription`, `updated_at`) VALUES
('LEC1', 'ETU002', '2025-2026', '2026-04-11 23:00:00', 50000, 1, '2026-04-12 18:54:17'),
('LCS1', 'ETU001', '2025-2026', '2026-04-11 23:00:00', 50000, 2, '2026-04-12 18:59:44');

-- --------------------------------------------------------

--
-- Structure de la table `jour`
--

CREATE TABLE `jour` (
  `code_jour` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_jour` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_jour` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `langue`
--

CREATE TABLE `langue` (
  `Code_Langue` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `Lib_Langue` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lettre_admission`
--

CREATE TABLE `lettre_admission` (
  `code_lettre` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_lettre` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACCEPTATION' COMMENT 'ACCEPTATION | REFUS | CONDITIONNELLE | LISTE_ATTENTE',
  `code_classe_proposee` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Classe proposée si acceptation',
  `date_emission` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_limite_reponse` date DEFAULT NULL COMMENT 'Date limite pour confirmer',
  `conditions` text COLLATE utf8mb4_unicode_ci COMMENT 'Conditions si lettre conditionnelle',
  `message_personnalise` text COLLATE utf8mb4_unicode_ci,
  `envoye_par_email` tinyint(1) NOT NULL DEFAULT '0',
  `date_envoi_email` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lettres d''admission ou de refus — générées automatiquement';

-- --------------------------------------------------------

--
-- Structure de la table `matiere`
--

CREATE TABLE `matiere` (
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_matiere` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `Obs_matiere` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Code_module` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `mention`
--

CREATE TABLE `mention` (
  `code_mention` int UNSIGNED NOT NULL,
  `lib_mention` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `note_min` int UNSIGNED NOT NULL DEFAULT '0',
  `note_max` int UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `mention_classe`
--

CREATE TABLE `mention_classe` (
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_mention` int UNSIGNED NOT NULL DEFAULT '0',
  `obs_mention` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `module`
--

CREATE TABLE `module` (
  `code_module` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_module` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_module` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `moratoire`
--

CREATE TABLE `moratoire` (
  `code_mor` int UNSIGNED NOT NULL COMMENT 'code du moratoire',
  `lib_mor` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_exp` datetime DEFAULT NULL,
  `date_effet` datetime DEFAULT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `niveau`
--

CREATE TABLE `niveau` (
  `code_niveau` int UNSIGNED NOT NULL,
  `lib_niveau` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_niveau` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_cycle` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_pension` int UNSIGNED DEFAULT NULL,
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `niveau`
--

INSERT INTO `niveau` (`code_niveau`, `lib_niveau`, `obs_niveau`, `code_cycle`, `code_pension`, `code_annee`) VALUES
(1, 'Niveau un (1)', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `paiement`
--

CREATE TABLE `paiement` (
  `code_paiement` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_tranche` int UNSIGNED NOT NULL DEFAULT '0',
  `date_paiement` datetime DEFAULT NULL,
  `mt_paiement` int UNSIGNED NOT NULL DEFAULT '0',
  `obs_paiement` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `statut` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAYE' COMMENT 'Statut : PAYE | IMPAYE | PARTIEL | ANNULE',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de dernière modification'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stocke les paiements des tranches de la pension';

--
-- Déchargement des données de la table `paiement`
--

INSERT INTO `paiement` (`code_paiement`, `mle_etudiant`, `code_tranche`, `date_paiement`, `mt_paiement`, `obs_paiement`, `statut`, `code_annee`, `updated_at`) VALUES
(1, 'ETU001', 1, '2026-04-11 23:00:00', 200000, 'Première tranche', 'PAYE', '2025-2026', '2026-04-12 19:01:46'),
(2, 'ETU002', 1, '2026-04-11 23:00:00', 200000, 'Première tranche', 'PAYE', '2025-2026', '2026-04-12 19:02:29');

-- --------------------------------------------------------

--
-- Structure de la table `pension`
--

CREATE TABLE `pension` (
  `code_pension` int UNSIGNED NOT NULL DEFAULT '0',
  `lib_pension` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mt_pension` double NOT NULL DEFAULT '0',
  `obs_pension` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nb_tranche` int UNSIGNED DEFAULT NULL,
  `mt_inscription` double NOT NULL DEFAULT '0' COMMENT 'montant de l''inscription'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stocke les differents montant de scolarite';

--
-- Déchargement des données de la table `pension`
--

INSERT INTO `pension` (`code_pension`, `lib_pension`, `mt_pension`, `obs_pension`, `nb_tranche`, `mt_inscription`) VALUES
(1, 'Scolarité', 500000, NULL, 3, 50000);

-- --------------------------------------------------------

--
-- Structure de la table `periode`
--

CREATE TABLE `periode` (
  `code_periode` int UNSIGNED NOT NULL,
  `lib_periode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `date_debut` datetime DEFAULT NULL,
  `date_fin` datetime DEFAULT NULL,
  `obs_periode` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `planning`
--

CREATE TABLE `planning` (
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_jour` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nbH` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'nombre d''unite de temps',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `qualification`
--

CREATE TABLE `qualification` (
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_qual` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rapport`
--

CREATE TABLE `rapport` (
  `code_rapport` int UNSIGNED NOT NULL,
  `lib_rapport` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rapport_cours`
--

CREATE TABLE `rapport_cours` (
  `code_lgnrapport` int UNSIGNED NOT NULL,
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_rapport` int UNSIGNED NOT NULL DEFAULT '0',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `detail_rapport` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rapport_financier`
--

CREATE TABLE `rapport_financier` (
  `code_rapport_fin` int UNSIGNED NOT NULL,
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `periode_debut` date NOT NULL,
  `periode_fin` date NOT NULL,
  `total_attendu` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Total des frais attendus',
  `total_encaisse` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Total effectivement encaissé',
  `total_impaye` decimal(14,2) GENERATED ALWAYS AS ((`total_attendu` - `total_encaisse`)) STORED,
  `nb_etudiants` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_etudiants_jour` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Étudiants à jour de paiement',
  `taux_recouvrement` decimal(5,2) GENERATED ALWAYS AS ((case when (`total_attendu` > 0) then ((`total_encaisse` / `total_attendu`) * 100) else 0 end)) STORED COMMENT 'Taux de recouvrement en %',
  `genere_par` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Login de l''utilisateur qui a généré',
  `genere_le` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rapports financiers globaux par période';

-- --------------------------------------------------------

--
-- Structure de la table `rapport_statistique`
--

CREATE TABLE `rapport_statistique` (
  `code_rapport_stat` int UNSIGNED NOT NULL,
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NULL = toutes les classes',
  `code_dep` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NULL = tous les départements',
  `periode_debut` date DEFAULT NULL,
  `periode_fin` date DEFAULT NULL,
  `nb_inscrits` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_hommes` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_femmes` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_admis` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_ajournes` int UNSIGNED NOT NULL DEFAULT '0',
  `nb_redoubles` int UNSIGNED NOT NULL DEFAULT '0',
  `taux_reussite` decimal(5,2) GENERATED ALWAYS AS ((case when (`nb_inscrits` > 0) then ((`nb_admis` / `nb_inscrits`) * 100) else 0 end)) STORED COMMENT 'Taux de réussite en %',
  `taux_feminisation` decimal(5,2) GENERATED ALWAYS AS ((case when (`nb_inscrits` > 0) then ((`nb_femmes` / `nb_inscrits`) * 100) else 0 end)) STORED COMMENT 'Pourcentage de femmes',
  `moyenne_generale` decimal(5,2) DEFAULT NULL COMMENT 'Moyenne de la classe/promotion',
  `note_min` decimal(5,2) DEFAULT NULL,
  `note_max` decimal(5,2) DEFAULT NULL,
  `genere_par` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `genere_le` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rapports statistiques — taux de réussite, effectifs, répartition H/F';

-- --------------------------------------------------------

--
-- Structure de la table `salle`
--

CREATE TABLE `salle` (
  `Code_salle` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_salle` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `obs_salle` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `salle`
--

INSERT INTO `salle` (`Code_salle`, `lib_salle`, `obs_salle`) VALUES
('01A', 'BAT01SALLE-A', '');

-- --------------------------------------------------------

--
-- Structure de la table `seance`
--

CREATE TABLE `seance` (
  `code_seance` int UNSIGNED NOT NULL,
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → matiere',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → classe',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → enseignant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → annee',
  `date_seance` date NOT NULL COMMENT 'Date du cours',
  `h_debut` time NOT NULL COMMENT 'Heure de début',
  `h_fin` time NOT NULL COMMENT 'Heure de fin',
  `salle` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Salle utilisée',
  `nb_heures_effectuees` decimal(4,2) NOT NULL DEFAULT '0.00' COMMENT 'Heures réellement dispensées',
  `statut` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TENU' COMMENT 'TENU | ANNULE | REPORTE | EN_ATTENTE',
  `observations` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Séances de cours effectivement tenues — base de la feuille d''émargement';

-- --------------------------------------------------------

--
-- Structure de la table `specialite`
--

CREATE TABLE `specialite` (
  `code_sp` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lib_sp` varchar(70) COLLATE utf8mb4_unicode_ci NOT NULL,
  `obs_sp` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_dep` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `specialite`
--

INSERT INTO `specialite` (`code_sp`, `lib_sp`, `obs_sp`, `code_dep`) VALUES
('AB', 'Analyse Biomédicale', NULL, 'GSS'),
('AGRO', 'Agronomie', NULL, 'GAE'),
('AP', 'Administration Publique', NULL, 'GJA'),
('AS', 'Assistance Sociale', NULL, 'GSS'),
('AV', 'Audiovisuel', NULL, 'GCM'),
('CC', 'Comptabilité et Finance', NULL, 'GCG'),
('CE', 'Communication d\'entreprise', NULL, 'GCM'),
('CS', 'Cybersécurité', NULL, 'GI'),
('D', 'Droit', NULL, 'GJA'),
('DG', 'Design Graphique', NULL, 'GCM'),
('DL', 'Développement Logiciel (web et mobile)', NULL, 'GI'),
('EC', 'E-Commerce et Marketing digital', NULL, 'GI'),
('ELV', 'Elevage', NULL, 'GAE'),
('FOREST', 'Génie Forestier', NULL, 'GAE'),
('GC', 'Génie Civil', NULL, 'GIT'),
('GE', 'Gestion de l\'environnement', NULL, 'GAE'),
('GEA', 'Gestion des Entreprises et Administrations', NULL, 'GCG'),
('GEE', 'Génie Electrique / Electrotechnique', NULL, 'GIT'),
('GH', 'Gestion Hôtelière', NULL, 'GHT'),
('GL', 'Génie Logiciel', NULL, 'GI'),
('GM', 'Génie Mécanique', NULL, 'GIT'),
('IA', 'Intelligence Artificielle et data', NULL, 'GI'),
('J', 'Journalisme', NULL, 'GCM'),
('LT', 'Logistique et Transport', NULL, 'GCG'),
('MC', 'Marketing et Commerce', NULL, 'GCG'),
('MI', 'Maintenance Industrielle', NULL, 'GIT'),
('RAS', 'Réseaux et Administration Systèmes', NULL, 'GI'),
('REST', 'Restauration', NULL, 'GHT'),
('SI', 'Soins Infirmiers', NULL, 'GSS'),
('TOUR', 'Tourisme', NULL, 'GHT');

-- --------------------------------------------------------

--
-- Structure de la table `stage`
--

CREATE TABLE `stage` (
  `code_stage` int UNSIGNED NOT NULL,
  `mle_etudiant` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK → etudiant',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entreprise` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom de l''entreprise d''accueil',
  `adresse_entreprise` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tuteur_entreprise` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nom du tuteur en entreprise',
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `sujet` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sujet ou mission du stage',
  `type_stage` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OBSERVATION' COMMENT 'OBSERVATION | PERFECTIONNEMENT | FIN_ETUDE',
  `note_stage` decimal(5,2) DEFAULT NULL COMMENT 'Note attribuée par le jury',
  `statut` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EN_COURS' COMMENT 'EN_COURS | VALIDE | INVALIDE | EN_ATTENTE',
  `certificat_emis` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = certificat généré',
  `date_emission_cert` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stages des étudiants — base des certificats de stage';

-- --------------------------------------------------------

--
-- Structure de la table `tranche`
--

CREATE TABLE `tranche` (
  `code_tranche` int UNSIGNED NOT NULL,
  `lib_tranche` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_pension` int UNSIGNED NOT NULL DEFAULT '0',
  `obs_tranche` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mt_tranche` int UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `tranche`
--

INSERT INTO `tranche` (`code_tranche`, `lib_tranche`, `code_pension`, `obs_tranche`, `mt_tranche`) VALUES
(1, 'Tranche 1', 1, NULL, 200000);

-- --------------------------------------------------------

--
-- Structure de la table `tuteur`
--

CREATE TABLE `tuteur` (
  `code_tuteur` int UNSIGNED NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prenom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lien_parente` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'PERE | MERE | TUTEUR | AUTRE',
  `tel` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tuteurs / parents des étudiants';

-- --------------------------------------------------------

--
-- Structure de la table `type_etab`
--

CREATE TABLE `type_etab` (
  `code_type` int UNSIGNED NOT NULL,
  `lib_type` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `obs_type` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stocke les types d''etablissement';

-- --------------------------------------------------------

--
-- Structure de la table `type_evaluation`
--

CREATE TABLE `type_evaluation` (
  `code_typeEval` int UNSIGNED NOT NULL,
  `lib_type_eval` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `obs_typeEval` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `unite_enseignement`
--

CREATE TABLE `unite_enseignement` (
  `code_matiere` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_classe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `coef` int UNSIGNED NOT NULL DEFAULT '0',
  `duree_eval` int UNSIGNED NOT NULL DEFAULT '0',
  `nbh_total` int UNSIGNED NOT NULL DEFAULT '0',
  `mle_ens` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `code_annee` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `note_elim` int UNSIGNED DEFAULT NULL,
  `credits_ects` int UNSIGNED NOT NULL DEFAULT '3' COMMENT 'Nombre de crédits ECTS pour cette UE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateur`
--

CREATE TABLE `utilisateur` (
  `login` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nom_user` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `passwd` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mot de passe hashé (PBKDF2 Django)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `utilisateur`
--

INSERT INTO `utilisateur` (`login`, `nom_user`, `role`, `passwd`) VALUES
('Lucky', 'Yemeya Luc', 'ADMIN', 'Lucky54999!');

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_absences_etudiant`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_absences_etudiant` (
`mle_etudiant` varchar(10)
,`nom_complet` varchar(91)
,`code_classe` varchar(10)
,`code_matiere` varchar(10)
,`total_seances` bigint
,`nb_absences` decimal(23,0)
,`abs_justifiees` decimal(23,0)
,`abs_non_justifiees` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_etudiants_inscrits`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_etudiants_inscrits` (
`mle_etudiant` varchar(10)
,`nom` varchar(45)
,`prenom` varchar(45)
,`date_naiss` datetime
,`tel` varchar(30)
,`email` varchar(50)
,`code_dep` varchar(10)
,`filiere` varchar(100)
,`code_sp` varchar(10)
,`specialite` varchar(70)
,`code_classe` varchar(10)
,`lib_classe` varchar(100)
,`code_annee` varchar(10)
,`annee_scolaire` varchar(45)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_paiements_etudiant`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_paiements_etudiant` (
`code_paiement` int unsigned
,`mle_etudiant` varchar(10)
,`nom_complet` varchar(91)
,`lib_tranche` varchar(10)
,`mt_paiement` int unsigned
,`date_paiement` datetime
,`statut` varchar(20)
,`code_annee` varchar(10)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_taux_reussite`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_taux_reussite` (
`code_annee` varchar(10)
,`code_classe` varchar(10)
,`lib_classe` varchar(100)
,`nb_inscrits` bigint
,`nb_admis` decimal(23,0)
,`taux_reussite` decimal(29,2)
,`moyenne_classe` decimal(6,2)
);

-- --------------------------------------------------------

--
-- Structure de la vue `v_absences_etudiant`
--
DROP TABLE IF EXISTS `v_absences_etudiant`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_absences_etudiant`  AS SELECT `ab`.`mle_etudiant` AS `mle_etudiant`, concat(`e`.`nom`,' ',coalesce(`e`.`prenom`,'')) AS `nom_complet`, `se`.`code_classe` AS `code_classe`, `se`.`code_matiere` AS `code_matiere`, count(0) AS `total_seances`, sum((case when (`ab`.`present` = 0) then 1 else 0 end)) AS `nb_absences`, sum((case when ((`ab`.`present` = 0) and (`ab`.`justifiee` = 1)) then 1 else 0 end)) AS `abs_justifiees`, sum((case when ((`ab`.`present` = 0) and (`ab`.`justifiee` = 0)) then 1 else 0 end)) AS `abs_non_justifiees` FROM ((`absence` `ab` join `seance` `se` on((`se`.`code_seance` = `ab`.`code_seance`))) join `etudiant` `e` on((`e`.`mle_etudiant` = `ab`.`mle_etudiant`))) GROUP BY `ab`.`mle_etudiant`, `nom_complet`, `se`.`code_classe`, `se`.`code_matiere` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_etudiants_inscrits`
--
DROP TABLE IF EXISTS `v_etudiants_inscrits`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_etudiants_inscrits`  AS SELECT `e`.`mle_etudiant` AS `mle_etudiant`, `e`.`nom` AS `nom`, `e`.`prenom` AS `prenom`, `e`.`date_naiss` AS `date_naiss`, `e`.`tel` AS `tel`, `e`.`email` AS `email`, `e`.`code_dep` AS `code_dep`, `d`.`lib_dep` AS `filiere`, `e`.`code_sp` AS `code_sp`, `s`.`lib_sp` AS `specialite`, `i`.`code_classe` AS `code_classe`, `c`.`lib_classe` AS `lib_classe`, `i`.`code_annee` AS `code_annee`, `a`.`lib_annee` AS `annee_scolaire` FROM (((((`etudiant` `e` left join `departement` `d` on((`d`.`Code_dep` = `e`.`code_dep`))) left join `specialite` `s` on((`s`.`code_sp` = `e`.`code_sp`))) left join `inscription` `i` on((`i`.`mle_etudiant` = `e`.`mle_etudiant`))) left join `classe` `c` on((`c`.`code_classe` = `i`.`code_classe`))) left join `annee` `a` on((`a`.`code_annee` = `i`.`code_annee`))) WHERE ((`a`.`statut` = 'EN COURS') OR (`a`.`statut` is null)) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_paiements_etudiant`
--
DROP TABLE IF EXISTS `v_paiements_etudiant`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_paiements_etudiant`  AS SELECT `p`.`code_paiement` AS `code_paiement`, `p`.`mle_etudiant` AS `mle_etudiant`, concat(`e`.`nom`,' ',coalesce(`e`.`prenom`,'')) AS `nom_complet`, `t`.`lib_tranche` AS `lib_tranche`, `p`.`mt_paiement` AS `mt_paiement`, `p`.`date_paiement` AS `date_paiement`, `p`.`statut` AS `statut`, `p`.`code_annee` AS `code_annee` FROM ((`paiement` `p` join `etudiant` `e` on((`e`.`mle_etudiant` = `p`.`mle_etudiant`))) join `tranche` `t` on((`t`.`code_tranche` = `p`.`code_tranche`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_taux_reussite`
--
DROP TABLE IF EXISTS `v_taux_reussite`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_taux_reussite`  AS SELECT `d`.`code_annee` AS `code_annee`, `d`.`code_classe` AS `code_classe`, `c`.`lib_classe` AS `lib_classe`, count(0) AS `nb_inscrits`, sum((case when (`d`.`resultat` = 'ADMIS') then 1 else 0 end)) AS `nb_admis`, round(((sum((case when (`d`.`resultat` = 'ADMIS') then 1 else 0 end)) * 100.0) / count(0)),2) AS `taux_reussite`, round(avg(`d`.`moyenne_annuelle`),2) AS `moyenne_classe` FROM (`decision` `d` join `classe` `c` on((`c`.`code_classe` = `d`.`code_classe`))) GROUP BY `d`.`code_annee`, `d`.`code_classe`, `c`.`lib_classe` ;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `absence`
--
ALTER TABLE `absence`
  ADD PRIMARY KEY (`code_absence`),
  ADD UNIQUE KEY `uk_absence_seance_etudiant` (`code_seance`,`mle_etudiant`),
  ADD KEY `idx_absence_etudiant` (`mle_etudiant`),
  ADD KEY `idx_absence_seance` (`code_seance`);

--
-- Index pour la table `annee`
--
ALTER TABLE `annee`
  ADD PRIMARY KEY (`code_annee`);

--
-- Index pour la table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_utilisateur` (`utilisateur`),
  ADD KEY `idx_audit_action` (`action`),
  ADD KEY `idx_audit_modele` (`modele`),
  ADD KEY `idx_audit_date` (`date_action`);

--
-- Index pour la table `auth_group`
--
ALTER TABLE `auth_group`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`);

--
-- Index pour la table `auth_user`
--
ALTER TABLE `auth_user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Index pour la table `badge_acces`
--
ALTER TABLE `badge_acces`
  ADD PRIMARY KEY (`code_badge`),
  ADD UNIQUE KEY `uk_numero_badge` (`numero_badge`),
  ADD KEY `idx_badge_etudiant` (`mle_etudiant`),
  ADD KEY `idx_badge_statut` (`statut`),
  ADD KEY `fk_badge_ens` (`mle_ens`);

--
-- Index pour la table `batiment`
--
ALTER TABLE `batiment`
  ADD PRIMARY KEY (`code_bat`);

--
-- Index pour la table `carte_etudiant`
--
ALTER TABLE `carte_etudiant`
  ADD PRIMARY KEY (`code_carte`),
  ADD UNIQUE KEY `uk_carte_mle_annee` (`mle_etudiant`,`code_annee`),
  ADD KEY `idx_carte_numero` (`numero_carte`);

--
-- Index pour la table `classe`
--
ALTER TABLE `classe`
  ADD PRIMARY KEY (`code_classe`),
  ADD KEY `Index_2` (`code_dep`),
  ADD KEY `code_sp` (`code_sp`);

--
-- Index pour la table `convocation`
--
ALTER TABLE `convocation`
  ADD PRIMARY KEY (`code_convocation`),
  ADD KEY `idx_conv_etudiant` (`mle_etudiant`),
  ADD KEY `idx_conv_date` (`date_evenement`),
  ADD KEY `fk_conv_ens` (`mle_ens`),
  ADD KEY `fk_conv_examen` (`code_examen`);

--
-- Index pour la table `cours`
--
ALTER TABLE `cours`
  ADD PRIMARY KEY (`code_matiere`,`code_classe`),
  ADD KEY `FK_Cours_classe` (`code_classe`);

--
-- Index pour la table `cycle`
--
ALTER TABLE `cycle`
  ADD PRIMARY KEY (`code_cycle`);

--
-- Index pour la table `decision`
--
ALTER TABLE `decision`
  ADD PRIMARY KEY (`code_decision`),
  ADD UNIQUE KEY `uk_decision_etudiant_annee` (`mle_etudiant`,`code_annee`),
  ADD KEY `idx_decision_classe` (`code_classe`),
  ADD KEY `idx_decision_resultat` (`resultat`),
  ADD KEY `fk_decision_annee` (`code_annee`);

--
-- Index pour la table `departement`
--
ALTER TABLE `departement`
  ADD PRIMARY KEY (`Code_dep`),
  ADD KEY `FK_etab` (`code_etab`);

--
-- Index pour la table `diplome`
--
ALTER TABLE `diplome`
  ADD PRIMARY KEY (`code_diplome`),
  ADD UNIQUE KEY `uk_diplome_serie` (`numero_serie`),
  ADD KEY `idx_diplome_etudiant` (`mle_etudiant`);

--
-- Index pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  ADD KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`);

--
-- Index pour la table `django_content_type`
--
ALTER TABLE `django_content_type`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`);

--
-- Index pour la table `django_migrations`
--
ALTER TABLE `django_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `django_session`
--
ALTER TABLE `django_session`
  ADD PRIMARY KEY (`session_key`),
  ADD KEY `django_session_expire_date_a5c62663` (`expire_date`);

--
-- Index pour la table `document_genere`
--
ALTER TABLE `document_genere`
  ADD PRIMARY KEY (`code_document`),
  ADD KEY `idx_dg_type` (`type_document`),
  ADD KEY `idx_dg_etudiant` (`mle_etudiant`),
  ADD KEY `idx_dg_date` (`genere_le`);

--
-- Index pour la table `enseignant`
--
ALTER TABLE `enseignant`
  ADD PRIMARY KEY (`mle_ens`),
  ADD KEY `FK_Dep_ens` (`code_dep`);

--
-- Index pour la table `etablissement`
--
ALTER TABLE `etablissement`
  ADD PRIMARY KEY (`code_etab`),
  ADD KEY `FK_code_type` (`code_type`);

--
-- Index pour la table `etudiant`
--
ALTER TABLE `etudiant`
  ADD PRIMARY KEY (`mle_etudiant`),
  ADD KEY `fk_etudiant_dep` (`code_dep`),
  ADD KEY `fk_etudiant_sp` (`code_sp`);

--
-- Index pour la table `etudiant_tuteur`
--
ALTER TABLE `etudiant_tuteur`
  ADD PRIMARY KEY (`mle_etudiant`,`code_tuteur`),
  ADD KEY `fk_et_tuteur` (`code_tuteur`);

--
-- Index pour la table `evaluation`
--
ALTER TABLE `evaluation`
  ADD PRIMARY KEY (`code_eval`),
  ADD KEY `FK_evaluation_typeEval` (`code_typeEval`),
  ADD KEY `FK_evaluation_periode` (`code_periode`),
  ADD KEY `FK_evaluation_etudiant` (`mle_etudiant`),
  ADD KEY `FK_evaluation_classe` (`code_classe`),
  ADD KEY `FK_evaluation_matiere` (`code_matiere`);

--
-- Index pour la table `examen`
--
ALTER TABLE `examen`
  ADD PRIMARY KEY (`code_examen`),
  ADD KEY `idx_examen_date` (`date_examen`),
  ADD KEY `idx_examen_classe` (`code_classe`),
  ADD KEY `idx_examen_matiere` (`code_matiere`),
  ADD KEY `fk_examen_annee` (`code_annee`);

--
-- Index pour la table `facture`
--
ALTER TABLE `facture`
  ADD PRIMARY KEY (`code_facture`),
  ADD UNIQUE KEY `uk_numero_facture` (`numero_facture`),
  ADD KEY `idx_facture_etudiant` (`mle_etudiant`),
  ADD KEY `idx_facture_annee` (`code_annee`),
  ADD KEY `idx_facture_statut` (`statut`);

--
-- Index pour la table `facture_detail`
--
ALTER TABLE `facture_detail`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_fd_facture` (`code_facture`);

--
-- Index pour la table `fiche_notes`
--
ALTER TABLE `fiche_notes`
  ADD PRIMARY KEY (`code_fiche`),
  ADD KEY `idx_fiche_classe` (`code_classe`),
  ADD KEY `idx_fiche_matiere` (`code_matiere`),
  ADD KEY `idx_fiche_statut` (`statut`),
  ADD KEY `fk_fiche_ens` (`mle_ens`),
  ADD KEY `fk_fiche_periode` (`code_periode`),
  ADD KEY `fk_fiche_type_eval` (`code_type_eval`);

--
-- Index pour la table `fiche_notes_detail`
--
ALTER TABLE `fiche_notes_detail`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_fiche_etudiant` (`code_fiche`,`mle_etudiant`),
  ADD KEY `fk_fnd_etudiant` (`mle_etudiant`);

--
-- Index pour la table `frais`
--
ALTER TABLE `frais`
  ADD PRIMARY KEY (`code_frais`),
  ADD KEY `FK_frais_annee` (`code_annee`);

--
-- Index pour la table `frais_inscription`
--
ALTER TABLE `frais_inscription`
  ADD KEY `FK_frais_inscription_insc` (`code_inscription`),
  ADD KEY `FK_frais_inscription_frais` (`code_frais`);

--
-- Index pour la table `inscription`
--
ALTER TABLE `inscription`
  ADD PRIMARY KEY (`code_inscription`),
  ADD KEY `FK_code_annee` (`code_annee`),
  ADD KEY `FK_mle_etudiant` (`mle_etudiant`),
  ADD KEY `FK_classe` (`code_classe`);

--
-- Index pour la table `jour`
--
ALTER TABLE `jour`
  ADD PRIMARY KEY (`code_jour`);

--
-- Index pour la table `langue`
--
ALTER TABLE `langue`
  ADD PRIMARY KEY (`Code_Langue`);

--
-- Index pour la table `lettre_admission`
--
ALTER TABLE `lettre_admission`
  ADD PRIMARY KEY (`code_lettre`),
  ADD KEY `idx_la_etudiant` (`mle_etudiant`),
  ADD KEY `idx_la_type` (`type_lettre`);

--
-- Index pour la table `matiere`
--
ALTER TABLE `matiere`
  ADD PRIMARY KEY (`code_matiere`),
  ADD KEY `FK_module` (`Code_module`);

--
-- Index pour la table `mention`
--
ALTER TABLE `mention`
  ADD PRIMARY KEY (`code_mention`);

--
-- Index pour la table `mention_classe`
--
ALTER TABLE `mention_classe`
  ADD PRIMARY KEY (`code_classe`,`code_mention`),
  ADD KEY `FK_mention` (`code_mention`);

--
-- Index pour la table `module`
--
ALTER TABLE `module`
  ADD PRIMARY KEY (`code_module`);

--
-- Index pour la table `moratoire`
--
ALTER TABLE `moratoire`
  ADD PRIMARY KEY (`code_mor`),
  ADD KEY `FK_etudiant` (`mle_etudiant`);

--
-- Index pour la table `niveau`
--
ALTER TABLE `niveau`
  ADD PRIMARY KEY (`code_niveau`),
  ADD KEY `FK_niveau_annee` (`code_annee`),
  ADD KEY `Fk_Cycle` (`code_cycle`);

--
-- Index pour la table `paiement`
--
ALTER TABLE `paiement`
  ADD PRIMARY KEY (`code_paiement`),
  ADD KEY `FK_Paiement_annee` (`code_annee`),
  ADD KEY `FK_Paiement_etudiant` (`mle_etudiant`),
  ADD KEY `FK_paiement_tranche` (`code_tranche`);

--
-- Index pour la table `pension`
--
ALTER TABLE `pension`
  ADD PRIMARY KEY (`code_pension`);

--
-- Index pour la table `periode`
--
ALTER TABLE `periode`
  ADD PRIMARY KEY (`code_periode`),
  ADD KEY `FK_Periode_annee` (`code_annee`);

--
-- Index pour la table `planning`
--
ALTER TABLE `planning`
  ADD PRIMARY KEY (`code_matiere`,`code_classe`,`code_jour`,`mle_ens`),
  ADD KEY `FK_planning_classe` (`code_classe`),
  ADD KEY `FK_planning_ens` (`mle_ens`),
  ADD KEY `FK_planning_jour` (`code_jour`);

--
-- Index pour la table `qualification`
--
ALTER TABLE `qualification`
  ADD PRIMARY KEY (`code_matiere`,`mle_ens`),
  ADD KEY `FK_Qualif_enseignant` (`mle_ens`);

--
-- Index pour la table `rapport`
--
ALTER TABLE `rapport`
  ADD PRIMARY KEY (`code_rapport`);

--
-- Index pour la table `rapport_cours`
--
ALTER TABLE `rapport_cours`
  ADD PRIMARY KEY (`code_lgnrapport`),
  ADD KEY `FK_Rapport_cours_mat` (`code_matiere`),
  ADD KEY `FK_Rapport_cours_classe` (`code_classe`),
  ADD KEY `FK_Rapport_cours_rapport` (`code_rapport`),
  ADD KEY `FK_Rapport_cours_ens` (`mle_ens`);

--
-- Index pour la table `rapport_financier`
--
ALTER TABLE `rapport_financier`
  ADD PRIMARY KEY (`code_rapport_fin`),
  ADD KEY `idx_rf_annee` (`code_annee`),
  ADD KEY `idx_rf_periode` (`periode_debut`,`periode_fin`);

--
-- Index pour la table `rapport_statistique`
--
ALTER TABLE `rapport_statistique`
  ADD PRIMARY KEY (`code_rapport_stat`),
  ADD KEY `idx_rs_annee` (`code_annee`),
  ADD KEY `idx_rs_classe` (`code_classe`),
  ADD KEY `idx_rs_dep` (`code_dep`);

--
-- Index pour la table `salle`
--
ALTER TABLE `salle`
  ADD PRIMARY KEY (`Code_salle`);

--
-- Index pour la table `seance`
--
ALTER TABLE `seance`
  ADD PRIMARY KEY (`code_seance`),
  ADD KEY `idx_seance_date` (`date_seance`),
  ADD KEY `idx_seance_classe` (`code_classe`),
  ADD KEY `idx_seance_matiere` (`code_matiere`),
  ADD KEY `fk_seance_ens` (`mle_ens`),
  ADD KEY `fk_seance_annee` (`code_annee`);

--
-- Index pour la table `specialite`
--
ALTER TABLE `specialite`
  ADD PRIMARY KEY (`code_sp`),
  ADD KEY `FK_Sp_dep` (`code_dep`);

--
-- Index pour la table `stage`
--
ALTER TABLE `stage`
  ADD PRIMARY KEY (`code_stage`),
  ADD KEY `idx_stage_etudiant` (`mle_etudiant`),
  ADD KEY `idx_stage_statut` (`statut`),
  ADD KEY `idx_stage_annee` (`code_annee`);

--
-- Index pour la table `tranche`
--
ALTER TABLE `tranche`
  ADD PRIMARY KEY (`code_tranche`),
  ADD KEY `FK_Tranche_pension` (`code_pension`);

--
-- Index pour la table `tuteur`
--
ALTER TABLE `tuteur`
  ADD PRIMARY KEY (`code_tuteur`);

--
-- Index pour la table `type_etab`
--
ALTER TABLE `type_etab`
  ADD PRIMARY KEY (`code_type`);

--
-- Index pour la table `type_evaluation`
--
ALTER TABLE `type_evaluation`
  ADD PRIMARY KEY (`code_typeEval`);

--
-- Index pour la table `unite_enseignement`
--
ALTER TABLE `unite_enseignement`
  ADD PRIMARY KEY (`code_matiere`,`code_classe`),
  ADD KEY `FK_UE_Classe` (`code_classe`),
  ADD KEY `FK_UE_annee` (`code_annee`),
  ADD KEY `FK_UE_enseignant` (`mle_ens`);

--
-- Index pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  ADD PRIMARY KEY (`login`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `absence`
--
ALTER TABLE `absence`
  MODIFY `code_absence` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT pour la table `auth_group`
--
ALTER TABLE `auth_group`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `auth_permission`
--
ALTER TABLE `auth_permission`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=253;

--
-- AUTO_INCREMENT pour la table `auth_user`
--
ALTER TABLE `auth_user`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `badge_acces`
--
ALTER TABLE `badge_acces`
  MODIFY `code_badge` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `carte_etudiant`
--
ALTER TABLE `carte_etudiant`
  MODIFY `code_carte` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `convocation`
--
ALTER TABLE `convocation`
  MODIFY `code_convocation` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `decision`
--
ALTER TABLE `decision`
  MODIFY `code_decision` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `diplome`
--
ALTER TABLE `diplome`
  MODIFY `code_diplome` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `django_content_type`
--
ALTER TABLE `django_content_type`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT pour la table `django_migrations`
--
ALTER TABLE `django_migrations`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT pour la table `document_genere`
--
ALTER TABLE `document_genere`
  MODIFY `code_document` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `evaluation`
--
ALTER TABLE `evaluation`
  MODIFY `code_eval` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `examen`
--
ALTER TABLE `examen`
  MODIFY `code_examen` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `facture`
--
ALTER TABLE `facture`
  MODIFY `code_facture` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `facture_detail`
--
ALTER TABLE `facture_detail`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `fiche_notes`
--
ALTER TABLE `fiche_notes`
  MODIFY `code_fiche` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `fiche_notes_detail`
--
ALTER TABLE `fiche_notes_detail`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `inscription`
--
ALTER TABLE `inscription`
  MODIFY `code_inscription` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `lettre_admission`
--
ALTER TABLE `lettre_admission`
  MODIFY `code_lettre` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `mention`
--
ALTER TABLE `mention`
  MODIFY `code_mention` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `moratoire`
--
ALTER TABLE `moratoire`
  MODIFY `code_mor` int UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'code du moratoire';

--
-- AUTO_INCREMENT pour la table `niveau`
--
ALTER TABLE `niveau`
  MODIFY `code_niveau` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `paiement`
--
ALTER TABLE `paiement`
  MODIFY `code_paiement` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `periode`
--
ALTER TABLE `periode`
  MODIFY `code_periode` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rapport`
--
ALTER TABLE `rapport`
  MODIFY `code_rapport` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rapport_cours`
--
ALTER TABLE `rapport_cours`
  MODIFY `code_lgnrapport` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rapport_financier`
--
ALTER TABLE `rapport_financier`
  MODIFY `code_rapport_fin` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rapport_statistique`
--
ALTER TABLE `rapport_statistique`
  MODIFY `code_rapport_stat` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `seance`
--
ALTER TABLE `seance`
  MODIFY `code_seance` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stage`
--
ALTER TABLE `stage`
  MODIFY `code_stage` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `tranche`
--
ALTER TABLE `tranche`
  MODIFY `code_tranche` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `tuteur`
--
ALTER TABLE `tuteur`
  MODIFY `code_tuteur` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `type_etab`
--
ALTER TABLE `type_etab`
  MODIFY `code_type` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `type_evaluation`
--
ALTER TABLE `type_evaluation`
  MODIFY `code_typeEval` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `absence`
--
ALTER TABLE `absence`
  ADD CONSTRAINT `fk_absence_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absence_seance` FOREIGN KEY (`code_seance`) REFERENCES `seance` (`code_seance`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `badge_acces`
--
ALTER TABLE `badge_acces`
  ADD CONSTRAINT `fk_badge_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_badge_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `carte_etudiant`
--
ALTER TABLE `carte_etudiant`
  ADD CONSTRAINT `fk_carte_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `classe`
--
ALTER TABLE `classe`
  ADD CONSTRAINT `fk_classe_dep` FOREIGN KEY (`code_dep`) REFERENCES `departement` (`Code_dep`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_classe_sp` FOREIGN KEY (`code_sp`) REFERENCES `specialite` (`code_sp`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `convocation`
--
ALTER TABLE `convocation`
  ADD CONSTRAINT `fk_conv_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_conv_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_conv_examen` FOREIGN KEY (`code_examen`) REFERENCES `examen` (`code_examen`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `decision`
--
ALTER TABLE `decision`
  ADD CONSTRAINT `fk_decision_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_decision_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_decision_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `departement`
--
ALTER TABLE `departement`
  ADD CONSTRAINT `fk_dep_etab` FOREIGN KEY (`code_etab`) REFERENCES `etablissement` (`code_etab`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `diplome`
--
ALTER TABLE `diplome`
  ADD CONSTRAINT `fk_diplome_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  ADD CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Contraintes pour la table `enseignant`
--
ALTER TABLE `enseignant`
  ADD CONSTRAINT `fk_ens_dep` FOREIGN KEY (`code_dep`) REFERENCES `departement` (`Code_dep`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `etudiant`
--
ALTER TABLE `etudiant`
  ADD CONSTRAINT `fk_etudiant_dep` FOREIGN KEY (`code_dep`) REFERENCES `departement` (`Code_dep`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_etudiant_sp` FOREIGN KEY (`code_sp`) REFERENCES `specialite` (`code_sp`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `etudiant_tuteur`
--
ALTER TABLE `etudiant_tuteur`
  ADD CONSTRAINT `fk_et_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_et_tuteur` FOREIGN KEY (`code_tuteur`) REFERENCES `tuteur` (`code_tuteur`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `evaluation`
--
ALTER TABLE `evaluation`
  ADD CONSTRAINT `fk_eval_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_eval_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_eval_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_eval_periode` FOREIGN KEY (`code_periode`) REFERENCES `periode` (`code_periode`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_eval_typeEval` FOREIGN KEY (`code_typeEval`) REFERENCES `type_evaluation` (`code_typeEval`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `examen`
--
ALTER TABLE `examen`
  ADD CONSTRAINT `fk_examen_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_examen_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_examen_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `facture`
--
ALTER TABLE `facture`
  ADD CONSTRAINT `fk_facture_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `facture_detail`
--
ALTER TABLE `facture_detail`
  ADD CONSTRAINT `fk_fd_facture` FOREIGN KEY (`code_facture`) REFERENCES `facture` (`code_facture`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `fiche_notes`
--
ALTER TABLE `fiche_notes`
  ADD CONSTRAINT `fk_fiche_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_fiche_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_fiche_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_fiche_periode` FOREIGN KEY (`code_periode`) REFERENCES `periode` (`code_periode`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_fiche_type_eval` FOREIGN KEY (`code_type_eval`) REFERENCES `type_evaluation` (`code_typeEval`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `fiche_notes_detail`
--
ALTER TABLE `fiche_notes_detail`
  ADD CONSTRAINT `fk_fnd_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_fnd_fiche` FOREIGN KEY (`code_fiche`) REFERENCES `fiche_notes` (`code_fiche`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `inscription`
--
ALTER TABLE `inscription`
  ADD CONSTRAINT `fk_insc_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_insc_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_insc_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `lettre_admission`
--
ALTER TABLE `lettre_admission`
  ADD CONSTRAINT `fk_la_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `matiere`
--
ALTER TABLE `matiere`
  ADD CONSTRAINT `fk_matiere_module` FOREIGN KEY (`Code_module`) REFERENCES `module` (`code_module`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `paiement`
--
ALTER TABLE `paiement`
  ADD CONSTRAINT `fk_paiement_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_paiement_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_paiement_tranche` FOREIGN KEY (`code_tranche`) REFERENCES `tranche` (`code_tranche`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `planning`
--
ALTER TABLE `planning`
  ADD CONSTRAINT `fk_planning_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_planning_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_planning_jour` FOREIGN KEY (`code_jour`) REFERENCES `jour` (`code_jour`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_planning_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `seance`
--
ALTER TABLE `seance`
  ADD CONSTRAINT `fk_seance_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_seance_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_seance_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_seance_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `specialite`
--
ALTER TABLE `specialite`
  ADD CONSTRAINT `fk_sp_dep` FOREIGN KEY (`code_dep`) REFERENCES `departement` (`Code_dep`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `stage`
--
ALTER TABLE `stage`
  ADD CONSTRAINT `fk_stage_etudiant` FOREIGN KEY (`mle_etudiant`) REFERENCES `etudiant` (`mle_etudiant`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `tranche`
--
ALTER TABLE `tranche`
  ADD CONSTRAINT `fk_tranche_pension` FOREIGN KEY (`code_pension`) REFERENCES `pension` (`code_pension`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Contraintes pour la table `unite_enseignement`
--
ALTER TABLE `unite_enseignement`
  ADD CONSTRAINT `fk_ue_annee` FOREIGN KEY (`code_annee`) REFERENCES `annee` (`code_annee`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ue_classe` FOREIGN KEY (`code_classe`) REFERENCES `classe` (`code_classe`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ue_ens` FOREIGN KEY (`mle_ens`) REFERENCES `enseignant` (`mle_ens`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ue_matiere` FOREIGN KEY (`code_matiere`) REFERENCES `matiere` (`code_matiere`) ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
