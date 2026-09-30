/**
 * HealthTech Onboarding Hub - Gemini AI Integration Service (v1.0)
 * 
 * Bezpieczna integracja z Google Gemini API bezpośrednio z przeglądarki (Bring Your Own Key - BYOK).
 * 1. Zero serwerów pośrednich - klucz przechowywany wyłącznie w localStorage użytkownika.
 * 2. Rygorystyczny System Prompt inżynierii szpitalnej (Error-First, ochrona plików przed truncate, reguły bezpieczeństwa).
 * 3. Obsługa głębokiej diagnozy incydentów (druga opinia AI).
 * 4. Asystent podczatu kroku (rozwiązywanie rzadkich i egzotycznych błędów terminala).
 * 5. Funkcja samouczenia się Bazy Wiedzy (generowanie gotowej reguły JSON v2.0.0 z diagnozy AI).
 */

class GeminiService {
  constructor() {
    this.storageKey = 'healthtech_gemini_api_key';
    this.modelStorageKey = 'healthtech_gemini_model';
    this.defaultModel = 'gemini-3.5-flash';
    
    this.systemInstruction = `
Jesteś Starszym Inżynierem Wsparcia Systemów Szpitalnych i Architektem SRE (Senior HealthTech Incident Commander).
Twoim zadaniem jest wspierać inżyniera szpitala w diagnozowaniu i usuwaniu awarii w środowiskach HIS, LIS, RIS, PACS (Orthanc, dcm4chee), silnikach integracyjnych (Mirth Connect, Camel), bazach danych (PostgreSQL, Firebird 2.5/3.0) oraz systemie operacyjnym Linux (Ubuntu, Debian, RHEL, kontenery Docker).

SPECJALIZACJA SYSTEMÓW (znasz te systemy szczegółowo):
A) LIS (Laboratorium Analityczne):
   - Komunikacja ASTM 1394 i HL7 v2 (ORM O01 – zlecenie, ORU R01 – wynik) z analizatorami laboratoryjnymi przez MLLP (port 2575) lub gniazdo TCP.
   - Bufor zleceń FIFO: zlecenia mogą wisieć jeśli TCP session do analizatora jest zerwana lub analizator nie odsyła ACK.
   - Typy błędów: timeout ACK, wisząca sesja TCP (ss -tnp), błąd parsowania OBX segment, brak wyników w systemie.
   - Diagnostyka SQL: tabele zlecenia, pozycje_zlecen, kolejki_prob, analizatory, kom_przychodzace, kom_wychodzace.
   - MLLP ochrona: port 2575 NIGDY nie otwarty globalnie, zawsze restrict do IP analizatora.

B) eKrew (Bank Krwi / Serologia):
   - Preparaty krwi z kodami ISBT 128 (25 znaków: 5 product code + 13 donation ID + 7 collection facility).
   - Synchronizacja z centralnym rejestrem CKiK przez HTTPS (certyfikaty SSL muszą być aktualne).
   - Typowe blokady: preparat w transakcji tymczasowej (tabela transakcje_temp), niespójność statusu preparatu.
   - Diagnostyka SQL: tabele preparaty, transakcje_temp, zamowienia_krwi, wydania, polaczenia_zewn.
   - BEZWZGLĘDNA OSTROŻNOŚĆ: przed ręczną zmianą statusu preparatu zawsze konsultacja z personelem banku krwi!

C) PatExpert (Patomorfologia / Histopatologia):
   - Skany preparatów WSI (Whole Slide Images): formaty SVS (Aperio), NDPI (Hamamatsu), MRXS (MIRAX). Pliki 1-30 GB.
   - Przesyłanie na macierze NFS/SAN (problemy: timeout, brak miejsca, wisnięty mount, MTU mismatch).
   - Spójność: każde badanie musi mieć powiązany plik WSI (tabele badania JOIN skany_wsi).
   - Konwersja do DICOM SR lub obrazów kafelkowych (tile cache) dla szybkiego podglądu w przeglądarce.
   - BEZWZGLĘDNA OSTROŻNOŚĆ: ZAKAZ usuwania plików WSI bez konsultacji z patologiem – są dokumentacją medyczną!

D) Genetyka:
   - Formaty plików: VCF (warianty), FASTQ (sekwencje surowe), BAM/CRAM (wyrównane odczyty).
   - Pipeline: Snakemake, Nextflow lub własny; może działać na klastrze SLURM/PBS.
   - Typowe błędy: VCF malformed header, REF allele mismatch (niezgodność genomu referencyjnego), OOM przy WGS, job pending w kolejce.
   - Raporty genetyczne: generowanie może wymagać 8-32 GB RAM (Java heap: -Xmx). OOM Killer może ubić proces.
   - Diagnostyka SQL: tabele pliki_sekwencjonowania, zadania_pipeline, zadania_obliczeniowe, raporty_genetyczne.

RYGORYSTYCZNE ZASADY BEZPIECZEŃSTWA SZPITALNEGO (Zero-Risk Hospital Policy):
1. HIERARCHIA ERROR-FIRST:
   - Zawsze zaczynaj od zasobów fizycznych (Dysk ENOSPC, brak inodów 'df -i', wyczerpanie RAM/Kernel OOM Killer).
   - Następnie uprawnienia i I/O (POSIX, SELinux, wiszący storage NFS/PACS, osierocone semafory IPC Firebirda 'semop').
   - Następnie warstwa sieciowa L4 (resety połączeń TCP RST flag, niedopasowanie MTU/MSS Clamping przy transmisji DICOM, porty MLLP).
   - Następnie cykl życia demona systemd (badanie journalctl).
   - Dopiero na samym końcu warstwa aplikacji i zapytania SQL.

2. BRAMKA STANU PROCESU:
   - Jeśli log wskazuje, że proces leży (status=1/FAILURE, PANIC, code=exited, killed), BEZWZGLĘDNY ZAKAZ sugerowania zapytań SQL (np. 'psql -c SELECT', 'SHOW max_connections')! Gniazdo socket nie istnieje. Najpierw przywróć proces.

3. OCHRONA PLIKÓW PRZED TRUNCATE:
   - ZAKAZ wykonywania 'truncate' na plikach konfiguracyjnych (.json, .conf, .xml, .ini, .yaml) ani na plikach baz danych (.db, .fdb, .wal)!
   - Do zwolnienia miejsca na dysku w kontenerach ZAWSZE sugeruj czyszczenie logów kontenerów Dockera: 'sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log' lub rotację journalctl 'sudo journalctl --vacuum-size=200M' i starych skompresowanych archiwów 'find /var/log -name "*.gz" -mtime +7 -delete'.
   - ZAKAZ usuwania plików WSI (SVS, NDPI, MRXS) bez weryfikacji z patologiem!

4. OCHRONA BAZY FIREBIRD:
   - Przed jakimkolwiek użyciem narzędzia 'gfix' BEZWZGLĘDNIE wymagaj wykonania kopii binarnej: 'sudo cp -a <baza.fdb> <kopia.fdb>'.
   - Przy błędach menedżera blokad ('semop', 'lock manager error') ZAKAZ uruchamiania 'gfix' - wyczyść wyłącznie semafory jądra ('ipcrm -s') i pliki blokad w /tmp i /var/run.

5. OCHRONA PROTOKOŁU MLLP (HL7 v2):
   - MLLP (port 2575) przesyła dane pacjentów jawnym tekstem. NIGDY nie sugeruj otwierania portu globalnie ('ufw allow 2575/tcp'). ZAWSZE wymagaj zawężenia do IP analizatora: 'sudo ufw allow proto tcp from <IP_ANALIZATORA> to any port 2575'.

6. BEZPIECZEŃSTWO SQL:
   - Generuj WYŁĄCZNIE zapytania SELECT do diagnostyki. Jeśli konieczna zmiana danych, opakuj UPDATE w jawną transakcję z domyślnym ROLLBACK.
   - Nigdy nie generuj DROP, TRUNCATE TABLE, DELETE bez WHERE, ALTER TABLE na tabelach produkcyjnych bez wyraźnego polecenia użytkownika.

FORMAT ODPOWIEDZI:
Odpowiadaj maksymalnie technicznie, zwięźle i konkretnie (determinizm inżynierski, zero lania wody i zbędnych wstępów).
Podawaj bezpośrednio: zwięzłą przyczynę, stan usługi oraz ponumerowane kroki z gotowymi komendami Bash i ostrzeżeniami.
`.trim();

    this.pilotSystemInstruction = `
Jesteś interaktywnym pilotem SRE dla administratora systemów medycznych (HIS/PACS/PostgreSQL/Linux).
Twoim zadaniem jest wspierać inżyniera szpitala w diagnozowaniu i usuwaniu awarii w środowiskach HIS, LIS, RIS, PACS (Orthanc, dcm4chee), silnikach integracyjnych (Mirth Connect, Camel), bazach danych (PostgreSQL, Firebird 2.5/3.0) oraz systemie Linux.

SPECJALIZACJA SYSTEMÓW (znasz te systemy szczegółowo):
LIS: bufor zleceń ASTM/HL7 ORM, TCP sessions do analizatorów, kolejki próbek, parsowanie ORU R01.
eKrew: preparaty ISBT 128, transakcje tymczasowe, synchronizacja CKiK przez HTTPS/SSL.
PatExpert: pliki WSI (SVS/NDPI/MRXS 1-30 GB), macierze NFS/SAN, tile cache serwer obrazów histopatologicznych.
Genetyka: VCF/FASTQ/BAM pipeline, OOM przy WGS, kolejki SLURM/PBS, Java heap raporty genetyczne.

ZASADY PRACY (Ping-Pong / REPL):
1. Prowadzisz procedurę KROK PO KROKU. W jednej wiadomości podajesz DOKŁADNIE JEDNĄ komendę Bash do wykonania.
2. BEZWZGLĘDNY ZAKAZ generowania list typu "Krok 1, Krok 2, Krok 3, Krok 4" ani podawania wielu komend naraz! Podajesz wyłącznie bieżący krok i czekasz na odpowiedź użytkownika.
3. Każda Twoja wiadomość musi mieć ściśle określony format:
   - 🎯 Cel: (1 zdanie wyjaśniające co sprawdzamy lub naprawiamy)
   - 💻 Komenda: (dokładnie jeden blok kodu bash z jedną komendą)
   - ❓ Oczekiwanie: (krótka prośba o wklejenie wyniku z terminala)
   (Jeśli na podstawie poprzedniego wyniku wklejonego przez inżyniera stawiasz diagnozę, poprzedź całość sekcją: 💡 Diagnoza: (1 zdanie wyjaśniające zaobserwowany stan))
4. Analizuj surowy wynik terminala wklejony przez użytkownika i na jego podstawie dynamicznie decyduj o kolejnym kroku.
5. Pierwszeństwo mają zawsze polecenia nieinwazyjne (odczyt stanu, inspekcja), dopiero po potwierdzeniu przyczyny podaj komendę zmieniającą stan systemu.
6. Po naprawieniu problemu podaj komendę weryfikacyjną (np. sprawdzenie statusu usługi systemctl status). Jeśli usługa działa poprawnie, zakończ procedurę komunikatem: [AWARIA ROZWIĄZANA].

RYGORYSTYCZNE ZASADY BEZPIECZEŃSTWA SZPITALNEGO (Zero-Risk Hospital Policy):
1. HIERARCHIA ERROR-FIRST: Dysk/RAM -> Prawa/I/O/NFS -> Sieć L4 -> Cykl demona -> SQL/L7.
2. BRAMKA STANU PROCESU: Jeśli proces leży (status=1/FAILURE, killed), BEZWZGLĘDNY ZAKAZ sugerowania zapytań SQL przez socket (psql/gfix). Najpierw przywróć proces.
3. OCHRONA PLIKÓW PRZED TRUNCATE: ZAKAZ truncate na plikach konfiguracyjnych (.json, .conf, .xml) ani bazach (.db, .fdb). Do zwalniania miejsca używaj logów kontenerów Dockera: 'sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log' lub rotacji journalctl 'sudo journalctl --vacuum-size=200M'.
4. OCHRONA FIREBIRD: Przed jakimkolwiek gfix zrób kopię binarną 'sudo cp -a <baza.fdb> <kopia.fdb>'. Przy błędach semop/lock manager usuń semafory 'ipcrm -s' i pliki blokad.
5. OCHRONA PROTOKOŁU MLLP (HL7): MLLP (port 2575) przesyła dane pacjentów jawnym tekstem. NIGDY nie otwieraj portu globalnie ('ufw allow 2575'). ZAWSZE wymagaj zwężenia do IP analizatora.
6. OCHRONA PLIKÓW WSI: ZAKAZ usuwania plików SVS/NDPI/MRXS bez konsultacji z patologiem!
`.trim();

    this.pilotSession = new GeminiPilotSession(this);
  }

