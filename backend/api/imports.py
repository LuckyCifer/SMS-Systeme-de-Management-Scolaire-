"""
api/imports.py — Importeurs CSV pour toutes les entités SMS.

Chaque importeur hérite de BaseImporter et implémente :
  - validate_row()  → valide une ligne (sans toucher la BD)
  - import_row()    → insère / met à jour via get_or_create
"""
import csv
import io
from datetime import datetime, date as date_type
from django.db import transaction
from django.core.validators import validate_email as dj_validate_email
from django.core.exceptions import ValidationError as DjValidationError

from .models import (
    Enseignant, Personnel, Etudiant, Inscription, Evaluation, Paiement,
    Departement, Specialite, Classe, Annee, Matiere, Periode, TypeEvaluation,
    Tranche, ConfigBulletin, POSTE_CHOICES,
)

# Dérivation automatique de la catégorie depuis le poste
POSTE_TO_CAT = {
    'DIRECTEUR': 'DIRECTION', 'DIRECTEUR_ADJ': 'DIRECTION',
    'PROVISEUR': 'DIRECTION', 'PROVISEUR_ADJ': 'DIRECTION',
    'DG': 'DIRECTION', 'DGA': 'DIRECTION', 'SG': 'DIRECTION',
    'DAF': 'DIRECTION', 'DES': 'DIRECTION', 'DAC': 'DIRECTION',
    'CENSEUR': 'ADMIN', 'CENSEUR_ADJ': 'ADMIN',
    'SECRETAIRE': 'ADMIN', 'ECONOME': 'ADMIN', 'INTENDANT': 'ADMIN',
    'RESP_SCOL': 'ADMIN', 'AGENT_SCOL': 'ADMIN', 'CHEF_DEP': 'ADMIN',
    'COMPTABLE': 'ADMIN', 'CAISSIER': 'ADMIN', 'INFORMATICIEN': 'ADMIN',
    'CONSEILLER_ORI': 'PEDAGOGIQUE', 'BIBLIOTHECAIRE': 'PEDAGOGIQUE',
    'SURVEILLANT': 'PEDAGOGIQUE',
    'INFIRMIER': 'SOUTIEN', 'CHAUFFEUR': 'SOUTIEN',
    'ENTRETIEN': 'SOUTIEN', 'GARDIEN': 'SOUTIEN', 'AUTRE': 'SOUTIEN',
}

# ── Constantes ────────────────────────────────────────────────────────────────

REGIONS_CAMEROUN = {
    'Centre', 'Littoral', 'Ouest', 'Nord-Ouest', 'Sud-Ouest',
    'Adamaoua', 'Nord', 'Extrême-Nord', 'Est', 'Sud',
}
_REGION_NORM = {
    'nord ouest': 'Nord-Ouest', 'nordouest': 'Nord-Ouest',
    'nord-ouest': 'Nord-Ouest', 'sud ouest': 'Sud-Ouest',
    'sudouest': 'Sud-Ouest', 'sud-ouest': 'Sud-Ouest',
    'extreme nord': 'Extrême-Nord', 'extremenord': 'Extrême-Nord',
    'extreme-nord': 'Extrême-Nord', 'extremenord': 'Extrême-Nord',
    'centre': 'Centre', 'littoral': 'Littoral', 'ouest': 'Ouest',
    'adamaoua': 'Adamaoua', 'nord': 'Nord', 'est': 'Est', 'sud': 'Sud',
}
VALID_SEXE           = {'M', 'F'}
VALID_ENS_STATUTS    = {'PERMANENT', 'VACATAIRE', 'CONTRACTUEL', 'FONCTIONNAIRE'}
VALID_CONTRATS       = {'TITULAIRE', 'CONTRACTUEL', 'VACATAIRE', 'BENEVOLE'}
VALID_POSTES         = {c[0] for c in POSTE_CHOICES}
VALID_TYPE_PAIEMENT  = {'SCOLARITE', 'INSCRIPTION', 'EXAMEN_BTS', 'SOUTENANCE_BTS',
                        'SOUTENANCE_LICENCE', 'SOUTENANCE_MASTER'}
VALID_MODE_PAIEMENT  = {'ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE'}
MENTION_MAP          = {'TB': 18, 'B': 14, 'EP': 10, 'AC': 6}
MAX_ROWS             = 1000
MAX_SIZE             = 5 * 1024 * 1024   # 5 Mo


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(raw):
    if not raw:
        return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except (ValueError, AttributeError):
            pass
    return None


def _validate_email(email):
    try:
        dj_validate_email(email)
        return True
    except DjValidationError:
        return False


def _normalize_region(raw):
    if not raw:
        return None
    s = raw.strip()
    if s in REGIONS_CAMEROUN:
        return s
    # Try normalised lower-case lookup
    key = s.lower().replace('é', 'e').replace('è', 'e').replace('ê', 'e')
    return _REGION_NORM.get(key)


def _s(row, col):
    """Strip-safe get from a CSV row dict."""
    return (row.get(col) or '').strip()


# ── BaseImporter ──────────────────────────────────────────────────────────────

