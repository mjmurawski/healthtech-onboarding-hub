# 🏥 HealthTech Onboarding Hub

**Osobisty system wdrożeniowy dla programisty i inżyniera wsparcia technicznego w sektorze ochrony zdrowia (HealthTech)**.

Zaprojektowany specjalnie pod kątem pracy z systemami szpitalnymi (**HIS, LIS, RIS, PACS**), standardami integracyjnymi (**HL7 v2.x, FHIR**) oraz procesami migracji baz danych (**Firebird ➔ PostgreSQL**).

---

## ⚡ Jak uruchomić aplikację?

Aplikacja jest w 100% **samowystarczalna (Single Page Application - SPA)**. Nie wymaga instalacji Node.js, dockera ani zewnętrznych bibliotek:

1. **Uruchomienie bezpośrednie:**
   - Przejdź do folderu `C:\Users\micha\.gemini\antigravity\scratch\healthtech-onboarding-hub`
   - Otwórz plik `index.html` w dowolnej nowoczesnej przeglądarce (Chrome, Edge, Firefox).

2. **Uruchomienie przez lekki serwer lokalny (opcjonalnie):**
   ```bash
   cd C:\Users\micha\.gemini\antigravity\scratch\healthtech-onboarding-hub
   python -m http.server 8080
   ```
   I wejdź na: `http://localhost:8080`

---

## 🧭 Zawartość i Moduły Aplikacji

### 1. 🎯 Moduł Oceny i Personalizacji (Suwaki 1–5)
- Interaktywne suwaki dla 6 kluczowych technologii:
  - **Java** (Mirth Connect, HAPI FHIR, Spring)
  - **Python** (skrypty ETL, parsowanie HL7, automatyzacja)
  - **Delphi** (czytanie i orientacja w kodzie legacy systemów HIS)
  - **Linux** (diagnostyka portów MLLP, logi, kontenery)
  - **SQL** (dialekty Firebird vs PostgreSQL, transakcje, sekwencje)
  - **HL7 / FHIR** (segmenty, protokół MLLP, REST API w JSON)
- **Dynamiczna adaptacja:** zmiana wartości suwaka natychmiast przelicza wskaźnik *HealthTech Readiness Score* oraz filtruje i dostosowuje priorytety w 7-dniowym planie nauki.

### 2. 📅 7-Dniowy Plan Przygotowawczy (2–3h / dzień)
- Zaplanowane dni z konkretnymi zadaniami, ćwiczeniami praktycznymi i zweryfikowanymi linkami do dokumentacji:
  - **Dzień 1:** Anatomia systemów HIS, LIS, RIS, PACS & format ramki HL7 v2
  - **Dzień 2:** MLLP, transakcje ACK/NACK, zlecenia badań (ORM) i wyniki (ORU)
  - **Dzień 3:** Przełamywanie bariery Delphi: jak czytać DataModule i zapytania SQL w starym kodzie
  - **Dzień 4:** Firebird w pigułce: transakcje Snapshot/Read Committed, generatory, gfix i gbak
  - **Dzień 5:** PostgreSQL w MedTech: mapowanie typów, konwersja WIN1250 do UTF-8, ETL w Pythonie
  - **Dzień 6:** Standard HL7 FHIR: zasoby JSON, REST API, zapytania do publicznego serwera HAPI
  - **Dzień 7:** Silnik integracyjny (Mirth Connect), kolejkowanie i symulacja awarii
- Zapis stanu każdego checkboxa w pamięci podręcznej.

### 3. 🔄 Cheat-sheet: Migracja Firebird ➔ PostgreSQL
- **Różnice i pułapki architektoniczne:** wielkość liter (Case Sensitivity), zjawisko blokad sweep/OAT vs MVCC/VACUUM, brak typu boolean w Firebird 2.5.
- **Tabela mapowania typów:** `VARCHAR`, `BLOB SUB_TYPE 1 (TEXT)`, `BLOB SUB_TYPE 0 (BYTEA)`, `SMALLINT` ➔ `BOOLEAN`, `TIMESTAMP` ➔ `TIMESTAMPTZ`.
- **Wzorce SQL:** zamiana generatorów na sekwencje (`CREATE SEQUENCE` + `IDENTITY`), przepisanie triggerów autoprzyrostu, konwersja paginacji `FIRST/SKIP` ➔ `LIMIT/OFFSET`.
- **Gotowy skrypt ETL w Pythonie:** migracja partiami (`fdb` + `psycopg2`) z dekodowaniem polskich znaków `WIN1250`.
- **Troubleshooting:** instrukcje naprawy uszkodzonych baz przez `gfix` i obsługa kolejności kluczy obcych.

