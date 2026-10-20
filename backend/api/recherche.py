"""
api/recherche.py — Recherche des listes (`?search=`) qui trouve aussi les libellés affichés.

La base stocke des codes (PAYE, VALIDE, EXAMEN_OFFICIEL…) alors que les tableaux affichent
leurs libellés (« Payé », « Validée », « Frais d'examen officiel »). Le SearchFilter de DRF
ne compare que les codes : taper un libellé ne trouvait rien. Ici, pour chaque champ à
choix de `search_fields`, un terme contenu dans le libellé d'un choix sélectionne aussi les
lignes portant ce code. La comparaison des libellés ignore la casse et les accents (comme
la collation MySQL pour les champs texte).

Comme DRF : chaque terme doit se retrouver dans au moins un champ (ET entre les termes,
OU entre les champs).
"""
import unicodedata

from django.core.exceptions import FieldDoesNotExist
from django.db.models import Q
from rest_framework.filters import SearchFilter


def _normaliser(texte):
    return unicodedata.normalize('NFKD', str(texte)).encode('ascii', 'ignore').decode().lower()


def _champ(model, chemin):
    """Champ final d'un chemin « a__b__c » (None s'il n'existe pas)."""
    champ = None
    for nom in chemin.split('__'):
        try:
            champ = model._meta.get_field(nom)
        except FieldDoesNotExist:
            return None
        if champ.is_relation and champ.related_model is not None:
            model = champ.related_model
    return champ


class RechercheAvecLibelles(SearchFilter):
    def filter_queryset(self, request, queryset, view):
        champs = self.get_search_fields(view, request)
        termes = self.get_search_terms(request)
        if not champs or not termes:
            return queryset
        champs = [c.lstrip('^=@$') for c in champs]
        choix = {}
        for chemin in champs:
            champ = _champ(queryset.model, chemin)
            if champ is not None and champ.choices:
                choix[chemin] = [(code, _normaliser(libelle)) for code, libelle in champ.flatchoices]

        for terme in termes:
            cle = _normaliser(terme)
            q = Q()
            for chemin in champs:
                q |= Q(**{f'{chemin}__icontains': terme})
                codes = [code for code, libelle in choix.get(chemin, ()) if cle in libelle]
                if codes:
                    q |= Q(**{f'{chemin}__in': codes})
            queryset = queryset.filter(q)
        return queryset