class BaseImporter:
    model            = None
    required_fields  = []
    optional_fields  = []
    encoding         = 'utf-8-sig'
    template_headers = []
    template_examples = []   # list of dicts with example values
    template_notes   = []    # list of comment lines (shown after examples)

    # ── public API ───────────────────────────────────────────────────────────

    def validate_row(self, row, line_num, etablissement):
        """
        Returns dict:
          {'valid': True,  'data': cleaned_dict, 'warnings': [str]}
          {'valid': False, 'message': str}
        """
        raise NotImplementedError

    def import_row(self, cleaned, etablissement):
        """
        Insert / update one validated row.
        Returns (created: bool, instance).
        """
        raise NotImplementedError

    def run(self, csv_file, etablissement, dry_run=False):
        result = {
            'total': 0, 'success': 0,
            'created': 0, 'updated': 0,
            'errors': [], 'warnings': [],
            'dry_run': dry_run,
        }

        if not csv_file:
            result['errors'].append({'line': 0, 'data': '', 'message': 'Aucun fichier fourni.'})
            return result

        if csv_file.size > MAX_SIZE:
            result['errors'].append({'line': 0, 'data': '',
                'message': 'Fichier trop volumineux (maximum 5 Mo).'})
            return result

        try:
            content = csv_file.read().decode(self.encoding, errors='replace')
        except Exception as e:
            result['errors'].append({'line': 0, 'data': '', 'message': f'Erreur de lecture : {e}'})
            return result

        # Auto-detect delimiter
        first_line = content.split('\n')[0] if '\n' in content else content[:300]
        delimiter  = ';' if first_line.count(';') >= first_line.count(',') else ','

        try:
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
            fieldnames = reader.fieldnames  # triggers header read
        except Exception as e:
            result['errors'].append({'line': 0, 'data': '', 'message': f'Fichier CSV invalide : {e}'})
            return result

        if not fieldnames:
            result['errors'].append({'line': 0, 'data': '',
                'message': 'Fichier vide ou sans ligne d\'en-tête.'})
            return result

        reader.fieldnames = [f.strip() for f in fieldnames]

        missing = [f for f in self.required_fields if f not in reader.fieldnames]
        if missing:
            result['errors'].append({'line': 0, 'data': '',
                'message': f"Colonnes obligatoires manquantes : {', '.join(missing)}"})
            return result

        # Collect non-comment rows
        self._seen_pks = set()
        rows = []
        for row in reader:
            first_val = next(iter(row.values()), '') or ''
            if str(first_val).startswith('#'):
                continue
            if not any(v for v in row.values()):
                continue
            rows.append(row)

        if len(rows) > MAX_ROWS:
            result['errors'].append({'line': 0, 'data': '',
                'message': f'Trop de lignes : {len(rows)} (maximum {MAX_ROWS}).'})
            return result

        # Validate all rows first
        valid_rows = []
        for i, row in enumerate(rows, start=2):
            result['total'] += 1
            out = self.validate_row(row, i, etablissement)
            if out.get('valid'):
                valid_rows.append((i, out['data']))
                result['success'] += 1
                for w in out.get('warnings', []):
                    result['warnings'].append({'line': i, 'message': w})
            else:
                preview = ', '.join(f'{k}={v}' for k, v in list(row.items())[:3] if v)
                result['errors'].append({
                    'line': i, 'data': preview,
                    'message': out.get('message', 'Erreur inconnue'),
                })

        # Insert validated rows (atomically if not dry_run)
        if not dry_run and valid_rows:
            try:
                with transaction.atomic():
                    for line_num, cleaned in valid_rows:
                        created, _ = self.import_row(cleaned, etablissement)
                        if created:
                            result['created'] += 1
                        else:
                            result['updated'] += 1
            except Exception as e:
                result['created'] = 0
                result['updated'] = 0
                result['errors'].append({'line': 0, 'data': '',
                    'message': f"Erreur lors de l'insertion (rollback complet) : {e}"})

        return result

    # ── Template CSV generation (legacy) ────────────────────────────────────

    def generate_template(self, response):
        response.write('﻿')
        writer = csv.DictWriter(response, fieldnames=self.template_headers,
                                extrasaction='ignore', delimiter=',')
        writer.writeheader()
        for ex in self.template_examples:
            writer.writerow(ex)
        for note in self.template_notes:
            response.write(f'# {note}\n')
        return response

    # ── Template XLSX generation ──────────────────────────────────────────────

    def generate_template_xlsx(self):
        """Return a BytesIO with a formatted Excel (.xlsx) import template."""
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        BF  = '1F3864'   # bleu foncé (header)
        BM  = '2E74B5'   # bleu moyen (colonnes)
        BC  = 'D6E4F0'   # bleu clair (ligne paire)
        YEL = 'FFF9C4'   # jaune (instructions)
        BLN = 'E3F2FD'   # bleu très clair (notes)

        def thin(color='BBBBBB'):
            s = Side(style='thin', color=color)
            return Border(left=s, right=s, top=s, bottom=s)

        wb = Workbook()
        ws = wb.active
        ws.title = 'Gabarit'
        n  = len(self.template_headers)
        lc = get_column_letter(n)
        label = getattr(self, 'template_label', 'Données').upper()

        # ── Ligne 1 : titre ─────────────────────────────────────────────────
        ws.row_dimensions[1].height = 38
        ws.merge_cells(f'A1:{lc}1')
        c = ws['A1']
        c.value = f"GABARIT D'IMPORT  —  {label}"
        c.font      = Font(name='Calibri', bold=True, size=14, color='FFFFFF')
        c.fill      = PatternFill('solid', fgColor=BF)
        c.alignment = Alignment(horizontal='center', vertical='center')

        # ── Ligne 2 : instructions ───────────────────────────────────────────
        ws.row_dimensions[2].height = 22
        ws.merge_cells(f'A2:{lc}2')
        c = ws['A2']
        c.value = ('Colonnes marquées (*) sont obligatoires  •  '
                   'Ne modifiez pas la ligne d\'en-tête (ligne 3)  •  '
                   'Supprimez les lignes d\'exemple avant d\'importer')
        c.font      = Font(name='Calibri', italic=True, size=9, color='555555')
        c.fill      = PatternFill('solid', fgColor=YEL)
        c.alignment = Alignment(horizontal='center', vertical='center')

        # ── Ligne 3 : en-têtes des colonnes ─────────────────────────────────
        ws.row_dimensions[3].height = 28
        for i, h in enumerate(self.template_headers, start=1):
            c = ws.cell(row=3, column=i)
            c.value     = h + (' *' if h in self.required_fields else '')
            c.font      = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
            c.fill      = PatternFill('solid', fgColor=BM)
            c.alignment = Alignment(horizontal='center', vertical='center',
                                    wrap_text=True)
            s = Side(style='thin', color='FFFFFF')
            c.border = Border(left=s, right=s, top=s, bottom=s)

        # ── Lignes d'exemples ────────────────────────────────────────────────
        alt = [BC, 'FFFFFF']
        for ei, ex in enumerate(self.template_examples):
            r = 4 + ei
            ws.row_dimensions[r].height = 20
            for i, h in enumerate(self.template_headers, start=1):
                c = ws.cell(row=r, column=i)
                c.value     = ex.get(h, '')
                c.font      = Font(name='Calibri', size=10, color='222222')
                c.fill      = PatternFill('solid', fgColor=alt[ei % 2])
                c.alignment = Alignment(vertical='center')
                c.border    = thin()

        # ── Auto-filter sur la ligne d'en-tête ──────────────────────────────
        ws.auto_filter.ref = f'A3:{lc}{3 + len(self.template_examples)}'
        ws.freeze_panes    = 'A4'

        # ── Notes sur les valeurs acceptées ──────────────────────────────────
        note_row = 4 + len(self.template_examples) + 1
        for ni, note in enumerate(self.template_notes):
            r = note_row + ni
            ws.row_dimensions[r].height = 18
            ws.merge_cells(f'A{r}:{lc}{r}')
            c = ws.cell(row=r, column=1)
            c.value     = f'ℹ  {note}'
            c.font      = Font(name='Calibri', size=9, italic=True, color='1565C0')
            c.fill      = PatternFill('solid', fgColor=BLN)
            c.alignment = Alignment(vertical='center')

        # ── Largeurs de colonnes ─────────────────────────────────────────────
        WIDTHS = {
            'mle_ens': 14, 'nom_ens': 22, 'prenom_ens': 20, 'sexe': 8,
            'tel_ens': 20, 'email_ens': 28, 'adresse_ens': 24, 'statut': 16,
            'code_dep': 14, 'numero_cni': 18,
            'mle_personnel': 16, 'nom': 22, 'prenom': 20, 'poste': 18,
            'type_contrat': 16, 'tel': 20, 'email': 28, 'date_embauche': 16,
            'matricule_fonct': 18, 'obs': 24,
            'mle_etudiant': 18, 'date_naiss': 14, 'lieu': 16,
            'nationalite': 18, 'code_sp': 14,
        }
        for i, h in enumerate(self.template_headers, start=1):
            ws.column_dimensions[get_column_letter(i)].width = WIDTHS.get(h, 16)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf


