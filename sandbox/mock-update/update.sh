#!/bin/bash
# ====================================================================
# Skrypt aktualizacji LIS Marcel (update.sh) dla środowiska testowego
# ====================================================================

set -e

echo "--------------------------------------------------------"
echo "  Start procedury aktualizacji bazy centrum (Marcel LIS)"
echo "--------------------------------------------------------"

DB_NAME="centrum"
DB_USER="lab"
export PGPASSWORD="lab"

# Sprawdzenie połączenia do bazy
if ! psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ BŁĄD: Brak połączenia z bazą $DB_NAME jako użytkownik $DB_USER."
    exit 1
fi

echo ">> Wykryto bazę $DB_NAME. Rozpoczynanie sekwencji migracji SQL..."

# Sekwencyjne uruchamianie plików SQL
for sql_file in $(ls *.sql 2>/dev/null | sort -V); do
    echo ">> Wykonywanie skryptu: $sql_file ..."
    if psql -h localhost -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$sql_file"; then
        echo "   [OK] Skrypt $sql_file zakończony pomyślnie."
    else
        echo "❌ BŁĄD KRYTYCZNY w pliku $sql_file! Przerywanie migracji."
        exit 2
    fi
done

echo "--------------------------------------------------------"
echo "✅ Aktualizacja zakończona sukcesem!"
echo "Aktualna wersja w bazie:"
psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT nr_wersji, data, komentarz FROM wersja ORDER BY id DESC LIMIT 3;"
echo "--------------------------------------------------------"
