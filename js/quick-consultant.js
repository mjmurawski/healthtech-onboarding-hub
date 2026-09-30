/**
 * HealthTech Onboarding Hub - Szybki Konsultant IT (Dev & Med) (quick-consultant.js)
 * 
 * Dedykowany, błyskawiczny agent AI do zwięzłych, technicznych odpowiedzi:
 * - Programowanie (Java, Python, Delphi, C#, Bash, Regex)
 * - Bazy Danych (PostgreSQL, Oracle, Firebird, SQL Server, blokady, indeksy)
 * - Systemy Medyczne (LIS, eKrew, PatExpert, Genetyka, HL7 v2, FHIR, ISBT 128, MLLP)
 * 
 * Reżim: Same konkrety, kod i komendy na pierwszym miejscu, zero lania wody.
 */

(function () {
    'use strict';

    // Pomocnik bezpiecznego kodowania HTML
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Pomocnik powiadomień Toast
    function showToast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[Toast ${type || 'info'}]: ${msg}`);
        }
    }

    /**
     * Dostępne modele Google Gemini API
     */
    const GEMINI_MODELS = [
        { value: 'gemini-3.5-flash', label: '⭐ gemini-3.5-flash (Domyślny – ultra-szybki, deterministyczny)' },
        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Stabilny GA)' },
        { value: 'gemini-3.7-flash', label: '🚀 gemini-3.7-flash (Agentic coding)' },
        { value: 'gemini-3.8-flash-high', label: '🔬 gemini-3.8-flash-high (Głębokie wnioskowanie SRE)' },
        { value: 'gemini-3.1-pro-preview', label: '🧠 gemini-3.1-pro-preview (Flagowy model Pro)' },
        { value: 'gemini-3.5-flash-high', label: '⚡ gemini-3.5-flash-high (Wysoki budżet myślenia)' },
        { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Zrównoważony Flash 3.6)' },
        { value: 'gemini-3.5-flash-lite', label: '🚀 gemini-3.5-flash-lite (Ultra-szybki, najniższy koszt)' },
        { value: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Lekki i oszczędny)' },
        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Stabilny Pro generacji 2.5)' },
        { value: 'gemini-2.0-flash-001', label: 'gemini-2.0-flash-001 (Wersja bazowa 2.0)' }
    ];

    /**
     * Presety i Baza Wiedzy Offline Błyskawicznego Konsultanta IT
     */
    const CONSULTANT_PRESETS = [
        // --- PROGRAMOWANIE ---
        {
            id: 'py_firebird',
            category: 'programming',
            badge: '💻 Python / Firebird',
            title: 'Połączenie z Firebird przez bibliotekę fdb',
            question: 'Jak w Pythonie poprawnie i bezpiecznie połączyć się z bazą Firebird 2.5/3.0 przez bibliotekę fdb i odczytać dane kursorem?',
            offlineAnswer: [
                "```python",
                "import fdb",
                "",
                "# Połączenie z Firebird (domyślny port 3050, kodowanie WIN1250 / UTF8)",
                "con = fdb.connect(",
                "    dsn='192.168.1.50/3050:/var/db/firebird/hospital.fdb',",
                "    user='SYSDBA',",
                "    password='masterkey',",
                "    charset='WIN1250'",
                ")",
                "",
                "try:",
                "    cur = con.cursor()",
                "    # Zawsze zamykaj kursor i pobieraj partiami przy dużych zbiorach",
                "    cur.execute(\"SELECT FIRST 100 id, nr_zlecenia, status FROM zlecenia WHERE status = 'NOWE'\")",
                "    for row in cur.fetchall():",
                "        print(f\"ID: {row[0]}, Zlecenie: {row[1]}, Status: {row[2]}\")",
                "finally:",
                "    cur.close()",
                "    con.close()",
                "```",
                "- **Transakcyjność:** W Firebird każde zapytanie `SELECT` otwiera transakcję. Po odczycie wywołaj `con.commit()` lub `con.close()`, aby nie blokować `mon$transactions`.",
                "- **Kodowanie:** Dla polskich znaków w medycznych bazach starszego typu stosuj `charset='WIN1250'` lub `charset='ISO8859_2'`.",
                "- **Instalacja:** `pip install fdb` wymaga zainstalowanej biblioteki klienta (`libfbclient.so` lub `fbclient.dll`)."
            ].join('\n')
        },
        {
            id: 'java_hl7_pid',
            category: 'programming',
            badge: '💻 Java / HL7',
            title: 'Ekstrakcja PESEL z komunikatu HL7 PID',
            question: 'Jak w Javie (HAPI HL7 lub czysty string) wyciągnąć numer PESEL i nazwisko pacjenta z segmentu PID komunikatu HL7 v2?',
            offlineAnswer: [
                "```java",
                "// Czysty, bezbiblioteczny i szybki parser segmentu PID (delimiter | i ^)",
                "public static PatientInfo parsePid(String rawHl7) {",
                "    for (String line : rawHl7.split(\"\\\\r?\\\\n|\\\\r\")) {",
                "        if (line.startsWith(\"PID|\")) {",
                "            String[] fields = line.split(\"\\\\|\", -1);",
                "            // PID-3: Patient Identifier List (często PESEL lub ID szpitalne)",
                "            String pid3 = fields.length > 3 ? fields[3].split(\"\\\\^\")[0] : \"\";",
                "            // PID-5: Patient Name (Nazwisko^Imie^^^)",
                "            String[] nameParts = fields.length > 5 ? fields[5].split(\"\\\\^\") : new String[0];",
                "            String lastName = nameParts.length > 0 ? nameParts[0] : \"\";",
                "            String firstName = nameParts.length > 1 ? nameParts[1] : \"\";",
                "            // PID-19: PESEL w polskich profilach krajowych HL7 PL",
                "            String pesel = (fields.length > 19 && !fields[19].isEmpty()) ? fields[19] : pid3;",
                "            return new PatientInfo(pesel, lastName, firstName);",
                "        }",
                "    }",
                "    return null;",
                "}",
                "```",
                "- **Pułapka HL7 PL:** W polskich szpitalach PESEL bywa umieszczany w `PID-3.1` (z kwalifikatorem PESEL w `PID-3.5`) ALBO w `PID-19`. Zawsze sprawdzaj oba pola.",
                "- **Znaki końca linii:** Segmenty HL7 są rozdzielane znakiem `\\r` (ASCII 13, 0x0D). Używaj regexu `\\r?\\n|\\r`."
            ].join('\n')
        },
        {
            id: 'delphi_access_violation',
            category: 'programming',
            badge: '💻 Delphi / Pamięć',
            title: 'Zabezpieczenie przed EAccessViolation',
            question: 'Jak w Delphi poprawnie zabezpieczyć kod przed EAccessViolation przy zwalnianiu obiektów i odczycie rekordów z bazy?',
            offlineAnswer: [
                "```pascal",
                "// Wzorzec bezpiecznej alokacji i zwalniania pamięci",
                "var",
                "  OrderQuery: TIBQuery;",
                "begin",
                "  OrderQuery := TIBQuery.Create(nil);",
                "  try",
                "    OrderQuery.Database := IBDatabase1;",
                "    OrderQuery.SQL.Text := 'SELECT id, status FROM zlecenia WHERE id = :id';",
                "    OrderQuery.ParamByName('id').AsInteger := 1024;",
                "    OrderQuery.Open;",
                "    ",
                "    // Zawsze sprawdzaj czy zbiór danych nie jest pusty przed odczytem pól",
                "    if not OrderQuery.IsEmpty then",
                "    begin",
                "      ShowMessage('Status: ' + OrderQuery.FieldByName('status').AsString);",
                "    end;",
                "  finally",
                "    // FreeAndNil zeruje wskaźnik natychmiast po zwolnieniu obiektu",
                "    FreeAndNil(OrderQuery);",
                "  end;",
                "end;",
                "```",
                "- **Nigdy nie wywołuj `Free` bezpośrednio na wskaźnikach współdzielonych:** Używaj `FreeAndNil(Obj)`, co zapobiega wiszącym wskaźnikom (dangling pointers).",
                "- **Sprawdzanie istnienia:** Zawsze stosuj `if Assigned(MyObject) then`.",
                "- **EAccessViolation w bibliotekach 32-bit:** Jeśli aplikacja LIS/HIS jest 32-bitowa, proces ma twardy limit 2 GB RAM (lub 3 GB z flagą LARGEADDRESSAWARE)."
            ].join('\n')
        },
        {
            id: 'bash_mllp_netstat',
            category: 'programming',
            badge: '💻 Bash / Sieć',
            title: 'Weryfikacja portu MLLP 2575 i procesów TCP',
            question: 'Jaka jest najszybsza komenda Bash do sprawdzenia czy port MLLP 2575 nasłuchuje, kto go zajmuje i jak zresetować wiszące połączenie?',
            offlineAnswer: [
                "```bash",
                "# 1. Sprawdź czy proces nasłuchuje na porcie MLLP 2575 i jaki ma PID:",
                "sudo ss -tulpn | grep :2575 || sudo netstat -tulpn | grep 2575",
                "",
                "# 2. Wyświetl aktywne sesje TCP z analizatorami (stan ESTAB / CLOSE_WAIT):",
                "sudo ss -tnp 'sport = :2575 or dport = :2575'",
                "",
                "# 3. Ubij tylko wiszącą sesję TCP do konkretnego analizatora bez restartu demona:",
                "sudo ss -K dst 192.168.10.120 dport 2575",
                "",
                "# 4. Jeśli port wisi w procesie-zombie, sprawdź i zrestartuj usługę Mirth/Camel:",
                "sudo systemctl status mirth-connect --no-pager",
                "```",
                "- **CLOSE_WAIT:** Jeśli połączenie wisi w stanie `CLOSE_WAIT`, oznacza to, że analizator zamknął socket, a aplikacja szpitalna nie wywołała `close()`.",
                "- **Bezpieczeństwo MLLP:** Zawsze ograniczaj regułę zapory do IP aparatury: `sudo ufw allow proto tcp from 192.168.10.120 to any port 2575`."
            ].join('\n')
        },

        // --- BAZY DANYCH ---
        {
            id: 'pg_locks',
            category: 'databases',
            badge: '🗄️ PostgreSQL / Blokady',
            title: 'Wykrywanie blokujących transakcji w Postgres',
            question: 'Podaj precyzyjne zapytanie SQL do znalezienia transakcji blokujących inne sesje w PostgreSQL wraz z PID-ami i czasem trwania.',
            offlineAnswer: [
                "```sql",
                "SELECT ",
                "    blocked_locks.pid     AS blocked_pid,",
                "    blocked_activity.usename AS blocked_user,",
                "    blocking_locks.pid    AS blocking_pid,",
                "    blocking_activity.usename AS blocking_user,",
                "    now() - blocking_activity.query_start AS blocking_duration,",
                "    blocked_activity.query    AS blocked_statement,",
                "    blocking_activity.query   AS blocking_statement",
                "FROM pg_catalog.pg_locks blocked_locks",
                "JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid",
                "JOIN pg_catalog.pg_locks blocking_locks ",
                "    ON blocking_locks.locktype = blocked_locks.locktype",
                "    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database",
                "    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation",
                "    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page",
                "    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple",
                "    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid",
                "    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid",
                "    AND blocking_locks.pid != blocked_locks.pid",
                "JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid",
                "WHERE NOT blocked_locks.granted;",
                "```",
                "- **Łagodne anulowanie zapytania:** `SELECT pg_cancel_backend(<blocking_pid>);`",
                "- **Twarde rozłączenie sesji:** `SELECT pg_terminate_backend(<blocking_pid>);`",
                "- **Szybki podgląd oczekujących:** `SELECT pid, state, wait_event_type, wait_event, query FROM pg_stat_activity WHERE wait_event_type = 'Lock';`"
            ].join('\n')
        },
        {
            id: 'oracle_ora_00054',
            category: 'databases',
            badge: '🗄️ Oracle / Deadlock',
            title: 'Obsługa błędu ORA-00054: resource busy',
            question: 'Jak zidentyfikować sesję blokującą tabelę w Oracle przy błędzie ORA-00054 (resource busy NOWAIT) i jak ją bezpiecznie zakończyć?',
            offlineAnswer: [
                "```sql",
                "-- 1. Znajdź sesję blokującą dany obiekt w Oracle:",
                "SELECT ",
                "    s.sid, ",
                "    s.serial#, ",
                "    s.username, ",
                "    s.osuser, ",
                "    s.machine, ",
                "    s.program, ",
                "    s.status,",
                "    o.object_name,",
                "    l.locked_mode",
                "FROM v$locked_object l",
                "JOIN dba_objects o ON l.object_id = o.object_id",
                "JOIN v$session s ON l.session_id = s.sid",
                "WHERE o.object_name = 'ZLECENIA';",
                "",
                "-- 2. Zakończenie sesji blokującej (wymaga uprawnień DBA):",
                "-- ALTER SYSTEM KILL SESSION '<sid>,<serial#>' IMMEDIATE;",
                "ALTER SYSTEM KILL SESSION '142,39812' IMMEDIATE;",
                "```",
                "- **Przyczyna:** Sesja wykonała `UPDATE` lub `SELECT ... FOR UPDATE NOWAIT` i nie wykonała ani `COMMIT` ani `ROLLBACK`.",
                "- **Wskazówka:** Klauzula `IMMEDIATE` zwalnia zasoby w obszarze rollback bez oczekiwania na potwierdzenie od klienta sieciowego."
            ].join('\n')
        },
        {
            id: 'firebird_trans',
            category: 'databases',
            badge: '🗄️ Firebird / Transakcje',
            title: 'Monitoring transakcji w MON$TRANSACTIONS',
            question: 'Jak w Firebird 2.5/3.0 sprawdzić wiszące transakcje i najdłużej wykonujące się zapytania przez tabele monitorujące MON$?',
            offlineAnswer: [
                "```sql",
                "-- Odczyt aktywnych transakcji posortowanych od najstarszej",
                "SELECT ",
                "    t.mon$transaction_id AS trans_id,",
                "    a.mon$attachment_id  AS attach_id,",
                "    a.mon$user           AS db_user,",
                "    a.mon$remote_address AS remote_ip,",
                "    a.mon$remote_process AS app_name,",
                "    t.mon$timestamp      AS trans_start,",
                "    s.mon$sql_text       AS current_query",
                "FROM mon$transactions t",
                "JOIN mon$attachments a ON t.mon$attachment_id = a.mon$attachment_id",
                "LEFT JOIN mon$statements s ON s.mon$transaction_id = t.mon$transaction_id",
                "WHERE a.mon$user != 'SYSDBA'",
                "ORDER BY t.mon$timestamp ASC;",
                "```",
                "- **Zabicie transakcji w Firebird:** `DELETE FROM mon$transactions WHERE mon$transaction_id = <trans_id>;`",
                "- **Zabicie połączenia:** `DELETE FROM mon$attachments WHERE mon$attachment_id = <attach_id>;`",
                "- **Ostrzeżenie OAT (Oldest Active Transaction):** Zbyt długa transakcja blokuje Garbage Collection w pliku FDB i powoduje gwałtowny rozrost bazy."
            ].join('\n')
        },
        {
            id: 'pg_safe_update',
            category: 'databases',
            badge: '🗄️ SQL / Zero-Risk',
            title: 'Bezpieczny UPDATE w transakcji z ROLLBACK',
            question: 'Jaki jest standardowy wzorzec bezpiecznego UPDATE w bazie produkcyjnej szpitala z domyślnym wycofaniem zmian?',
            offlineAnswer: [
                "```sql",
                "-- ⚠️ SZPITALNA PROCEDURA ZERO-RISK: Domyślnie wycofaj (ROLLBACK)",
                "BEGIN;",
                "",
                "-- 1. Podgląd stanu rekordów PRZED zmianą",
                "SELECT id, nr_zlecenia, status, modified_at ",
                "FROM zlecenia ",
                "WHERE nr_zlecenia = '2026/09/ORD1024';",
                "",
                "-- 2. Wykonanie modyfikacji",
                "UPDATE zlecenia ",
                "SET status = 'GOTOWE', ",
                "    modified_at = NOW(),",
                "    modified_by = 'support_hotfix'",
                "WHERE nr_zlecenia = '2026/09/ORD1024';",
                "",
                "-- 3. Weryfikacja stanu PO zmianie",
                "SELECT id, nr_zlecenia, status, modified_at, modified_by ",
                "FROM zlecenia ",
                "WHERE nr_zlecenia = '2026/09/ORD1024';",
                "",
                "-- 4. ⚠️ DOMYŚLNIE ROLLBACK! Dopiero po ręcznym sprawdzeniu SELECT zmień na COMMIT:",
                "ROLLBACK;",
                "```",
                "- **Nigdy nie wykonuj UPDATE bez transakcji:** W DBeaver/pgAdmin wyłącz autocommit (`Auto-Commit: OFF`).",
                "- **Kryterium liczby wierszy:** Zawsze weryfikuj komunikat `UPDATE N` – jeśli zmodyfikowano więcej niż oczekiwano, natychmiast wycofaj."
            ].join('\n')
        },

        // --- SYSTEMY MEDYCZNE ---
        {
            id: 'lis_astm_hl7',
            category: 'medical',
            badge: '🏥 LIS / ASTM vs HL7',
            title: 'Ramka ASTM 1394 vs HL7 v2 w LIS',
            question: 'Czym różni się ramka ASTM 1394 od HL7 v2 przy komunikacji z analizatorem laboratoryjnym i jak wygląda handshake ACK?',
            offlineAnswer: [
                "```text",
                "=== ASTM 1394 (Transmisja znakowa po RS232 lub TCP raw socket) ===",
                "Struktura ramki: <STX>[Nr_ramki][Treść rekordu: H/P/O/R/C/L]<CR><ETX>[SumaKontrolna: 2 znaki hex]<CR><LF>",
                "Handshake:",
                "  1. Nadawca wysyła: <ENQ> (0x05)",
                "  2. Odbiorca odpowiada: <ACK> (0x06) - gotowość do odbioru",
                "  3. Nadawca śle ramki danych: <STX>1H|\\^&...<CR><ETX>2A<CR><LF> -> Odbiorca odsyła <ACK>",
                "  4. Nadawca kończy transmisję: <EOT> (0x04)",
                "",
                "=== HL7 v2 (Transmisja MLLP - Minimal Lower Layer Protocol na porcie 2575) ===",
                "Koperta MLLP: <VT> (0x0B) [Treść komunikatu: MSH|... PID|... OBR|... OBX|...] <FS> (0x1C) <CR> (0x0D)",
                "Handshake aplikacyjny:",
                "  1. Analizator przesyła wynik: ORU^R01 (MSH-10 = \"MSG12345\")",
                "  2. Serwer LIS natychmiast odpowiada: ACK^R01 (MSA-1 = \"AA\", MSA-2 = \"MSG12345\")",
                "```",
                "- **Najczęstsza przyczyna zawieszenia bufora LIS:** Analizator oczekuje bajtu `<ACK>` (0x06) w ciągu 5-15 sekund. Jeśli serwer LIS nie odpowie na czas, bufor analizatora się blokuje.",
                "- **Kod ACK:** `AA` = Application Accept (OK), `AE` = Application Error, `AR` = Application Reject."
            ].join('\n')
        },
        {
            id: 'ekrew_isbt128',
            category: 'medical',
            badge: '🩸 eKrew / ISBT 128',
            title: 'Dekompozycja i walidacja kodu ISBT 128',
            question: 'Jaka jest struktura 25-znakowego kodu kreskowego ISBT 128 preparatu krwi w eKrew i jak go zwalidować wyrażeniem regularnym?',
            offlineAnswer: [
                "```text",
                "Struktura kodu ISBT 128 (Donation Identification Number - DIN):",
                "[=] [Kraj: 1 znak] [Ośrodek RCKiK: 4 znaki] [Rok: 2 znaki] [Nr donacji: 6 cyfr] [Znak kontrolny: 1 znak]",
                "Przykład: =W123424123456K",
                "",
                "Dekompozycja:",
                "- Znak 1: '=' (identyfikator ISBT 128)",
                "- Znaki 2-5: Kod placówki (np. W1234 = Regionalne Centrum Krwiodawstwa)",
                "- Znaki 6-7: Rok pobrania (np. 24 = 2024)",
                "- Znaki 8-13: Numer seryjny donacji w danym roku (6 cyfr)",
                "- Znak 14: Znak kontrolny modulo 37-2",
                "```",
                "```regex",
                "# Regex walidujący DIN (Donation Identification Number):",
                "^=[A-Z][0-9]{4}[0-9]{2}[0-9]{6}[0-9A-Z]$",
                "",
                "# Regex walidujący Product Code (np. =<E0123V00):",
                "^=<[A-Z0-9]{5}[0-9]{3}$",
                "```",
                "- **Zasada bezpieczeństwa:** Przed wydaniem koncentratu krwinek czerwonych (KKCz) system eKrew sprawdza zgodność grupy krwi i ważność próby krzyżowej. Nigdy nie forsuj statusu w bazie bez zgody lekarza serologa!"
            ].join('\n')
        },
        {
            id: 'patexpert_nfs_wsi',
            category: 'medical',
            badge: '🔬 PatExpert / WSI Storage',
            title: 'Optymalizacja NFS dla wielogigabajtowych skanów WSI',
            question: 'Jak skonfigurować montowanie macierzy NFS dla skanów histopatologicznych WSI (pliki 1-30 GB w PatExpert), aby uniknąć timeoutów i zerwanych transferów?',
            offlineAnswer: [
                "```bash",
                "# Rekomendowany wpis montowania macierzy WSI w /etc/fstab:",
                "192.168.10.50:/volume1/pacs_wsi  /mnt/pacs_storage  nfs  rw,hard,intr,nfsvers=4.1,rsize=1048576,wsize=1048576,timeo=600,retrans=3,noatime,nodiratime,_netdev  0  0",
                "",
                "# Zastosowanie montowania natychmiast:",
                "sudo mount -o remount /mnt/pacs_storage",
                "```",
                "- **rsize / wsize:** Ustawienie bufora na 1 MB (`1048576` bajtów) dramatycznie przyspiesza transfer wielkich plików SVS i NDPI w sieci 10GbE.",
                "- **hard zamiast soft:** W środowiskach medycznych ZAWSZE montuj z opcją `hard,intr`! Opcja `soft` przy chwilowym timeoutcie sieci zwraca błąd I/O do aplikacji, co może doprowadzić do uszkodzenia pliku badania.",
                "- **noatime:** Wyłącza zapisywanie czasu ostatniego dostępu przy odczycie kafelków obrazu, odciążając macierz dyskową."
            ].join('\n')
        },
        {
            id: 'genetics_vcf_valid',
            category: 'medical',
            badge: '🧬 Genetyka / VCF Header',
            title: 'Szybka walidacja nagłówka VCF przed pipeline',
            question: 'Jak w terminalu w kilka sekund sprawdzić czy plik VCF jest poprawny, ma kompletny nagłówek i pasuje do genomu referencyjnego GRCh38?',
            offlineAnswer: [
                "```bash",
                "# 1. Sprawdź format nagłówka i wersję genomu referencyjnego (pierwsze 40 linii):",
                "head -n 40 probka_wgs.vcf | grep -E '^##fileformat|^##reference|^##contig'",
                "",
                "# 2. Walidacja składniowa za pomocą bcftools (bez czytania całego pliku):",
                "bcftools view -h probka_wgs.vcf > /dev/null && echo \"✅ Nagłówek VCF poprawny\" || echo \"❌ Błąd nagłówka VCF\"",
                "",
                "# 3. Sprawdź czy chromosomy mają prefiks 'chr' (chr1 vs 1 - częsty powód wywrotki pipeline):",
                "grep -v '^#' probka_wgs.vcf | head -n 5 | awk '{print $1}'",
                "```",
                "- **Niezgodność contigów:** Jeśli pipeline bazuje na `GRCh38` (format z `chr1`, `chr2`), a plik VCF ma nazwy `1`, `2` (styl Ensembl), pipeline Snakemake/Nextflow wywali się po kilku godzinach.",
                "- **Brak indeksu:** Dla skompresowanych plików `.vcf.gz` zawsze wygeneruj indeks: `bcftools index -t probka.vcf.gz`."
            ].join('\n')
        }
    ];

    /**
     * Główny stan modułu w pamięci
     */
    let consultantState = {
        activeCategory: 'all', // 'all', 'programming', 'databases', 'medical'
        currentQuery: '',
        isLoading: false,
        history: [] // { id, question, answer, model, latencyMs, timestamp, category }
    };

    // Załaduj historię z localStorage jeśli istnieje
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const savedHistory = window.localStorage.getItem('healthtech_consultant_history');
            if (savedHistory) {
                consultantState.history = JSON.parse(savedHistory);
            }
        }
    } catch (e) {
        console.warn('[QuickConsultant] Błąd ładowania historii:', e);
    }

    function saveHistoryToStorage() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('healthtech_consultant_history', JSON.stringify(consultantState.history.slice(0, 30)));
            }
        } catch (e) {
            console.warn('[QuickConsultant] Błąd zapisu historii:', e);
        }
    }

    /**
     * Prosty i bezpieczny konwerter Markdown do HTML z kolorowaniem bloków kodu
     */
    function formatMarkdown(text) {
        if (!text) return '';

        let html = escapeHtml(text);

        // Bloki kodu ```jezyk ... ```
        html = html.replace(/```([a-zA-Z0-9_\-\+]*)\s*([\s\S]*?)```/g, function (match, lang, code) {
            const cleanLang = lang.trim() || 'code';
            const rawCode = code.trim();
            const copyId = 'code_block_' + Math.random().toString(36).substr(2, 9);

            return `
                <div class="code-container" style="position: relative; margin: 12px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1a24; padding: 4px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.75rem; color: #a1a1aa;">
                        <span>🏷️ ${escapeHtml(cleanLang.toUpperCase())}</span>
                        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="copyCodeSnippet('${copyId}')">📋 Kopiuj kod</button>
                    </div>
                    <pre style="margin: 0; border-top-left-radius: 0; border-top-right-radius: 0; background: #0f0f17; padding: 12px; overflow-x: auto;"><code id="${copyId}" class="lang-${escapeHtml(cleanLang)}">${rawCode}</code></pre>
                </div>
            `;
        });

        // Inline code `kod`
        html = html.replace(/`([^`\n]+)`/g, '<code style="background: rgba(255,255,255,0.08); color: var(--accent-cyan); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.88em;">$1</code>');

        // Nagłówki ###
        html = html.replace(/^### (.*$)/gim, '<h4 style="color: var(--accent-cyan); margin: 14px 0 6px 0; font-size: 0.98rem;">$1</h4>');
        html = html.replace(/^## (.*$)/gim, '<h3 style="color: var(--accent-teal); margin: 16px 0 8px 0; font-size: 1.05rem;">$1</h3>');

        // Pogrubienie **tekst**
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Listy punktowane - punkt
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<div style="display: flex; gap: 8px; margin: 4px 0;"><span style="color: var(--accent-teal);">•</span><span>$1</span></div>');

        // Numerowane listy 1. punkt
        html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<div style="display: flex; gap: 8px; margin: 4px 0;"><strong style="color: var(--accent-cyan); min-width: 18px;">$1.</strong><span>$2</span></div>');

        // Nowe linie na <br> (z wyjątkiem wnętrza bloków kodu)
        html = html.replace(/\n\n/g, '<div style="height: 8px;"></div>');

        return html;
    }

    /**
     * Kopiowanie fragmentu kodu do schowka
     */
    window.copyCodeSnippet = function (elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const text = el.textContent || el.innerText;
        if (navigator && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Skopiowano kod do schowka! 📋', 'success');
            }).catch(err => {
                console.error('Błąd kopiowania:', err);
                showToast('Nie udało się skopiować kodu', 'error');
            });
        }
    };

    /**
     * Główna funkcja renderująca Moduł Szybkiego Konsultanta IT
     */
    function renderQuickConsultantModule() {
        const container = document.getElementById('quick-consultant-container');
        if (!container) return;

        const currentModel = (window.geminiService && window.geminiService.getModel()) || 'gemini-3.5-flash';
        const hasKey = !!(window.geminiService && window.geminiService.hasApiKey());

        container.innerHTML = `
            <!-- Górny pasek statusu, selektora modeli i konfiguracji API -->
            <div class="card" style="margin-bottom: 20px; padding: 14px 18px; border-left: 4px solid var(--accent-cyan);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">⚡</span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                                    Błyskawiczny Konsultant IT (Dev & Med)
                                    <span class="badge" style="background: rgba(6, 214, 160, 0.15); color: #06d6a0; font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
                                        Tryb Express: Zero lania wody
                                    </span>
                                </h3>
                                <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
                                    Błyskawiczne odpowiedzi techniczne: Programowanie, Bazy Danych i Systemy Medyczne. Gotowy kod i komendy od pierwszego zdania.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <!-- Selektor Modelu Gemini -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label for="consultant-gemini-model-select" style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
                                Model:
                            </label>
                            <select id="consultant-gemini-model-select" class="doc-input" style="padding: 4px 10px; font-size: 0.8rem; min-width: 220px;" onchange="onGeminiModelChange(this.value)">
                                ${GEMINI_MODELS.map(m => `
                                    <option value="${m.value}" ${m.value === currentModel ? 'selected' : ''}>
                                        ${m.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Przycisk Statusu API i Rozwijania Konfiguracji -->
                        <button id="consultant-gemini-status-btn" class="btn btn-secondary btn-sm" onclick="toggleConsultantGeminiConfigUI()" style="font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                            ${hasKey ? '🟢 Gemini API Aktywne' : '⚙️ Skonfiguruj Klucz API'}
                        </button>
                    </div>
                </div>

                <!-- Rozwijany panel konfiguracji klucza API -->
                <div id="consultant-gemini-config-section" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color);">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end;">
                        <div>
                            <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 4px;">
                                Klucz Google Gemini API (przechowywany lokalnie w przeglądarce):
                            </label>
                            <input type="password" id="consultant-api-key-input" class="doc-input" style="font-family: var(--font-mono); font-size: 0.82rem;" placeholder="Wklej klucz (AIzaSy...)" value="${escapeHtml((window.geminiService && window.geminiService.getApiKey()) || '')}" />
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-primary btn-sm" onclick="saveConsultantApiKeyUI()">💾 Zapisz</button>
                            <button class="btn btn-secondary btn-sm" onclick="testConsultantConnectionUI()">⚡ Test (Ping)</button>
                            <button class="btn btn-secondary btn-sm" onclick="toggleConsultantGeminiConfigUI()">✕ Zamknij</button>
                        </div>
                    </div>
                    <div id="consultant-test-result" style="margin-top: 8px; font-size: 0.8rem;"></div>
                </div>
            </div>

            <!-- Panel Zapytania i Presety -->
            <div class="card" style="margin-bottom: 20px; padding: 18px;">
                <!-- Filtry kategorii presetów -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                        Szybkie Szablony Pytań (Kliknij, aby wstawić):
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-sm ${consultantState.activeCategory === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="filterConsultantCategory('all')">🌐 Wszystko</button>
                        <button class="btn btn-sm ${consultantState.activeCategory === 'programming' ? 'btn-primary' : 'btn-secondary'}" onclick="filterConsultantCategory('programming')">💻 Programowanie</button>
                        <button class="btn btn-sm ${consultantState.activeCategory === 'databases' ? 'btn-primary' : 'btn-secondary'}" onclick="filterConsultantCategory('databases')">🗄️ Bazy Danych</button>
                        <button class="btn btn-sm ${consultantState.activeCategory === 'medical' ? 'btn-primary' : 'btn-secondary'}" onclick="filterConsultantCategory('medical')">🏥 Systemy Medyczne</button>
                    </div>
                </div>

                <!-- Chipy presetów -->
                <div id="consultant-presets-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px;">
                    ${renderPresetsChips(consultantState.activeCategory)}
                </div>

                <!-- Pole tekstowe wprowadzania pytania -->
                <div style="position: relative;">
                    <textarea id="consultant-prompt-input" rows="3" class="doc-input" style="width: 100%; font-size: 0.92rem; padding: 12px 14px; font-family: inherit; line-height: 1.45; resize: vertical;" placeholder="Wpisz dowolne pytanie techniczne (np. 'Jak w Pythonie połączyć się z Firebird przez fdb?', 'PostgreSQL: zapytanie na wiszące blokady', 'Regex dla kodu ISBT 128', 'Delphi: jak uniknąć EAccessViolation')... Wciśnij Enter aby wysłać"></textarea>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="consultant-submit-btn" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px; font-weight: 600;" onclick="askQuickConsultantUI()">
                            <span>⚡ Odpowiedz Błyskawicznie</span>
                            <span style="font-size: 0.75rem; opacity: 0.8; font-weight: normal;">(Enter)</span>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="clearConsultantInput()">🧹 Wyczyść</button>
                    </div>

                    <div id="consultant-latency-badge" style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                        <span>💡 Skrót: <strong>Enter</strong> wysyła, <strong>Shift+Enter</strong> nowa linia</span>
                    </div>
                </div>
            </div>

            <!-- Kontener Najnowszej Odpowiedzi -->
            <div id="consultant-active-response-container">
                ${renderActiveResponse()}
            </div>

            <!-- Kontener Historii Zapytań Sesji -->
            <div id="consultant-history-container" style="margin-top: 24px;">
                ${renderHistorySection()}
            </div>
        `;

        // Obsługa skrótu Enter w textarea
        const textarea = document.getElementById('consultant-prompt-input');
        if (textarea) {
            textarea.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    askQuickConsultantUI();
                }
            });
        }
    }

    /**
     * Renderowanie chipów presetów z podziałem na kategorie
     */
    function renderPresetsChips(category) {
        const filtered = category === 'all'
            ? CONSULTANT_PRESETS
            : CONSULTANT_PRESETS.filter(p => p.category === category);

        return filtered.map(p => `
            <button class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 10px; border-radius: 16px; text-align: left;" onclick="selectConsultantPreset('${p.id}')">
                <span style="opacity: 0.85;">${escapeHtml(p.badge)}:</span> 
                <strong>${escapeHtml(p.title)}</strong>
            </button>
        `).join('');
    }

    /**
     * Filtrowanie presetów po kliknięciu zakładki
     */
    window.filterConsultantCategory = function (category) {
        consultantState.activeCategory = category;
        const grid = document.getElementById('consultant-presets-grid');
        if (grid) {
            grid.innerHTML = renderPresetsChips(category);
        }
        renderQuickConsultantModule();
    };

    /**
     * Kliknięcie presetu — wstawia treść do inputa i od razu wysyła
     */
    window.selectConsultantPreset = function (presetId) {
        const preset = CONSULTANT_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        const input = document.getElementById('consultant-prompt-input');
        if (input) {
            input.value = preset.question;
            input.focus();
        }

        // Natychmiastowe uruchomienie
        askQuickConsultantUI(preset.question, preset);
    };

    /**
     * Czyszczenie pola input
     */
    window.clearConsultantInput = function () {
        const input = document.getElementById('consultant-prompt-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    };

    /**
     * Wysłanie zapytania do Konsultanta (AI z fallbackiem offline)
     */
    window.askQuickConsultantUI = async function (customText = null, matchedPreset = null) {
        const input = document.getElementById('consultant-prompt-input');
        const questionText = (customText !== null ? customText : (input ? input.value : '')).trim();

        if (!questionText) {
            showToast('Wpisz pytanie przed wysłaniem!', 'warning');
            if (input) input.focus();
            return;
        }

        const submitBtn = document.getElementById('consultant-submit-btn');
        const activeContainer = document.getElementById('consultant-active-response-container');
        const latencyBadge = document.getElementById('consultant-latency-badge');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳ Konsultuję w locie...</span>`;
        }

        if (activeContainer) {
            activeContainer.innerHTML = `
                <div class="card" style="border: 2px dashed var(--accent-cyan); padding: 26px; text-align: center; background: rgba(0, 245, 212, 0.03);">
                    <div style="font-size: 2rem; margin-bottom: 10px;">⚡</div>
                    <h4 style="color: var(--accent-cyan); margin: 0 0 6px 0;">Błyskawiczna analiza zapytania...</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
                        Generowanie zwięzłej, bezpośredniej odpowiedzi bez zbędnego lania wody.
                    </p>
                </div>
            `;
        }

        const startTime = Date.now();
        let answerText = "";
        let usedModel = "Baza Wiedzy (Offline)";
        let isAi = false;

        try {
            // Sprawdź czy jest klucz API i serwis Gemini
            if (window.geminiService && window.geminiService.hasApiKey()) {
                const result = await window.geminiService.askQuickConsultant(questionText, {
                    contextDomain: consultantState.activeCategory
                });
                answerText = result.text;
                usedModel = result.model;
                isAi = true;
            } else {
                // Tryb Offline Fallback
                let found = matchedPreset;
                if (!found) {
                    const lower = questionText.toLowerCase();
                    found = CONSULTANT_PRESETS.find(p => 
                        lower.includes(p.id) || 
                        lower.includes(p.title.toLowerCase()) || 
                        p.question.toLowerCase().split(' ').some(w => w.length > 4 && lower.includes(w))
                    );
                }

                if (found) {
                    answerText = found.offlineAnswer;
                    usedModel = 'Baza Wiedzy Offline (KB)';
                } else {
                    answerText = [
                        "### 💡 Brak Klucza Gemini API dla Zapytania Indywidualnego",
                        "Aby zadawać dowolne pytania w języku naturalnym i otrzymywać odpowiedzi w ułamku sekundy, skonfiguruj bezpłatny klucz **Google Gemini API** u góry ekranu.",
                        "",
                        "**Możesz również wybrać jeden z gotowych szablonów diagnostycznych:**",
                        "- 💻 **Python / Firebird:** Połączenie przez bibliotekę fdb i odczyt kursorem",
                        "- 💻 **Java / HL7:** Ekstrakcja PESEL z segmentu PID-3 / PID-19",
                        "- 💻 **Delphi:** Zabezpieczenie przed EAccessViolation (Assigned, FreeAndNil)",
                        "- 🗄️ **PostgreSQL:** Wykrywanie blokujących transakcji w pg_locks",
                        "- 🗄️ **Oracle:** Rozwiązanie błędu ORA-00054 (resource busy)",
                        "- 🏥 **LIS / ASTM:** Porównanie protokołu ASTM 1394 z HL7 v2",
                        "- 🏥 **eKrew:** Dekompozycja i walidacja 25-znakowego kodu ISBT 128"
                    ].join('\n');
                }
            }
        } catch (err) {
            console.error('[QuickConsultant] Błąd zapytania:', err);
            answerText = [
                "### ⚠️ Wystąpił błąd podczas konsultacji",
                escapeHtml(err.message || String(err)),
                "",
                "**Wskazówka:** Sprawdź poprawność klucza API w panelu konfiguracji lub wybierz inny model (np. `gemini-3.5-flash` lub `gemini-2.5-flash`)."
            ].join('\n');
            usedModel = 'Błąd Połączenia';
        }

        const elapsedMs = Date.now() - startTime;
        const latencySec = (elapsedMs / 1000).toFixed(2);

        // Zapisz do historii
        const record = {
            id: 'qa_' + Date.now(),
            question: questionText,
            answer: answerText,
            model: usedModel,
            latencyMs: elapsedMs,
            timestamp: new Date().toLocaleTimeString(),
            isAi: isAi
        };

        consultantState.history.unshift(record);
        saveHistoryToStorage();

        // Renderuj wynik
        if (activeContainer) {
            activeContainer.innerHTML = renderResponseCard(record, true);
        }

        const histContainer = document.getElementById('consultant-history-container');
        if (histContainer) {
            histContainer.innerHTML = renderHistorySection();
        }

        if (latencyBadge) {
            latencyBadge.innerHTML = `⏱️ Czas odpowiedzi: <strong>${latencySec}s</strong> (${escapeHtml(usedModel)})`;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>⚡ Odpowiedz Błyskawicznie</span><span style="font-size: 0.75rem; opacity: 0.8; font-weight: normal;">(Enter)</span>`;
        }
    };

    /**
     * Renderowanie aktywnej odpowiedzi
     */
    function renderActiveResponse() {
        if (!consultantState.history || consultantState.history.length === 0) {
            return `
                <div class="card" style="border: 1px dashed var(--border-color); padding: 28px; text-align: center; background: rgba(255,255,255,0.01);">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">⚡</div>
                    <h4 style="margin: 0 0 6px 0; color: var(--text-primary);">Konsultant IT czeka na Twoje pytanie</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 600px; margin: 0 auto;">
                        Zadaj pytanie dotyczące kodu, bazy danych lub systemów medycznych, albo kliknij jeden z powyższych szablonów. 
                        Odpowiedź pojawi się natychmiast, bez zbędnych wstępów.
                    </p>
                </div>
            `;
        }

        return renderResponseCard(consultantState.history[0], true);
    }

    /**
     * Renderowanie pojedynczej karty odpowiedzi
     */
    function renderResponseCard(record, isActive = false) {
        const borderStyle = isActive ? 'border: 2px solid var(--accent-cyan);' : 'border: 1px solid var(--border-color);';
        const latencySec = (record.latencyMs / 1000).toFixed(2);

        return `
            <div class="card" style="${borderStyle} padding: 20px; border-radius: var(--radius-md); margin-bottom: 16px; background: var(--bg-card);">
                <!-- Nagłówek karty z pytaniem i metadanymi -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 1.1rem;">❓</span>
                            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">
                                ${escapeHtml(record.question)}
                            </h4>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; font-size: 0.76rem; color: var(--text-muted);">
                            <span>⏱️ ${latencySec}s</span>
                            <span>•</span>
                            <span>🤖 ${escapeHtml(record.model)}</span>
                            <span>•</span>
                            <span>🕒 ${escapeHtml(record.timestamp)}</span>
                        </div>
                    </div>

                    <!-- Przyciski akcji 1-click -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="copyFullResponse('${record.id}')" title="Kopiuj treść odpowiedzi">
                            📋 Kopiuj
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="saveToQuickNotes('${record.id}')" title="Zapisz do Twoich Szybkich Notatek">
                            📝 Szybkie Notatki
                        </button>
                        <button class="btn btn-secondary btn-sm" style="color: var(--accent-teal);" onclick="saveToRunbooks('${record.id}')" title="Zapisz jako procedurę w Bazie Runbooków">
                            📖 Do Runbooka
                        </button>
                    </div>
                </div>

                <!-- Ciało odpowiedzi z formatowaniem kodu -->
                <div id="response-content-${record.id}" style="font-size: 0.92rem; line-height: 1.5; color: var(--text-secondary);">
                    ${formatMarkdown(record.answer)}
                </div>
            </div>
        `;
    }

    /**
     * Renderowanie sekcji historii sesji
     */
    function renderHistorySection() {
        if (!consultantState.history || consultantState.history.length <= 1) {
            return '';
        }

        const pastRecords = consultantState.history.slice(1);

        return `
            <div class="card" style="padding: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                        <span>📚 Poprzednie Zapytania w Tej Sesji (${pastRecords.length})</span>
                    </h4>
                    <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose); font-size: 0.75rem;" onclick="clearConsultantHistory()">
                        🗑️ Wyczyść Historię
                    </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${pastRecords.map(r => renderResponseCard(r, false)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Kopiowanie pełnej treści odpowiedzi
     */
    window.copyFullResponse = function (recordId) {
        const record = consultantState.history.find(r => r.id === recordId);
        if (!record) return;

        if (navigator && navigator.clipboard) {
            navigator.clipboard.writeText(record.answer).then(() => {
                showToast('Skopiowano całą odpowiedź do schowka! 📋', 'success');
            }).catch(err => {
                console.error('Błąd kopiowania:', err);
                showToast('Nie udało się skopiować odpowiedzi', 'error');
            });
        }
    };

    /**
     * Zapis odpowiedzi do Szybkich Notatek (Quick Notes)
     */
    window.saveToQuickNotes = function (recordId) {
        let record = recordId ? consultantState.history.find(r => r.id === recordId) : null;
        if (!record && consultantState.history.length > 0) {
            record = consultantState.history[0];
        }
        if (!record) return;

        const noteSnippet = "\n\n[Konsultant IT - " + record.timestamp + "]\nPytanie: " + record.question + "\nOdpowiedź:\n" + record.answer + "\n-------------------";

        if (window.appState && window.appState.data && window.appState.data.notes) {
            window.appState.data.notes.quickNote = (window.appState.data.notes.quickNote || '') + noteSnippet;
            window.appState.saveState();

            const notesEl = document.getElementById('quick-notes-textarea');
            if (notesEl) {
                notesEl.value = window.appState.data.notes.quickNote;
            }

            showToast('Zapisano w Szybkich Notatkach! 📝', 'success');
        } else {
            showToast('Błąd zapisu w stanie aplikacji', 'error');
        }
    };

    /**
     * Zapis odpowiedzi jako gotowy wpis w Bazie Runbooków
     */
    window.saveToRunbooks = function (recordId) {
        let record = recordId ? consultantState.history.find(r => r.id === recordId) : null;
        if (!record && consultantState.history.length > 0) {
            record = consultantState.history[0];
        }
        if (!record) return;

        if (window.appState && typeof window.appState.saveIncidentRunbook === 'function') {
            const runbookRecord = {
                id: 'RUNBOOK-QC-' + Date.now(),
                title: 'Konsultacja IT: ' + record.question.substring(0, 60),
                severity: 'L1_INFO',
                tags: ['KONSULTANT_IT', 'SRE_QUICK_COPILOT', consultantState.activeCategory.toUpperCase()],
                category: 'KONSULTACJA_IT',
                system: 'Ogólne IT / Bazy Danych',
                createdAt: new Date().toISOString(),
                diagnosis: 'Odpowiedź Błyskawicznego Konsultanta IT (' + record.model + ')',
                solutionSteps: [
                    'Zapytanie: ' + record.question,
                    'Rozwiązanie: ' + record.answer.substring(0, 300) + '...'
                ],
                commands: [],
                notes: record.answer
            };

            window.appState.saveIncidentRunbook(runbookRecord);
            showToast('Dodano procedurę do Bazy Runbooków! 📖', 'success');
        } else {
            showToast('Baza Runbooków jest niedostępna', 'error');
        }
    };

    /**
     * Czyszczenie historii sesji
     */
    window.clearConsultantHistory = function () {
        if (confirm('Czy na pewno chcesz wyczyścić historię zapytań Konsultanta IT?')) {
            consultantState.history = [];
            saveHistoryToStorage();
            renderQuickConsultantModule();
            showToast('Wyczyszczono historię sesji 🧹', 'info');
        }
    };

    /**
     * Przełączanie rozwijanego panelu konfiguracji API
     */
    window.toggleConsultantGeminiConfigUI = function () {
        const panel = document.getElementById('consultant-gemini-config-section');
        if (!panel) return;
        panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    };

    /**
     * Zapis klucza API z formularza Konsultanta
     */
    window.saveConsultantApiKeyUI = function () {
        const input = document.getElementById('consultant-api-key-input');
        if (!input || !window.geminiService) return;

        const key = input.value.trim();
        if (!key) {
            showToast('Wpisz klucz API przed zapisem!', 'warning');
            return;
        }

        window.geminiService.setApiKey(key);
        updateConsultantGeminiStatusUI();
        if (typeof window.updateGeminiStatusUI === 'function') {
            window.updateGeminiStatusUI();
        }
        showToast('Klucz Gemini API został zapisany pomyślnie! 💾', 'success');
        toggleConsultantGeminiConfigUI();
    };

    /**
     * Test połączenia z Google Gemini API
     */
    window.testConsultantConnectionUI = async function () {
        const resultDiv = document.getElementById('consultant-test-result');
        if (!resultDiv || !window.geminiService) return;

        const activeModel = window.geminiService.getModel();
        resultDiv.innerHTML = `<span style="color: var(--accent-cyan);">⏳ Testowanie połączenia z modelem ${escapeHtml(activeModel)}...</span>`;

        try {
            const reply = await window.geminiService.testConnection();
            if (reply) {
                resultDiv.innerHTML = `<span style="color: var(--accent-teal);">✅ Połączenie aktywne z modelem ${escapeHtml(activeModel)}! Odpowiedź: "${escapeHtml(reply.trim())}"</span>`;
                updateConsultantGeminiStatusUI();
                if (typeof showToast === 'function') {
                    showToast(`Połączenie z ${activeModel} aktywne! ⚡`, 'success');
                }
            } else {
                resultDiv.innerHTML = `<span style="color: var(--accent-rose);">❌ Błąd testu połączenia.</span>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<span style="color: var(--accent-rose);">❌ Błąd: ${escapeHtml(e.message)}</span>`;
        }
    };

    /**
     * Aktualizacja statusu przycisku API w nagłówku
     */
    function updateConsultantGeminiStatusUI() {
        const btn = document.getElementById('consultant-gemini-status-btn');
        if (!btn || !window.geminiService) return;

        const hasKey = window.geminiService.hasApiKey();
        if (hasKey) {
            btn.innerHTML = `🟢 Gemini API Aktywne`;
            btn.style.color = '#06d6a0';
            btn.style.borderColor = 'rgba(6, 214, 160, 0.4)';
        } else {
            btn.innerHTML = `⚙️ Skonfiguruj Klucz API`;
            btn.style.color = 'var(--accent-amber)';
            btn.style.borderColor = 'rgba(255, 183, 3, 0.3)';
        }

        // Zsynchronizuj selektor modelu
        const modelSelect = document.getElementById('consultant-gemini-model-select');
        if (modelSelect) {
            modelSelect.value = window.geminiService.getModel();
        }
    }

    // Eksport globalny
    if (typeof window !== 'undefined') {
        window.renderQuickConsultantModule = renderQuickConsultantModule;
        window.updateConsultantGeminiStatusUI = updateConsultantGeminiStatusUI;
        window.CONSULTANT_PRESETS = CONSULTANT_PRESETS;
    }
})();