# ── 1. Enseignants ────────────────────────────────────────────────────────────

class ImporteurEnseignant(BaseImporter):
    template_label  = 'Enseignants'
    model           = Enseignant
    required_fields = ['mle_ens', 'nom_ens', 'prenom_ens', 'sexe']
    optional_fields = ['tel_ens', 'email_ens', 'adresse_ens', 'statut',
                       'code_dep', 'numero_cni']
    template_headers  = ['mle_ens', 'nom_ens', 'prenom_ens', 'sexe',
                         'tel_ens', 'email_ens', 'adresse_ens', 'statut', 'code_dep', 'numero_cni']
    template_examples = [
        {'mle_ens': 'ENS001', 'nom_ens': 'ATEBA', 'prenom_ens': 'Paul', 'sexe': 'M',
         'tel_ens': '+237 699 123 456', 'email_ens': 'p.ateba@ecole.cm', 'statut': 'PERMANENT'},
        {'mle_ens': 'ENS002', 'nom_ens': 'NKOA', 'prenom_ens': 'Marie', 'sexe': 'F',
         'tel_ens': '+237 677 234 567', 'statut': 'VACATAIRE'},
    ]
    template_notes = [
        'VALEURS — sexe: M, F',
        'VALEURS — statut: PERMANENT, VACATAIRE, CONTRACTUEL, FONCTIONNAIRE',
    ]

    def validate_row(self, row, line_num, etablissement):
        warnings = []
        mle    = _s(row, 'mle_ens')
        nom    = _s(row, 'nom_ens')
        prenom = _s(row, 'prenom_ens')
        sexe   = _s(row, 'sexe').upper()

        if not mle:
            return {'valid': False, 'message': "La colonne 'mle_ens' est obligatoire."}
        if len(mle) > 10:
            return {'valid': False, 'message': f"'mle_ens' trop long (max 10 car.) : '{mle}'"}
        if not nom:
            return {'valid': False, 'message': "La colonne 'nom_ens' est obligatoire."}
        if not prenom:
            return {'valid': False, 'message': "La colonne 'prenom_ens' est obligatoire."}
        if sexe not in VALID_SEXE:
            return {'valid': False, 'message': f"'sexe' invalide : '{sexe}' (valeurs : M ou F)"}
        if mle in self._seen_pks:
            return {'valid': False, 'message': f"'mle_ens' '{mle}' est en doublon dans le fichier."}
        self._seen_pks.add(mle)

        statut = _s(row, 'statut').upper() or 'PERMANENT'
        if statut not in VALID_ENS_STATUTS:
            return {'valid': False,
                    'message': f"'statut' invalide : '{statut}' (valeurs : {', '.join(VALID_ENS_STATUTS)})"}

        email = _s(row, 'email_ens')
        if email and not _validate_email(email):
            return {'valid': False, 'message': f"Format email invalide : '{email}'"}

        code_dep = _s(row, 'code_dep') or None
        if code_dep and etablissement:
            if not Departement.objects.filter(code_dep=code_dep,
                                              etablissement=etablissement).exists():
                return {'valid': False,
                        'message': f"Le département '{code_dep}' n'existe pas pour cet établissement."}

        if Enseignant.objects.filter(mle_ens=mle).exists():
            warnings.append(f"L'enseignant '{mle}' existe déjà et sera mis à jour.")

        cleaned = {
            'mle_ens': mle, 'nom_ens': nom.upper(), 'prenom_ens': prenom,
            'sexe': sexe, 'statut': statut,
            'tel_ens': _s(row, 'tel_ens'),
            'email_ens': email,
            'adresse_ens': _s(row, 'adresse_ens'),
            'numero_cni': _s(row, 'numero_cni'),
        }
        if code_dep:
            cleaned['code_dep_id'] = code_dep
        warnings.append(f"⚠ {mle} importé sans photo — à ajouter manuellement via la fiche enseignant.")
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        mle = cleaned.pop('mle_ens')
        if etablissement:
            cleaned['etablissement'] = etablissement
        obj, created = Enseignant.objects.get_or_create(mle_ens=mle, defaults={**cleaned})
        if not created:
            for k, v in cleaned.items():
                if v not in (None, ''):
                    setattr(obj, k, v)
            obj.save()
        return created, obj