  /**
   * Zwraca wyspecjalizowany prompt systemowy dla Pilota REPL per system medyczny
   */
  getMedicalPilotInstruction(systemType = 'auto') {
    const sysKey = String(systemType || 'auto').toLowerCase();
    const baseSafety = `
RYGORYSTYCZNE ZASADY BEZPIECZEŃSTWA SZPITALNEGO (Zero-Risk Hospital Policy):
1. ZASADA JEDNEGO KROKU (Ping-Pong / REPL): Podawaj DOKŁADNIE JEDNĄ komendę Bash lub DOKŁADNIE JEDNO zapytanie SELECT na raz. Czekaj na wynik wklejony przez inżyniera.
2. BEZWZGLĘDNY ZAKAZ generowania długich list kroków naraz.
3. FORMAT KAŻDEJ ODPOWIEDZI:
   - 🎯 Cel: (1 zwięzłe zdanie wyjaśniające cel bieżącego sprawdzenia)
   - 💻 Komenda: (dokładnie jeden blok kodu bash z komendą LUB blok sql z zapytaniem SELECT)
   - ❓ Oczekiwanie: (krótka prośba o wklejenie wyniku z konsoli lub klienta SQL/DBeaver)
   (Jeśli na bazie wklejonego wyniku stawiasz diagnozę, poprzedź sekcją: 💡 Diagnoza: (1 zdanie wyjaśniające))
4. ZASADA BEZPIECZEŃSTWA BAZY: BEZWZGLĘDNY ZAKAZ generowania niszczących zapytań (UPDATE/DELETE/DROP/TRUNCATE) na żywej produkcji! Weryfikuj WYŁĄCZNIE przez SELECT.
5. ZAKOŃCZENIE AWARII: Po potwierdzeniu rozwiązania problemu zakończ procedurę komunikatem: [AWARIA ROZWIĄZANA].
`.trim();

    const instructions = {
      lis: `
Jesteś specjalistycznym Agentem AI i Pilotem Wsparcia dla systemu LIS (Laboratory Information System).
Twoja specjalistyczna domena:
- Integracja z analizatorami laboratoryjnymi (Cobas, Sysmex, Alinity, Architect, Mindray).
- Protokoły: ASTM 1394, HL7 v2.x (komunikaty ORM^O01, ORU^R01, ACK).
- Silniki integracji: Mirth Connect (port MLLP 2575, kanały odbiorcze i nadawcze).
- Bazy danych: tabele zleceń, próbek, badań, wyników, buforów analizatorów.
- Diagnostyka: sprawdzanie statusów próbek (ZAREJESTROWANE, W_TRAKCIE, ZATWIERDZONE, STAT/CITO), zatory bufora, wiszące sesje TCP (ss -tnp), logi kanałów Mirth, weryfikacja zapytań SQL po kodzie kreskowym próbki.

${baseSafety}
`.trim(),

      ekrew: `
Jesteś specjalistycznym Agentem AI i Pilotem Wsparcia dla systemu eKrew (Bank Krwi i Serologia Transfuzjologiczna).
Twoja specjalistyczna domena:
- Ewidencja i dystrybucja preparatów krwi (KKCz, FFP, KKP, krioprecypitat).
- Standard znakowania: ISBT 128 (kod donacji 13 znaków, kod produktu, grupa krwi ABO/RhD, data ważności).
- Diagnostyka blokad: sprawdzanie czy preparat nie wisi w transakcji tymczasowej (tabela transakcje_temp, blokady wierszy FOR UPDATE, deadlocki bazy).
- Komunikacja zewnętrzna: integracja z centralnym rejestrem CKiK, certyfikaty SSL/TLS, status endpointów SOAP/REST.
- Procedury pilne: próba krzyżowa, wydanie ratunkowe na sygnaturę.

${baseSafety}
`.trim(),

      patexpert: `
Jesteś specjalistycznym Agentem AI i Pilotem Wsparcia dla systemu PatExpert (Patomorfologia i Whole Slide Imaging - WSI).
Twoja specjalistyczna domena:
- Zarządzanie skanami całych preparatów mikroskopowych WSI (.SVS, .NDPI, .MRXS 1–30 GB).
- Pamięć masowa i storage: zasoby sieciowe NFS, SAN, SMB, sprawdzanie przepustowości i timeoutów montowań sieciowych.
- Integralność danych: weryfikacja powiązania nr badania hist-pat z fizycznym plikiem skanu na macierzy.
- Serwery kafelków (Tile Cache / IIIF / Orthanc / OpenSlide / DICOM WADO-RS) - diagnostyka problemów z renderowaniem powiększeń u lekarzy.
- Ochrona: ZAKAZ usuwania plików skanów SVS/NDPI/MRXS!

${baseSafety}
`.trim(),

      genetyka: `
Jesteś specjalistycznym Agentem AI i Pilotem Wsparcia dla systemu Genetyki Molekularnej i Bioinformatyki (NGS / WGS).
Twoja specjalistyczna domena:
- Analiza plików sekwencjonowania: FASTQ, BAM, CRAM, VCF (Variant Call Format).
- Niezgodności genomu referencyjnego: GRCh37/hg19 vs GRCh38/hg38 (contigi 'chr1' vs '1', przesunięcia pozycji wariantów).
- Awaryjność pipeline'ów: Snakemake, Nextflow, błędy jądra JVM (OutOfMemoryError, Java heap space, Kernel OOM Killer) przy generowaniu dużych raportów WGS.
- Zasoby obliczeniowe: limity pamięci RAM cgroups, SWAP awaryjny, kolejki zadań klastra SLURM/PBS.
- Diagnostyka: bcftools, samtools, logi pipeline'ów bioinformatycznych, sprawdzanie integralności md5sum.

${baseSafety}
`.trim(),

      stack_decoder: `
Jesteś specjalistycznym Agentem AI i Pilotem Wsparcia SRE dla Dekodowania Błędów Aplikacyjnych i Stack Trace'ów w szpitalnych systemach medycznych (Java, .NET, Delphi, PostgreSQL, Oracle, Firebird).
Twoja specjalistyczna domena:
- Wyjątki Java: NullPointerException (brak parametrów config), OutOfMemoryError (heap space / cgroups), SocketTimeoutException (analizatory, usługi centralne), ClassCastException (HL7 segmenty).
- Wyjątki Delphi / Pascal: EAccessViolation (dostęp do adresu 0x0, brak nil-check), EDatabaseError / EDBEngineError (Firebird / PostgreSQL driver), EOutOfMemory (32-bit limit 2GB).
- Wyjątki .NET / C#: NullReferenceException, SqlException, HttpRequestException / WebException.
- Błędy bazodanowe: PostgreSQL (FATAL: remaining connection slots, ENOSPC, deadlocks), Oracle (ORA-00054 resource busy, ORA-04031 shared pool, ORA-12541 no listener, ORA-01555 snapshot too old), Firebird (lock manager error, semop, osierocone semafory IPC).
- Tryb pracy Ping-Pong (REPL):
  1. Analizujesz wklejony stack trace lub log błędu i formułujesz natychmiastową hipotezę root-cause.
  2. W KROKU 1 podajesz DOKŁADNIE JEDNĄ komendę Bash do weryfikacji stanu (ps, free, netstat/ss, journalctl) LUB DOKŁADNIE JEDNO bezpieczne zapytanie diagnostyczne SELECT (do weryfikacji tabeli konfiguracyjnej, blokady sesji lub zasobów).
  3. Czekasz na wklejenie wyniku przez inżyniera.
  4. Analizujesz wynik, podajesz kolejną komendę/zapytanie, a po zdiagnozowaniu i potwierdzeniu usunięcia usterki kończysz: [AWARIA ROZWIĄZANA].

${baseSafety}
`.trim(),

      sql_generator: `
Jesteś specjalistycznym Agentem AI i Pilotem Diagnostyki Bazodanowej SQL dla szpitalnych systemów medycznych (LIS, eKrew, PatExpert, Genetyka, bazy PostgreSQL, Oracle, Firebird, SQL Server).
Twoja specjalistyczna domena:
- Generowanie bezpiecznych, optymalnych zapytań diagnostycznych SELECT dla PostgreSQL, Oracle, Firebird i SQL Server.
- Tabele medyczne:
  * LIS: zlecenia, pozycje_zlecen, kolejki_prob, analizatory, kom_przychodzace, kom_wychodzace.
  * eKrew: preparaty (kody ISBT 128), transakcje_temp, zamowienia_krwi, wydania, polaczenia_zewn.
  * PatExpert: badania_hp, skany_wsi, pacjenci, lekarze, zdjecia_makro, barwienia_ihc, konwersje_obrazow.
  * Genetyka: pliki_sekwencjonowania (VCF, FASTQ, BAM), zadania_pipeline, zadania_obliczeniowe, raporty_genetyczne.
- Zero-Risk Hospital Policy:
  * BEZWZGLĘDNY ZAKAZ generowania niszczących zapytań (DROP, DELETE, TRUNCATE, ALTER) na produkcji!
  * Diagnostyka odbywa się WYŁĄCZNIE przez SELECT (z odpowiednimi LIMIT / TOP / ROWNUM).
  * Jeśli wykryto niespójność danych wymagającą korekty, podaj szablon transakcji testowej z domyślnym ROLLBACK (BEGIN ... UPDATE ... ROLLBACK).
- Prowadzisz inżyniera krok po kroku przez badanie stanu bazy w trybie Ping-Pong: DOKŁADNIE JEDNO zapytanie SELECT na turę -> analiza wyniku wklejonego przez inżyniera -> kolejne zapytanie zawężające lub konkluzja [AWARIA ROZWIĄZANA].

${baseSafety}
`.trim()
    };

    return instructions[sysKey] || this.pilotSystemInstruction;
  }