### 4. 🏥 Przewodnik HL7 v2 & FHIR + Słownik „Mów jak zespół”
- Porównanie HL7 v2 vs FHIR.
- Analiza obiegów: `ADT^A01`/`A08` (ruch chorych), `ORM^O01` (zlecenia), `ORU^R01` (wyniki badań laboratoryjnych i radiologicznych).
- Gotowy kod klienta MLLP w Pythonie.
- **Słownik żargonu (25+ terminów z wyszukiwarką):** MLLP, ACK/NACK, Z-segmenty, DICOM MWL, AET Title, Placer vs Filler, LOINC, ICD-10/ICD-9, okno serwisowe, RODO medyczne.

### 5. 🔬 Interaktywny Inspektor Komunikatów HL7 (Sandbox)
- Wbudowany parser rozbijający komunikaty na segmenty, pola i komponenty.
- Szablony gotowych komunikatów (Wynik LIS, Przyjęcie ADT, Zlecenie ORM).
- **Automatyczny generator odpowiedzi ACK (Application Accept)** z zachowaniem numeru kontrolnego wiadomości (`MSH-10` ➔ `MSA-2`).

### 6. 🐧 Asystent Konsoli Linux & Generator Rozwiązań (Baza Wiedzy JSON v2.0.0 & Error-First)
- **Architektura Error-First (5 Poziomów):**
  - **Poziom 1: Sprzęt i Zasoby OS** (RAM/Kernel OOM Killer z awaryjnym SWAP vs Dysk ENOSPC i wyczerpanie Inodów).
  - **Poziom 2: Uprawnienia, IPC i Storage** (Firebird `semop` i czyszczenie blokad tabeli locków `ipcrm`, wiszący NFS/PACS z odmontowaniem `umount -l -f`, uprawnienia POSIX `namei -l` i SELinux bez niszczącego uruchamiania `gfix`).
  - **Poziom 3: Sieć L4, Sockety i MTU** (Gwałtowne zrywanie połączeń TCP RST flag w trakcie transmisji obrazów DICOM, MSS Clamping w `iptables`, konflikt portów `fuser` i restrykcje zapory UFW per IP analizatora).
  - **Poziom 4: Cykl Życia Usługi** (Bramka stanu procesu: blokada zapytań SQL L7 na procesach martwych z kodem `status=1/FAILURE` lub `PANIC`).
  - **Poziom 5: Aplikacja & Bazy Danych** (Zarządzanie pulą sesji PostgreSQL, naprawa spójności bazy Firebird z obowiązkową kopią `cp -a`).
- **Lekki Silnik Dopasowujący & Baza Reguł JSON v2.0.0 (`diagnoseLog`):**
  - Ekstrakcja parametrów w locie: `{{TARGET_PATH}}`, `{{TARGET_DIR}}`, `{{TARGET_FILE}}`, `{{TARGET_PORT}}`, `{{SERVICE_USER}}`, `{{SERVICE_NAME}}`, `{{SOURCE_IP_SUBNET}}`, `{{NFS_SERVER_IP}}`.
  - Wbudowany edytor Bazy Wiedzy z możliwością modyfikacji JSON w przeglądarce, zapisu w `localStorage`, eksportu i resetu do domyślnych reguł.
- **Incident Step Feedback Engine (Podczat Kroku):**
  - Obsługa dedykowanych `subchat_fallbacks` (np. `operation not permitted` -> zdjęcie flag niezmienności `chattr -i -a` z logu audytowego).
  - Baza mikro-poprawek (brakujące pakiety `psmisc`, `net-tools`, `tcpdump`, wiszący zasób) z zachowaniem zasady niepowtarzania błędu.
- **Archiwum Szpitalnych Runbooków & Post-Mortem:**
  - Trwały zapis rozwiązanych awarii, czas trwania, objawy i eksport do Markdown.

### 7. 📝 Szablon Dokumentacji Integracyjnej / Projektowej
- Gotowy, interaktywny formularz zgodny ze standardami inżynierii szpitalnej.
- Sekcje: Metryka, Cel biznesowy, Zakres, Architektura przepływu, Mapowanie pól, Zmiany w bazie, Plan testów, Rollback plan.
- Eksport jednym kliknięciem do czystego pliku `.md` lub skopiowanie do schowka.

### 7. ❓ Lista Pytań Orientacyjnych do Zespołu
- 11 kluczowych pytań pogrupowanych w 5 filarów: Architektura, Narzędzia & Git, Standaryzacja HL7, Dostęp & RODO, Dług technologiczny w Delphi.
- Odznaczanie stanu zadania pytania i wbudowane pole na notowanie odpowiedzi od kolegów.

### 8. ✅ Checklist Pierwszego Tygodnia (Dni 1–5)
- Dzień po dniu: zadania organizacyjne, konfiguracja IDE i Dockera, pierwszy testowy komunikat MLLP, realizacja pierwszego zadania (*Good First Issue*) i podsumowanie tygodnia z mentorem.

