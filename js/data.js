/**
 * HealthTech Onboarding Hub - Główna Baza Wiedzy i Treści (data.js)
 * Sektor: HIS / LIS / RIS / PACS, HL7 v2, FHIR, Firebird -> PostgreSQL
 */

const HEALTHTECH_DATA = {
  // Domyślne oceny umiejętności (skala 1-5)
  defaultSkills: {
    java: 3,
    python: 3,
    delphi: 2,
    linux: 3,
    sql: 3,
    hl7_fhir: 2
  },

  // Definicje umiejętności wraz z kryteriami poziomów
  skillsMetadata: {
    java: {
      name: "Java",
      category: "Backend & Integracje",
      description: "Wykorzystywana w silnikach integracyjnych (Mirth Connect, Apache Camel) oraz serwerach FHIR (HAPI FHIR).",
      levels: {
        1: "Podstawy składni i OOP, brak doświadczenia w systemach produkcyjnych.",
        2: "Tworzenie prostych aplikacji konsolowych/REST, podstawy Maven/Gradle.",
        3: "Praca z Spring Boot, JDBC/JPA, obsługa wyjątków, REST API, wielowątkowość podstawowa.",
        4: "Architektura mikroserwisów, zaawansowane strumienie, HAPI FHIR / HAPI HL7, optymalizacja JVM.",
        5: "Ekspert: tworzenie wysokowydajnych brokerów MLLP, głębokie profilowanie pamięci i GC."
      }
    },
    python: {
      name: "Python",
      category: "Skrypty, ETL & Integracje",
      description: "Narzędzie pierwszego wyboru do szybkiej migracji danych, parsowania HL7, skryptów automatyzacji i testów integracyjnych.",
      levels: {
        1: "Podstawy składni, pętli i struktur danych.",
        2: "Pisanie prostych skryptów plikowych, obsługa bibliotek requests, json, podstawy csv.",
        3: "Średniozaawansowany: skrypty migracji bazodanowych (psycopg2, fdb), parsowanie HL7 (hl7apy/hl7), FastAPI/Flask.",
        4: "Asynchroniczne przetwarzanie (asyncio), budowa micro-usług medycznych, zaawansowany data wrangling.",
        5: "Ekspert: budowa kompletnych potoków ETL w standardzie FHIR, transformacje strumieniowe, cyberbezpieczeństwo medyczne."
      }
    },
    delphi: {
      name: "Delphi / Object Pascal",
      category: "Systemy Legacy & Desktop",
      description: "Kluczowa technologia w historycznych (i nadal aktywnych) systemach HIS w polskich i europejskich szpitalach.",
      levels: {
        1: "Początkujący: brak wiedzy lub kojarzenie składni Pascala.",
        2: "Czytelnik kodu: umiejętność otwarcia projektu w Delphi/Lazarus, zlokalizowania DataModule, zapytań SQL i logiki biznesowej.",
        3: "Utrzymaniowiec: modyfikacja istniejących formularzy, naprawianie drobnych błędów, kompilacja modułów DLL/EXE.",
        4: "Programista: tworzenie nowych modułów, integracja z zewnętrznymi bibliotekami C/COM, optymalizacja VCL.",
        5: "Ekspert: głęboka refaktoryzacja monolitu szpitalnego, dekompozycja do REST/mikroserwisów."
      }
    },
    linux: {
      name: "Linux",
      category: "Infrastruktura & Serwery",
      description: "Środowisko serwerowe dla baz danych (PostgreSQL), brokerów integracyjnych, archiwów PACS (Orthanc/dcm4chee) i kontenerów Docker.",
      levels: {
        1: "Podstawowe komendy: cd, ls, cat, pwd.",
        2: "Zarządzanie plikami, uprawnienia (chmod, chown), proste procesy (ps, kill), edytor nano.",
        3: "Średniozaawansowany: pisanie skryptów bash, diagnostyka sieci (nc, curl, tcpdump, ss/netstat), systemd, Docker podstawy.",
        4: "Zaawansowany: diagnostyka wydajności (htop, iostat, vmstat), orkiestracja kontenerów, zabezpieczenia firewall (iptables/ufw), logi szpitalne.",
        5: "DevOps/Sysadmin: hardening środowisk medycznych, high availability, klastry bazodanowe, audyt zgodności z normami bezpieczeństwa."
      }
    },
    sql: {
      name: "SQL (MySQL / PostgreSQL / Firebird)",
      category: "Bazy Danych Medycznych",
      description: "Fundament przechowywania historii pacjenta, zleceń i wyników. Kluczowa znajomość różnic dialektów Firebird vs PostgreSQL.",
      levels: {
        1: "Podstawowe SELECT, INSERT, UPDATE, DELETE, proste WHERE.",
        2: "Złączenia JOIN, agregacje GROUP BY, podstawowe klucze obce i indeksy.",
        3: "Średniozaawansowany: złożone podzapytania, transakcje (ACID), widoki, triggery, generatory/sekwencje, analiza planów EXPLAIN.",
        4: "Optymalizacja wolnych zapytań na milionach rekordów pacjentów, procedury składowane (PL/pgSQL), indeksy cząstkowe i GIN/JSONB.",
        5: "Ekspert bazodanowy: projektowanie hurtowni danych medycznych, replikacja logiczna/fizyczna, bezprzerwowe migracje petabajtów danych."
      }
    },
    hl7_fhir: {
      name: "HL7 v2 & FHIR",
      category: "Standardy Medyczne & Interoperacyjność",
      description: "Krwioobieg komunikacji w szpitalu: HL7 v2 (rurowy protokół MLLP) oraz FHIR (nowoczesne REST API w JSON).",
      levels: {
        1: "Wiem, że to standardy medyczne, ale nie potrafię przeczytać komunikatu.",
        2: "Rozpoznaję segmenty (MSH, PID, PV1, OBX), rozumiem zasadę MLLP, potrafię odczytać JSON w formacie FHIR.",
        3: "Średniozaawansowany: pisanie reguł transformacji w Mirth Connect, obsługa komunikatów ADT, ORM, ORU, generowanie ACK/NACK.",
        4: "Projektowanie integracji HIS ↔ LIS ↔ RIS ↔ PACS, obsługa Z-segmentów, tworzenie profili FHIR (StructureDefinition).",
        5: "Ekspert interoperacyjności: certyfikacja HL7, implementacja pełnych architektur IHE (PIX/PDQ, XDS.b), krajowe węzły P1/e-Zdrowie."
      }
    }
  },

  // 7-Dniowy Plan Przygotowawczy dostosowany do profilu
  studyPlan: [
    {
      day: 1,
      title: "Anatomia Ekosystemu Szpitalnego & Podstawy HL7 v2",
      estimatedHours: "2.5h",
      priority: "Krytyczny (Dzień 1)",
      category: "hl7_fhir",
      tag: "Fundamenty HealthTech",
      summary: "Zrozumienie ról systemów HIS, LIS, RIS i PACS oraz anatomii komunikatu HL7 v2.x (separatory, segmenty).",
      tasks: [
        {
          id: "sp_1_1",
          text: "Przeanalizuj obieg pacjenta w szpitalu: Rejestracja w HIS -> Zlecenie badania do RIS/LIS -> Wykonanie na aparacie -> Wynik/Obraz do PACS -> Opis z powrotem do HIS.",
          completed: false
        },
        {
          id: "sp_1_2",
          text: "Opanuj anatomię ramki HL7 v2: separatory |, ^, ~, \\, & oraz kluczowe segmenty MSH (nagłówek), PID (dane pacjenta), PV1 (wizyta/pobyt).",
          completed: false
        },
        {
          id: "sp_1_3",
          text: "Ćwiczenie praktyczne: Otwórz wbudowany Inspektor HL7 w aplikacji, wklej przykładowy komunikat ADT^A01 i zidentyfikuj numer PESEL, nazwisko i oddział szpitalny.",
          completed: false
        }
      ],
      resources: [
        { name: "HL7 v2.x Standards Quick Reference", url: "https://hl7.org", note: "Oficjalny konspekt struktur" },
        { name: "Przewodnik Caristix HL7 Web", url: "https://hl7-definition.caristix.com", note: "Świetny interaktywny słownik segmentów i pól" }
      ]
    },
    {
      day: 2,
      title: "Komunikacja w Praktyce: MLLP, Zlecenia (ORM) i Wyniki (ORU)",
      estimatedHours: "3h",
      priority: "Krytyczny (Dzień 1-2)",
      category: "hl7_fhir",
      tag: "Integracje Sieciowe",
      summary: "Protokół MLLP na warstwie TCP, transakcje ACK/NACK, zlecenia badań i przesyłanie wyników laboratoryjnych/opisowych.",
      tasks: [
        {
          id: "sp_2_1",
          text: "Zrozum protokół MLLP: bajty startowe (0x0B - VT) i końcowe (0x1C 0x0D - FS CR) owijające czysty tekst komunikatu.",
          completed: false
        },
        {
          id: "sp_2_2",
          text: "Zbadaj strukturę zlecenia badań ORM^O01 / OML^O21 oraz odpowiedzi z wynikami ORU^R01 (segmenty OBR - zlecenie i OBX - obserwacja/wartość).",
          completed: false
        },
        {
          id: "sp_2_3",
          text: "Ćwiczenie: Przygotuj w notatniku odpowiedź potwierdzającą ACK dla komunikatu ORM z poprawnym kodem MSA-1=AA (Application Accept).",
          completed: false
        }
      ],
      resources: [
        { name: "MLLP Protocol Specification", url: "#", note: "Opis ramek TCP i obsługi timeoutów" },
        { name: "HAPI HL7 v2 Java Library docs", url: "https://hapifhir.github.io/hapi-hl7v2/", note: "Standard de facto w świecie Java" }
      ]
    },
    {
      day: 3,
      title: "Przełamywanie Bariery Delphi w Systemach HIS",
      estimatedHours: "2.5h",
      priority: "Wysoki",
      category: "delphi",
      tag: "Legacy Code Reading",
      summary: "Jak czytać i rozumieć kod w Delphi bez bycia deweloperem Delphi: struktura pas/dfm, DataModule, komponenty bazodanowe i SQL.",
      tasks: [
        {
          id: "sp_3_1",
          text: "Poznaj strukturę projektu Delphi: pliki .dpr (projekt), .pas (kod jednostki unit), .dfm (deklaracja formularza/komponentów UI i baz danych).",
          completed: false
        },
        {
          id: "sp_3_2",
          text: "Zrozum gdzie ukryty jest SQL: obiekty TQuery, TIBQuery, TFDQuery (FireDAC) – właściwość .SQL.Text oraz parametry .ParamByName().",
          completed: false
        },
        {
          id: "sp_3_3",
          text: "Ćwiczenie: Przejrzyj przykładowy fragment modułu DataModule z cheat-sheetu i zidentyfikuj logikę zapisu pacjenta oraz pobieranie generatora ID.",
          completed: false
        }
      ],
      resources: [
        { name: "Delphi Basics & Object Pascal Guide", url: "https://www.delphibasics.co.uk", note: "Szybka ściągawka składni dla programistów C++/Java/Python" },
        { name: "Lazarus / Free Pascal Wiki", url: "https://wiki.lazarus.freepascal.org", note: "Darmowe środowisko do otwierania i podglądu kodu Pascala" }
      ]
    },
    {
      day: 4,
      title: "Baza Danych Firebird w Pigułce & Strategia Migracji",
      estimatedHours: "3h",
      priority: "Wysoki",
      category: "sql",
      tag: "Baza Danych & SQL",
      summary: "Specyfika silnika Firebird 2.5/3.0: dialekt 3, generatory, transakcje Snapshot vs Read Committed, narzędzia gfix i gbak.",
      tasks: [
        {
          id: "sp_4_1",
          text: "Poznaj kluczowe pojęcia Firebird: baza w jednym pliku .fdb, brak natywnego typu BOOLEAN w wersji 2.5 (emulacja SMALLINT 0/1), mechanizm generatorów GEN_ID().",
          completed: false
        },
        {
          id: "sp_4_2",
          text: "Zrozum model transakcyjny Firebirda: zjawisko OIT/OAT (Oldest Interesting/Active Transaction) i problem blokad 'sweep' powodujących zacięcia HIS.",
          completed: false
        },
        {
          id: "sp_4_3",
          text: "Narzędzia konsolowe: gbak (backup/restore), isql (interaktywny klient) oraz gfix (weryfikacja integralności uszkodzonych baz).",
          completed: false
        }
      ],
      resources: [
        { name: "Firebird 2.5 / 3.0 Documentation", url: "https://firebirdsql.org/en/documentation/", note: "Oficjalna dokumentacja silnika" },
        { name: "FlameRobin GUI Client", url: "http://www.flamerobin.org", note: "Lekki klient GUI do podglądu schematu Firebird" }
      ]
    },
    {
      day: 5,
      title: "PostgreSQL w MedTech: Mapowanie Typów, Sekwencje i ETL",
      estimatedHours: "3h",
      priority: "Krytyczny (Migracje)",
      category: "sql",
      tag: "PostgreSQL & ETL",
      summary: "Bezpieczna migracja z Firebirda do PostgreSQL: konwersja typów, obsługa kodowań (WIN1250 -> UTF-8) i skrypty Python ETL.",
      tasks: [
        {
          id: "sp_5_1",
          text: "Przestudiuj mapowanie typów danych z Modułu 3: Firebird VARCHAR/BLOB SUB_TYPE 1 -> Postgres TEXT/VARCHAR, BLOB 0 -> BYTEA, GENERATOR -> SEQUENCE/IDENTITY.",
          completed: false
        },
        {
          id: "sp_5_2",
          text: "Rozwiąż problem kodowania polskich znaków: jak poprawnie przekonwertować bazę z Windows-1250 lub ISO-8859-2 do UTF-8 w Postgres bez 'krzaków' w nazwiskach.",
          completed: false
        },
        {
          id: "sp_5_3",
          text: "Ćwiczenie: Uruchom/przeanalizuj przygotowany w cheat-sheecie skrypt Pythona (fdb + psycopg2) migrujący tabelę pacjentów partiami po 1000 rekordów z walidacją sum.",
          completed: false
        }
      ],
      resources: [
        { name: "PostgreSQL Official Documentation", url: "https://www.postgresql.org/docs/", note: "Rozdziały: Data Types, Concurrency Control (MVCC)" },
        { name: "pgloader Guide", url: "https://pgloader.readthedocs.io", note: "Wielowątkowe narzędzie do automatycznych migracji do Postgresa" }
      ]
    },
    {
      day: 6,
      title: "Nowoczesny Standard HL7 FHIR & Architektura REST",
      estimatedHours: "2.5h",
      priority: "Wysoki",
      category: "hl7_fhir",
      tag: "FHIR & Nowoczesny MedTech",
      summary: "Przejście z HL7 v2 na HL7 FHIR: zasoby JSON, RESTful API, operacje CRUD, zasoby Patient, Encounter, Observation.",
      tasks: [
        {
          id: "sp_6_1",
          text: "Zrozum filozofię FHIR: Zasoby (Resources), format JSON, operacje HTTP (GET /Patient/123, POST /Observation), referencje między zasobami.",
          completed: false
        },
        {
          id: "sp_6_2",
          text: "Porównaj reprezentację pacjenta: segment PID w HL7 v2 vs zasób Patient w FHIR JSON (identyfikatory z systemami URI, np. system PESEL).",
          completed: false
        },
        {
          id: "sp_6_3",
          text: "Ćwiczenie: Przetestuj zapytanie do publicznego serwera HAPI FHIR Test Server i odczytaj historię badań pacjenta za pomocą prostej metody curl / requests.",
          completed: false
        }
      ],
      resources: [
        { name: "HL7 FHIR R4 Specification", url: "https://hl7.org/fhir/R4/", note: "Standard obowiązujący w większości współczesnych integracji" },
        { name: "Public HAPI FHIR Sandbox", url: "http://hapi.fhir.org/baseR4", note: "Publiczny serwer testowy do zapytań REST" }
      ]
    },
    {
      day: 7,
      title: "Silnik Integracyjny (Mirth Connect) & End-to-End Testy",
      estimatedHours: "3h",
      priority: "Krytyczny (Praca na produkcji)",
      category: "java",
      tag: "Silniki Integracyjne & QA",
      summary: "Konfiguracja kanału w silniku integracyjnym (Source MLLP -> Transformer JavaScript/Java -> Destination DB/Postgres/HTTP).",
      tasks: [
        {
          id: "sp_7_1",
          text: "Zrozum architekturę silnika integracji (Mirth Connect / NextGen Connect): Kanał (Channel), Reader MLLP, Filtry, Transformery i Destination.",
          completed: false
        },
        {
          id: "sp_7_2",
          text: "Poznaj zasady obsługi kolejek (Queuing): co się dzieje, gdy system laboratoryjny LIS przestaje odpowiadać na 4 godziny (buforowanie komunikatów).",
          completed: false
        },
        {
          id: "sp_7_3",
          text: "Symulacja awarii: Naucz się odczytywać kody błędów MLLP, stack trace w Javie oraz lokalizować zablokowane komunikaty w kanale.",
          completed: false
        }
      ],
      resources: [
        { name: "NextGen Connect (Mirth) User Guide", url: "https://www.nextgen.com", note: "Wiodący otwartoźródłowy silnik integracyjny w szpitalach" },
        { name: "DICOM & PACS Basics (Orthanc)", url: "https://www.orthanc-server.com", note: "Lekki serwer PACS open-source do testów i nauki" }
      ]
    }
  ],

  // Cheat-sheet: Migracja Firebird -> PostgreSQL
  migrationCheatSheet: {
    overview: "Firebird (2.5/3.0) był przez dekady fundamentem systemów medycznych w Europie Środkowej ze względu na zero-admin i małe wymagania sprzętowe. PostgreSQL stanowi dziś standard branżowy ze względu na skalowalność, indeksy JSONB pod dane FHIR/medyczne, wsparcie dla chmury oraz zaawansowaną analitykę.",
    
    pitfalls: [
      {
        title: "Case Sensitivity (Wielkość liter w nazwach tabel i kolumn)",
        severity: "Wysokie ryzyko",
        firebird: "Firebird domyślnie konwertuje niezacytowane nazwy na UPPERCASE (np. SELECT * FROM pacjenci szuka PACJENCI). Jeśli użyto cudzysłowów \"Pacjenci\", wymaga dokładnej wielkości liter.",
        postgres: "PostgreSQL domyślnie konwertuje niezacytowane identyfikatory na LOWERCASE (np. SELECT * FROM Pacjenci szuka pacjenci). Zacytowane \"Pacjenci\" wymusi wielkie litery.",
        solution: "Zasada złota migracji: Podczas migracji do PostgreSQL przekonwertuj WSZYSTKIE nazwy tabel i kolumn do lowercase w schemacie (np. pacjenci, id_pacjenta, nazwisko). Unikaj cudzysłowów w nowo pisanym kodzie SQL."
      },
      {
        title: "Generatory vs Sekwencje / Identity",
        severity: "Krytyczne dla unikalności PK",
        firebird: "W Firebird klucz główny pobierany jest ręcznie lub w triggerze BEFORE INSERT przez: GEN_ID(GEN_PACJENT_ID, 1). Brak kolumny typu AUTO_INCREMENT.",
        postgres: "PostgreSQL używa standardu ANSI: GENERATED ALWAYS AS IDENTITY lub kolumn SERIAL (powiązanych z obiektem SEQUENCE i funkcją nextval('seq_name')).",
        solution: "W Postgresie utwórz sekwencje: CREATE SEQUENCE seq_pacjent START WITH (ostatnie_id + 1000); a w tabeli ustaw DEFAULT nextval('seq_pacjent') lub użyj IDENTITY."
      },
      {
        title: "Brak natywnego typu BOOLEAN (w Firebird 2.5)",
        severity: "Średnie",
        firebird: "W Firebird 2.5 brak typu boolean. Kolumny logiczne były modelowane jako SMALLINT (0 / 1) lub CHAR(1) ('T' / 'N', 'Y' / 'N', '1' / '0'). W wersji 3.0 dodano BOOLEAN.",
        postgres: "PostgreSQL posiada w pełni natywny, ścisły typ BOOLEAN (TRUE, FALSE, NULL). Zwykły integer nie konwertuje się automatycznie do boolean w klauzulach IF / WHERE.",
        solution: "Podczas migracji kolumn statusowych skonwertuj dane: CASE WHEN czy_aktywny = 1 THEN TRUE ELSE FALSE END do natywnego typu BOOLEAN w Postgresie."
      },
      {
        title: "Transakcje i Blokady (MGA/Sweeping vs MVCC/VACUUM)",
        severity: "Wydajnościowe / Ryzyko zawieszenia",
        firebird: "Firebird używa architektury MGA (Multi-Generational Architecture). Długo otwarta transakcja (np. niezamknięty raport w Delphi) blokuje garbage collection (OAT), powodując gwałtowny rozrost pliku bazy i spowolnienie całego szpitala.",
        postgres: "PostgreSQL stosuje zaawansowany MVCC sterowany automatycznym procesem autovacuum. Mimo to długo trwające transakcje (idle in transaction) blokują vacuuming i mogą wywołać transaction wraparound.",
        solution: "W Postgresie skonfiguruj parametry: idle_in_transaction_session_timeout = '15min' oraz zoptymalizuj autovacuum_vacuum_scale_factor dla tabel transakcji medycznych."
      },
      {
        title: "Kodowanie znaków (WIN1250 / ISO8859_2 vs UTF8)",
        severity: "Błędy danych (polskie znaki w nazwiskach)",
        firebird: "Bazy Firebird w polskich szpitalach były najczęściej tworzone z CHARSET WIN1250, ISO8859_2 lub z CHARSET NONE (co oznacza, że klient zapisywał surowe bajty zgodnie ze swoją stroną kodową Windows).",
        postgres: "Postgres wymaga jednolitego kodowania na poziomie klastra/bazy, standardem w medycynie jest bezwzględnie UTF8.",
        solution: "Przed załadowaniem danych do Postgresa zdekoduj strumień bajtów z WIN1250 i zre-enkoduj do UTF-8. W skryptach Pythona: row[col].decode('cp1250').encode('utf-8')."
      }
    ],

    typeMapping: [
      { firebird: "INTEGER", postgres: "INTEGER", note: "Identyczny zakres (-2^31 do 2^31-1)" },
      { firebird: "BIGINT", postgres: "BIGINT", note: "Identyczny zakres 64-bit" },
      { firebird: "SMALLINT", postgres: "SMALLINT / BOOLEAN", note: "Jeśli używany jako flaga (0/1) -> mapuj do BOOLEAN" },
      { firebird: "VARCHAR(n)", postgres: "VARCHAR(n) lub TEXT", note: "Postgres nie ma narzutu wydajnościowego na typ TEXT" },
      { firebird: "CHAR(n)", postgres: "CHAR(n) lub VARCHAR(n)", note: "Uwaga na dopełnianie spacjami w Firebird" },
      { firebird: "BLOB SUB_TYPE 1 (TEXT)", postgres: "TEXT", note: "Opisy badań, wywiady lekarskie, epikryzy" },
      { firebird: "BLOB SUB_TYPE 0 (BINARY)", postgres: "BYTEA", note: "Załączniki PDF, skany dokumentów, surowe ramki HL7/DICOM" },
      { firebird: "DATE", postgres: "DATE", note: "Sama data bez czasu" },
      { firebird: "TIME", postgres: "TIME", note: "Sam czas" },
      { firebird: "TIMESTAMP", postgres: "TIMESTAMP lub TIMESTAMPTZ", note: "W systemach szpitalnych zalecane TIMESTAMPTZ (ze strefą czasową)" },
      { firebird: "NUMERIC(p, s) / DECIMAL(p, s)", postgres: "NUMERIC(p, s)", note: "Dokładne wartości finansowe, rozliczenia z NFZ, dawki leków" },
      { firebird: "DOUBLE PRECISION", postgres: "DOUBLE PRECISION", note: "Wyniki pomiarów laboratoryjnych zmiennoprzecinkowych" }
    ],

    sqlPatterns: [
      {
        title: "Konwersja Generatora na Sekwencję",
        firebirdSql: `-- W Firebird:
CREATE GENERATOR GEN_PACJENT_ID;
SET GENERATOR GEN_PACJENT_ID TO 154200;

-- Pobranie nowej wartości:
SELECT GEN_ID(GEN_PACJENT_ID, 1) FROM RDB$DATABASE;`,
        postgresSql: `-- W PostgreSQL:
CREATE SEQUENCE seq_pacjent_id START WITH 154201;

-- Użycie w tabeli:
ALTER TABLE pacjenci ALTER COLUMN id SET DEFAULT nextval('seq_pacjent_id');

-- Pobranie nowej wartości:
SELECT nextval('seq_pacjent_id');`
      },
      {
        title: "Konwersja Triggera Before Insert na Identity/Default",
        firebirdSql: `-- W Firebird (typowy trigger autoprzyrostu):
CREATE TRIGGER BI_PACJENCI_ID FOR PACJENCI
ACTIVE BEFORE INSERT POSITION 0
AS
BEGIN
  IF (NEW.ID IS NULL) THEN
    NEW.ID = GEN_ID(GEN_PACJENT_ID, 1);
END;`,
        postgresSql: `-- W PostgreSQL najczystszym rozwiązaniem jest IDENTITY (od Postgres 10):
CREATE TABLE pacjenci (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    pesel VARCHAR(11) NOT NULL,
    nazwisko VARCHAR(100) NOT NULL
);`
      },
      {
        title: "Paginacja (FIRST/SKIP vs LIMIT/OFFSET)",
        firebirdSql: `-- W Firebird 2.5:
SELECT FIRST 50 SKIP 100 
id, nazwisko, imie 
FROM pacjenci 
ORDER BY id;`,
        postgresSql: `-- W PostgreSQL:
SELECT 
id, nazwisko, imie 
FROM pacjenci 
ORDER BY id 
LIMIT 50 OFFSET 100;`
      }
    ],

    pythonEtlSnippet: `"""
Skrypt produkcyjnego ETL partiami: Firebird -> PostgreSQL
Wymagania: pip install fdb psycopg2-binary
"""
import fdb
import psycopg2
from psycopg2.extras import execute_batch
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def migrate_patients():
    # 1. Połączenie źródłowe (Firebird)
    fb_conn = fdb.connect(
        dsn='192.168.1.50:/var/db/szpital_his.fdb',
        user='SYSDBA',
        password='masterkey',
        charset='WIN1250'  # Kluczowe dla dekodowania polskich znaków!
    )
    fb_cur = fb_conn.cursor()

    # 2. Połączenie docelowe (PostgreSQL)
    pg_conn = psycopg2.connect(
        dbname='szpital_nowy',
        user='postgres',
        password='tajne_haslo_pg',
        host='localhost',
        port=5432
    )
    pg_cur = pg_conn.cursor()

    CHUNK_SIZE = 2000
    total_migrated = 0

    logging.info("Start migracji tabeli PACJENCI...")
    
    # Wyciągamy dane z Firebirda
    fb_cur.execute("""
        SELECT ID, PESEL, NAZWISKO, IMIE, DATA_URODZENIA, CZY_AKTYWNY, NOTATKI 
        FROM PACJENCI ORDER BY ID
    """)

    insert_sql = """
        INSERT INTO pacjenci (id, pesel, nazwisko, imie, data_urodzenia, czy_aktywny, notatki)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            nazwisko = EXCLUDED.nazwisko,
            imie = EXCLUDED.imie,
            czy_aktywny = EXCLUDED.czy_aktywny;
    """

    while True:
        rows = fb_cur.fetchmany(CHUNK_SIZE)
        if not rows:
            break
        
        batch_data = []
        for row in rows:
            # Bezpieczna transformacja typów
            p_id, pesel, nazwisko, imie, ur_data, aktywny_num, notatki = row
            
            # Konwersja SMALLINT (0/1) -> BOOLEAN
            is_active = True if aktywny_num == 1 else False
            
            # Czyszczenie białych znaków ze starych CHAR/VARCHAR
            clean_pesel = pesel.strip() if pesel else None
            clean_nazwisko = nazwisko.strip() if nazwisko else "BRAK"
            clean_imie = imie.strip() if imie else "BRAK"
            
            batch_data.append((p_id, clean_pesel, clean_nazwisko, clean_imie, ur_data, is_active, notatki))
        
        # Szybki zapis partią do Postgresa
        execute_batch(pg_cur, insert_sql, batch_data, page_size=CHUNK_SIZE)
        pg_conn.commit()
        total_migrated += len(batch_data)
        logging.info(f"Zmigrowano partię: łącznie {total_migrated} pacjentów.")

    # 3. Synchronizacja sekwencji w Postgresie do maksymalnego ID
    pg_cur.execute("SELECT setval('seq_pacjent_id', COALESCE((SELECT MAX(id) FROM pacjenci), 1));")
    pg_conn.commit()

    fb_conn.close()
    pg_conn.close()
    logging.info(f"Migracja zakończona sukcesem! Przeniesiono rekordów: {total_migrated}")

if __name__ == '__main__':
    migrate_patients()
`
  },

  // Praktyczny przewodnik HL7 v2 i FHIR
  hl7FhirGuide: {
    comparison: {
      hl7v2: {
        format: "Tekstowy z separatorami rurowymi (|) i karetkami (^)",
        transport: "MLLP (Minimal Lower Layer Protocol) over TCP/IP (porty np. 2575, 6661)",
        architektura: "Event-driven (Zdarzenie wywołuje wysłanie komunikatu, np. przyjęcie pacjenta)",
        status: "Standard de facto w 90% istniejącej aparatury i systemów HIS/LIS/RIS na świecie"
      },
      fhir: {
        format: "JSON (lub XML) zoptymalizowany pod REST API",
        transport: "HTTPS / TLS (porty 443 / 8443)",
        architektura: "Resource-based (Zasoby CRUD: GET, POST, PUT, DELETE, GraphQL)",
        status: "Nowoczesny standard do wymiany między szpitalami, aplikacji pacjenta i integracji chmurowych"
      }
    },

    commonMessages: [
      {
        code: "ADT^A01",
        name: "Patient Admission (Przyjęcie pacjenta)",
        flow: "HIS -> LIS, RIS, PACS",
        description: "Wysyłany gdy pacjent zostaje przyjęty na oddział szpitalny. Systemy pomocnicze tworzą u siebie kartotekę pacjenta.",
        segments: ["MSH", "EVN", "PID", "PV1"]
      },
      {
        code: "ADT^A08",
        name: "Update Patient Information (Aktualizacja danych pacjenta)",
        flow: "HIS -> Systemy dziedzinowe",
        description: "Zmiana nazwiska, adresu, korekta PESEL lub ubezpieczenia. Kluczowe dla spójności danych medycznych.",
        segments: ["MSH", "EVN", "PID", "PV1"]
      },
      {
        code: "ORM^O01 / OML^O21",
        name: "Order Message (Zlecenie badań)",
        flow: "HIS -> LIS (badania krwi) lub HIS -> RIS (badania obrazowe RTG/TK/MR)",
        description: "Lekarz w HIS zleca morfologię lub tomografię. Komunikat zawiera numer zlecenia (Placer Order Number) i kody badań.",
        segments: ["MSH", "PID", "PV1", "ORC", "OBR"]
      },
      {
        code: "ORU^R01",
        name: "Observational Result (Wynik badań)",
        flow: "LIS -> HIS lub RIS -> HIS",
        description: "Wyniki laboratoryjne z aparatów lub opis badania radiologicznego lekarza radiologa wraca do systemu głównego HIS.",
        segments: ["MSH", "PID", "PV1", "OBR", "OBX"]
      },
      {
        code: "ACK",
        name: "General Acknowledgment (Potwierdzenie techniczne/aplikacyjne)",
        flow: "Odbiorca -> Nadawca",
        description: "Zwracany natychmiast po odebraniu komunikatu. Kod AA = Sukces (Application Accept), AE = Błąd danych (Application Error), AR = Odrzucenie (Application Reject).",
        segments: ["MSH", "MSA"]
      }
    ],

    sampleMessage: {
      raw: "MSH|^~\\&|HIS_SZPITAL|ODDZIAL_WEWN|LAB_LIS|LABORATORIUM|20260912103000||ORU^R01|MSG20260912001|P|2.3\r" +
           "PID|1||98051412345^^^SZPITAL_ID^PI||KOWALSKI^JAN^^^PAN||19980514|M|||UL. ZDROWA 12^^WARSZAWA^^00-001^POL||501234567|||S||98051412345\r" +
           "PV1|1|I|WEW^SALA_104^LOZKO_2||||12345^NOWAK^PIOTR^^^DR MED||||||||||10023456^^^NR_POBYTU\r" +
           "OBR|1|ORD998811|LAB554422|CBC^MORFOLOGIA KRWI 5-DIFF^LN|||20260912090000|||||||||12345^NOWAK^PIOTR\r" +
           "OBX|1|NM|6690-2^LEUKOCYTY (WBC)^LN||7.4|10*3/uL|4.0-10.0|N|||F|||20260912101500\r" +
           "OBX|2|NM|789-8^ERYTROCYTY (RBC)^LN||4.85|10*6/uL|4.5-5.9|N|||F|||20260912101500\r" +
           "OBX|3|NM|718-7^HEMOGLOBINA (HGB)^LN||14.2|g/dL|13.5-17.5|N|||F|||20260912101500",
      breakdown: [
        { segment: "MSH", desc: "Nagłówek wiadomości: nadawca HIS_SZPITAL, odbiorca LAB_LIS, typ ORU^R01, wersja HL7 2.3" },
        { segment: "PID", desc: "Dane pacjenta: Identyfikator=98051412345, Nazwisko=KOWALSKI, Imię=JAN, Data ur.=1998-05-14, Płeć=M" },
        { segment: "PV1", desc: "Pobyt pacjenta: Pacjent hospitalizowany (I), Oddział=Wewnętrzny (WEW), Sala 104, Lekarz kierujący=dr Piotr Nowak" },
        { segment: "OBR", desc: "Nagłówek zlecenia badania: Zlecenie nr ORD998811, Badanie CBC (Morfologia krwi), data pobrania próbki" },
        { segment: "OBX (1-3)", desc: "Trzy linie konkretnych wyników: WBC (7.4), RBC (4.85), HGB (14.2) wraz z jednostkami i normami referencyjnymi" }
      ]
    },

    fhirSnippet: {
      json: `{
  "resourceType": "Observation",
  "id": "wbc-result-1001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "laboratory",
          "display": "Laboratory"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "6690-2",
        "display": "Leukocytes [#/volume] in Blood by Automated count"
      }
    ],
    "text": "Leukocyty (WBC)"
  },
  "subject": {
    "reference": "Patient/98051412345",
    "display": "Jan Kowalski"
  },
  "effectiveDateTime": "2026-09-12T10:15:00+02:00",
  "valueQuantity": {
    "value": 7.4,
    "unit": "10*3/uL",
    "system": "http://unitsofmeasure.org",
    "code": "10*3/uL"
  },
  "referenceRange": [
    {
      "low": { "value": 4.0, "unit": "10*3/uL" },
      "high": { "value": 10.0, "unit": "10*3/uL" }
    }
  ]
}`,
      explanation: "Odpowiednik segmentu OBX w formacie HL7 FHIR: obiekt JSON ze standardowymi kodami LOINC, referencją do pacjenta i precyzyjnie określonymi normami."
    },

    pythonMllpClientSnippet: `"""
Prosty i niezawodny klient MLLP w Pythonie do wysyłania komunikatów HL7
"""
import socket

def send_hl7_mllp(host, port, hl7_message_text):
    # Ramka MLLP: Start Byte (0x0B), Treść, End Bytes (0x1C, 0x0D)
    START_BLOCK = b'\\x0b'
    END_BLOCK = b'\\x1c\\x0d'
    
    payload = START_BLOCK + hl7_message_text.encode('utf-8') + END_BLOCK
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(10.0) # 10s timeout dla systemów szpitalnych
        sock.connect((host, port))
        sock.sendall(payload)
        
        # Oczekiwanie na odpowiedź ACK
        response_data = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response_data += chunk
            if END_BLOCK in response_data:
                break
                
    # Zdjęcie ramki MLLP z odpowiedzi
    clean_ack = response_data.strip(START_BLOCK + END_BLOCK).decode('utf-8', errors='replace')
    return clean_ack
`,

    // Słownik żargonu i pojęć branżowych "Mów jak zespół"
    jargonDictionary: [
      {
        term: "HIS (Hospital Information System)",
        meaning: "Szpitalny System Informacyjny – główny system zarządczy w placówce. Obsługuje ruch chorych (przyjęcia, wypisy), kartotekę pacjenta, zlecenia badań, rozliczenia z NFZ/płatnikami oraz historię choroby.",
        context: "Gdy zespół mówi: 'HIS nie puścił zlecenia', oznacza to, że lekarz zlecił badanie w systemie głównym, ale komunikat ORM nie opuścił kolejki wyjściowej."
      },
      {
        term: "LIS (Laboratory Information System)",
        meaning: "Laboratoryjny System Informatyczny. Zarządza pracowniami analitycznymi, probówkami, kodami kreskowymi, komunikacją bezpośrednią z analizatorami krwi/moczu oraz autoryzacją wyników przez diagnostów.",
        context: "Komunikacja HIS -> LIS (zlecenie ORM), LIS -> HIS (zautoryzowany wynik ORU)."
      },
      {
        term: "RIS (Radiology Information System)",
        meaning: "Radiologiczny System Informatyczny. Odpowiada za rejestrację i kolejkowanie pacjentów na badania obrazowe (RTG, TK, Rezonans, USG) oraz tworzenie i zatwierdzanie opisów radiologicznych.",
        context: "Współpracuje ściśle z PACS. RIS przechowuje dane opisowe, a PACS surowe obrazy medyczne."
      },
      {
        term: "PACS (Picture Archiving and Communication System)",
        meaning: "System Archiwizacji i Transmisji Obrazów. Specjalistyczny serwer/baza danych przechowująca pliki obrazowe w standardzie DICOM (skany TK o rozmiarach setek megabajtów) wraz z dedykowanymi przeglądarkami medycznymi dla lekarzy.",
        context: "Popularne rozwiązania w testach/produkcji: Orthanc, dcm4chee."
      },
      {
        term: "MLLP (Minimal Lower Layer Protocol)",
        meaning: "Minimalny protokół transportowy warstwy sesji opakowujący ramki HL7 v2 na gnieździe TCP. Dodaje 1 bajt początkowy (0x0B) i 2 bajty końcowe (0x1C 0x0D).",
        context: "Gdy ktoś mówi: 'Sprawdź czy port MLLP wisi', oznacza to weryfikację czy socket TCP słucha i czy zapora nie blokuje ruchu."
      },
      {
        term: "ACK / NACK (Acknowledgment)",
        meaning: "Komunikat zwrotny potwierdzający (ACK) lub odrzucający (NACK) transakcję HL7. Kluczowe kody w segmencie MSA-1: AA (Akceptacja), AE (Błąd aplikacji), AR (Odrzucenie komunikatu).",
        context: "Jeśli integracja rzuca błąd AE, zazwyczaj w komunikacie brakuje wymaganego pola (np. PESEL lub numeru zlecenia)."
      },
      {
        term: "Z-Segmenty (Z-Segments)",
        meaning: "Niestandardowe, zdefiniowane lokalnie segmenty komunikatów HL7 (zawsze zaczynające się na literę Z, np. ZDS, ZBE, ZPS), używane przez polskich dostawców do przesyłania danych specyficznych dla NFZ lub placówki.",
        context: "Najczęstsza przyczyna problemów integracyjnych: parser trzeciej firmy wywala się, bo nie rozpoznaje Z-segmentu."
      },
      {
        term: "DICOM Modality Worklist (MWL)",
        meaning: "Lista robocza aparatu diagnostycznego. Umożliwia technikowi przy aparacie RTG/TK wybranie pacjenta z listy bez ręcznego wklepywania nazwiska i PESELu, co eliminuje pomyłki.",
        context: "HIS wysyła zlecenie do RIS -> RIS wystawia MWL na aparat -> aparat wykonuje badanie z poprawnym ID pacjenta."
      },
      {
        term: "AET / AE Title (Application Entity Title)",
        meaning: "Unikalna nazwa (do 16 znaków, wielkie litery) identyfikująca urządzenie lub węzeł w sieci DICOM (np. TK_SIEMENS_01, PACS_ARCHIVE).",
        context: "Bez poprawnego dopisania pary AET w PACS aparat nie prześle ani jednego zdjęcia."
      },
      {
        term: "Placer Order Number vs Filler Order Number",
        meaning: "Placer (ORC-2) to numer zlecenia nadany przez system zlecający (HIS). Filler (ORC-3) to numer nadany przez system wykonujący badanie (LIS/RIS).",
        context: "Kluczowe przy korelowaniu wyników: w komunikacie ORU muszą znaleźć się oba identyfikatory, by HIS wiedział do którego zlecenia przypiąć wynik."
      },
      {
        term: "LOINC (Logical Observation Identifiers Names and Codes)",
        meaning: "Międzynarodowy słownik kodów badań laboratoryjnych i obserwacji klinicznych. Standard używany w segmencie OBX-3 oraz w FHIR.",
        context: "Np. kod 6690-2 jednoznacznie definiuje badanie leukocytów we krwi, niezależnie od języka polskiego czy angielskiego."
      },
      {
        term: "ICD-10 / ICD-9",
        meaning: "Klasyfikacje medyczne: ICD-10 to międzynarodowa klasyfikacja chorób i problemów zdrowotnych (rozpoznania lekarskie), a ICD-9 w Polsce to klasyfikacja procedur medycznych (zabiegi, operacje, badania).",
        context: "Wymagane w każdym rozliczeniu z NFZ i w zleceniach szpitalnych."
      },
      {
        term: "Interface Engine (Silnik Integracyjny)",
        meaning: "Oprogramowanie pośredniczące (middleware), które odbiera komunikaty z wielu źródeł, transformuje je i kieruje do odpowiednich systemów docelowych (np. Mirth Connect / NextGen Connect, Cloverleaf).",
        context: "Umożliwia zmianę formatów w locie (np. HL7 v2 -> JSON -> zapis do bazy PostgreSQL) bez dotykania kodu źródłowego HIS."
      },
      {
        term: "RODO Medyczne / Dane Szczególnej Kategorii",
        meaning: "Zgodnie z art. 9 RODO dane o stanie zdrowia to dane wrażliwe. W środowiskach testowych obowiązuje bezwzględny zakaz używania prawdziwych nazwisk i numerów PESEL.",
        context: "Przed zrzuceniem bazy produkcyjnej na środowisko dev/staging MUSI zostać wykonana anonimizacja (maskowanie PESEL, nazwisk, adresów)."
      },
      {
        term: "Okno Serwisowe (Maintenance Window)",
        meaning: "Wyznaczony czas (najczęściej w nocy między 01:00 a 04:00), w którym szpital minimalizuje ruch planowy i dopuszczalne są restarty baz danych, migracje schematów oraz aktualizacje oprogramowania.",
        context: "Szpital pracuje 24/7 (SOR, Izba Przyjęć nie śpią) – każda niedostępność musi być wcześniej zgłoszona do personelu medycznego."
      }
    ]
  },

  // Szablon Dokumentacji Projektowej i Integracyjnej
  documentationTemplate: {
    title: "Dokumentacja Integracji / Zmiany Architektonicznej",
    sections: [
      { id: "meta", title: "1. Metryka Dokumentu & Zaangażowane Systemy", placeholder: "Autor, Data, Wersja, System Źródłowy (np. HIS Asseco/Comarch), System Docelowy (np. LIS Marcel/Alab, PACS Orthanc)" },
      { id: "business_goal", title: "2. Cel Biznesowy i Kliniczny", placeholder: "Jaki problem medyczny/operacyjny rozwiązuje ta zmiana? (np. automatyczne przekazywanie wyników gazometrii z SOR do karty zlecenia lekarskiego)" },
      { id: "scope", title: "3. Zakres Rozwiązania (In-Scope & Out-of-Scope)", placeholder: "Co wchodzi w zakres wdrożenia, a co zostaje odłożone na kolejny etap (np. tylko zlecenia planowe, bez badań cito z SOR)" },
      { id: "architecture", title: "4. Architektura Przepływu Danych", placeholder: "Protokoły (MLLP / HTTP REST / DICOM), porty sieciowe, adresy IP węzłów, formaty wiadomości (HL7 v2.3 / FHIR R4), kolejki buforujące" },
      { id: "mapping", title: "5. Specyfikacja Mapowania Pól (Field Mapping)", placeholder: "Tabela konwersji: Pole w systemie A -> Reguła transformacji -> Pole w systemie B (np. PID-3 PESEL -> patient.identifier[system='pesel'].value)" },
      { id: "database", title: "6. Zmiany w Bazie Danych / Migracje", placeholder: "Nowe tabele, indeksy, sekwencje, modyfikacje schematu Firebird / PostgreSQL, skrypty DDL i DML" },
      { id: "testing", title: "7. Plan Testów & Środowisko Weryfikacyjne", placeholder: "Scenariusze testowe: Happy path, błąd sieci, niepoprawny PESEL, test obciążeniowy, symulacja odpowiedzi ACK/NACK" },
      { id: "rollback", title: "8. Plan Wycofania Zmian (Rollback Plan)", placeholder: "Procedura krok po kroku w razie niepowodzenia wdrożenia w oknie serwisowym (przywrócenie backupu, przełączenie portów MLLP)" },
      { id: "contacts", title: "9. Notatki Wdrożeniowe & Osoby Kontaktowe", placeholder: "Telefony do administratora LIS, opiekuna bazy danych szpitala, koordynatora nocnego dyżuru" }
    ]
  },

  // Pytania Orientacyjne do Zespołu w Pierwszym Tygodniu
  orientationQuestions: [
    {
      id: "q1",
      category: "Architektura & Infrastruktura",
      question: "Gdzie fizycznie i logicznie hostowane są bazy danych i silniki integracyjne (on-premise w szpitalach czy prywatna chmura)?",
      whyImportant: "Szpitale często mają rygorystyczne segmenty sieci VLAN i odcięcie od publicznego Internetu.",
      asked: false,
      userNote: ""
    },
    {
      id: "q2",
      category: "Architektura & Infrastruktura",
      question: "Jaki silnik integracyjny (Interface Engine) jest używany w firmie (Mirth Connect, Apache Camel, własny serwis)?",
      whyImportant: "Pozwoli Ci natychmiast skupić się na właściwym narzędziu i przejrzeć istniejące kanały.",
      asked: false,
      userNote: ""
    },
    {
      id: "q3",
      category: "Architektura & Infrastruktura",
      question: "W jakich wersjach działają bazy danych Firebird i PostgreSQL na instalacjach klientów?",
      whyImportant: "Różnice między Firebird 2.1, 2.5 i 3.0 oraz Postgres 12 a 16 determinują dostępne funkcje SQL i sterowniki.",
      asked: false,
      userNote: ""
    },
    {
      id: "q4",
      category: "Procesy & Narzędzia",
      question: "Jaki jest standardowy Git workflow (GitLab Flow, Trunk-Based) i jak oznaczane są wydania dla konkretnych szpitali?",
      whyImportant: "Często szpitale mają swoje dedykowane gałęzie z lokalnymi modyfikacjami.",
      asked: false,
      userNote: ""
    },
    {
      id: "q5",
      category: "Procesy & Narzędzia",
      question: "Jak wygląda proces wdrożeń produkcyjnych – czy robimy je zdalnie w oknach serwisowych w nocy, czy odpowiada za to osobny zespół wdrożeniowy?",
      whyImportant: "Wpływa na Twój harmonogram pracy i ewentualne dyżury domowe (on-call).",
      asked: false,
      userNote: ""
    },
    {
      id: "q6",
      category: "Standaryzacja HL7 & FHIR",
      question: "Czy posiadamy wewnętrzny katalog specyfikacji komunikatów HL7 i spis używanych niestandardowych Z-segmentów?",
      whyImportant: "Zaoszczędzi Ci to dziesiątek godzin debugowania, dlaczego komunikaty odrzucają się na produkcji.",
      asked: false,
      userNote: ""
    },
    {
      id: "q7",
      category: "Standaryzacja HL7 & FHIR",
      question: "W jaki sposób testujemy integracje z laboratoriami i aparatami bez dostępu do fizycznych maszyn (symulatory MLLP, mocki)?",
      whyImportant: "Klucz do bezpiecznego developingu na lokalnej maszynie.",
      asked: false,
      userNote: ""
    },
    {
      id: "q8",
      category: "Dostęp do Systemów & Bezpieczeństwo",
      question: "Jak uzyskujemy dostęp do logów produkcyjnych w razie awarii (VPN, bastion host, Graylog, ELK)?",
      whyImportant: "Gdy wpadnie błąd krytyczny z SOR, musisz wiedzieć od razu gdzie szukać śladu komunikatu.",
      asked: false,
      userNote: ""
    },
    {
      id: "q9",
      category: "Dostęp do Systemów & Bezpieczeństwo",
      question: "Jakie są procedury dotyczące anonimizacji danych medycznych do celów odtwarzania bugów na dev/staging?",
      whyImportant: "Ochrona przed naruszeniem przepisów RODO i karami prawno-finansowymi.",
      asked: false,
      userNote: ""
    },
    {
      id: "q10",
      category: "Dług Technologiczny & Historia",
      question: "Które moduły kodu w Delphi są obecnie uznawane za 'zamrożone' lub zbyt ryzykowne do dotykania bez konsultacji?",
      whyImportant: "Uchroni Cię przed przypadkowym zepsuciem historycznych procedur rozliczeniowych.",
      asked: false,
      userNote: ""
    },
    {
      id: "q11",
      category: "Dług Technologiczny & Historia",
      question: "Jakie są najczęstsze powtarzające się zgłoszenia wsparcia technicznego w poniedziałki rano?",
      whyImportant: "Szybko zidentyfikujesz słabe punkty infrastruktury (zablokowane kolejki, zerwane tunele VPN, brak miejsca na dysku).",
      asked: false,
      userNote: ""
    }
  ],

  // Checklist Pierwszego Tygodnia (Dni 1-5)
  firstWeekChecklist: [
    {
      day: "Dzień 1: Organizacja & Środowisko Dostępowe",
      items: [
        {
          id: "fw_1_1",
          task: "Odbiór i konfiguracja stacji roboczej, instalacja menedżera haseł i bezpiecznych narzędzi.",
          contact: "Dział IT / Helpdesk",
          reading: "Polityka Bezpieczeństwa Informacji i Ochrony Danych Medycznych (RODO)",
          done: false,
          note: ""
        },
        {
          id: "fw_1_2",
          task: "Uzyskanie dostępów do kluczowych systemów: GitLab/GitHub, Jira/Redmine, komunikator zespołu, VPN.",
          contact: "Przełożony / Tech Lead",
          reading: "Przewodnik wprowadzający dla nowych programistów (Wiki firmowe)",
          done: false,
          note: ""
        },
        {
          id: "fw_1_3",
          task: "Zapoznanie się z przypisanym Mentorem (Buddy) i ustalenie codziennego syncu (15 min daily).",
          contact: "Twój Mentor / Senior Developer",
          reading: "Struktura organizacyjna firmy i spis ról w projekcie",
          done: false,
          note: ""
        }
      ]
    },
    {
      day: "Dzień 2: Konfiguracja Środowiska Deweloperskiego",
      items: [
        {
          id: "fw_2_1",
          task: "Pobranie i uruchomienie lokalnych repozytoriów kodu (backend Java/Python, moduły Delphi/klient).",
          contact: "Mentor",
          reading: "Instrukcja README.md w głównym repozytorium projektu",
          done: false,
          note: ""
        },
        {
          id: "fw_2_2",
          task: "Uruchomienie lokalnych instancji baz danych (Docker Compose z PostgreSQL oraz testowy plik bazy Firebird).",
          contact: "DevOps / Inżynier Infrastruktury",
          reading: "Cheat-sheet migracji Firebird -> PostgreSQL (Moduł 3 aplikacji)",
          done: false,
          note: ""
        },
        {
          id: "fw_2_3",
          task: "Instalacja narzędzi pomocniczych: DBeaver/pgAdmin, klient MLLP/Postman, Inspektor HL7.",
          contact: "Samodzielnie / Mentor",
          reading: "Przewodnik narzędziowy w onboarding hubie",
          done: false,
          note: ""
        }
      ]
    },
    {
      day: "Dzień 3: Anatomia Kodu & Pierwsze Uruchomienie Przepływu",
      items: [
        {
          id: "fw_3_1",
          task: "Sesja code walkthrough z mentorem: omówienie warstwy dostępu do danych, silnika integracyjnego i logiki biznesowej.",
          contact: "Senior Developer / Architekt",
          reading: "Diagram architektury systemu szpitalnego",
          done: false,
          note: ""
        },
        {
          id: "fw_3_2",
          task: "Przesłanie testowego komunikatu HL7 ADT^A01 przez lokalny port MLLP i prześledzenie zapisu w bazie danych.",
          contact: "Mentor",
          reading: "Struktury komunikatów w Module 4 aplikacji",
          done: false,
          note: ""
        },
        {
          id: "fw_3_3",
          task: "Lokalizacja logów aplikacji: zapoznanie się z formatem logowania błędów transakcyjnych i komunikatów odrzuconych (NACK).",
          contact: "DevOps / Mentor",
          reading: "Konfiguracja Logback/Log4j/logging w projekcie",
          done: false,
          note: ""
        }
      ]
    },
    {
      day: "Dzień 4: Pierwsze Praktyczne Zadanie (Good First Issue)",
      items: [
        {
          id: "fw_4_1",
          task: "Pobranie pierwszego zadania z Jiry (np. poprawka mapowania pola w HL7, optymalizacja zapytania SQL lub dodanie walidacji PESEL).",
          contact: "Tech Lead / Scrum Master",
          reading: "Opis ticketa w Jirze wraz z powiązaną dokumentacją integracyjną",
          done: false,
          note: ""
        },
        {
          id: "fw_4_2",
          task: "Implementacja zmiany w wydzielonej gałęzi (feature branch), napisanie testu jednostkowego/integracyjnego.",
          contact: "Samodzielnie",
          reading: "Standardy czystego kodu i wytyczne review w zespole",
          done: false,
          note: ""
        },
        {
          id: "fw_4_3",
          task: "Wystawienie Merge Requestu (MR / PR) i przejście przez pierwsze Code Review.",
          contact: "Wyznaczeni recenzenci z zespołu",
          reading: "Checklist code review w repozytorium",
          done: false,
          note: ""
        }
      ]
    },
    {
      day: "Dzień 5: Podsumowanie Wdrożenia & Plan na Kolejny Sprint",
      items: [
        {
          id: "fw_5_1",
          task: "Wdrożenie zaakceptowanego MR na środowisko deweloperskie/staging i weryfikacja działania.",
          contact: "DevOps / Mentor",
          reading: "Pipeline CI/CD w GitLab/GitHub Actions",
          done: false,
          note: ""
        },
        {
          id: "fw_5_2",
          task: "Spotkanie 1-on-1 z przełożonym: omówienie wrażeń z 1. tygodnia, feedback techniczny, ewentualne blokery dostępowe.",
          contact: "Engineering Manager / Przełożony",
          reading: "Własne notatki sporządzone w aplikacji w Module 6 i 7",
          done: false,
          note: ""
        },
        {
          id: "fw_5_3",
          task: "Wypełnienie i zaktualizowanie ocen w Module 1 Onboarding Huba oraz wyznaczenie celów nauki na tydzień 2.",
          contact: "Samodzielnie",
          reading: "Plan nauki na kolejne tygodnie",
          done: false,
          note: ""
        }
      ]
    }
  ]
};

// Eksport do środowiska globalnego przeglądarki
if (typeof window !== 'undefined') {
  window.HEALTHTECH_DATA = HEALTHTECH_DATA;
}