# ── 2. Personnel administratif ────────────────────────────────────────────────

class ImporteurPersonnel(BaseImporter):
    template_label  = 'Personnel'
    model           = Personnel
    required_fields = ['mle_personnel', 'nom', 'poste']
    optional_fields = ['prenom', 'sexe', 'tel', 'email', 'adresse',
                       'type_contrat', 'date_embauche', 'date_fin',
                       'matricule_fonct', 'lieu_naiss', 'date_naiss', 'obs']
    template_headers  = ['mle_personnel', 'nom', 'prenom', 'sexe', 'poste',
                         'type_contrat', 'tel', 'email', 'date_embauche', 'matricule_fonct', 'obs']
    template_examples = [
        {'mle_personnel': 'PRV001', 'nom': 'MBALLA', 'prenom': 'Pierre', 'sexe': 'M',
         'poste': 'PROVISEUR', 'type_contrat': 'TITULAIRE', 'tel': '+237 699 000 001'},
        {'mle_personnel': 'ADM001', 'nom': 'FOUDA', 'prenom': 'Chantal', 'sexe': 'F',
         'poste': 'AGENT_SCOL', 'type_contrat': 'CONTRACTUEL', 'tel': '+237 677 000 002'},
    ]
    template_notes = [
        f'VALEURS — poste: {", ".join(sorted(VALID_POSTES))}',
        'VALEURS — type_contrat: TITULAIRE, CONTRACTUEL, VACATAIRE, BENEVOLE',
        'VALEURS — sexe: M, F',
        'NOTE — La colonne "categorie" est déduite automatiquement du poste.',
    ]

    def validate_row(self, row, line_num, etablissement):
        warnings = []
        mle   = _s(row, 'mle_personnel')
        nom   = _s(row, 'nom')
        poste = _s(row, 'poste').upper()

        if not mle:
            return {'valid': False, 'message': "La colonne 'mle_personnel' est obligatoire."}
        if len(mle) > 20:
            return {'valid': False, 'message': f"'mle_personnel' trop long (max 20) : '{mle}'"}
        if not nom:
            return {'valid': False, 'message': "La colonne 'nom' est obligatoire."}
        if not poste:
            return {'valid': False, 'message': "La colonne 'poste' est obligatoire."}
        if poste not in VALID_POSTES:
            return {'valid': False,
                    'message': f"'poste' invalide : '{poste}'. Voir la liste des postes acceptés."}
        if mle in self._seen_pks:
            return {'valid': False, 'message': f"'mle_personnel' '{mle}' en doublon dans le fichier."}
        self._seen_pks.add(mle)

        type_contrat = _s(row, 'type_contrat').upper() or 'CONTRACTUEL'
        if type_contrat not in VALID_CONTRATS:
            return {'valid': False,
                    'message': f"'type_contrat' invalide : '{type_contrat}'"}

        sexe = _s(row, 'sexe').upper() or None
        if sexe and sexe not in VALID_SEXE:
            return {'valid': False, 'message': f"'sexe' invalide : '{sexe}' (M ou F)"}

        email = _s(row, 'email')
        if email and not _validate_email(email):
            return {'valid': False, 'message': f"Format email invalide : '{email}'"}

        date_embauche = _parse_date(_s(row, 'date_embauche'))
        if _s(row, 'date_embauche') and not date_embauche:
            return {'valid': False,
                    'message': f"Date d'embauche invalide : '{_s(row, 'date_embauche')}' (format : JJ/MM/AAAA)"}

        date_fin = _parse_date(_s(row, 'date_fin'))
        date_naiss = _parse_date(_s(row, 'date_naiss'))

        if Personnel.objects.filter(mle_personnel=mle).exists():
            warnings.append(f"Le personnel '{mle}' existe déjà et sera mis à jour.")

        categorie = POSTE_TO_CAT.get(poste, 'SOUTIEN')
        cleaned = {
            'mle_personnel': mle, 'nom': nom.upper(), 'prenom': _s(row, 'prenom'),
            'sexe': sexe or '', 'poste': poste, 'categorie': categorie,
            'type_contrat': type_contrat, 'actif': True,
            'tel': _s(row, 'tel'), 'email': email, 'adresse': _s(row, 'adresse'),
            'matricule_fonct': _s(row, 'matricule_fonct'),
            'lieu_naiss': _s(row, 'lieu_naiss'), 'obs': _s(row, 'obs'),
        }
        if date_embauche:
            cleaned['date_embauche'] = date_embauche
        if date_fin:
            cleaned['date_fin'] = date_fin
        if date_naiss:
            cleaned['date_naiss'] = date_naiss
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        mle = cleaned.pop('mle_personnel')
        if etablissement:
            cleaned['etablissement'] = etablissement
        obj, created = Personnel.objects.get_or_create(mle_personnel=mle, defaults={**cleaned})
        if not created:
            for k, v in cleaned.items():
                if v not in (None, ''):
                    setattr(obj, k, v)
            obj.save()
        return created, obj