### 9. 🤖 Centrum Automatyzacji SRE & Ansible (Site Reliability Engineering)
Zaprojektowane pod kątem transformacji zespołu w kierunku **SRE ze wsparciem aplikacyjnym**, z naciskiem na **automatyzację, powtarzalność i stabilność**:
- **Katalog Idempotentnych Playbooków SRE:**
  - `psql_maintenance`: PostgreSQL Healthcheck, VACUUM i bezpieczne zamykanie wycieków połączeń (*idle-in-transaction*).
  - `firebird_ipc_heal`: Samonaprawa menedżera blokad Firebird (błędy `semop`), czyszczenie semaforów IPC z obowiązkową kopią binarną (`cp -a`).
  - `nfs_pacs_heal`: Samoleczenie zawieszonego montażu NFS dla archiwum PACS i skanów WSI (`umount -l -f`, weryfikacja RPC, canary write probe).
  - `mllp_daemon_guard`: Monitoring i autorestart demonów MLLP (HL7 v2 na porcie 2575) z zaporą UFW zawężoną per IP analizatora.
  - `disk_docker_purge`: Bezpieczne odzyskiwanie przestrzeni dyskowej (rotacja journalctl, truncate logów `*-json.log` Dockera z ochroną baz danych i konfiguracji).
  - `patexpert_hotfix_deploy`: Wdrożenia patchów w architekturze `block ... rescue ... always` z testem dymnym REST i automatycznym rollbackiem.
- **Zasada Safe by Default:**
  - Wymuszona obsługa `--check` (dry-run) oraz `--diff` dla wszystkich playbooków.
  - Jawna konfiguracja zmiennych (`extra_vars` / `-e`) bez ukrytego stanu.
- **Hybryda Python + Bash:**
  - Dedykowane skrypty pomocnicze wywoływane przez zadania Ansible:
    - `sre_mllp_probe.py`: sonda gniazda HL7 MLLP z timeoutem i formatowaniem JSON dla Ansible.
    - `sre_pg_pool_guard.py`: monitor wycieków transakcji PostgreSQL.
    - `safe_docker_vacuum.sh`: skrypt Bash z `set -euo pipefail` i selektywnym zerowaniem logów kontenerów.
    - `firebird_safe_reset.sh`: bezpieczny reset semaforów IPC.
- **Parser i Diagnosta PLAY RECAP:**
  - Natychmiastowe parsowanie zrzutów z terminala CLI / AWX / GitLab CI.
  - Wykrywanie hostów `ok`, `changed`, `unreachable`, `failed`.
  - Automatyczna diagnoza SRE root-cause i generowanie komendy naprawczej.
  - Eksport 1-click do Bazy Runbooków (`tags: ['SRE', 'ANSIBLE', 'AUTOMATION']`).
- **Generator Playbooków AI (Gemini):**
  - Generowanie nowych playbooków na podstawie opisu procedury w języku naturalnym z zachowaniem rygoru idempotentności i obsługi błędów.

---

## 🚀 Jak pracować z Ansible i nowym modułem SRE?

1. **Uruchomienie w przeglądarce:**
   - Otwórz zakładkę `🤖 Automatyzacja SRE & Ansible` w menu bocznym.
2. **Uruchamianie Playbooków z CLI:**
   - Skopiuj wygenerowane polecenie z flagą `--check` (bezpieczny test bez wprowadzania zmian):
     ```bash
     ansible-playbook -i inventory.ini psql_maintenance.yml --check --diff
     ```
   - Po zweryfikowaniu wyników w trybie testowym usuń `--check`, aby wprowadzić pożądany stan:
     ```bash
     ansible-playbook -i inventory.ini psql_maintenance.yml --diff
     ```
3. **Analiza wyników i rozwiązywanie problemów:**
   - Wklej wynik wykonania do podzakładki **Parser Wyników PLAY RECAP** — moduł wskaże błędy timeoutów, odmowy dostępu SSH lub kody wyjścia i pozwoli zapisać procedurę do Bazy Runbooków.

---

## 🛠️ Funkcje Dodatkowe
- **Pełna pamięć w `localStorage`:** Wszystkie suwaki, odznaczone zadania, notatki i szablony nie znikają po odświeżeniu strony.
- **Kopia zapasowa JSON:** Przycisk *Kopia JSON* i *Wczytaj* w menu bocznym umożliwia przeniesienie stanu na inny komputer.
- **Szybkie Notatki (Quick Notes):** Wysuwana z prawej strony szuflada na podręczne zapiski ze spotkań i porty testowe.
- **Tryb Ciemny / Jasny (Dark & Light Mode).**
- **Pełna responsywność:** Działa na monitorach ultrawide, laptopach, tabletach i smartfonach.

---

*Stworzone w ramach Google Antigravity dla inżynierów i specjalistów wsparcia w sektorze ochrony zdrowia.*
