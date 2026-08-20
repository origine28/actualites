# Sauvegarde et restauration

## Sauvegarde (à automatiser via la tâche planifiée Windows)

1. **Base de données** : `pg_dump` de `news_db`.
2. **Fichiers** : copie du dossier `backend/storage/`.
3. **Configuration** : sauvegarde de `backend/.env` (hors Git) dans un emplacement sécurisé.

Exemple :

```powershell
# Base
pg_dump --host 127.0.0.1 --username news_app --dbname news_db --format=plain --file=backup\news_db_YYYYMMDD.sql

# Fichiers
Copy-Item -Recurse backend\storage backup\storage_YYYYMMDD
```

## Restauration (procédure à tester avant mise en production)

```powershell
# 1. Recréer la base
psql --host 127.0.0.1 --username news_app --dbname news_db -f backup\news_db_YYYYMMDD.sql

# 2. Restaurer les fichiers
Copy-Item -Recurse backup\storage_YYYYMMDD backend\storage
```

Le script `scripts/backup.ps1` et `scripts/restore.ps1` sont des squelettes
dont l'implémentation complète sera réalisée en Phase 12.
