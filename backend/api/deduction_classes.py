"""
api/deduction_classes.py — Déduit le niveau scolaire national et la série d'une classe
à partir de son libellé (« 1ère A4 » → 1ERE_FR, série A).

Utilisé par la commande `deduire_niveaux_series`, qui montre d'abord ses propositions
avant de les enregistrer. En 6ème et 5ème, la lettre (« 6ème A ») n'est qu'un numéro de
groupe : aucune série n'est déduite. En 4ème et 3ème, la série est la troisième langue
(« 4ème Espagnol », « 3ème All »).
"""
import re
import unicodedata

from .notes import NIVEAUX_AVEC_SERIE

# (motif sur le libellé normalisé, code NiveauScolaire, remarque éventuelle)
_NIVEAUX = [
    (r'\b6\s*(e|eme)\b',                        '6EME_FR', None),
    (r'\b5\s*(e|eme)\b',                        '5EME_FR', None),
    (r'\b4\s*(e|eme)\b',                        '4EME_FR', None),
    (r'\b3\s*(e|eme)\b',                        '3EME_FR', None),
    (r'\b(2nde|2nd|2de|seconde)\b',             '2NDE_FR', None),
    (r'\b(1ere|1re|premiere)\b',                '1ERE_FR', None),
    (r'\b(tle|terminale|term)\b',               'TLE_FR',  None),
    (r'\bform\s*([1-4])\b',                     'F{0}_EN', None),
    (r'\b(lower\s*sixth|l6|ls)\b',              'LS_EN',   None),
    (r'\b(upper\s*sixth|u6|us)\b',              'US_EN',   None),
    (r'\b(sil)\b',                              'CP1_FR',  'SIL rattachée à CP1 : à vérifier'),
    (r'\bcp\s*([12])\b',                        'CP{0}_FR', None),
    (r'\bcp\b',                                 'CP2_FR',  'CP rattaché à CP2 : à vérifier'),
    (r'\bce\s*([12])\b',                        'CE{0}_FR', None),
    (r'\bcm\s*([12])\b',                        'CM{0}_FR', None),
    (r'\b(class|grade)\s*([1-6])\b',            'G{1}_EN', None),
]

# Série, puis éventuellement la langue des littéraires (« AE » = A Espagnol, AA Allemand, AC
# Chinois, AL Latin) et un numéro de classe (« C2 ») : « 2nde AE », « 1ère D2 », « Tle C1 ».
_SERIES_FR = r'\b(?:(A)[AECL]?|(TI|C|D|E))\d*\b'
_LANGUES = [(r'\ball(emand)?\b', 'ALLEMAND'), (r'\besp(agnol)?\b', 'ESPAGNOL'),
            (r'\blat(in)?\b', 'LATIN'), (r'\bchi(nois)?\b', 'CHINOIS')]


def _normaliser(texte):
    sans_accents = unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode()
    return sans_accents.lower()


def deduire_niveau_serie(lib_classe):
    """
    Retourne {'niveau': code ou None, 'serie': code ou '', 'remarque': texte ou None}.
    `remarque` signale ce qui doit être vérifié ou complété à la main.
    """
    texte = _normaliser(lib_classe or '')
    niveau, remarque = None, None
    for motif, code, note in _NIVEAUX:
        m = re.search(motif, texte)
        if m:
            niveau, remarque = code.format(*m.groups()), note
            break
    if niveau is None:
        if re.search(r'\bform\s*5\b', texte):
            return {'niveau': None, 'serie': '', 'remarque': 'Form 5 absent du référentiel des niveaux'}
        return {'niveau': None, 'serie': '', 'remarque': 'Niveau non reconnu'}

    serie = ''
    if niveau in ('4EME_FR', '3EME_FR'):
        serie = next((code for motif, code in _LANGUES if re.search(motif, texte)), '')
        if not serie:
            remarque = 'Troisième langue (série) à compléter'
    elif niveau in ('LS_EN', 'US_EN'):
        if 'science' in texte:
            serie = 'SCIENCE'
        elif 'art' in texte:
            serie = 'ARTS'
        else:
            remarque = 'Série (Arts / Science) à compléter'
    elif niveau in NIVEAUX_AVEC_SERIE:
        # La série suit le niveau dans le libellé original (« 1ère A4 », « Tle TI »).
        apres = re.split(r'(?i)2nde|2nd|2de|seconde|1[èe]re|1re|premi[èe]re|tle|terminale|term', lib_classe, maxsplit=1)
        m = re.search(_SERIES_FR, apres[-1]) if len(apres) > 1 else None
        if m:
            serie = m.group(1) or m.group(2)
        else:
            remarque = 'Série à compléter'
    return {'niveau': niveau, 'serie': serie, 'remarque': remarque}
