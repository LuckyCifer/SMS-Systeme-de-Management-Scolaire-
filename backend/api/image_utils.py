"""
api/image_utils.py — Traitement des photos de profil (format demi-carte).

Dimensions demi-carte camerounaise : 3,5 × 4,5 cm à 300 DPI = 413 × 531 px.
"""
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
import os

PHOTO_WIDTH      = 413   # px  (3,5 cm × 300 DPI)
PHOTO_HEIGHT     = 531   # px  (4,5 cm × 300 DPI)
MAX_FILE_SIZE_MB = 2
ALLOWED_TYPES    = {'JPEG', 'JPG', 'PNG', 'WEBP'}


def process_profile_photo(image_field):
    """
    Traitement automatique à l'upload :
      1. Vérifie que le fichier est une image PIL valide (rejette exe, pdf renommés…)
      2. Convertit en RGB si nécessaire (PNG transparent → fond blanc)
      3. Recadre au ratio 7:9 (demi-carte) en centrant
      4. Redimensionne à 413 × 531 px (300 DPI)
      5. Sauvegarde en JPEG qualité 85
    Retourne un ContentFile prêt à sauvegarder.
    """
    try:
        img = Image.open(image_field)
        # Vérification PIL — lève une exception si ce n'est pas une vraie image
        img.verify()
        # Re-ouvrir après verify() (verify() consomme le flux)
        image_field.seek(0)
        img = Image.open(image_field)

        # Conversion RGB (gère PNG avec alpha, images L, RGBA…)
        if img.mode not in ('RGB',):
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            else:
                img = img.convert('RGB')

        # Recadrage centré au ratio 7:9 (largeur:hauteur)
        target_ratio = 7 / 9
        w, h = img.size
        current_ratio = w / h

        if current_ratio > target_ratio:
            # Trop large → rogner les côtés gauche et droit
            new_w = int(h * target_ratio)
            left  = (w - new_w) // 2
            img   = img.crop((left, 0, left + new_w, h))
        elif current_ratio < target_ratio:
            # Trop haut → rogner le bas (garde le haut où se trouve le visage)
            new_h = int(w / target_ratio)
            img   = img.crop((0, 0, w, new_h))

        # Redimensionnement haute qualité
        img = img.resize((PHOTO_WIDTH, PHOTO_HEIGHT), Image.LANCZOS)

        # Export JPEG optimisé
        output = BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)

        basename = os.path.splitext(os.path.basename(image_field.name))[0]
        return ContentFile(output.read(), name=f"{basename}.jpg")

    except Exception as e:
        raise ValueError(f"Image invalide ou corrompue : {e}")