# ── 3. Étudiants ─────────────────────────────────────────────────────────────

class ImporteurEtudiant(BaseImporter):
    template_label  = 'Étudiants'
    model           = Etudiant
    required_fields = ['mle_etudiant', 'nom', 'prenom', 'sexe']
    optional_fields = ['date_naiss', 'lieu', 'region_or', 'nationalite',
                       'tel', 'email', 'adresse', 'domicile',
                       'nom_pere', 'nom_mere', 'nom_tuteur',
                       'code_dep', 'code_sp', 'numero_cni']
    template_headers  = ['mle_etudiant', 'nom', 'prenom', 'sexe', 'date_naiss',
                         'lieu', 'region_or', 'nationalite', 'tel', 'email',
                         'adresse', 'domicile', 'nom_pere', 'nom_mere', 'nom_tuteur',
                         'code_dep', 'code_sp', 'numero_cni']
    template_examples = [
        {'mle_etudiant': 'ETU001', 'nom': 'MBALLA', 'prenom': 'Jean', 'sexe': 'M',
         'date_naiss': '15/03/2005', 'lieu': 'Yaoundé', 'region_or': 'Centre',
         'nationalite': 'Camerounaise', 'tel': '+237 699 123 456', 'email': 'jean.mballa@email.com'},
        {'mle_etudiant': 'ETU002', 'nom': 'NKOA', 'prenom': 'Marie', 'sexe': 'F',
         'date_naiss': '22/07/2006', 'lieu': 'Douala', 'region_or': 'Littoral',
         'nationalite': 'Camerounaise'},
    ]
    template_notes = [
        'VALEURS — sexe: M, F',
        'FORMAT — date_naiss: JJ/MM/AAAA (ex: 15/03/2005)',
        'VALEURS — region_or: Centre, Littoral, Ouest, Nord-Ouest, Sud-Ouest, Adamaoua, Nord, Extrême-Nord, Est, Sud',
        'NOTE — nationalite: défaut "Camerounaise" si vide',
    ]

    def validate_row(self, row, line_num, etablissement):
        warnings = []
        mle    = _s(row, 'mle_etudiant')
        nom    = _s(row, 'nom')
        prenom = _s(row, 'prenom')
        sexe   = _s(row, 'sexe').upper()

        if not mle:
            return {'valid': False, 'message': "La colonne 'mle_etudiant' est obligatoire."}
        if len(mle) > 15:
            return {'valid': False, 'message': f"'mle_etudiant' trop long (max 15) : '{mle}'"}
        if not nom:
            return {'valid': False, 'message': "La colonne 'nom' est obligatoire."}
        if not prenom:
            return {'valid': False, 'message': "La colonne 'prenom' est obligatoire."}
        if sexe not in VALID_SEXE:
            return {'valid': False, 'message': f"'sexe' invalide : '{sexe}' (valeurs : M ou F)"}
        if mle in self._seen_pks:
            return {'valid': False, 'message': f"'mle_etudiant' '{mle}' en doublon dans le fichier."}
        self._seen_pks.add(mle)

        # Date de naissance
        date_naiss_raw = _s(row, 'date_naiss')
        date_naiss = _parse_date(date_naiss_raw)
        if date_naiss_raw and not date_naiss:
            return {'valid': False,
                    'message': f"'date_naiss' invalide : '{date_naiss_raw}' (format attendu : JJ/MM/AAAA)"}

        # Région
        region_raw = _s(row, 'region_or')
        region_or  = None
        if region_raw:
            region_or = _normalize_region(region_raw)
            if not region_or:
                return {'valid': False,
                        'message': f"'region_or' inconnue : '{region_raw}'. "
                                   f"Régions acceptées : {', '.join(sorted(REGIONS_CAMEROUN))}"}

        # Email
        email = _s(row, 'email')
        if email and not _validate_email(email):
            return {'valid': False, 'message': f"Format email invalide : '{email}'"}

        # Département
        code_dep = _s(row, 'code_dep') or None
        if code_dep and etablissement:
            if not Departement.objects.filter(code_dep=code_dep,
                                              etablissement=etablissement).exists():
                return {'valid': False,
                        'message': f"Le département '{code_dep}' n'existe pas pour cet établissement."}

        # Spécialité
        code_sp = _s(row, 'code_sp') or None
        if code_sp:
            if not Specialite.objects.filter(code_sp=code_sp).exists():
                return {'valid': False, 'message': f"La spécialité '{code_sp}' n'existe pas."}

        if Etudiant.objects.filter(mle_etudiant=mle).exists():
            warnings.append(f"L'étudiant '{mle}' existe déjà et sera mis à jour.")

        cleaned = {
            'mle_etudiant': mle, 'nom': nom.upper(), 'prenom': prenom,
            'sexe': sexe,
            'lieu': _s(row, 'lieu'),
            'nationalite': _s(row, 'nationalite') or 'Camerounaise',
            'tel': _s(row, 'tel'), 'email': email,
            'adresse': _s(row, 'adresse'), 'domicile': _s(row, 'domicile'),
            'nom_pere': _s(row, 'nom_pere'), 'nom_mere': _s(row, 'nom_mere'),
            'nom_tuteur': _s(row, 'nom_tuteur'),
            'numero_cni': _s(row, 'numero_cni'),
        }
        if date_naiss:
            cleaned['date_naiss'] = date_naiss
        if region_or:
            cleaned['region_or'] = region_or
        if code_dep:
            cleaned['code_dep_id'] = code_dep
        if code_sp:
            cleaned['code_sp_id'] = code_sp
        warnings.append(f"⚠ {mle} importé sans photo — à ajouter manuellement via la fiche étudiant.")
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        mle = cleaned.pop('mle_etudiant')
        if etablissement:
            cleaned['etablissement'] = etablissement
        obj, created = Etudiant.objects.get_or_create(mle_etudiant=mle, defaults={**cleaned})
        if not created:
            for k, v in cleaned.items():
                if v not in (None, '', []):
                    setattr(obj, k, v)
            obj.save()
        return created, obj


