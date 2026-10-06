# 🧪 HealthTech SRE Sandbox: Poligon Testowy Aktualizacji PostgreSQL & Centrum

Gotowe środowisko testowe do samodzielnego przećwiczenia procedury aktualizacji bazy PostgreSQL i oprogramowania Centrum (LIS Marcel) zgodnie z wytycznymi Adriana Wojtkowskiego.

---

## 🚀 Metoda 1: Docker & Docker Compose (Podejście 100% SRE — 1 komenda)

Wymagania: Zainstalowany Docker Desktop na Windows.

### 1. Uruchomienie piaskownicy
W terminalu (PowerShell lub Git Bash) przejdź do katalogu `sandbox` i wykonaj:
```bash
docker compose up -d
```
To polecenie:
- Zbuduje kontener `marcel-db-sandbox` z PostgreSQL 14, środowiskiem Wine, użytkownikiem `lab:users` i strukturą `/home/lab/marcel/service/`.
- Zainicjalizuje bazę `centrum` z tabelą `wersja` (wersje 5.0.0, 5.1.0, 5.2.0) oraz tabelami `pacjenci` i `zlecenia`.
- Uruchomi kontener `satellite-rdp-sandbox` (czysty Debian bez Wine) udający serwer terminalowy RDP Alab.

### 2. Wejście do konsoli serwera bazy danych
```bash
docker exec -it -u lab marcel-db-sandbox bash
```

### 3. Ćwiczenie Scenariuszy Krok po Kroku

#### 🎯 Test 1: Sprawdzenie sesji (Zero-Connection Check)
W kontenerze bazy sprawdź czy nie ma aktywnych połączeń:
```bash
psql -U postgres -d centrum -c "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';"
```
*Powinno zwrócić:* `(0 rows)` lub tylko Twoją własną bieżącą sesję.

**Symulacja wiszącego połączenia (jak na produkcji w dzień roboczy):**
Otwórz drugie okno terminala i zasymuluj wiszące zapytanie pracownika:
```bash
docker exec -it marcel-db-sandbox psql -U lab -d centrum -c "SELECT pg_sleep(120);"
```
Wróć do pierwszego okna i wykonaj zapytanie Adriana:
```bash
psql -U postgres -d centrum -c "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';"
```
Zauważysz aktywne połączenie `SELECT pg_sleep(120);`! Teraz możesz przećwiczyć restart bazy:
```bash
# Na Debianie w kontenerze:
supervisorctl restart postgresql # lub killall -HUP postgres
```

---

#### 🎯 Test 2: Przetestowanie Triku z Tabelą `wersja`
Przejdź do katalogu aktualizacji:
```bash
cd /home/lab/marcel/service/532_przed_zmianami/
chmod +x update.sh kgp.exe
```

1. **Próba bez wycięcia pierwszej linijki (symulacja błędu):**
   Jeśli uruchomisz `5.2.1.sql` gdy wpis wersji już istnieje, otrzymasz błąd naruszenia unikalności:
   ```bash
   psql -U lab -d centrum -c "INSERT INTO wersja (nr_wersji) VALUES ('5.2.1');"
   # Próba wykonania skryptu z tą samą wersją w linijce 1:
   psql -U lab -d centrum -f 5.2.1.sql
   # Otrzymasz: ERROR: duplicate key value violates unique constraint "wersja_pkey"
   ```

2. **Zastosowanie triku Adriana Wojtkowskiego:**
   Wycinamy pierwszą linijkę `INSERT INTO wersja`:
   ```bash
   sed -i '1{/INSERT INTO wersja/d}' 5.2.1.sql
   ```
   Weryfikujemy podglądem:
   ```bash
   head -n 2 5.2.1.sql
   ```

3. **Uruchomienie aktualizacji:**
   ```bash
   ./update.sh
   ```
   Wszystkie skrypty (`5.2.1.sql`, `5.2.2.sql`, `5.3.2.sql`) wykonają się bez błędów, a baza zaktualizuje się do wersji 5.3.2!

---

#### 🎯 Test 3: Wymiana `centrum.exe`, Uprawnienia i Podpisanie Licencji
```bash
# Skopiowanie nowej binarki do katalogu nadrzędnego
cp centrum.exe /home/lab/marcel/centrum.exe
cp kgp.exe /home/lab/marcel/kgp.exe
cd /home/lab/marcel/

# Ustawienie uprawnień lab:users (755)
chown lab:users centrum.exe
chmod 755 centrum.exe

# Podpisanie licencji (aktywacja binarnego bitu PE w Wine)
./kgp.exe -a centrum.exe # lub: wine kgp.exe -a centrum.exe

# Weryfikacja utworzonego pliku klucza
ls -la centrum.exe centrum.key
```

---

#### 🎯 Test 4: Przesyłanie Klucza dla Serwera Satelitarnego RDP
Serwer `satellite-rdp` nie posiada Wine. Pobieramy jego klucz, podpisujemy i odsyłamy:
```bash
# Z kontenera marcel-db pobieramy klucz satelity:
scp lab@satellite-rdp:/home/lab/marcel/centrum.key /home/lab/marcel/satellite_keys/

# Podpisujemy binarkę dla satelity:
cd /home/lab/marcel/satellite_keys/
cp /home/lab/marcel/centrum.exe .
../kgp.exe -a centrum.exe

# Odsyłamy na serwer satelitarny:
scp centrum.exe centrum.key lab@satellite-rdp:/home/lab/marcel/
```

---

#### 🎯 Test 5: Czyszczenie po aktualizacji
```bash
cd /home/lab/marcel/
rm -f kgp.exe
ls -la
```

---

### Resetowanie środowiska do stanu początkowego:
Wystarczy jedna komenda na Windowsie:
```bash
docker compose down -v && docker compose up -d
```
I masz czyste środowisko gotowe do kolejnego treningu!

---

## 🐧 Metoda 2: WSL2 na Windows (Bez Dockera)

Jeśli wolisz pracować bezpośrednio w systemie Ubuntu pod Windows WSL2:

1. **Instalacja WSL2 w PowerShell (jako Administrator):**
   ```powershell
   wsl --install -d Ubuntu
   ```
2. **Instalacja PostgreSQL i Wine w terminalu Ubuntu:**
   ```bash
   sudo apt update
   sudo apt install -y postgresql postgresql-contrib
   sudo dpkg --add-architecture i386
   sudo apt update
   sudo apt install -y wine wine32 wine64
   ```
3. **Utworzenie użytkownika `lab` i struktury folderów:**
   ```bash
   sudo useradd -m -s /bin/bash -g users lab
   sudo mkdir -p /home/lab/marcel/service
   sudo chown -R lab:users /home/lab
   ```
4. **Utworzenie bazy `centrum`:**
   ```bash
   sudo -u postgres psql -c "CREATE USER lab WITH SUPERUSER PASSWORD 'lab';"
   sudo -u postgres psql -c "CREATE DATABASE centrum OWNER lab;"
   sudo -u postgres psql -d centrum -f /ścieżka/do/sandbox/init-db.sql
   ```