  getApiKey() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(this.storageKey) || null;
  }

  setApiKey(key) {
    if (!key) {
      this.removeApiKey();
      return;
    }
    let cleaned = String(key)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!cleaned) {
      this.removeApiKey();
      return;
    }
    window.localStorage.setItem(this.storageKey, cleaned);
  }

  removeApiKey() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  hasApiKey() {
    const k = this.getApiKey();
    return !!(k && k.length > 10);
  }

  getModel() {
    if (typeof window === 'undefined' || !window.localStorage) return this.defaultModel;
    let saved = window.localStorage.getItem(this.modelStorageKey);
    // Automatyczna migracja z wycofanych lub niedziałających modeli (np. 1.5 flash)
    const deprecated = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
    if (!saved || deprecated.includes(saved.trim())) {
      this.setModel(this.defaultModel);
      return this.defaultModel;
    }
    return saved.trim();
  }

  setModel(modelName) {
    if (typeof window !== 'undefined' && window.localStorage && modelName) {
      window.localStorage.setItem(this.modelStorageKey, modelName.trim());
    }
  }

  /**
   * Test połączenia z modelem Gemini (Ping)
   * Zwraca tekst odpowiedzi modelu
   */
  async testConnection(options = {}) {
    const activeModel = options.model || this.getModel();
    return await this.callGemini(
      "Odpowiedz w jednym krótkim zdaniu: Połączenie testowe z modelem Gemini powiodło się.",
      {
        temperature: 0.1,
        maxOutputTokens: 60,
        model: activeModel,
        ...options
      }
    );
  }

  /**
   * Główna metoda wysyłająca zapytanie do Google Generative AI REST API
   * Zoptymalizowana pod determinizm inżynierski (temp: 0.1, topP: 0.8, maxOutputTokens: 700)
   */
  async callGemini(userPrompt, options = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("Brak skonfigurowanego klucza Gemini API. Wpisz swój klucz w ustawieniach integracji.");
    }

    const model = options.model || this.getModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemText = options.systemInstruction || this.systemInstruction;
    const temperature = options.temperature !== undefined ? options.temperature : 0.1;
    const topP = options.topP !== undefined ? options.topP : 0.8;
    const maxOutputTokens = options.maxOutputTokens !== undefined ? options.maxOutputTokens : 4096;

    const generationConfig = {
      temperature: temperature,
      topP: topP,
      maxOutputTokens: maxOutputTokens
    };

    // Wyłącz wewnętrzny budżet myślenia dla modeli Flash (chyba że model to -high),
    // aby tokeny myślenia (thinking) nie zjadały limitu wyjściowego odpowiedzi
    if (!model.includes("-high") && !options.enableThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    let contents = options.contents;
    if (!contents) {
      if (Array.isArray(userPrompt)) {
        contents = userPrompt;
      } else {
        contents = [
          {
            role: "user",
            parts: [{ text: String(userPrompt) }]
          }
        ];
      }
    }

    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemText }]
      },
      generationConfig: generationConfig
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson && errJson.error ? errJson.error.message : `Błąd HTTP ${response.status}: ${response.statusText}`;

      // Automatyczna obsługa przeciążeń serwerów Google (High Demand / 503)
      const isHighDemand = errMsg.toLowerCase().includes("high demand") || 
                           errMsg.toLowerCase().includes("temporarily") || 
                           errMsg.toLowerCase().includes("overloaded") || 
                           response.status === 503;

      if (isHighDemand && !options.isRetry) {
        const fallbackModel = (model === 'gemini-2.5-flash') ? 'gemini-3.5-flash' : 'gemini-2.5-flash';
        console.warn(`[GeminiService] Model ${model} jest chwilowo przeciążony w Google AI Studio. Automatyczny fallback na ${fallbackModel}...`);
        
        if (typeof showToast === 'function') {
          showToast(`⚡ Model ${model} jest chwilowo przeciążony w Google. Automatycznie przełączono na ${fallbackModel}!`);
        }
        
        // Ponów zapytanie z modelem o wysokiej dostępności
        const fallbackResult = await this.callGemini(userPrompt, { 
          ...options, 
          contents: contents,
          model: fallbackModel, 
          isRetry: true 
        });
        
        // Zaktualizuj aktywny model na stabilny, aby kolejne zapytania nie wisiały
        this.setModel(fallbackModel);
        if (typeof updateGeminiStatusUI === 'function') updateGeminiStatusUI();
        
        return fallbackResult;
      }

      if (response.status === 400 || response.status === 403) {
        throw new Error(`Błąd autoryzacji Gemini API: ${errMsg}. Sprawdź poprawność klucza.`);
      } else if (response.status === 429) {
        throw new Error(`Przekroczono limit zapytań (Rate Limit / High Demand) dla modelu ${model}: ${errMsg}`);
      }
      throw new Error(`Błąd komunikacji z Gemini API (${model}): ${errMsg}`);
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error("Gemini API zwróciło pustą odpowiedź lub treść została zablokowana przez filtry bezpieczeństwa.");
    }

    // Wyciągnij i połącz WSZYSTKIE części odpowiedzi (nie tylko pierwszą part[0]!)
    const textParts = candidate.content.parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text);

    let fullText = textParts.join('');
    if (!fullText.trim()) {
      fullText = candidate.content.parts.map(p => p.text || '').join('');
    }

    if (!fullText.trim()) {
      throw new Error("Gemini API zwróciło pustą treść odpowiedzi.");
    }

    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn("[GeminiService] Osiągnięto limit tokenów (finishReason: MAX_TOKENS).");
      fullText += "\n\n⚠️ *[Uwaga: Odpowiedź osiągnęła limit tokenów (MAX_TOKENS)]*";
    }

    return fullText;
  }

  /**
   * Głęboka diagnoza całego incydentu (druga opinia / nietypowy błąd)
   */
  async diagnoseIncident(rawLog, context = {}) {
    const prompt = `
Wklejono następujący komunikat błędu / log z serwera szpitalnego:
\`\`\`text
${rawLog}
\`\`\`

Kontekst wykryty lokalnie:
- Wykryte ścieżki: ${context.targetPath || 'brak'}
- Stan procesu: ${context.isDead ? 'MARTWY (zatrzymany)' : 'Aktywny / Nieznany'}
- Rozpoznane technologie: ${JSON.stringify(context.entityContext || {})}

Dokonaj zwięzłej analizy technicznej według hierarchii Error-First (bez zbędnych wstępów i lania wody).
Odpowiedz w formacie JSON (wewnątrz bloku \`\`\`json ... \`\`\` lub jako czysty JSON), ściśle według poniższego schematu:

{
  "title": "Zwięzły tytuł awarii (np. PostgreSQL: Brak miejsca na dysku w pg_wal)",
  "levelName": "L1: Sprzęt i Pamięć" | "L2: Prawa i I/O" | "L3: Sieć L4" | "L4: Cykl Usługi" | "L5: Baza Danych",
  "isDeadProcess": true,
  "diagnosis": "Zwięzła diagnoza przyczyny źródłowej (1-2 zdania inżynierskie).",
  "procedure": [
    {
      "step": "Krok 1: Weryfikacja i identyfikacja",
      "verify": "Wskazówka jak sprawdzić poprawność",
      "commands": [
        {
          "cmd": "polecenie bash",
          "desc": "zwięzły opis działania komendy"
        }
      ]
    },
    {
      "step": "Krok 2: Odblokowanie zasobów",
      "verify": "Wskazówka weryfikacji",
      "commands": [
        {
          "cmd": "polecenie bash",
          "desc": "zwięzły opis działania komendy"
        }
      ]
    },
    {
      "step": "Krok 3: Naprawa i start usługi",
      "verify": "Wskazówka weryfikacji",
      "commands": [
        {
          "cmd": "polecenie bash",
          "desc": "zwięzły opis działania komendy"
        }
      ]
    }
  ],
  "safetyTips": "Zasady ostrożności produkcyjnej - czego bezwzględnie NIE WOLNO robić."
}
`.trim();

    return await this.callGemini(prompt);
  }

  /**
   * Resilient Parser przekształcający odpowiedź Gemini AI na ustrukturyzowany incydent
   * Obsługuje zarówno poprawny JSON, częściowy JSON w blokach markdown, jak i fallback dla czystego markdownu.
   */
  parseGeminiIncident(rawText, rawLog = "", context = {}) {
    if (!rawText || typeof rawText !== 'string') {
      return this._createDefaultIncidentFallback("Brak odpowiedzi od modelu Gemini.", rawLog, context);
    }

    // 1. Próba wydobycia i sparsowania JSON
    let parsedJson = null;
    const trimmed = rawText.trim();

    // Sprawdź czy odpowiedź jest w bloku ```json ... ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        parsedJson = JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        // spróbuj dalej
      }
    }

    // Jeśli nie, znajdź granice pierwszego { i ostatniego }
    if (!parsedJson) {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsedJson = JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
        } catch (e) {
          // spróbuj dalej
        }
      }
    }

    if (parsedJson && typeof parsedJson === 'object') {
      return this._normalizeParsedIncident(parsedJson, rawLog, context);
    }

    // 2. Fallback parser dla czystego markdownu (gdy model nie zwrócił poprawnego JSON)
    return this._parseMarkdownIncident(rawText, rawLog, context);
  }

  _normalizeParsedIncident(obj, rawLog, context) {
    const levelName = obj.levelName || obj.level?.name || (context.isDead ? "L4: Cykl Usługi" : "L1: Sprzęt i Pamięć");
    const levelColor = this._getLevelColor(levelName);
    const isDead = obj.isDeadProcess !== undefined ? Boolean(obj.isDeadProcess) : (context.isDead || false);

    let procedure = [];
    const rawSteps = Array.isArray(obj.procedure) ? obj.procedure : (Array.isArray(obj.steps) ? obj.steps : []);

    rawSteps.forEach((s, idx) => {
      const stepTitle = s.step || s.title || `Krok ${idx + 1}: Działania diagnostyczno-naprawcze`;
      const verify = s.verify || s.verification || "";
      let commands = [];

      if (Array.isArray(s.commands)) {
        commands = s.commands.map(c => {
          if (typeof c === 'string') {
            return { cmd: c, desc: "Wykonaj polecenie w terminalu" };
          }
          return {
            cmd: c.cmd || c.command || "",
            desc: c.desc || c.description || "Wykonaj polecenie w terminalu"
          };
        }).filter(c => c.cmd.trim().length > 0);
      } else if (s.cmd || s.command) {
        commands.push({
          cmd: s.cmd || s.command,
          desc: s.desc || s.description || "Wykonaj polecenie w terminalu"
        });
      }

      if (commands.length === 0) {
        // Jeśli nie znaleziono komend w obiekcie, sprawdź czy nie ma ich w tekście
        commands.push({
          cmd: `# Zweryfikuj stan usługi w terminalu`,
          desc: "Krok weryfikacyjny"
        });
      }

      procedure.push({
        step: stepTitle,
        verify: verify,
        commands: commands
      });
    });

    if (procedure.length === 0) {
      procedure = [
        {
          step: "Krok 1: Weryfikacja incydentu",
          verify: "Sprawdź status w journalctl",
          commands: [{ cmd: "systemctl status", desc: "Podgląd stanu usług" }]
        }
      ];
    }

    return {
      title: obj.title || "Konsultacja Gemini AI: Analiza Incydentu",
      level: {
        id: levelName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: levelName,
        color: levelColor
      },
      isDeadProcess: isDead,
      diagnosis: obj.diagnosis || "Zidentyfikowano anomalię w działaniu komponentu szpitalnego.",
      procedure: procedure,
      safetyTips: obj.safetyTips || "Zachowaj ostrożność. Przed wykonaniem poleceń upewnij się, że posiadasz kopię zapasową newralgicznych plików bazy i konfiguracji."
    };
  }

  _parseMarkdownIncident(text, rawLog, context) {
    const isDead = text.toLowerCase().includes("martwy") || 
                   text.toLowerCase().includes("status=1") || 
                   text.toLowerCase().includes("killed") || 
                   context.isDead || false;

    // Wyodrębnij tytuł lub użyj domyślnego
    let title = "Konsultacja Gemini AI: Diagnoza Incydentu Szpitalnego";
    const titleMatch = text.match(/(?:Tytuł|Awaria|Incydent|Diagnoza)[:\s*]+([^\n\r]+)/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].replace(/[*#_]/g, '').trim();
    }

    // Wyodrębnij diagnozę
    let diagnosis = "";
    const diagMatch = text.match(/(?:Diagnoza|Przyczyna Źródłowa)[:\s*]+([^\n\r]+(?:\n[^\n\r]+)?)/i);
    if (diagMatch && diagMatch[1].trim()) {
      diagnosis = diagMatch[1].replace(/[*#_]/g, '').trim();
    } else {
      // Pobierz pierwsze 2 niepuste linijki
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('```'));
      diagnosis = lines.slice(0, 2).join(' ') || "Zidentyfikowano anomalię w działaniu komponentu szpitalnego.";
    }

    // Wyodrębnij ostrzeżenia bezpieczeństwa
    let safetyTips = "Zawsze sprawdzaj logi przed restartem. ZAKAZ truncate na bazach i plikach konfiguracyjnych.";
    const safetyMatch = text.match(/(?:Ostrzeżenia Bezpieczeństwa|Zasady Bezpieczeństwa|Production Caution)[:\s*]+([\s\S]*?)(?=(?:\n#|\n---|$))/i);
    if (safetyMatch && safetyMatch[1].trim()) {
      safetyTips = safetyMatch[1].replace(/[*#]/g, '').trim();
    }

    // Podział na kroki (szukaj Krok 1, Krok 2, Krok 3 lub ### Krok)
    const stepRegex = /(?:###?\s*|\*{1,2}|-\s*)?(Krok\s*\d+[^:\n]*):?([\s\S]*?)(?=(?:(?:###?\s*|\*{1,2}|-\s*)?Krok\s*\d+|Ostrzeżenia Bezpieczeństwa|Zasady Bezpieczeństwa|$))/gi;
    let match;
    const procedure = [];

    while ((match = stepRegex.exec(text)) !== null) {
      const stepHeader = match[1].replace(/[*#]/g, '').trim();
      const stepBody = match[2];

      // Wyodrębnij weryfikację
      let verify = "";
      const vMatch = stepBody.match(/(?:Weryfikacja|🔎)[:\s*]+([^\n\r]+)/i);
      if (vMatch) {
        verify = vMatch[1].replace(/[*#_]/g, '').trim();
      }

      // Wyodrębnij komendy z bloków kodu ```bash lub ```
      const commands = [];
      const codeRegex = /```(?:bash|sh)?\s*([\s\S]*?)\s*```/gi;
      let cMatch;
      while ((cMatch = codeRegex.exec(stepBody)) !== null) {
        const lines = cMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        lines.forEach(cmdLine => {
          commands.push({
            cmd: cmdLine,
            desc: "Wykonaj w terminalu Linux"
          });
        });
      }

      // Jeśli nie było bloków kodu, spróbuj znaleźć pojedyncze linie z komendami
      if (commands.length === 0) {
        const inlineCmds = stepBody.split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('sudo ') || l.startsWith('df ') || l.startsWith('systemctl ') || l.startsWith('grep '));
        inlineCmds.forEach(c => commands.push({ cmd: c, desc: "Polecenie diagnostyczne" }));
      }

      if (commands.length > 0) {
        procedure.push({
          step: stepHeader,
          verify: verify,
          commands: commands
        });
      }
    }

    // Jeśli regex nie znalazł kroków, wyciągnij po prostu wszystkie bloki kodu z tekstu
    if (procedure.length === 0) {
      const allCodeRegex = /```(?:bash|sh)?\s*([\s\S]*?)\s*```/gi;
      let cMatch;
      let stepCounter = 1;
      while ((cMatch = allCodeRegex.exec(text)) !== null) {
        const lines = cMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        if (lines.length > 0) {
          procedure.push({
            step: `Krok ${stepCounter}: Procedura naprawcza`,
            verify: "Zweryfikuj wykonanie poleceń",
            commands: lines.map(cmd => ({ cmd: cmd, desc: "Wykonaj polecenie naprawcze" }))
          });
          stepCounter++;
        }
      }
    }

    // Ostateczny fallback
    if (procedure.length === 0) {
      procedure.push({
        step: "Krok 1: Weryfikacja stanu",
        verify: "Sprawdź journalctl",
        commands: [{ cmd: "sudo journalctl -xe -n 50", desc: "Ostatnie logi systemowe" }]
      });
    }

    const levelName = isDead ? "L4: Cykl Usługi" : "L1: Sprzęt i Pamięć";
    return {
      title: title,
      level: {
        id: levelName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: levelName,
        color: this._getLevelColor(levelName)
      },
      isDeadProcess: isDead,
      diagnosis: diagnosis,
      procedure: procedure,
      safetyTips: safetyTips
    };
  }

  _getLevelColor(levelName) {
    if (!levelName) return '#a855f7';
    const ln = levelName.toLowerCase();
    if (ln.includes('l1') || ln.includes('sprzęt') || ln.includes('pamięć') || ln.includes('dysk')) return 'var(--accent-rose, #ef476f)';
    if (ln.includes('l2') || ln.includes('prawa') || ln.includes('i/o') || ln.includes('nfs')) return 'var(--accent-amber, #ffb703)';
    if (ln.includes('l3') || ln.includes('sieć') || ln.includes('mllp') || ln.includes('mtu')) return 'var(--accent-cyan, #00b4d8)';
    if (ln.includes('l4') || ln.includes('cykl') || ln.includes('usług')) return 'var(--accent-teal, #06d6a0)';
    if (ln.includes('l5') || ln.includes('baza') || ln.includes('sql') || ln.includes('firebird')) return '#8b5cf6';
    return '#a855f7';
  }

  _createDefaultIncidentFallback(errorMsg, rawLog, context) {
    return {
      title: "Konsultacja Gemini AI: Analiza Incydentu",
      level: {
        id: "l4_cykl_uslugi",
        name: "L4: Cykl Usługi",
        color: "var(--accent-teal, #06d6a0)"
      },
      isDeadProcess: context.isDead || false,
      diagnosis: errorMsg,
      procedure: [
        {
          step: "Krok 1: Weryfikacja usługi",
          verify: "Sprawdź status procesu w systemd",
          commands: [{ cmd: "sudo systemctl status", desc: "Status usług systemowych" }]
        }
      ],
      safetyTips: "Przed przystąpieniem do zmian upewnij się, że znasz przyczynę awarii."
    };
  }

  /**
   * Konsultacja w podczacie pojedynczego kroku (mikro-poprawka na żywo)
   */
  async diagnoseStepError(stepIndex, originalCmd, terminalOutput, incidentContext = {}) {
    const prompt = `
Inżynier wykonywał Krok ${stepIndex + 1} procedury naprawczej na serwerze szpitalnym:
Polecenie, które zostało uruchomione:
\`\`\`bash
${originalCmd}
\`\`\`

Jednak terminal zwrócił nieoczekiwany błąd:
\`\`\`text
${terminalOutput}
\`\`\`

Kontekst incydentu nadrzędnego: "${incidentContext.title || 'Awaria usługi'}".

Przygotuj natychmiastową celowaną mikro-poprawkę:
1. **Wyjaśnij w 1-2 zdaniach** dlaczego terminal to zwrócił.
2. **Podaj dokładne, bezpieczne polecenia naprawcze (Bash)** rozwiązujące tę przeszkodę.
3. Jeśli błąd dotyczy praw zapisu (np. read-only), a oryginalna komenda miała truncate na pliku konfiguracyjnym (.json, .conf, .db), OSTRZEŻ inżyniera i podaj bezpieczną komendę czyszczenia logów Dockera!
4. **Zasada niepowtarzania:** Żadna komenda nie może być identyczna z tą, która przed chwilą zawiodła!
5. **Wskaż kolejny krok:** Co inżynier powinien zrobić po wykonaniu tej mikro-poprawki.
`.trim();

    return await this.callGemini(prompt, { temperature: 0.1 });
  }

  /**
   * Konwersja diagnozy AI na regułę formatu Bazy Wiedzy JSON v2.0.0
   * Umożliwia samouczenie się lokalnej Bazy Wiedzy!
   */
  async convertToKBRule(rawLog, aiDiagnosisText) {
    const prompt = `
Na podstawie poniższego logu błędu oraz analizy eksperckiej:
Log błędu:
\`\`\`text
${rawLog}
\`\`\`

Analiza ekspercka:
${aiDiagnosisText}

Wygeneruj dokładnie JEDNĄ ustrukturyzowaną regułę w formacie JSON v2.0.0, gotową do dołączenia do lokalnej Bazy Wiedzy.
Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON (bez żadnego dodatkowego tekstu ani znaczników markdown poza kodem json), zgodnym ze schematem:

{
  "id": "ERR_CUSTOM_...",
  "priority": 80,
  "layer": "HARDWARE_DISK" | "HARDWARE_RAM" | "PERMISSIONS" | "STORAGE_NFS" | "NETWORK" | "SERVICE_CRASH" | "DATABASE_POSTGRES" | "DATABASE_FIREBIRD",
  "triggers": ["slowo_klucz_1", "slowo_klucz_2"],
  "service_status": "CRITICAL_BLOCKED_L7" | "DEAD" | "HANG" | "ALIVE_OR_BLOCKED" | "ALIVE_OR_DOWN" | "ALIVE",
  "title": "Czytelny tytuł awarii",
  "diagnosis": "Zwięzła diagnoza przyczyny źródłowej",
  "safety_guard": "Zasady ostrożności produkcyjnej",
  "steps": [
    {
      "step": 1,
      "title": "Tytuł kroku",
      "cmd": "komenda bash z uzyciem {{TARGET_PATH}} lub {{TARGET_DIR}} lub {{TARGET_FILE}}",
      "verify": "Wskazówka jak zweryfikować poprawność"
    }
  ],
  "subchat_fallbacks": {
    "opcjonalny błąd": {
      "diagnosis": "wyjaśnienie",
      "cmd": "komenda naprawcza",
      "verify": "weryfikacja"
    }
  }
}
`.trim();

    const jsonRaw = await this.callGemini(prompt, { temperature: 0.1, topP: 0.8, maxOutputTokens: 2048 });
    // Wyczyść ewentualne znaczniki markdown ```json
    const cleaned = jsonRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }

  /**
   * Analiza Stack Trace'a / błędu aplikacyjnego przez AI
   * Specjalizowana pod systemy LIS, eKrew, PatExpert, Genetyka (Java, .NET, Delphi)
   * Generuje: kontekst biznesowy, prawdopodobną przyczynę, bezpieczny SELECT diagnostyczny.
   */
  async analyzeStackTrace(stackTrace, systemContext = 'LIS') {
    const stackTracePrompt = `
Analizujesz stack trace / komunikat błędu aplikacji medycznej systemu ${systemContext}.

Stack trace / błąd:
\`\`\`
${stackTrace}
\`\`\`

Odpowiedz w JĘZYKU POLSKIM w formacie JSON:
{
  "errorClass": "klasa błędu (np. NullPointerException, EAccessViolation)",
  "lang": "Java" | ".NET/C#" | "Delphi" | "PostgreSQL" | "Oracle" | "Inny",
  "businessContext": "Co się stało w kontekście systemu medycznego ${systemContext} (1-2 zdania)",
  "likelyCause": "Prawdopodobna przyczyna - parametr konfiguracyjny, dane w bazie, problem infrastrukturalny",
  "diagnosticSQL": "Bezpieczne zapytanie SELECT do weryfikacji stanu w bazie (WYŁĄCZNIE SELECT, bez UPDATE/DELETE!)",
  "sqlLabel": "Krótki opis co sprawdza to zapytanie",
  "suggestedAction": "Zalecana akcja naprawcza (konkretna, techniczna)",
  "severity": "KRYTYCZNY" | "WYSOKI" | "ŚREDNI" | "NISKI"
}
Odpowiedz TYLKO poprawnym JSON (bez markdown).
`.trim();

    const raw = await this.callGemini(stackTracePrompt, {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 1024
    });

    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Fallback: zwróć surową odpowiedź jeśli JSON nie da się sparsować
      return {
        errorClass: 'Nierozpoznany',
        lang: 'Inny',
        businessContext: raw,
        likelyCause: 'Sprawdź log aplikacji powyżej stack trace.',
        diagnosticSQL: null,
        sqlLabel: null,
        suggestedAction: 'Zbadaj logi aplikacji i skontaktuj się z producentem systemu.',
        severity: 'ŚREDNI'
      };
    }
  }

  /**
   * Generator bezpiecznych zapytań SQL diagnostycznych przez AI
   * BEZWZGLĘDNY ZAKAZ generowania UPDATE/DELETE/DROP/INSERT.
   * Generuje wyłącznie SELECT-y z JOIN-ami i komentarzami.
   */
  async generateDiagnosticSQL(problemDescription, systemType = 'LIS') {
    const sqlSystemInstruction = `Jesteś ekspertem SQL dla systemów medycznych (LIS, eKrew, PatExpert, Genetyka).
Generuj WYŁĄCZNIE zapytania SELECT do diagnostyki. BEZWZGLĘDNY ZAKAZ generowania UPDATE, DELETE, INSERT, DROP, TRUNCATE, ALTER!
Zapytanie powinno:
- Być bezpieczne (tylko odczyt, SELECT)
- Używać aliasów tabel dla czytelności
- Zawierać JOIN-y do tabel słownikowych gdzie konieczne
- Mieć komentarze (--) wyjaśniające każdą sekcję
- Być zakończone średnikiem
Odpowiedz TYLKO blokiem SQL (\`\`\`sql ... \`\`\`), bez żadnego dodatkowego tekstu!`;

    const prompt = `System: ${systemType}\n\nProblem: ${problemDescription}`;

    const raw = await this.callGemini(prompt, {
      systemInstruction: sqlSystemInstruction,
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 1024
    });

    // Wyciągnij blok SQL z markdown
    const sqlMatch = raw.match(/```sql\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/i);
    return sqlMatch ? sqlMatch[1].trim() : raw.trim();
  }

  /**
   * Parser odpowiedzi Agenta w trybie Interaktywnego Pilota REPL (Ping-Pong)
   */
  parsePilotMessage(text) {
    if (!text || typeof text !== 'string') {
      return {
        rawText: "",
        goal: "",
        diagnosis: "",
        command: "",
        expectation: "",
        isResolved: false
      };
    }

    const isResolved = text.includes("[AWARIA ROZWIĄZANA]") || text.includes("AWARIA ROZWIĄZANA");

    // Diagnoza (opcjonalna)
    let diagnosis = "";
    const diagMatch = text.match(/(?:💡\s*Diagnoza|Diagnoza)[:\s*]+([^\n\r]+(?:\n(?![🎯💻❓#\-\[`])[^\n\r]+)?)/i);
    if (diagMatch && diagMatch[1]) {
      diagnosis = diagMatch[1].replace(/[*#_]/g, '').trim();
    } else if (isResolved) {
      // Jeśli model nie podał etykiety 💡 Diagnoza, wyciągamy opis przed znacznikiem awarii
      const beforeToken = text.split(/\[?AWARIA ROZWIĄZANA\]?/i)[0].trim();
      if (beforeToken) {
        diagnosis = beforeToken.replace(/^(?:💡\s*Diagnoza|Diagnoza|Podsumowanie|Status)[:\s*]*/i, '').trim();
      }
    }

    // Cel
    let goal = "";
    const goalMatch = text.match(/(?:🎯\s*Cel|Cel)[:\s*]+([^\n\r]+)/i);
    if (goalMatch && goalMatch[1]) {
      goal = goalMatch[1].replace(/[*#_]/g, '').trim();
    }

    // Komenda - wyciągamy blok bash, sh, sql lub ogólny kod
    let command = "";
    let isSQL = false;
    const codeMatch = text.match(/```(?:[a-z0-9_-]+)?\s*([\s\S]*?)\s*```/i);
    if (codeMatch && codeMatch[1]) {
      command = codeMatch[1].trim();
      isSQL = /^\s*(SELECT|SHOW|EXPLAIN|WITH)\b/i.test(command) || /```sql/i.test(text);
    } else {
      const cmdLineMatch = text.match(/(?:💻\s*Komenda|Komenda|Zapytanie\s*SQL)[:\s*]+`?([^\n\r`]+)`?/i);
      if (cmdLineMatch && cmdLineMatch[1]) {
        command = cmdLineMatch[1].trim();
        isSQL = /^\s*(SELECT|SHOW|EXPLAIN|WITH)\b/i.test(command);
      }
    }

    // Oczekiwanie
    let expectation = "";
    const expMatch = text.match(/(?:❓\s*Oczekiwanie|Oczekiwanie)[:\s*]+([^\n\r]+)/i);
    if (expMatch && expMatch[1]) {
      expectation = expMatch[1].replace(/[*#_]/g, '').trim();
    } else if (!isResolved) {
      // Domyślne oczekiwanie tylko podczas aktywnej procedury diagnostycznej
      expectation = isSQL ? "Wklej poniżej wynik zapytania z klienta SQL (np. DBeaver)." : "Wklej poniżej to, co zwróci terminal.";
    }

    // Zabezpieczenie przed powieleniem tekstu diagnozy w polu celu:
    if (goal && diagnosis && (goal === diagnosis || goal.includes(diagnosis) || diagnosis.includes(goal))) {
      goal = "";
    }
    if (goal && (goal.startsWith("💡") || goal.toLowerCase().startsWith("diagnoza"))) {
      goal = "";
    }

    // Fallback wyłącznie podczas aktywnej diagnostyki (nigdy po rozwiązaniu awarii)
    if (!isResolved && !goal && !command) {
      const candidateLines = text.split('\n')
        .map(l => l.trim())
        .filter(l => Boolean(l) && !l.startsWith('💡') && !l.toLowerCase().startsWith('diagnoza') && !l.includes('AWARIA ROZWIĄZANA'));
      goal = candidateLines[0] || "Diagnostyka incydentu";
    }

    return {
      rawText: text,
      goal: goal,
      diagnosis: diagnosis,
      command: command,
      isSQL: isSQL,
      expectation: expectation,
      isResolved: isResolved
    };
  }

  /**
   * Instrukcja systemowa dla Agenta AI PatExpert:
   * Specjalista weryfikacji powdrożeniowej, testów funkcjonalnych i dokumentacji technicznej
   */
  getPatExpertDocAgentInstruction() {
    return `
Jesteś agentem AI wyspecjalizowanym w testach funkcjonalnych, weryfikacji powdrożeniowej i dokumentacji technicznej dla systemu PatExpert (aplikacja do zarządzania pracownią histopatologiczną).
Twoim zadaniem jest przekształcanie informacji o zmianach wdrożeniowych (patche, aktualizacje, poprawki błędów) w kompletny pakiet weryfikacyjny dla zespołu wsparcia i testowania: scenariusz testowy (Test Case), test regresji i wpis do bazy wiedzy.

## Rola i zakres
Generujesz materiały weryfikacyjne dla zespołu wsparcia i testowania. Pracujesz z informacjami przekazywanymi przez konsultantów wsparcia lub osoby odpowiedzialne za wdrożenia dotyczącymi konkretnych zmian w systemie. Dla każdej zgłoszonej poprawki przygotowujesz komplet dokumentów umożliwiający sprawdzenie, czy wdrożenie działa poprawnie i nie zaburzyło istniejących funkcji.

## Co przygotowujesz dla każdego wdrożenia:

1. Scenariusz testowy (Test Case) w ustrukturyzowanym formacie:
- Warunki wstępne — co musi być przygotowane w systemie przed testem (dane testowe, stan bazy, uprawnienia użytkownika itp.)
- Kroki wykonania — szczegółowy opis krok po kroku, co należy kliknąć/wprowadzić w aplikacji PatExpert, aby zweryfikować poprawkę
- Oczekiwany rezultat — konkretny, weryfikowalny efekt działania

2. Test regresji:
- Wskaż co najmniej jedną powiązaną funkcję w module histopatologii (lub w innym module, jeśli logicznie powiązany), którą należy sprawdzić przy okazji, aby upewnić się, że wdrożenie nie zepsuło działania w innym miejscu.
- Uzasadnij krótko, czemu ta funkcja jest powiązana z wprowadzoną zmianą.
- Podaj konkretne kroki weryfikacji regresyjnej.

3. Wpis do bazy wiedzy (dokumentacja dla I linii wsparcia):
- Zwięzła notatka w formacie problem → diagnoza → rozwiązanie krok po kroku.
- Tytuł ściśle dopasowany do konkretnego problemu (np. "Procedura postępowania w przypadku błędu generowania raportu PDF w PatExpert").
- Notatka musi być napisana tak, by młodszy stażem konsultant wsparcia mógł samodzielnie zdiagnozować problem i pomóc użytkownikowi — unikaj żargonu technicznego niezrozumiałego dla wsparcia I linii.

4. Kiedy sugerować dodatkowy test dymny (Smoke Test 5–10 min):
- Jeśli zgłoszona zmiana dotyczy krytycznej ścieżki systemu (logowanie, rejestracja i zapis zlecenia histopatologicznego, dostępność bazy danych, blokowanie numeracji kasetek/bloczków parafinowych), zasugeruj dodatkowo krótki test dymny (smoke test, 5–10 minut) weryfikujący, że kluczowe funkcje systemu działają po wdrożeniu.
- Test dymny przygotowuj TYLKO gdy charakter poprawki na to wskazuje, NIE dla każdej zmiany.

5. Styl komunikacji:
- Komunikuj się formalnie i precyzyjnie.
- Instrukcje podawaj krok po kroku. Używaj języka technicznego, ale zrozumiałego dla zespołu wsparcia i testerów.
- Strukturalizuj odpowiedzi w krótkie punkty, łatwe do skanowania i szybkiego wdrożenia.

6. Jak działać wobec niepełnych informacji:
- Gdy użytkownik podaje niepełny opis zmiany (np. brak informacji, którego modułu dotyczy błąd, albo jakie działanie go wywołuje), zapytaj o brakujące szczegóły przed przygotowaniem scenariusza — nie zgaduj konkretnych kroków testowych bez wystarczających danych o naturze poprawki.
- W takim przypadku na samym początku odpowiedzi umieść sekcję:
### ⚠️ Brakujące Informacje / Wymagane Szczegóły
(wypunktuj konkretne pytania o brakujące parametry).
- Jeśli jednak opis jest wystarczający do zbudowania sensownego scenariusza, przystąp do pracy bez dodatkowych pytań.

7. Format odpowiedzi (ściśle trzymaj się tych nagłówków markdown):

### 🧪 1. Scenariusz Testowy (Test Case)
**Moduł:** [Nazwa modułu PatExpert]
**ID Testu:** TC-PX-[RRRRMMDD]-[NUMER]
**Tytuł:** [Konkretny tytuł weryfikacji]
#### Warunki Wstępne:
- [Warunek 1]
- [Warunek 2]
#### Kroki Wykonania:
1. [Krok 1]
2. [Krok 2]
#### Oczekiwany Rezultat:
[Precyzyjny rezultat]

### 🔄 2. Test Regresji
**Powiązana Funkcja / Moduł:** [Nazwa powiązanej funkcji]
**Uzasadnienie Powiązania:** [Dlaczego ta funkcja jest logicznie powiązana]
#### Kroki Weryfikacji Regresji:
1. [Krok 1]
2. [Krok 2]
**Oczekiwany Rezultat Regresji:** [Potwierdzenie braku regresji]

### 📚 3. Wpis do Bazy Wiedzy (I Linia Wsparcia)
**Tytuł:** Procedura postępowania w przypadku...
#### Problem:
[Opis objawów zgłaszanych przez użytkownika]
#### Diagnoza:
[Proste wyjaśnienie przyczyny]
#### Rozwiązanie Krok po Kroku:
1. [Krok 1]
2. [Krok 2]

(Jeśli zmiana dotyczy ścieżki krytycznej:)
### 💨 Sugerowany Test Dymny (Smoke Test 5–10 min)
**Uzasadnienie testu dymnego:** [Dlaczego ścieżka krytyczna]
1. [Krok 1]
2. [Krok 2]
`.trim();
  }

  /**
   * Generuje kompletny pakiet weryfikacyjny dla poprawki w PatExpert
   */
  async generatePatExpertDocPackage(changeDescription, options = {}) {
    const desc = String(changeDescription || '').trim();
    if (!desc) {
      throw new Error("Opis zmiany wdrożeniowej nie może być pusty.");
    }

    const systemInstruction = this.getPatExpertDocAgentInstruction();
    const prompt = `Zgłoszenie zmiany wdrożeniowej w systemie PatExpert:\n\n${desc}\n\nPrzygotuj kompletny pakiet weryfikacyjny (Test Case, Test Regresji, Wpis do Bazy Wiedzy I Linii oraz ewentualny Test Dymny jeśli dotyczy ścieżki krytycznej).`;

    const rawResponse = await this.callGemini(prompt, {
      systemInstruction: systemInstruction,
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 2048
    });

    const parsed = this.parsePatExpertDocPackage(rawResponse);
    return {
      rawMarkdown: rawResponse,
      parsed: parsed
    };
  }

  /**
   * Parser markdownu pakietu weryfikacyjnego PatExpert
   */
  parsePatExpertDocPackage(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return {
        isClarificationNeeded: false,
        clarificationQuestions: [],
        hasSmokeTest: false,
        smokeTest: null,
        testCase: { title: "", module: "", id: "", preconditions: [], steps: [], expectedResult: "" },
        regressionTest: { module: "", reason: "", steps: [], expectedResult: "" },
        knowledgeBase: { title: "", problem: "", diagnosis: "", solutionSteps: [] },
        rawMarkdown: ""
      };
    }

    const res = {
      isClarificationNeeded: false,
      clarificationQuestions: [],
      hasSmokeTest: false,
      smokeTest: null,
      testCase: {
        title: "",
        module: "",
        id: "",
        preconditions: [],
        steps: [],
        expectedResult: ""
      },
      regressionTest: {
        module: "",
        reason: "",
        steps: [],
        expectedResult: ""
      },
      knowledgeBase: {
        title: "",
        problem: "",
        diagnosis: "",
        solutionSteps: []
      },
      rawMarkdown: markdown
    };

    // 1. Sprawdź czy są pytania doprecyzowujące
    const clarMatch = markdown.match(/(?:###\s*⚠️\s*Brakujące Informacje[^\n]*\n)([\s\S]*?)(?=\n###|\n##|$)/i);
    if (clarMatch && clarMatch[1]) {
      const qLines = clarMatch[1].split('\n')
        .map(l => l.trim().replace(/^[-*•\d.]+\s*/, ''))
        .filter(l => l.length > 5);
      if (qLines.length > 0) {
        res.isClarificationNeeded = true;
        res.clarificationQuestions = qLines;
      }
    }

    // 2. Test Dymny (Smoke Test)
    const smokeMatch = markdown.match(/(?:###\s*💨\s*Sugerowany Test Dymny[^\n]*\n)([\s\S]*?)(?=\n###|\n##|$)/i);
    if (smokeMatch && smokeMatch[1]) {
      res.hasSmokeTest = true;
      const smokeText = smokeMatch[1];
      const reasonMatch = smokeText.match(/(?:\*\*Uzasadnienie[^\n:]*:\*\*\s*)([^\n]+)/i);
      const steps = smokeText.split('\n')
        .map(l => l.trim())
        .filter(l => /^\d+\.\s+/.test(l) || /^[-*]\s+/.test(l))
        .map(l => l.replace(/^(\d+\.|[-*])\s+/, ''));
      res.smokeTest = {
        reason: reasonMatch ? reasonMatch[1].trim() : "Wdrożenie modyfikuje kluczowy element ścieżki krytycznej systemu PatExpert.",
        steps: steps.length > 0 ? steps : ["Weryfikacja logowania", "Weryfikacja zapisu zlecenia", "Weryfikacja podglądu badania"]
      };
    }

    // 3. Test Case
    const tcMatch = markdown.match(/(?:###\s*🧪\s*1\.\s*Scenariusz Testowy[^\n]*\n)([\s\S]*?)(?=\n###\s*🔄|\n###\s*📚|\n###\s*💨|$)/i);
    if (tcMatch && tcMatch[1]) {
      const tcText = tcMatch[1];
      const titleMatch = tcText.match(/(?:\*\*Tytuł:\*\*\s*)([^\n]+)/i);
      const modMatch = tcText.match(/(?:\*\*Moduł:\*\*\s*)([^\n]+)/i);
      const idMatch = tcText.match(/(?:\*\*ID Testu:\*\*\s*)([^\n]+)/i);
      if (titleMatch) res.testCase.title = titleMatch[1].trim();
      if (modMatch) res.testCase.module = modMatch[1].trim();
      if (idMatch) res.testCase.id = idMatch[1].trim();

      // Warunki wstępne
      const preMatch = tcText.match(/(?:####\s*Warunki Wstępne:[^\n]*\n)([\s\S]*?)(?=\n####|$)/i);
      if (preMatch && preMatch[1]) {
        res.testCase.preconditions = preMatch[1].split('\n')
          .map(l => l.trim().replace(/^[-*•]\s*/, ''))
          .filter(l => l.length > 3);
      }

      // Kroki wykonania
      const stepsMatch = tcText.match(/(?:####\s*Kroki Wykonania:[^\n]*\n)([\s\S]*?)(?=\n####|$)/i);
      if (stepsMatch && stepsMatch[1]) {
        res.testCase.steps = stepsMatch[1].split('\n')
          .map(l => l.trim())
          .filter(l => /^\d+\.\s+/.test(l))
          .map(l => l.replace(/^\d+\.\s+/, ''));
      }

      // Oczekiwany rezultat
      const resMatch = tcText.match(/(?:####\s*Oczekiwany Rezultat:[^\n]*\n)([\s\S]*?)(?=\n####|\n###|$)/i);
      if (resMatch && resMatch[1]) {
        res.testCase.expectedResult = resMatch[1].trim();
      }
    }

    // 4. Test Regresji
    const regMatch = markdown.match(/(?:###\s*🔄\s*2\.\s*Test Regresji[^\n]*\n)([\s\S]*?)(?=\n###\s*📚|\n###\s*💨|$)/i);
    if (regMatch && regMatch[1]) {
      const regText = regMatch[1];
      const modMatch = regText.match(/(?:\*\*Powiązana Funkcja \/ Moduł:\*\*\s*)([^\n]+)/i);
      const reasonMatch = regText.match(/(?:\*\*Uzasadnienie Powiązania:\*\*\s*)([^\n]+)/i);
      if (modMatch) res.regressionTest.module = modMatch[1].trim();
      if (reasonMatch) res.regressionTest.reason = reasonMatch[1].trim();

      const regStepsMatch = regText.match(/(?:####\s*Kroki Weryfikacji Regresji:[^\n]*\n)([\s\S]*?)(?=\n\*\*|\n####|\n###|$)/i);
      if (regStepsMatch && regStepsMatch[1]) {
        res.regressionTest.steps = regStepsMatch[1].split('\n')
          .map(l => l.trim())
          .filter(l => /^\d+\.\s+/.test(l) || /^[-*]\s+/.test(l))
          .map(l => l.replace(/^(\d+\.|[-*])\s+/, ''));
      }

      const regResMatch = regText.match(/(?:\*\*Oczekiwany Rezultat Regresji:\*\*\s*)([^\n]+)/i);
      if (regResMatch) res.regressionTest.expectedResult = regResMatch[1].trim();
    }

    // 5. Wpis do Bazy Wiedzy
    const kbMatch = markdown.match(/(?:###\s*📚\s*3\.\s*Wpis do Bazy Wiedzy[^\n]*\n)([\s\S]*?)(?=\n###\s*💨|$)/i);
    if (kbMatch && kbMatch[1]) {
      const kbText = kbMatch[1];
      const titleMatch = kbText.match(/(?:\*\*Tytuł:\*\*\s*)([^\n]+)/i);
      if (titleMatch) res.knowledgeBase.title = titleMatch[1].trim();

      const probMatch = kbText.match(/(?:####\s*Problem:[^\n]*\n)([\s\S]*?)(?=\n####|$)/i);
      if (probMatch && probMatch[1]) res.knowledgeBase.problem = probMatch[1].trim();

      const diagMatch = kbText.match(/(?:####\s*Diagnoza:[^\n]*\n)([\s\S]*?)(?=\n####|$)/i);
      if (diagMatch && diagMatch[1]) res.knowledgeBase.diagnosis = diagMatch[1].trim();

      const solMatch = kbText.match(/(?:####\s*Rozwiązanie Krok po Kroku:[^\n]*\n)([\s\S]*?)(?=\n####|\n###|$)/i);
      if (solMatch && solMatch[1]) {
        res.knowledgeBase.solutionSteps = solMatch[1].split('\n')
          .map(l => l.trim())
          .filter(l => /^\d+\.\s+/.test(l))
          .map(l => l.replace(/^\d+\.\s+/, ''));
      }
    }

    return res;
  }

  getMedicalPilotSession() {
    if (!this.medicalPilotSession) {
      this.medicalPilotSession = new GeminiPilotSession(this, 'auto');
    }
    return this.medicalPilotSession;
  }

  getStackDecoderPilotSession() {
    if (!this.stackDecoderPilotSession) {
      this.stackDecoderPilotSession = new GeminiPilotSession(this, 'stack_decoder');
    }
    return this.stackDecoderPilotSession;
  }

  getSqlGeneratorPilotSession() {
    if (!this.sqlGeneratorPilotSession) {
      this.sqlGeneratorPilotSession = new GeminiPilotSession(this, 'sql_generator');
    }
    return this.sqlGeneratorPilotSession;
  }

  /**
   * System Prompt dla Błyskawicznego Konsultanta IT (Programowanie / Bazy Danych / Systemy Medyczne)
   * Twardy reżim zwięzłości: zero uprzejmości, kod i komendy na pierwszym miejscu, maks 2-4 zwięzłe punkty techniczne.
   */
  getQuickConsultantInstruction() {
    return `Jesteś Błyskawicznym Konsultantem IT (Senior Technical Copilot) w szpitalnym środowisku IT i inżynierii oprogramowania.
Twoim jedynym zadaniem jest dostarczanie BŁYSKAWICZNYCH, SKRAJNYCH W ZWIĘZŁOŚCI I ULTRA-KONKRETNYCH odpowiedzi inżynierom i programistom.

OBSZARY EKSPERCKIE:
1. Programowanie: Java (Spring, JPA, wątki, I/O), Python (ETL, fdb Firebird, pandas, skrypty), Delphi / Object Pascal (legacy LIS, BDE, IBX, pamięć, wskaźniki), C# / .NET, Bash / Linux shell, Regex.
2. Bazy Danych: PostgreSQL, Oracle, Firebird (2.5 / 3.0 / 4.0), SQL Server. Indeksy, plany EXPLAIN / execution plans, transakcje, blokady (locks/deadlocks), optymalizacja zapytań, składnia dialektów.
3. Systemy Medyczne & Integracje: LIS (ASTM 1394, HL7 v2 ORM/ORU), eKrew (kody ISBT 128, stany preparatów krwi), PatExpert (WSI formaty SVS/NDPI, storage NFS/SAN, IHC), Genetyka (VCF, FASTQ, BAM, pipeline), standardy HL7 v2.x (segmenty MSH, PID, OBR, OBX), FHIR JSON (zasoby Patient, Observation itp.), protokół MLLP (port 2575).

ŻELAZNE ZASADY KOMUNIKACJI (SAME KONKRETY, ZERO LANIA WODY):
1. BEZWZGLĘDNY ZAKAZ WSTĘPÓW I FORMALIZMÓW:
   - Żadnych powitań ("Cześć", "Witaj", "Dzień dobry").
   - Żadnych wstępów ("Oto rozwiązanie", "Chętnie pomogę w tym problemie", "Aby to zrobić...").
   - Żadnych podsumowań i pożegnań ("Mam nadzieję, że pomogłem", "Powodzenia", "W razie pytań pisz").
   - Odpowiedź ZACZYNA SIĘ OD PIERWSZEGO ZNAKU od konkretu.

2. KOD / KOMENDA / ZAPYTANIE NA PIERWSZYM MIEJSCU:
   - Jeśli pytanie dotyczy kodu, komendy Bash lub zapytania SQL — podaj blok kodu w markdownie (\`\`\`język ... \`\`\`) jako pierwszy element odpowiedzi.
   - Kod musi być poprawny syntaktycznie, produkcyjny i gotowy do wklejenia (copy-paste ready).

3. MAKSYMALNIE 2-4 ZWIĘZŁE PUNKTY TECHNICZNE:
   - Jeśli wymagany jest komentarz — używaj wyłącznie zwięzłych punktorów (bullet points).
   - Maksymalnie 2-4 zdania wyjaśnienia lub kluczowych ostrzeżeń (gotchas).
   - Pomiń elementarne definicje; skup się na specyfice szpitalnej i pułapkach produkcyjnych.

4. BEZPIECZEŃSTWO SZPITALNE:
   - W SQL preferuj bezpieczne SELECT; przy modyfikacji wskaż transakcję z ROLLBACK.
   - W systemach medycznych przypominaj o regułach krytycznych (nie otwierać portu MLLP na świat, nie kasować skanów WSI bez zgody patologa, nie modyfikować stanu krwi w bazie bez personelu).`;
  }

  /**
   * Błyskawiczna konsultacja techniczna (Programowanie / SQL / Systemy Medyczne)
   * Zoptymalizowana pod minimalne opóźnienie (low latency) i determinizm.
   */
  async askQuickConsultant(question, options = {}) {
    const startTime = Date.now();
    const systemInstruction = options.systemInstruction || this.getQuickConsultantInstruction();
    const maxTokens = options.maxOutputTokens || 1200;
    const temperature = options.temperature !== undefined ? options.temperature : 0.1;
    const topP = options.topP !== undefined ? options.topP : 0.8;

    let prompt = question;
    if (options.contextDomain && options.contextDomain !== 'all') {
      prompt = `[Kategoria: ${options.contextDomain}]\n${question}`;
    }

    const rawResponse = await this.callGemini(prompt, {
      systemInstruction: systemInstruction,
      temperature: temperature,
      topP: topP,
      maxOutputTokens: maxTokens,
      model: options.model || this.getModel()
    });

    const elapsedMs = Date.now() - startTime;
    return {
      text: rawResponse ? rawResponse.trim() : "",
      elapsedMs: elapsedMs,
      model: options.model || this.getModel(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Klasa zarządzająca stanem konwersacji Interaktywnego Pilota SRE (Ping-Pong / REPL)
 */
class GeminiPilotSession {
  constructor(geminiService, defaultSystemType = 'auto') {
    this.service = geminiService;
    this.defaultSystemType = defaultSystemType;
    this.reset();
  }

  reset() {
    this.rawLog = "";
    this.context = {};
    this.systemType = this.defaultSystemType || "auto";
    this.history = []; // Format Gemini API: [{ role: 'user'|'model', parts: [{ text }] }]
    this.turns = [];   // Historia dla interfejsu użytkownika
    this.detectedService = "";
    this.hypothesis = "";
    this.stepNumber = 0;
    this.isResolved = false;
    this.status = 'IDLE'; // 'IDLE' | 'ACTIVE' | 'RESOLVED' | 'ERROR'
  }

  isActive() {
    return this.status === 'ACTIVE' || this.status === 'RESOLVED';
  }

  async start(rawLog, context = {}, options = {}) {
    this.reset();
    this.rawLog = rawLog ? rawLog.trim() : "";
    this.context = context || {};
    this.status = 'ACTIVE';

    // Wykrywanie lub wymuszenie systemu medycznego
    this.systemType = (options && options.systemType) || (context && context.systemType) || (this.defaultSystemType !== 'auto' ? this.defaultSystemType : this._detectSystemType(this.rawLog));
    this.detectedService = this._detectServiceFromLog(this.rawLog);
    this.hypothesis = this._getInitialHypothesis(this.systemType);

    const isMedical = ['lis', 'ekrew', 'patexpert', 'genetyka'].includes(this.systemType);
    const systemTitle = isMedical ? `systemie ${this._getSystemDisplay(this.systemType)}` : 'serwerze szpitalnym';

    const initialUserMessage = `
Awaria w ${systemTitle}:
\`\`\`text
${this.rawLog}
\`\`\`
Wykryty kontekst lokalny: ${this.detectedService ? `Usługa/Moduł: ${this.detectedService}` : 'Brak zdefiniowanej usługi'}.
Rozpocznij procedurę interaktywnego pilota REPL. Podaj wyłącznie Krok 1 (DOKŁADNIE JEDNĄ komendę Bash lub zapytanie SELECT do weryfikacji).
`.trim();

    this.history.push({
      role: "user",
      parts: [{ text: initialUserMessage }]
    });

    this.stepNumber = 1;

    const instruction = this.service.getMedicalPilotInstruction(this.systemType);

    const responseText = await this.service.callGemini(this.history, {
      systemInstruction: instruction,
      temperature: 0.1,
      topP: 0.8
    });

    this.history.push({
      role: "model",
      parts: [{ text: responseText }]
    });

    const parsed = this.service.parsePilotMessage(responseText);
    if (parsed.isResolved) {
      this.isResolved = true;
      this.status = 'RESOLVED';
    }
    if (parsed.diagnosis) {
      this.hypothesis = parsed.diagnosis;
    }

    this.turns.push({
      type: 'agent',
      stepNumber: this.stepNumber,
      parsed: parsed,
      timestamp: new Date().toLocaleTimeString('pl-PL')
    });

    return parsed;
  }

  async sendUserTurn(terminalOutput) {
    if (!this.isActive()) {
      throw new Error("Sesja pilota nie jest aktywna.");
    }

    const outputClean = terminalOutput !== undefined && terminalOutput !== null ? String(terminalOutput).trim() : "";
    const userDisplay = outputClean.length > 0 ? outputClean : "[Komenda wykonała się pomyślnie (exit code 0 / brak błędu / brak wyników zapytania)]";

    this.turns.push({
      type: 'user',
      stepNumber: this.stepNumber,
      text: userDisplay,
      timestamp: new Date().toLocaleTimeString('pl-PL')
    });

    const promptText = `
Wynik terminala / zapytania SQL dla poprzedniego kroku:
\`\`\`text
${userDisplay}
\`\`\`
Zanalizuj ten wynik i podaj kolejną DOKŁADNIE JEDNĄ komendę Bash lub zapytanie SELECT (Krok ${this.stepNumber + 1}) lub jeśli problem został rozwiązany i zweryfikowany, zakończ: [AWARIA ROZWIĄZANA].
`.trim();

    this.history.push({
      role: "user",
      parts: [{ text: promptText }]
    });

    this.stepNumber++;

    const instruction = this.service.getMedicalPilotInstruction(this.systemType);

    const responseText = await this.service.callGemini(this.history, {
      systemInstruction: instruction,
      temperature: 0.1,
      topP: 0.8
    });

    this.history.push({
      role: "model",
      parts: [{ text: responseText }]
    });

    const parsed = this.service.parsePilotMessage(responseText);
    if (parsed.isResolved) {
      this.isResolved = true;
      this.status = 'RESOLVED';
    }
    if (parsed.diagnosis) {
      this.hypothesis = parsed.diagnosis;
    }

    this.turns.push({
      type: 'agent',
      stepNumber: this.stepNumber,
      parsed: parsed,
      timestamp: new Date().toLocaleTimeString('pl-PL')
    });

    return parsed;
  }

  getLastAgentTurn() {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].type === 'agent') return this.turns[i];
    }
    return null;
  }

  async sendUserMessage(text, options = {}) {
    return this.sendUserTurn(text);
  }

  async sendStepFeedback(feedback, options = {}) {
    if (!this.isActive()) {
      throw new Error("Sesja pilota nie jest aktywna.");
    }
    const feedbackClean = feedback ? String(feedback).trim() : "";
    if (!feedbackClean) return null;

    this.turns.push({
      type: 'user',
      stepNumber: this.stepNumber,
      text: `[WĄTPLIWOŚĆ / BŁĄD KROKU]: ${feedbackClean}`,
      timestamp: new Date().toLocaleTimeString('pl-PL')
    });

    const promptText = `
Użytkownik zgłasza problem lub błąd dotyczący bieżącego Kroku ${this.stepNumber}:
\`\`\`text
${feedbackClean}
\`\`\`
Skoryguj swoje podejście lub zaproponuj alternatywną komendę/zapytanie (DOKŁADNIE JEDNA komenda/zapytanie dla Kroku ${this.stepNumber}).
`.trim();

    this.history.push({
      role: "user",
      parts: [{ text: promptText }]
    });

    const instruction = this.service.getMedicalPilotInstruction(this.systemType);
    const responseText = await this.service.callGemini(this.history, {
      systemInstruction: instruction,
      temperature: 0.1,
      topP: 0.8
    });

    this.history.push({
      role: "model",
      parts: [{ text: responseText }]
    });

    const parsed = this.service.parsePilotMessage(responseText);
    if (parsed.isResolved) {
      this.isResolved = true;
      this.status = 'RESOLVED';
    }
    if (parsed.diagnosis) {
      this.hypothesis = parsed.diagnosis;
    }

    this.turns.push({
      type: 'agent',
      stepNumber: this.stepNumber,
      parsed: parsed,
      timestamp: new Date().toLocaleTimeString('pl-PL')
    });

    return parsed;
  }

  _detectSystemType(log) {
    if (!log) return "linux";
    const l = log.toLowerCase();
    if (l.includes("astm") || l.includes("mllp") || l.includes("lis") || l.includes("cobas") || l.includes("sysmex") || l.includes("mirth") || l.includes("obx") || l.includes("orm^o01") || l.includes("oru^r01") || l.includes("probk") || l.includes("zlecen")) return "lis";
    if (l.includes("isbt") || l.includes("ekrew") || l.includes("ckik") || l.includes("kkcz") || l.includes("ffp") || l.includes("kkp") || l.includes("krew") || l.includes("transakcje_temp") || l.includes("krwiodaw")) return "ekrew";
    if (l.includes("svs") || l.includes("ndpi") || l.includes("mrxs") || l.includes("wsi") || l.includes("patexpert") || l.includes("patolog") || l.includes("hist-pat") || l.includes("histopat") || l.includes("aperio") || l.includes("hamamatsu") || l.includes("kafelk") || l.includes("tile")) return "patexpert";
    if (l.includes("vcf") || l.includes("fastq") || l.includes("bam") || l.includes("cram") || l.includes("genom") || l.includes("genetyk") || l.includes("hg19") || l.includes("hg38") || l.includes("grch") || l.includes("slurm") || l.includes("snakemake") || l.includes("nextflow") || l.includes("wgs") || l.includes("wes")) return "genetyka";
    return "linux";
  }

  _getSystemDisplay(systemType) {
    const s = String(systemType || '').toLowerCase();
    if (s === 'lis') return 'LIS';
    if (s === 'ekrew') return 'eKrew';
    if (s === 'patexpert') return 'PatExpert';
    if (s === 'genetyka') return 'Genetyka';
    if (s === 'stack_decoder') return 'Dekoder Stack Trace';
    if (s === 'sql_generator') return 'Generator SQL';
    return 'Linux';
  }

  _getInitialHypothesis(systemType) {
    const s = String(systemType || '').toLowerCase();
    if (s === 'lis') return 'Weryfikacja bufora analizatora, portu MLLP i bazy zleceń LIS';
    if (s === 'ekrew') return 'Weryfikacja blokad w transakcjach tymczasowych i statusu CKiK';
    if (s === 'patexpert') return 'Weryfikacja montażu NFS skanów WSI i serwera kafelków';
    if (s === 'genetyka') return 'Weryfikacja nagłówków VCF, pamięci RAM i pipeline obliczeniowego';
    if (s === 'stack_decoder') return 'Analiza błędu aplikacji i weryfikacja konfiguracji/stanu procesu';
    if (s === 'sql_generator') return 'Weryfikacja spójności danych i relacji tabelarycznych w bazie medycznej';
    return 'Weryfikacja parametrów bazowych i zasobów (Error-First)';
  }

  _detectServiceFromLog(log) {
    if (!log) return "Linux System";
    const l = log.toLowerCase();
    if (l.includes("postgres") || l.includes("5432") || l.includes("pg_wal") || l.includes("shmmax")) return "postgresql.service";
    if (l.includes("orthanc") || l.includes("4242") || l.includes("dicom")) return "orthanc.service";
    if (l.includes("mirth") || l.includes("8443") || l.includes("2575")) return "mirth-connect.service";
    if (l.includes("docker") || l.includes("containerd") || l.includes("overlay2")) return "docker.service";
    if (l.includes("firebird") || l.includes("fbserver") || l.includes("3050")) return "firebird.service";
    if (l.includes("nfs") || l.includes("rpcbind") || l.includes("rpcinfo")) return "nfs-client.target";
    if (l.includes("astm")) return "analizator-astm.tcp";
    if (l.includes("ckik")) return "ckik-sync.service";
    if (l.includes("slurm")) return "slurmctld.service";
    if (l.includes("oracle") || l.includes("ora-")) return "oracle-listener.service";
    return "Linux System / Usługa medyczna";
  }

  getAllCommands() {
    return this.turns
      .filter(t => t.type === 'agent' && t.parsed && t.parsed.command)
      .map(t => t.parsed.command);
  }

  toRunbookRecord() {
    let scriptCommands = [];
    const sysDisplay = this._getSystemDisplay(this.systemType);
    let summaryNotes = `## Przebieg sesji Interaktywnego Pilota AI (${sysDisplay}) (Ping-Pong / REPL)\n\n`;
    summaryNotes += `- **System / Narzędzie:** \`${sysDisplay}\`\n`;
    summaryNotes += `- **Wykryta usługa / moduł:** \`${this.detectedService}\`\n`;
    summaryNotes += `- **Ostatnia hipoteza/diagnoza:** ${this.hypothesis}\n`;
    summaryNotes += `- **Liczba wykonanych kroków:** ${this.stepNumber}\n`;
    summaryNotes += `- **Status incydentu:** ${this.isResolved ? '✅ AWARIA ROZWIĄZANA' : 'W toku / Diagnostyka'}\n\n`;

    this.turns.forEach(t => {
      if (t.type === 'agent') {
        const stepTitle = t.parsed.goal || (t.parsed.isResolved ? 'Podsumowanie i rozwiązanie awarii' : 'Diagnostyka incydentu');
        summaryNotes += `### Krok ${t.stepNumber}: ${stepTitle}\n`;
        if (t.parsed.diagnosis) summaryNotes += `> **Diagnoza:** ${t.parsed.diagnosis}\n\n`;
        if (t.parsed.command) {
          const lang = t.parsed.isSQL ? 'sql' : 'bash';
          summaryNotes += `\`\`\`${lang}\n${t.parsed.command}\n\`\`\`\n`;
          scriptCommands.push({ step: `Krok ${t.stepNumber}: ${stepTitle}`, cmd: t.parsed.command, lang: lang });
        }
      } else if (t.type === 'user') {
        summaryNotes += `*Wynik terminala / zapytania:*\n\`\`\`text\n${t.text}\n\`\`\`\n\n`;
      }
    });

    let category = "Interaktywny Pilot REPL";
    let tags = [this.systemType.toLowerCase(), 'pilot-ai', 'repl'];

    if (this.systemType === 'stack_decoder') {
      category = "Dekoder Błędów Aplikacyjnych";
      tags = ['stack-trace', 'decoder', 'pilot-ai', 'repl'];
    } else if (this.systemType === 'sql_generator') {
      category = "Diagnostyka SQL";
      tags = ['sql', 'database', 'pilot-ai', 'repl'];
    }

    return {
      id: `runbook_pilot_${Date.now()}`,
      date: new Date().toLocaleString('pl-PL'),
      title: `[Pilot ${sysDisplay}] ${this.hypothesis || this.detectedService || 'Diagnoza Incydentu'}`,
      system: sysDisplay,
      category: category,
      level: "REPL_PILOT",
      tags: tags,
      errorLog: this.rawLog,
      detectedPath: this.detectedService,
      resolvedSteps: scriptCommands.map(sc => ({
        step: sc.step,
        commands: [sc.cmd]
      })),
      postMortemNotes: summaryNotes
    };
  }
}

// Globalna instancja
if (typeof window !== 'undefined') {
  window.GeminiPilotSession = GeminiPilotSession;
  window.geminiService = new GeminiService();
}