# ── 4. Inscriptions ───────────────────────────────────────────────────────────

class ImporteurInscription(BaseImporter):
    template_label  = 'Inscriptions'
    model           = Inscription
    required_fields = ['mle_etudiant', 'code_classe', 'code_annee']
    optional_fields = ['date_inscription', 'mt_inscription']
    template_headers  = ['mle_etudiant', 'code_classe', 'code_annee', 'date_inscription', 'mt_inscription']
    template_examples = [
        {'mle_etudiant': 'ETU001', 'code_classe': 'TL-A', 'code_annee': '2025-2026',
         'date_inscription': '01/10/2025', 'mt_inscription': '150000'},
        {'mle_etudiant': 'ETU002', 'code_classe': 'TL-A', 'code_annee': '2025-2026',
         'date_inscription': '05/10/2025', 'mt_inscription': '150000'},
    ]
    template_notes = [
        'FORMAT — date_inscription: JJ/MM/AAAA (défaut = date du jour si vide)',
        'NOTE — mt_inscription: montant en FCFA, entier sans espace (ex: 150000)',
    ]

    def validate_row(self, row, line_num, etablissement):
        warnings  = []
        mle       = _s(row, 'mle_etudiant')
        code_cl   = _s(row, 'code_classe')
        code_an   = _s(row, 'code_annee')

        if not mle:
            return {'valid': False, 'message': "La colonne 'mle_etudiant' est obligatoire."}
        if not code_cl:
            return {'valid': False, 'message': "La colonne 'code_classe' est obligatoire."}
        if not code_an:
            return {'valid': False, 'message': "La colonne 'code_annee' est obligatoire."}

        # Check student exists
        try:
            etudiant = Etudiant.objects.get(mle_etudiant=mle)
        except Etudiant.DoesNotExist:
            return {'valid': False, 'message': f"L'étudiant '{mle}' n'existe pas en base."}

        # Check classe exists and belongs to etablissement
        qs_cl = Classe.objects.filter(code_classe=code_cl)
        if etablissement:
            qs_cl = qs_cl.filter(etablissement=etablissement)
        if not qs_cl.exists():
            return {'valid': False,
                    'message': f"La classe '{code_cl}' n'existe pas pour cet établissement."}

        # Check year exists
        if not Annee.objects.filter(code_annee=code_an).exists():
            return {'valid': False, 'message': f"L'année académique '{code_an}' n'existe pas."}

        # Duplicate check in file
        pk_key = f'{mle}|{code_an}'
        if pk_key in self._seen_pks:
            return {'valid': False,
                    'message': f"Doublon dans le fichier : '{mle}' déjà présent pour l'année '{code_an}'"}
        self._seen_pks.add(pk_key)

        # Already inscribed for this year (unique_together constraint)
        if Inscription.objects.filter(mle_etudiant=mle, code_annee=code_an).exists():
            return {'valid': False,
                    'message': f"'{mle}' est déjà inscrit(e) pour l'année '{code_an}' (une seule inscription par an)."}

        date_insc = _parse_date(_s(row, 'date_inscription')) or date_type.today()
        mt_raw    = _s(row, 'mt_inscription')
        try:
            mt = int(mt_raw) if mt_raw else 0
            if mt < 0:
                raise ValueError
        except ValueError:
            return {'valid': False, 'message': f"'mt_inscription' invalide : '{mt_raw}' (entier positif attendu)"}

        cleaned = {
            'mle_etudiant_id': mle,
            'code_classe_id':  code_cl,
            'code_annee_id':   code_an,
            'date_inscription': date_insc,
            'mt_inscription':   mt,
        }
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        if etablissement:
            cleaned['etablissement'] = etablissement
        obj = Inscription.objects.create(**cleaned)
        return True, obj


# ── 5. Notes (Évaluations) ────────────────────────────────────────────────────

