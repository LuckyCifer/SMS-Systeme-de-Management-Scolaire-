# Lancer SMS avec Docker — notice pour les testeurs

Cette notice permet de faire tourner l'application complète (base de données, API, interface web) sur un autre ordinateur, **sans installer Python, Node.js, MySQL ni XAMPP**. Docker s'occupe de tout.

---

## 1. Prérequis

- **Docker Desktop** installé et démarré : <https://www.docker.com/products/docker-desktop/>
  (en bas à gauche de Docker Desktop, il doit être écrit *Engine running*).
- Environ **5 Go** d'espace disque libre.
- Les ports **5173**, **8000** et **3307** libres sur la machine.
- **Le fichier de la base de données** `01-sms.sql`, transmis à part par Luc (il n'est pas sur GitHub car il contient des données personnelles).
- **Un identifiant et un mot de passe** pour se connecter à l'application, également transmis par Luc.

---

## 2. Installation (une seule fois)

1. **Récupérer le projet**, soit avec Git :
   ```bash
   git clone https://github.com/LuckyCifer/SMS-Systeme-de-Management-Scolaire-.git
   ```
   soit en téléchargeant le ZIP depuis GitHub (*Code → Download ZIP*) puis en le décompressant.

2. **Placer le fichier de la base de données** dans le dossier `docker/mysql-init/` du projet :
   ```
   SMS-Systeme-de-Management-Scolaire-/
   └── docker/
       └── mysql-init/
           └── 01-sms.sql   ← ici
   ```
   ⚠️ Cette étape doit être faite **avant** le premier lancement. Sinon, la base sera créée vide.

3. **Ouvrir un terminal dans le dossier du projet**
   (sous Windows : ouvrir le dossier dans l'Explorateur, taper `cmd` dans la barre d'adresse, puis Entrée).

4. **Lancer l'application** :
   ```bash
   docker compose up -d --build
   ```
   Le premier lancement prend **5 à 15 minutes** : téléchargement des images, compilation, puis import de la base (2 à 3 minutes à lui seul). Les lancements suivants prennent quelques secondes.

5. **Suivre l'import de la base** (facultatif) :
   ```bash
   docker compose logs -f db
   ```
   L'import est terminé quand apparaît `MySQL init process done. Ready for start up.`
   Appuyer sur **Ctrl + C** pour quitter l'affichage (l'application continue de tourner).

---

## 3. Utiliser l'application

| Quoi | Adresse |
|---|---|
| **Application web** | <http://localhost:5173> |
| API (backend) | <http://localhost:8000> |
| Base MySQL (outil externe : DBeaver, MySQL Workbench…) | hôte `127.0.0.1`, port `3307`, utilisateur `root`, mot de passe `smsroot` |

---

## 4. Démarrer et arrêter au quotidien

**Depuis Docker Desktop** (onglet *Containers*, ligne `projetsms` ou au nom du dossier) :
- ■ arrête l'application ;
- ▶ la redémarre ;
- un clic sur un conteneur affiche ses logs.

**Ou en ligne de commande**, dans le dossier du projet :

| Action | Commande |
|---|---|
| Démarrer | `docker compose up -d` |
| Arrêter | `docker compose stop` |
| Voir l'état | `docker compose ps` |
| Voir les logs | `docker compose logs -f` (Ctrl + C pour quitter) |
| Après une mise à jour du code (`git pull`) | `docker compose up -d --build` |

Les données saisies pendant les tests sont **conservées** entre les arrêts et redémarrages.

---

## 5. ⚠️ À ne pas faire

- **`docker compose down -v`** : le `-v` **efface la base de données**. Au démarrage suivant, elle est réimportée depuis `01-sms.sql` et toutes les données saisies pendant les tests sont perdues. Ne l'utiliser que pour repartir volontairement de zéro.
- **Supprimer le volume `…_db_data`** dans l'onglet *Volumes* de Docker Desktop : même effet.
- **La corbeille 🗑** dans Docker Desktop supprime les conteneurs (pas les données) ; il faut ensuite relancer `docker compose up -d` dans un terminal.

---

## 6. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| `failed to connect to the docker API` | Docker Desktop n'est pas démarré | Lancer Docker Desktop et attendre *Engine running* |
| `port is already allocated` / `address already in use` | Un autre logiciel utilise le port 5173, 8000 ou 3307 | Fermer ce logiciel (autre serveur de dev, autre MySQL…) puis relancer |
| `dependency failed to start: container …-db-1 is unhealthy` | L'import de la base a échoué | Lire l'erreur avec `docker compose logs db` et l'envoyer à Luc |
| La page de connexion s'affiche mais le login échoue | La base est vide (fichier `01-sms.sql` absent au premier lancement) | Placer le fichier dans `docker/mysql-init/`, puis `docker compose down -v` et `docker compose up -d` |
| « Une erreur inattendue s'est produite » | Fichiers périmés dans le cache du navigateur | L'application se recharge normalement toute seule ; sinon F5. Si l'erreur persiste : vider le cache du navigateur (Ctrl + Maj + Suppr → *Images et fichiers en cache*) |
| Une modification du code n'apparaît pas | — | Actualiser la page ; après un `git pull`, lancer `docker compose up -d --build` |

**Pour signaler un bug**, envoyer à Luc :
1. la page concernée et les étapes pour reproduire le problème ;
2. une capture de la console du navigateur (**F12 → onglet Console**) ;
3. si besoin, les logs : `docker compose logs --tail 100 backend`.

---

## 7. À savoir

Cette configuration est faite pour le **développement et les tests**, pas pour la production : mode `DEBUG` activé, mots de passe par défaut, serveurs de développement. Ne pas l'exposer sur Internet.