class ImporteurNote(BaseImporter):
    template_label  = 'Notes'
    model           = Evaluation
    required_fields = ['mle_etudiant', 'code_matiere', 'code_classe', 'code_periode', 'note']
    optional_fields = ['code_type_eval', 'date_eval', 'obs_eval']
    template_headers  = ['mle_etudiant', 'code_matiere', 'code_classe', 'code_periode',
                         'note', 'code_type_eval', 'date_eval', 'obs_eval']
    template_examples = [
        {'mle_etudiant': 'ETU001', 'code_matiere': 'MAT001', 'code_classe': 'TL-A',
         'code_periode': 'SEM1', 'note': '14.5', 'date_eval': '15/12/2025'},
        {'mle_etudiant': 'ETU002', 'code_matiere': 'MAT001', 'code_classe': 'TL-A',
         'code_periode': 'SEM1', 'note': 'B'},
    ]
    template_notes = [
        'FORMAT — note: nombre décimal (ex: 14.5) ou mention TB/B/EP/AC pour maternelle',
        'VALEURS — mentions: TB=18, B=14, EP=10, AC=6',
        'FORMAT — date_eval: JJ/MM/AAAA (défaut = date du jour)',
    ]

    def _get_bareme(self, etablissement):
        try:
            type_etab = etablissement.type_etab if etablissement else None
            cfg = ConfigBulletin.objects.filter(type_etab=type_etab).first()
            return float(cfg.bareme_defaut) if cfg and cfg.bareme_defaut else 20.0
        except Exception:
            return 20.0

    def validate_row(self, row, line_num, etablissement):
        warnings  = []
        mle       = _s(row, 'mle_etudiant')
        cod_mat   = _s(row, 'code_matiere')
        cod_cl    = _s(row, 'code_classe')
        cod_per   = _s(row, 'code_periode')
        note_raw  = _s(row, 'note')

        for col, val in [('mle_etudiant', mle), ('code_matiere', cod_mat),
                         ('code_classe', cod_cl), ('code_periode', cod_per),
                         ('note', note_raw)]:
            if not val:
                return {'valid': False, 'message': f"La colonne '{col}' est obligatoire."}

        # Validate FK existence
        if not Etudiant.objects.filter(mle_etudiant=mle).exists():
            return {'valid': False, 'message': f"L'étudiant '{mle}' n'existe pas."}
        if not Matiere.objects.filter(code_matiere=cod_mat).exists():
            return {'valid': False, 'message': f"La matière '{cod_mat}' n'existe pas."}
        qs_cl = Classe.objects.filter(code_classe=cod_cl)
        if etablissement:
            qs_cl = qs_cl.filter(etablissement=etablissement)
        if not qs_cl.exists():
            return {'valid': False, 'message': f"La classe '{cod_cl}' n'existe pas."}
        if not Periode.objects.filter(code_periode=cod_per).exists():
            return {'valid': False, 'message': f"La période '{cod_per}' n'existe pas."}

        # Note value (mention or decimal)
        note_upper = note_raw.upper()
        if note_upper in MENTION_MAP:
            note_val = float(MENTION_MAP[note_upper])
        else:
            try:
                note_val = float(note_raw.replace(',', '.'))
            except ValueError:
                return {'valid': False, 'message': f"'note' invalide : '{note_raw}'. "
                        f"Attendu : nombre décimal ou mention (TB/B/EP/AC)"}
            bareme = self._get_bareme(etablissement)
            if not (0 <= note_val <= bareme):
                return {'valid': False,
                        'message': f"'note' hors barème : {note_val} (barème = {bareme})"}

        # Type eval (obligatoire en BD, auto-déduit si absent)
        cod_type = _s(row, 'code_type_eval') or None
        if cod_type and not TypeEvaluation.objects.filter(code_type_eval=cod_type).exists():
            return {'valid': False, 'message': f"Le type d'évaluation '{cod_type}' n'existe pas."}
        if not cod_type:
            first_type = TypeEvaluation.objects.first()
            if first_type:
                cod_type = first_type.code_type_eval
            else:
                return {'valid': False,
                        'message': "Aucun type d'évaluation trouvé. Créez d'abord un type d'évaluation."}

        date_eval = _parse_date(_s(row, 'date_eval')) or date_type.today()

        # Warn if note already exists for this triplet
        exists = Evaluation.objects.filter(
            mle_etudiant_id=mle, code_matiere_id=cod_mat,
            code_classe_id=cod_cl, code_periode_id=cod_per,
        )
        if cod_type:
            exists = exists.filter(code_type_eval_id=cod_type)
        if exists.exists():
            warnings.append(f"Une note existe déjà pour '{mle}' / '{cod_mat}' / période '{cod_per}' — sera mise à jour.")

        cleaned = {
            'mle_etudiant_id':  mle,
            'code_matiere_id':  cod_mat,
            'code_classe_id':   cod_cl,
            'code_periode_id':  cod_per,
            'note':             note_val,
            'date_eval':        date_eval,
            'obs_eval':         _s(row, 'obs_eval'),
        }
        if cod_type:
            cleaned['code_type_eval_id'] = cod_type
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        if etablissement:
            cleaned['etablissement'] = etablissement
        # Update if exists, create otherwise
        filters = {k: cleaned[k] for k in
                   ['mle_etudiant_id', 'code_matiere_id', 'code_classe_id', 'code_periode_id']
                   if k in cleaned}
        if 'code_type_eval_id' in cleaned:
            filters['code_type_eval_id'] = cleaned['code_type_eval_id']

        obj = Evaluation.objects.filter(**filters).first()
        if obj:
            for k, v in cleaned.items():
                setattr(obj, k, v)
            obj.save()
            return False, obj
        else:
            obj = Evaluation.objects.create(**cleaned)
            return True, obj


# ── 6. Paiements ──────────────────────────────────────────────────────────────

class ImporteurPaiement(BaseImporter):
    template_label  = 'Paiements'
    model           = Paiement
    required_fields = ['mle_etudiant', 'montant', 'date_paiement']
    optional_fields = ['code_annee', 'type_paiement', 'mode_paiement',
                       'reference', 'obs', 'code_tranche']
    template_headers  = ['mle_etudiant', 'montant', 'date_paiement', 'code_annee',
                         'type_paiement', 'code_tranche', 'mode_paiement', 'reference', 'obs']
    template_examples = [
        {'mle_etudiant': 'ETU001', 'montant': '150000', 'date_paiement': '05/10/2025',
         'code_annee': '2025-2026', 'type_paiement': 'SCOLARITE',
         'code_tranche': 'T1', 'mode_paiement': 'ESPECES'},
        {'mle_etudiant': 'ETU002', 'montant': '75000', 'date_paiement': '10/11/2025',
         'code_annee': '2025-2026', 'type_paiement': 'SCOLARITE',
         'code_tranche': 'T2', 'mode_paiement': 'MOBILE_MONEY'},
    ]
    template_notes = [
        'NOTE — montant: entier en FCFA sans espace ni symbole (ex: 150000)',
        'FORMAT — date_paiement: JJ/MM/AAAA',
        f'VALEURS — type_paiement: {", ".join(VALID_TYPE_PAIEMENT)}',
        f'VALEURS — mode_paiement: {", ".join(VALID_MODE_PAIEMENT)}',
    ]

    def validate_row(self, row, line_num, etablissement):
        warnings = []
        mle      = _s(row, 'mle_etudiant')
        mt_raw   = _s(row, 'montant')
        date_raw = _s(row, 'date_paiement')

        if not mle:
            return {'valid': False, 'message': "La colonne 'mle_etudiant' est obligatoire."}
        if not mt_raw:
            return {'valid': False, 'message': "La colonne 'montant' est obligatoire."}
        if not date_raw:
            return {'valid': False, 'message': "La colonne 'date_paiement' est obligatoire."}

        # Student existence
        if not Etudiant.objects.filter(mle_etudiant=mle).exists():
            return {'valid': False, 'message': f"L'étudiant '{mle}' n'existe pas."}

        # Montant
        try:
            montant = int(mt_raw.replace(' ', '').replace(' ', ''))
            if montant <= 0:
                raise ValueError
        except ValueError:
            return {'valid': False,
                    'message': f"'montant' invalide : '{mt_raw}' (entier positif en FCFA attendu)"}

        # Date
        date_paiement = _parse_date(date_raw)
        if not date_paiement:
            return {'valid': False,
                    'message': f"'date_paiement' invalide : '{date_raw}' (format : JJ/MM/AAAA)"}

        type_paiement = (_s(row, 'type_paiement').upper() or 'SCOLARITE')
        if type_paiement not in VALID_TYPE_PAIEMENT:
            return {'valid': False,
                    'message': f"'type_paiement' invalide : '{type_paiement}'"}

        mode_paiement = (_s(row, 'mode_paiement').upper() or 'ESPECES')
        if mode_paiement not in VALID_MODE_PAIEMENT:
            mode_paiement = 'ESPECES'

        code_annee = _s(row, 'code_annee') or None
        if code_annee and not Annee.objects.filter(code_annee=code_annee).exists():
            return {'valid': False, 'message': f"L'année '{code_annee}' n'existe pas."}
        if not code_annee:
            actif = Annee.objects.filter(statut='EN_COURS').first() or Annee.objects.first()
            if not actif:
                return {'valid': False,
                        'message': "Aucune année académique trouvée. Créez d'abord une année."}
            code_annee = actif.code_annee

        code_tranche = _s(row, 'code_tranche') or None
        if code_tranche and not Tranche.objects.filter(code_tranche=code_tranche).exists():
            return {'valid': False, 'message': f"La tranche '{code_tranche}' n'existe pas."}

        # Warn if student not inscribed for this year
        if code_annee and not Inscription.objects.filter(mle_etudiant=mle, code_annee=code_annee).exists():
            warnings.append(f"'{mle}' ne semble pas inscrit(e) pour {code_annee}.")

        cleaned = {
            'mle_etudiant_id': mle,
            'mt_paiement':     montant,
            'date_paiement':   date_paiement,
            'type_paiement':   type_paiement,
            'mode_paiement':   mode_paiement,
            'obs_paiement':    _s(row, 'obs'),
            'ref_paiement':    _s(row, 'reference'),
            'statut':          'PAYE',
        }
        if code_annee:
            cleaned['code_annee_id']  = code_annee
        if code_tranche:
            cleaned['code_tranche_id'] = code_tranche
        return {'valid': True, 'data': cleaned, 'warnings': warnings}

    def import_row(self, cleaned, etablissement):
        if etablissement:
            cleaned['etablissement'] = etablissement
        obj = Paiement.objects.create(**cleaned)
        return True, obj


# ── Registry ──────────────────────────────────────────────────────────────────

IMPORTERS = {
    'enseignants':  ImporteurEnseignant,
    'personnel':    ImporteurPersonnel,
    'etudiants':    ImporteurEtudiant,
    'inscriptions': ImporteurInscription,
    'notes':        ImporteurNote,
    'paiements':    ImporteurPaiement,
}
