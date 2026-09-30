/**
 * HealthTech Onboarding Hub - Dekoder Stack Trace'ów i Błędów Aplikacyjnych (stack-decoder.js)
 * 
 * Moduł diagnostyczny łączący:
 * 1. Lokalną Bazę Wiedzy (STACK_KB) - 19 wbudowanych reguł offline (Java, .NET, Delphi, PostgreSQL, Oracle)
 * 2. Dedykowanego Agenta AI i Interaktywnego Pilota REPL (Ping-Pong krok po kroku)
 * 3. Pełny wybór 11 modeli Gemini API z dwukierunkową synchronizacją
 * 4. Step Feedback Engine i 1-klikowy eksport post-mortem do Bazy Runbooków
 */

(function() {
'use strict';

/**
 * 11 Oficjalnych modeli Google Gemini API
 */
const GEMINI_MODELS = [
  { value: 'gemini-3.5-flash', label: '⭐ gemini-3.5-flash (Domyślny – determinizm, niskie opóźnienie)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Stabilny GA)' },
  { value: 'gemini-3.7-flash', label: '🚀 gemini-3.7-flash (Agentic coding)' },
  { value: 'gemini-3.8-flash-high', label: '🔬 gemini-3.8-flash-high (Głębokie wnioskowanie SRE)' },
  { value: 'gemini-3.1-pro-preview', label: '🧠 gemini-3.1-pro-preview (Flagowy model Pro – Złożona dedukcja)' },
  { value: 'gemini-3.5-flash-high', label: '⚡ gemini-3.5-flash-high (Wysoki budżet myślenia)' },
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Zrównoważony Flash 3.6)' },
  { value: 'gemini-3.5-flash-lite', label: '🚀 gemini-3.5-flash-lite (Ultra-szybki, najniższy koszt)' },
  { value: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Lekki i oszczędny)' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Stabilny Pro generacji 2.5)' },
  { value: 'gemini-2.0-flash-001', label: 'gemini-2.0-flash-001 (Wersja bazowa 2.0)' }
];

/**
 * Baza Wiedzy Reguł Diagnostycznych Offline (STACK_KB)
 */
const STACK_KB = [
  {
    id: 'java_npe',
    triggers: ['nullpointerexception', 'npe at'],
    lang: 'Java',
    errorClass: 'NullPointerException',
    businessContext: 'Walidacja próbki/zlecenia, brak parametru config. Próba dostępu do obiektu, który nie był zainicjowany.',
    likelyCause: 'Brak wypełnionego parametru konfiguracyjnego lub null w wyniku zapytania SQL',
    diagnosticSQL: {
      label: 'Sprawdź konfigurację stanowiska',
      sql: 'SELECT klucz, wartosc FROM konfiguracja WHERE wartosc IS NULL AND wymagane = true;'
    },
    suggestedAction: 'Sprawdź log aplikacji przed wyjątkiem aby znaleźć parametr null. Sprawdź konfigurację stanowiska w bazie.'
  },
  {
    id: 'java_classcast',
    triggers: ['classcastexception', 'cannot be cast to'],
    lang: 'Java',
    errorClass: 'ClassCastException',
    businessContext: 'Niezgodność wersji bibliotek lub typów HL7 segment',
    likelyCause: 'Obiekt nie pasuje do oczekiwanego typu, możliwy problem z wersją zależności.',
    suggestedAction: 'Sprawdź wersję biblioteki HL7 w POM/build.gradle'
  },
  {
    id: 'java_oom',
    triggers: ['outofmemoryerror', 'java heap space', 'gc overhead limit'],
    lang: 'Java',
    errorClass: 'OutOfMemoryError: Java heap space',
    businessContext: 'Raport genetyczny / analiza WGS / export dużego zestawu wyników',
    likelyCause: 'Aplikacja zużyła całą dostępną pamięć Heap. Zbyt duży zbiór danych wczytany do pamięci.',
    cmd: "ps aux | grep java | grep -oP '-Xmx[0-9]+[gGmM]' \nfree -h",
    diagnosticSQL: {
      label: 'Sprawdź ilość przetwarzanych plików sekwencjonowania',
      sql: "SELECT COUNT(*), SUM(rozmiar_mb) FROM pliki_sekwencjonowania WHERE status = 'PRZETWARZANY';"
    },
    suggestedAction: 'Zwiększ pamięć JVM (-Xmx) lub sprawdź optymalizację przetwarzania dużych danych.'
  },
  {
    id: 'java_timeout',
    triggers: ['sockettimeoutexception', 'read timed out', 'connection timed out'],
    lang: 'Java',
    errorClass: 'SocketTimeoutException',
    businessContext: 'Timeout połączenia do analizatora LIS lub usługi CKiK',
    likelyCause: 'Serwer docelowy nie odpowiada w oczekiwanym czasie lub problem sieciowy/zapora.',
    cmd: "ss -tnp | grep <PORT> \nnc -zv <HOST> <PORT>",
    diagnosticSQL: {
      label: 'Sprawdź ustawienia analizatorów',
      sql: "SELECT adres_ip, port, timeout_ms, ostatnie_polaczenie FROM analizatory WHERE aktywny = 1;"
    },
    suggestedAction: 'Sprawdź logi po stronie usługi zewnętrznej. Zmodyfikuj timeout_ms.'
  },
  {
    id: 'pg_sqlexception',
    triggers: ['psqlexception', 'org.postgresql', 'fatal: sorry', 'connection refused'],
    lang: 'Java/PostgreSQL',
    errorClass: 'SQLException / PSQLException',
    businessContext: 'Baza PostgreSQL niedostępna lub przekroczony limit połączeń',
    likelyCause: 'Brak łączności z serwerem baz danych, przekroczono max_connections, lub serwer leży.',
    cmd: "sudo systemctl status postgresql \nsudo -u postgres psql -c 'SELECT count(*) FROM pg_stat_activity;'",
    diagnosticSQL: {
      label: 'Sprawdź aktywne połączenia vs limit',
      sql: "SELECT count(*) as active, max_conn FROM pg_stat_activity, (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') s GROUP BY max_conn;"
    },
    suggestedAction: 'Zwiększ max_connections lub sprawdź pulę połączeń aplikacji.'
  },
  {
    id: 'ora_00054',
    triggers: ['ora-00054', 'resource busy', 'nowait'],
    lang: 'Oracle',
    errorClass: 'ORA-00054 (Oracle resource busy)',
    businessContext: 'Rekord blokowany przez inną sesję Oracle',
    likelyCause: 'Inny użytkownik lub zawieszony proces trzyma locka na zasobie.',
    diagnosticSQL: {
      label: 'Znajdź blokującą sesję',
      sql: "SELECT s.sid, s.serial#, s.username, s.machine, l.type, l.block FROM v$session s JOIN v$lock l ON s.sid = l.sid WHERE l.block = 1;"
    },
    suggestedAction: 'Odczekaj lub zabij (kill) sesję blokującą po weryfikacji.'
  },
  {
    id: 'ora_04031',
    triggers: ['ora-04031', 'unable to allocate', 'shared pool'],
    lang: 'Oracle',
    errorClass: 'ORA-04031 (shared pool exhausted)',
    businessContext: 'Wyczerpanie pamięci shared pool Oracle',
    likelyCause: 'Za mała alokacja SGA lub fragmentacja shared pool.',
    cmd: "Sprawdź SGA configuration (SHOW PARAMETER shared_pool_size)",
    suggestedAction: 'Zwiększ shared_pool_size, sprawdź czy zapytania używają bind variables.'
  },
  {
    id: 'ora_12541',
    triggers: ['ora-12541', 'tns:no listener'],
    lang: 'Oracle',
    errorClass: 'ORA-12541 (no listener)',
    businessContext: 'Oracle listener nie działa lub zły port TNS',
    likelyCause: 'Proces lsnrctl został zatrzymany lub nieprawidłowa konfiguracja listener.ora.',
    cmd: "lsnrctl status \nlsnrctl start",
    suggestedAction: 'Uruchom listener i zweryfikuj plik listener.ora oraz tnsnames.ora.'
  },
  {
    id: 'ora_01555',
    triggers: ['ora-01555', 'snapshot too old'],
    lang: 'Oracle',
    errorClass: 'ORA-01555 (snapshot too old)',
    businessContext: 'Zbyt długa transakcja przy małym UNDO tablespace',
    likelyCause: 'Segmenty UNDO zostały nadpisane zanim długa transakcja odczytująca ukończyła pracę.',
    diagnosticSQL: {
      label: 'Sprawdź wolne miejsce w UNDO tablespace',
      sql: "SELECT tablespace_name, round(sum(bytes)/1024/1024, 2) AS mb_free FROM dba_free_space WHERE tablespace_name LIKE '%UNDO%' GROUP BY tablespace_name;"
    },
    suggestedAction: 'Zwiększ UNDO_RETENTION lub powiększ przestrzeń UNDO tablespace.'
  },
  {
    id: 'dotnet_nre',
    triggers: ['nullreferenceexception', 'system.nullreferenceexception'],
    lang: '.NET / C#',
    errorClass: 'NullReferenceException',
    businessContext: 'Brak zainicjowanego obiektu w komponencie .NET',
    likelyCause: 'Odwołanie do właściwości obiektu o wartości null, niespójność danych z bazy.',
    diagnosticSQL: {
      label: 'Sprawdź brakujące wartości w konfiguracji',
      sql: "SELECT klucz, wartosc FROM konfiguracja WHERE wartosc IS NULL;"
    },
    suggestedAction: 'Sprawdź null-check w kodzie aplikacji lub uzupełnij brakujące rekordy w bazie.'
  },
  {
    id: 'dotnet_sqlexception',
    triggers: ['system.data.sqlclient', 'sqlexception', 'cannot open database'],
    lang: '.NET / C#',
    errorClass: 'SqlException (SQL Server)',
    businessContext: 'Problem z połączeniem do bazy SQL Server',
    likelyCause: 'Błędny connection string, wygasłe hasło serwisowe lub zablokowany port 1433.',
    cmd: "nc -zv <HOST_SQL_SERVER> 1433",
    suggestedAction: 'Zweryfikuj connection string w appsettings.json / web.config.'
  },
  {
    id: 'dotnet_httpexception',
    triggers: ['httprequestexception', 'webexception', 'unable to connect to remote server'],
    lang: '.NET / C#',
    errorClass: 'HttpRequestException / WebException',
    businessContext: 'Brak dostępu do usługi zewnętrznej (CKiK, NFZ, systemy centralne)',
    likelyCause: 'Problem z certyfikatem SSL, proxy sieciowe lub niedostępność endpointu.',
    cmd: "curl -I https://<HOST>",
    suggestedAction: 'Sprawdź ustawienia proxy i zainstalowane certyfikaty urzędów certyfikacji.'
  },
  {
    id: 'dotnet_timeoutexception',
    triggers: ['system.timeoutexception', 'operation timed out'],
    lang: '.NET / C#',
    errorClass: 'TimeoutException',
    businessContext: 'Timeout zapytania do bazy danych lub usługi webowej',
    likelyCause: 'Zablokowane indeksy bazy, przeciążenie serwera lub długie transakcje blokujące.',
    diagnosticSQL: {
      label: 'Sprawdź najwolniejsze zapytania w SQL Server',
      sql: "SELECT TOP 10 text, execution_count, total_elapsed_time/execution_count AS avg_ms FROM sys.dm_exec_cached_plans CROSS APPLY sys.dm_exec_sql_text(plan_handle) ORDER BY avg_ms DESC;"
    },
    suggestedAction: 'Zoptymalizuj zapytanie w bazie, dodaj indeks lub zwiększ CommandTimeout.'
  },
  {
    id: 'delphi_accessviolation',
    triggers: ['eaccessviolation', 'access violation', 'access violation at address'],
    lang: 'Delphi/Pascal',
    errorClass: 'EAccessViolation',
    businessContext: 'Próba dostępu do niezainicjowanego wskaźnika (NIL pointer) w LIS.exe',
    likelyCause: 'Wywołanie metody na zwolnionym lub nieutworzonym obiekcie w module Delphi.',
    suggestedAction: 'Sprawdź czy obiekt nie jest nil przed użyciem. Zweryfikuj log aplikacji tuż przed błędem.'
  },
  {
    id: 'delphi_dberror',
    triggers: ['edatabaseerror', 'edbengineerror', 'database error'],
    lang: 'Delphi/Pascal',
    errorClass: 'EDatabaseError / EDBEngineError',
    businessContext: 'Błąd bazy danych Firebird (IBX/BDE) lub PostgreSQL przez sterownik Delphi',
    likelyCause: 'Błąd transakcji, naruszenie klucza obcego lub zerwane połączenie gniazda bazy.',
    diagnosticSQL: {
      label: 'Sprawdź transakcje w bazie Firebird',
      sql: "SELECT * FROM rdb$transactions WHERE rdb$transaction_state IS NOT NULL;"
    },
    suggestedAction: 'Sprawdź czy transakcja nie wisi w bazie. Zweryfikuj konfigurację gds32.dll / fbclient.dll.'
  },
  {
    id: 'delphi_inouterror',
    triggers: ['einouterror', 'i/o error', 'cannot open file'],
    lang: 'Delphi/Pascal',
    errorClass: 'EInOutError',
    businessContext: 'Brak dostępu do pliku logu, bufora lub pliku konfiguracyjnego INI',
    likelyCause: 'Brak uprawnień do katalogu roboczego lub plik zablokowany przez inny proces.',
    cmd: "ls -la <SCIEZKA> \nnamei -l <SCIEZKA>",
    suggestedAction: 'Sprawdź uprawnienia do pliku i katalogu. Sprawdź blokadę procesu przez fuser.'
  },
  {
    id: 'delphi_oom',
    triggers: ['eoutofmemory', 'out of memory'],
    lang: 'Delphi/Pascal',
    errorClass: 'EOutOfMemory',
    businessContext: 'Wyczerpanie pamięci procesu Delphi (32-bit limit 2GB)',
    likelyCause: 'Wczytanie ogromnej ilości danych lub wyciek pamięci w aplikacji Delphi 32-bit.',
    cmd: "free -h",
    suggestedAction: 'Restart aplikacji może być konieczny. Podziel przetwarzaną partię danych.'
  },
  {
    id: 'pg_connslots',
    triggers: ['remaining connection slots', 'max_connections', 'fatal: sorry, too many clients'],
    lang: 'PostgreSQL',
    errorClass: 'FATAL: remaining connection slots',
    businessContext: 'Przekroczono limit połączeń PostgreSQL',
    likelyCause: 'Wyciek połączeń z puli aplikacji lub nagły wzrost obciążenia.',
    diagnosticSQL: {
      label: 'Sprawdź stan połączeń PG',
      sql: "SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY count DESC;"
    },
    suggestedAction: 'Ubicie uśpionych (idle) sesji, zwiększenie max_connections, konfiguracja pgBouncer.'
  },
  {
    id: 'pg_nospace',
    triggers: ['could not write to file', 'no space left on device', 'enospc'],
    lang: 'PostgreSQL',
    errorClass: 'FATAL: could not write to file',
    businessContext: 'Brak miejsca na dysku (pg_wal lub data dir)',
    likelyCause: 'Zapełnienie dysku / partycji, logi pg_wal niesynchronizowane lub nagły przyrost danych.',
    cmd: "df -hT /var/lib/postgresql \ndf -i /var/lib/postgresql",
    suggestedAction: 'Zwolnij miejsce na dysku (usunięcie starych backupów/logów). Poszerz partycję.'
  }
];

/**
 * Gotowe presety produkcyjne dla Dekodera
 */
const EXAMPLES = [
  {
    id: 'preset_java_npe',
    label: 'Java NPE w LIS',
    lang: 'Java',
    badge: '🧪 LIS / Java',
    color: '#06d6a0',
    text: `java.lang.NullPointerException
	at pl.med.lis.service.SampleValidator.validate(SampleValidator.java:142)
	at pl.med.lis.controller.OrderController.processOrder(OrderController.java:87)`
  },
  {
    id: 'preset_java_oom',
    label: 'Java OOM w Genetyce',
    lang: 'Java',
    badge: '🧬 Genetyka / WGS',
    color: '#ffb703',
    text: `java.lang.OutOfMemoryError: Java heap space
	at java.util.Arrays.copyOf(Arrays.java:3210)
	at pl.med.genetyka.report.WGSReportGenerator.buildReport(WGSReportGenerator.java:334)`
  },
  {
    id: 'preset_delphi_access',
    label: 'Delphi Access Violation',
    lang: 'Delphi',
    badge: '🔷 Delphi 32-bit',
    color: '#ef476f',
    text: `EAccessViolation: Access violation at address 004A2B1C in module 'LIS.exe'. Read of address 00000000.`
  },
  {
    id: 'preset_pg_limit',
    label: 'PostgreSQL limit połączeń',
    lang: 'PostgreSQL',
    badge: '🐘 PostgreSQL',
    color: '#3a86ff',
    text: `FATAL: remaining connection slots are reserved for non-replication superuser connections
	at org.postgresql.Driver.connect(Driver.java:69)`
  },
  {
    id: 'preset_oracle_busy',
    label: 'Oracle ORA-00054 (Blokada)',
    lang: 'Oracle',
    badge: '🗄️ Oracle DB',
    color: '#8338ec',
    text: `ORA-00054: resource busy and acquire with NOWAIT specified or timeout expired`
  }
];

// Pomocnicze funkcje bezpieczeństwa
const escapeHtml = function(unsafe) {
  if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') return window.escapeHtml(unsafe);
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const showToast = function(message, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[Toast ${type}] ${message}`);
  }
};

/**
 * Generuje opcje dla listy rozwijanej modeli Gemini
 */
function renderDecoderModelSelectOptions(currentModel) {
  return GEMINI_MODELS.map(m => `
    <option value="${m.value}" ${currentModel === m.value ? 'selected' : ''}>
      ${escapeHtml(m.label)}
    </option>
  `).join('');
}

/**
 * Obsługa zmiany aktywnego modelu Gemini w Dekoderze Stack Trace'ów
 */
function onDecoderGeminiModelChange(modelName) {
  if (!modelName || !window.geminiService) return;
  window.geminiService.setModel(modelName);

  const ids = [
    'decoder-gemini-model-select',
    'decoder-gemini-config-model-select',
    'decoder-pilot-inline-model-select',
    'med-gemini-model-select',
    'med-gemini-config-model-select',
    'med-pilot-inline-model-select',
    'doc-gemini-model-select',
    'doc-gemini-config-model-select',
    'sqlgen-gemini-model-select',
    'sqlgen-gemini-config-model-select',
    'gemini-model-select'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== modelName) {
      el.value = modelName;
    }
  });

  updateDecoderGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  showToast(`Ustawiono aktywny model AI: ${modelName}`, 'success');
}

/**
 * Aktualizacja wskaźnika statusu API w Dekoderze
 */
function updateDecoderGeminiStatusUI() {
  const btn = document.getElementById('decoder-gemini-status-btn');
  if (!btn || !window.geminiService) return;

  const hasKey = window.geminiService.hasApiKey();
  const currentModel = window.geminiService.getModel();

  if (hasKey) {
    btn.innerHTML = `🟢 Gemini API: <strong>${escapeHtml(currentModel)}</strong>`;
    btn.style.borderColor = 'var(--accent-teal, #06d6a0)';
    btn.style.color = 'var(--accent-teal, #06d6a0)';
    btn.title = `Połączono z Google Gemini API (Model: ${currentModel}). Kliknij aby zarządzać.`;
  } else {
    btn.innerHTML = `🟡 Tryb Offline / Brak Klucza API`;
    btn.style.borderColor = 'var(--accent-amber, #ffb703)';
    btn.style.color = 'var(--accent-amber, #ffb703)';
    btn.title = `Brak klucza API Gemini. Kliknij aby wprowadzić klucz lub korzystaj z wbudowanej bazy STACK_KB.`;
  }

  const modelSelect = document.getElementById('decoder-gemini-model-select');
  if (modelSelect && modelSelect.value !== currentModel) {
    modelSelect.value = currentModel;
  }
}

/**
 * Otwiera / zamyka rozwijany panel konfiguracji API
 */
function toggleDecoderGeminiConfigUI() {
  const panel = document.getElementById('decoder-gemini-config-section');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderDecoderGeminiConfigUI();
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Renderuje zawartość panelu konfiguracji API
 */
function renderDecoderGeminiConfigUI() {
  const panel = document.getElementById('decoder-gemini-config-section');
  if (!panel || !window.geminiService) return;

  const hasKey = window.geminiService.hasApiKey();
  const currentKey = window.geminiService.getApiKey();
  const currentModel = window.geminiService.getModel();
  const maskedKey = currentKey ? `${currentKey.substring(0, 6)}...${currentKey.substring(currentKey.length - 4)}` : '';

  panel.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>⚙️ Konfiguracja Google Gemini API (Dekoder Stack Trace'ów)</span>
        </h4>
        <button class="btn btn-secondary btn-sm" onclick="window.toggleDecoderGeminiConfigUI()">✕ Zamknij</button>
      </div>
      <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 16px;">
        Klucz API jest przechowywany wyłącznie w pamięci Twojej przeglądarki (Bring Your Own Key). Model Gemini napędza Agenta AI w analizie rzadkich wyjątków i prowadzi sesję REPL krok po kroku.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Klucz Google Gemini API:</label>
          <div style="display: flex; gap: 8px;">
            <input type="password" id="decoder-gemini-key-input" class="form-control" style="flex: 1; font-family: monospace;" 
                   placeholder="AIzaSy..." value="${escapeHtml(currentKey || '')}">
            <button class="btn btn-primary btn-sm" onclick="window.saveDecoderGeminiApiKeyUI()">💾 Zapisz</button>
            ${hasKey ? `<button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.removeDecoderGeminiApiKeyUI()">🗑️</button>` : ''}
          </div>
          ${hasKey ? `<div style="font-size: 0.75rem; color: var(--accent-teal); margin-top: 4px;">Aktywny klucz: ${maskedKey}</div>` : ''}
        </div>

        <div>
          <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Wybierz Model Gemini dla Dekodera:</label>
          <select id="decoder-gemini-config-model-select" class="form-control" onchange="window.onDecoderGeminiModelChange(this.value)">
            ${renderDecoderModelSelectOptions(currentModel)}
          </select>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            Rekomendowany: <strong>gemini-3.5-flash</strong> (maksymalna precyzja analizy kodu).
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <button class="btn btn-secondary btn-sm" onclick="window.testDecoderGeminiConnectionUI()">
          🧪 Przetestuj połączenie z modelem
        </button>
        <span id="decoder-gemini-test-result" style="font-size: 0.85rem;"></span>
      </div>
    </div>
  `;
}

function saveDecoderGeminiApiKeyUI() {
  const input = document.getElementById('decoder-gemini-key-input');
  if (!input || !window.geminiService) return;
  const key = input.value.trim();
  if (!key) {
    showToast("Wprowadź prawidłowy klucz API.", "warning");
    return;
  }
  window.geminiService.setApiKey(key);
  renderDecoderGeminiConfigUI();
  updateDecoderGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  showToast("Klucz Gemini API został pomyślnie zapisany!", "success");
}

function removeDecoderGeminiApiKeyUI() {
  if (!confirm("Czy na pewno chcesz usunąć klucz Gemini API z pamięci przeglądarki?")) return;
  if (!window.geminiService) return;
  window.geminiService.removeApiKey();
  renderDecoderGeminiConfigUI();
  updateDecoderGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  showToast("Klucz API został usunięty. Aktywowano tryb Offline.", "info");
}

async function testDecoderGeminiConnectionUI() {
  const resEl = document.getElementById('decoder-gemini-test-result');
  if (!resEl || !window.geminiService) return;

  resEl.innerHTML = `<span style="color: var(--accent-cyan);">⏳ Testowanie połączenia z ${window.geminiService.getModel()}...</span>`;

  try {
    const reply = await window.geminiService.testConnection();
    resEl.innerHTML = `<span style="color: var(--accent-teal);">✅ Połączenie udane! Odpowiedź: "${escapeHtml(reply)}"</span>`;
    showToast("Test połączenia z modelem Gemini zakończony sukcesem!", "success");
  } catch (err) {
    resEl.innerHTML = `<span style="color: var(--accent-rose);">❌ Błąd połączenia: ${escapeHtml(err.message)}</span>`;
    showToast(`Błąd testu API: ${err.message}`, "error");
  }
}

/**
 * Ładowanie presetu błędu
 */
function loadDecoderPreset(presetArg) {
  const ex = typeof presetArg === 'number' ? EXAMPLES[presetArg] : EXAMPLES.find(e => e.id === presetArg || e.id === `preset_${presetArg}` || e.id.includes(presetArg));
  if (!ex) return;
  const input = document.getElementById('stack-trace-input');
  if (input) {
    input.value = ex.text;
  }
  showToast(`Załadowano przykład: ${ex.label}`, 'info');
  analyzeAndRender();
}

/**
 * Główna funkcja renderująca moduł Dekodera
 */
function renderStackDecoderModule() {
  const container = document.getElementById('stack-decoder-container');
  if (!container) return;

  const currentModel = window.geminiService ? window.geminiService.getModel() : 'gemini-3.5-flash';

  container.innerHTML = `
    <div class="decoder-layout" style="display: flex; flex-direction: column; gap: 1rem;">
      
      <!-- Pasek narzędziowy modelu AI -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🧠</span>
            <label for="decoder-gemini-model-select" style="font-weight: 600; font-size: 0.88rem; margin: 0;">Model Gemini AI:</label>
            <select id="decoder-gemini-model-select" class="form-control" style="width: auto; min-width: 270px; font-weight: 500;" onchange="window.onDecoderGeminiModelChange(this.value)">
              ${renderDecoderModelSelectOptions(currentModel)}
            </select>
          </div>

          <button id="decoder-gemini-status-btn" class="btn btn-secondary btn-sm" onclick="window.toggleDecoderGeminiConfigUI()" style="border-width: 1px; border-style: solid; font-size: 0.82rem;">
            <!-- Renderowane dynamicznie -->
          </button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="window.toggleDecoderGeminiConfigUI()">
            ⚙️ Konfiguracja API
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.clearDecoderAll()">
            🧹 Wyczyść
          </button>
        </div>
      </div>

      <!-- Rozwijany panel konfiguracji Gemini API -->
      <div id="decoder-gemini-config-section" style="display: none;"></div>

      <!-- Szybkie Presety Produkcyjne -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            ⚡ Szybkie Scenariusze Błędów Szpitalnych:
          </span>
          <span style="color: var(--text-muted); font-size: 0.78rem;">
            Kliknij preset aby natychmiast załadować stack trace
          </span>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="decoder-examples-row">
          ${EXAMPLES.map((ex, idx) => `
            <button class="btn btn-sm btn-secondary decoder-example-chip" style="font-size: 0.8rem; border-color: ${ex.color};" onclick="window.loadDecoderPreset(${idx})">
              <span style="color: ${ex.color}; font-weight: bold; margin-right: 4px;">${escapeHtml(ex.badge)}</span> ${escapeHtml(ex.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Obszar wprowadzania błędu -->
      <div class="decoder-input-area" style="display: flex; flex-direction: column; gap: 0.5rem;">
        <textarea id="stack-trace-input"
          style="width: 100%; min-height: 180px; padding: 1rem; font-family: var(--font-mono); background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); resize: vertical; font-size: 0.88rem; line-height: 1.5;"
          placeholder="Wklej stack trace, komunikat błędu z logów lub okna błędu aplikacji Java / .NET / Delphi...">${escapeHtml(EXAMPLES[0].text)}</textarea>
      </div>

      <!-- Przyciski akcji -->
      <div class="decoder-actions" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <button id="btn-analyze-local" class="btn btn-secondary" onclick="window.runDecoderLocalAnalysis()" style="display: flex; align-items: center; gap: 0.5rem;">
          ⚡ Diagnoza Lokalna (Offline STACK_KB)
        </button>
        <button id="btn-analyze-pilot" class="btn btn-primary" onclick="window.runDecoderPilotConsultation()" style="display: flex; align-items: center; gap: 0.5rem; background: var(--accent-purple, #8338ec); border-color: var(--accent-purple, #8338ec);">
          🤖 Uruchom Agenta AI (Interaktywny Pilot REPL)
        </button>
        <button class="btn btn-secondary" onclick="window.clearDecoderAll()">
          🗑️ Wyczyść
        </button>
      </div>

      <!-- Kontener na sesję Interaktywnego Pilota REPL -->
      <div id="decoder-pilot-output" style="display: none; margin-top: 1rem;"></div>

      <!-- Kontener na wyniki diagnozy lokalnej -->
      <div id="stack-decoder-result" style="margin-top: 1rem;"></div>
    </div>
  `;

  updateDecoderGeminiStatusUI();
  // Domyślna analiza lokalna dla pierwszego presetu
  analyzeAndRender();
}

/**
 * Czyszczenie pól
 */
function clearDecoderAll() {
  const input = document.getElementById('stack-trace-input');
  const resContainer = document.getElementById('stack-decoder-result');
  const pilotOutput = document.getElementById('decoder-pilot-output');
  if (input) input.value = '';
  if (resContainer) resContainer.innerHTML = '';
  if (pilotOutput) pilotOutput.style.display = 'none';
  showToast("Wyczyszczono pole błędu.", "info");
}

/**
 * Wyszukiwanie reguł w lokalnej bazie STACK_KB
 */
function analyzeStackTrace(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const matched = [];
  
  for (const rule of STACK_KB) {
    const isMatch = rule.triggers.some(trigger => lowerText.includes(trigger.toLowerCase()));
    if (isMatch) {
      matched.push(rule);
    }
  }
  
  return matched;
}

function runDecoderLocalAnalysis() {
  analyzeAndRender();
  showToast("Wykonano analizę w oparciu o lokalną bazę STACK_KB", "info");
}

function analyzeAndRender() {
  const text = document.getElementById('stack-trace-input')?.value.trim();
  const resContainer = document.getElementById('stack-decoder-result');
  
  if (!text) {
    if (resContainer) resContainer.innerHTML = '';
    return;
  }
  
  const matches = analyzeStackTrace(text);
  renderDecoderResult(matches, text);
}

function renderDecoderResult(matches, rawText) {
  const container = document.getElementById('stack-decoder-result');
  if (!container) return;
  
  if (!matches || matches.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 1rem; align-items: center;">
        <span style="color: var(--text-muted); font-size: 1.05rem;">Brak dopasowania w lokalnej Bazie Wiedzy STACK_KB.</span>
        <button onclick="window.runDecoderPilotConsultation()" class="btn btn-primary" style="background: var(--accent-purple); border-color: var(--accent-purple);">
          🤖 Uruchom Agenta AI (Interaktywny Pilot REPL)
        </button>
      </div>
    `;
    return;
  }
  
  let html = `
    <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 0.85rem; text-transform: uppercase; color: var(--accent-teal); letter-spacing: 0.05em;">
        📋 Wynik Analizy Lokalnej (Dopasowano ${matches.length} reguł STACK_KB):
      </strong>
      <button class="btn btn-primary btn-sm" onclick="window.runDecoderPilotConsultation()" style="font-size: 0.78rem; background: var(--accent-purple); border-color: var(--accent-purple);">
        🤖 Przejdź do Pilota AI (Ping-Pong)
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 1rem;">
  `;
  
  matches.forEach(m => {
    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="background: var(--accent-teal); color: #000; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: bold;">${escapeHtml(m.lang)}</span>
            <span style="color: var(--text-primary); font-weight: bold; font-family: var(--font-mono); font-size: 0.95rem;">${escapeHtml(m.errorClass)}</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">ID: ${escapeHtml(m.id)}</span>
        </div>
        <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
          
          <div>
            <div style="color: var(--accent-amber); font-weight: bold; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              💡 Kontekst biznesowy
            </div>
            <div style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(m.businessContext)}</div>
          </div>
          
          <div>
            <div style="color: var(--accent-rose); font-weight: bold; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              🔍 Prawdopodobna przyczyna
            </div>
            <div style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(m.likelyCause)}</div>
          </div>
    `;

    if (m.cmd) {
      const codeId = `cmd_${Math.random().toString(36).substr(2, 9)}`;
      html += `
          <div>
            <div style="color: var(--text-primary); font-weight: bold; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              💻 Komenda diagnostyczna
            </div>
            <div style="position: relative; background: var(--bg-input); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <code id="${codeId}" style="font-family: var(--font-mono); color: var(--accent-cyan); white-space: pre-wrap;">${escapeHtml(m.cmd)}</code>
              <button onclick="navigator.clipboard.writeText(document.getElementById('${codeId}').innerText); window.showToast && window.showToast('Skopiowano do schowka')" style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(255,255,255,0.1); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: white;">📋 Kopiuj</button>
            </div>
          </div>
      `;
    }

    if (m.diagnosticSQL) {
      const sqlId = `sql_${Math.random().toString(36).substr(2, 9)}`;
      html += `
          <div>
            <div style="color: var(--text-primary); font-weight: bold; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              🗄️ Zapytanie SQL diagnostyczne: <span style="font-weight: normal; color: var(--text-secondary);">${escapeHtml(m.diagnosticSQL.label)}</span>
            </div>
            <div style="position: relative; background: var(--bg-input); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <code id="${sqlId}" style="font-family: var(--font-mono); color: var(--accent-purple); white-space: pre-wrap;">${escapeHtml(m.diagnosticSQL.sql)}</code>
              <button onclick="navigator.clipboard.writeText(document.getElementById('${sqlId}').innerText); window.showToast && window.showToast('Skopiowano SQL do schowka')" style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(255,255,255,0.1); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: white;">📋 Kopiuj</button>
            </div>
          </div>
      `;
    }

    html += `
          <div>
            <div style="color: var(--accent-teal); font-weight: bold; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              ✅ Zalecana akcja
            </div>
            <div style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(m.suggestedAction)}</div>
          </div>
          
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

/* ==========================================================================
   SILNIK INTERAKTYWNEGO PILOTA REPL DLA DEKODERA STACK TRACE'ÓW
   ========================================================================== */

/**
 * Uruchomienie nowej sesji Pilota AI dla Stack Trace
 */
async function runDecoderPilotConsultation() {
  const inputElem = document.getElementById('stack-trace-input');
  const rawLog = inputElem ? inputElem.value.trim() : "";

  if (!rawLog) {
    showToast("Wklej treść błędu lub stack trace przed uruchomieniem Pilota AI!", "warning");
    if (inputElem) inputElem.focus();
    return;
  }

  if (!window.geminiService || !window.geminiService.hasApiKey()) {
    showToast("Brak klucza Gemini API. Kliknij 'Konfiguracja API' aby wprowadzić klucz.", "warning");
    toggleDecoderGeminiConfigUI();
    return;
  }

  const outputContainer = document.getElementById('decoder-pilot-output');
  if (outputContainer) {
    outputContainer.style.display = 'block';
    outputContainer.innerHTML = `
      <div style="background: var(--bg-card); border: 2px solid var(--accent-purple); border-radius: var(--radius-md); padding: 24px; text-align: center;">
        <div style="font-size: 2.2rem; animation: pulse 1.5s infinite;">🧠</div>
        <h4 style="margin: 12px 0 6px 0; color: var(--accent-purple);">Pilot AI analizuje Stack Trace...</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
          Inicjalizacja środowiska Ping-Pong, formułowanie hipotezy root-cause i przygotowanie Kroku 1...
        </p>
      </div>
    `;
    outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  try {
    const session = window.geminiService.getStackDecoderPilotSession();
    await session.start(rawLog, { systemType: 'stack_decoder' }, { systemType: 'stack_decoder' });
    renderDecoderPilotUI();
    showToast("Interaktywny Pilot REPL rozpoczął procedurę diagnostyczną!", "success");
  } catch (err) {
    if (outputContainer) {
      outputContainer.innerHTML = `
        <div style="background: var(--bg-card); border: 2px solid var(--accent-rose); border-radius: var(--radius-md); padding: 20px;">
          <h4 style="color: var(--accent-rose); margin: 0 0 8px 0;">❌ Błąd uruchomienia Pilota AI</h4>
          <p style="font-size: 0.85rem; color: var(--text-primary); margin: 0 0 12px 0;">${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary btn-sm" onclick="window.runDecoderPilotConsultation()">🔄 Ponów próbę</button>
        </div>
      `;
    }
    showToast(`Błąd pilota: ${err.message}`, "error");
  }
}

/**
 * Renderuje interaktywny interfejs Pilota REPL dla Dekodera
 */
function renderDecoderPilotUI() {
  const container = document.getElementById('decoder-pilot-output');
  const session = window.geminiService?.getStackDecoderPilotSession();
  if (!container || !session || !session.isActive()) return;

  const currentModel = window.geminiService.getModel();
  const isResolved = session.isResolved;
  const themeColor = '#8338ec'; // Purple accent dla Dekodera

  container.style.display = 'block';

  let html = `
    <div style="background: var(--bg-card); border: 2px solid ${themeColor}; border-radius: var(--radius-md); padding: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
      
      <!-- Pasek Pamięci Kontekstowej (Memory Header) -->
      <div id="decoder-pilot-memory-header" style="background: rgba(131, 56, 236, 0.08); border-bottom: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 0.75rem; font-weight: 800; background: ${themeColor}; color: #fff; padding: 3px 9px; border-radius: 4px;">
            🔍 Dekoder Stack Trace
          </span>

          <!-- Inline Model Selector -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">Model:</span>
            <select id="decoder-pilot-inline-model-select" style="font-size: 0.74rem; padding: 2px 6px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;" onchange="window.onDecoderGeminiModelChange(this.value)">
              ${renderDecoderModelSelectOptions(currentModel)}
            </select>
          </div>

          <span class="badge" style="font-size: 0.72rem; ${isResolved ? 'background: rgba(6, 214, 160, 0.2); color: var(--accent-teal); border: 1px solid var(--accent-teal);' : 'background: rgba(255, 183, 3, 0.2); color: var(--accent-amber); border: 1px solid var(--accent-amber);'}">
            ${isResolved ? '🟢 STAN: [AWARIA ROZWIĄZANA]' : '🟡 STAN: DIAGNOSTYKA W TOKU'}
          </span>
          <span style="font-size: 0.76rem; color: var(--text-secondary); max-width: 380px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(session.hypothesis)}">
            🎯 <em>${escapeHtml(session.hypothesis)}</em>
          </span>
        </div>

        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.copyDecoderPilotScript()" title="Kopiuj całą procedurę jako skrypt">
            📋 Kopiuj Procedurę
          </button>
          <button class="btn btn-primary btn-sm" style="background: ${themeColor}; border-color: ${themeColor}; font-size: 0.75rem;" onclick="window.saveDecoderPilotSessionAsRunbook()">
            💾 Zapisz do Runbooka
          </button>
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.resetDecoderPilotSession()">
            🔄 Resetuj Sesję
          </button>
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.closeDecoderPilotUI()">
            ✕ Schowaj
          </button>
        </div>
      </div>

      <!-- Zgłoszony stack trace wejściowy (Zwijany) -->
      <details style="margin-bottom: 14px; background: rgba(0, 0, 0, 0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
        <summary style="font-size: 0.78rem; color: var(--accent-cyan); cursor: pointer; font-weight: 700;">
          📋 Podgląd analizowanego Stack Trace (kliknij aby rozwinąć)
        </summary>
        <pre style="margin-top: 8px; padding: 6px; font-size: 0.76rem; background: var(--bg-card); max-height: 100px; overflow-y: auto;"><code>${escapeHtml(session.rawLog)}</code></pre>
      </details>

      <!-- Wątek Incydentu (Chat Stream) -->
      <div id="decoder-pilot-thread" style="display: flex; flex-direction: column; gap: 14px; max-height: 440px; overflow-y: auto; padding-right: 6px; margin-bottom: 16px;">
        ${session.turns.map((t, idx) => {
          if (t.type === 'agent') {
            const p = t.parsed;
            const isSqlCmd = p.isSQL || /^\s*(SELECT|SHOW|EXPLAIN|WITH)\b/i.test(p.command || '');
            const cmdTypeLabel = isSqlCmd ? '🗄️ Zapytanie SQL (DBeaver / psql)' : '💻 Komenda Bash (Terminal)';

            return `
              <div style="background: var(--bg-card); border-left: 4px solid ${themeColor}; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.78rem; font-weight: 800; color: ${themeColor}; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 6px;">
                    🤖 Pilot AI (Dekoder) • Krok ${t.stepNumber}
                  </span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.timestamp)}</span>
                </div>

                ${p.diagnosis ? `
                  <div style="margin-bottom: 8px; font-size: 0.84rem; color: #a7f3d0; background: rgba(6, 214, 160, 0.08); padding: 6px 12px; border-radius: 4px; border-left: 2px solid var(--accent-teal);">
                    <strong>💡 Diagnoza:</strong> ${escapeHtml(p.diagnosis)}
                  </div>
                ` : ''}

                ${(!p.isResolved && p.goal) ? `
                  <div style="font-size: 0.9rem; color: var(--text-primary); font-weight: 600; margin-bottom: 8px;">
                    🎯 <strong>Cel:</strong> ${escapeHtml(p.goal)}
                  </div>
                ` : ''}

                ${(!p.isResolved && p.command) ? `
                  <div style="background: var(--bg-input, #0b1120); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">${cmdTypeLabel}:</span>
                      <button class="btn btn-secondary btn-sm" style="padding: 1px 8px; font-size: 0.72rem;" onclick="navigator.clipboard.writeText(document.getElementById('dec-cmd-${t.stepNumber}').innerText); window.showToast && window.showToast('Skopiowano polecenie!')">📋 Kopiuj</button>
                    </div>
                    <pre style="margin: 0; padding: 4px 0; background: transparent;"><code id="dec-cmd-${t.stepNumber}" style="color: #67e8f9; font-size: 0.88rem; font-family: var(--font-mono); white-space: pre-wrap;">${escapeHtml(p.command)}</code></pre>
                  </div>
                ` : ''}

                ${(!p.isResolved && p.expectation) ? `
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="font-size: 0.82rem; color: #fde047;">
                      ❓ <strong>Oczekiwanie:</strong> ${escapeHtml(p.expectation)}
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="window.askDecoderStepFeedback(${t.stepNumber})" style="font-size: 0.72rem; padding: 2px 8px; color: ${themeColor}; border-color: var(--border-color);">
                      💬 Problem z tym krokiem? (Zapytaj o korektę)
                    </button>
                  </div>
                ` : ''}

                ${p.isResolved ? `
                  <div style="margin-top: 12px; background: rgba(6, 214, 160, 0.15); border: 2px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 12px; color: var(--accent-teal);">
                    <h4 style="margin: 0 0 4px 0; font-size: 1rem;">🎉 [AWARIA ROZWIĄZANA]</h4>
                    <p style="margin: 0 0 10px 0; font-size: 0.82rem; color: var(--text-primary);">
                      Procedura zakończona sukcesem! Przyczyna wyjątku została zidentyfikowana i zweryfikowana.
                    </p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="btn btn-primary btn-sm" onclick="window.saveDecoderPilotSessionAsRunbook()">💾 Zapisz kompletny Runbook do bazy</button>
                      <button class="btn btn-secondary btn-sm" onclick="window.resetDecoderPilotSession()">🔄 Rozpocznij nową sesję</button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          } else {
            return `
              <div style="background: rgba(15, 23, 42, 0.6); border-left: 4px solid var(--accent-cyan); border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 0.78rem; font-weight: 800; color: var(--accent-cyan);">
                    💻 Inżynier (Wynik terminala / klienta SQL) • Krok ${t.stepNumber}
                  </span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.timestamp)}</span>
                </div>
                <pre style="margin: 0; padding: 8px 10px; background: #0b1120; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.06); max-height: 160px; overflow-y: auto;"><code style="color: #4ade80; font-family: var(--font-mono); font-size: 0.82rem; white-space: pre-wrap;">${escapeHtml(t.text)}</code></pre>
              </div>
            `;
          }
        }).join('')}
      </div>

      <!-- Dolny Pasek Wprowadzania Wyniku (Input Console) -->
      ${!isResolved ? `
        <div id="decoder-pilot-input-box" style="background: var(--bg-card); border: 1.5px solid ${themeColor}; border-radius: var(--radius-sm); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label for="decoder-pilot-input" style="font-size: 0.82rem; font-weight: 700; color: ${themeColor};">
              💬 Wklej wynik terminala lub zapytania SQL dla Kroku ${session.stepNumber}:
            </label>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Skrót: <strong>Ctrl + Enter</strong> aby wysłać</span>
          </div>
          <textarea id="decoder-pilot-input" class="doc-textarea" style="min-height: 65px; font-family: var(--font-mono); font-size: 0.85rem; color: #fde047;" placeholder="Wklej tutaj wynik polecenia lub zapytania..."></textarea>
          <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-primary btn-sm" id="decoder-pilot-submit-btn" onclick="window.submitDecoderPilotInput()">
              ⚡ Wyślij wynik do analizy (Ctrl+Enter)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.sendDecoderPilotQuickSuccess()">
              ✅ Sukces (Kod 0 / Wynik poprawny)
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--accent-amber);" onclick="window.submitDecoderPilotInput('Błąd zapytania: tabela lub kolumna nie istnieje')">
              ⚠️ Brak tabeli w bazie
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.submitDecoderPilotInput('Błąd: Permission denied / Odmowa dostępu')">
              🔒 Brak uprawnień
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.submitDecoderPilotInput('Zapytanie zwróciło 0 wierszy (brak dopasowań)')">
              🔍 Pusty wynik (0 wierszy)
            </button>
          </div>
          <div id="decoder-pilot-loading" style="display: none; margin-top: 8px; font-size: 0.8rem; color: ${themeColor};">
            <span class="pulse-dot" style="display: inline-block; width: 8px; height: 8px; background: ${themeColor}; border-radius: 50%; margin-right: 6px;"></span>
            Pilot AI analizuje wynik i przygotowuje kolejną komendę diagnostyczną...
          </div>
        </div>
      ` : `
        <div style="background: rgba(6, 214, 160, 0.08); border: 1.5px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 0.92rem; font-weight: 800; color: var(--accent-teal); display: flex; align-items: center; gap: 6px;">
              <span>🎉</span> Problem powiązany ze Stack Trace został pomyślnie rozwiązany!
            </div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              Wprowadzanie zostało zablokowane. Możesz zapisać pełny raport post-mortem do Bazy Runbooków.
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" style="background: var(--accent-teal); border-color: var(--accent-teal); font-weight: 700;" onclick="window.saveDecoderPilotSessionAsRunbook()">
              💾 Zapisz post-mortem do Runbooka
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.resetDecoderPilotSession()">
              🔄 Nowa analiza
            </button>
          </div>
        </div>
      `}

    </div>
  `;

  container.innerHTML = html;

  setTimeout(() => {
    const thread = document.getElementById('decoder-pilot-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
    const inputElem = document.getElementById('decoder-pilot-input');
    if (inputElem) {
      inputElem.focus();
      inputElem.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitDecoderPilotInput();
        }
      });
    }
  }, 50);
}

/**
 * Przesyła kolejną turę inżyniera do Pilota AI
 */
async function submitDecoderPilotInput(overrideText) {
  const session = window.geminiService?.getStackDecoderPilotSession();
  if (!session) return;

  if (session.isResolved) {
    showToast("Problem został już rozwiązany! Zapisz runbook lub zresetuj sesję.");
    return;
  }

  const inputElem = document.getElementById('decoder-pilot-input');
  const text = overrideText !== undefined ? overrideText : (inputElem ? inputElem.value : "");

  if (overrideText === undefined && (!text || !text.trim())) {
    showToast("Wklej wynik z terminala lub klienta SQL!");
    if (inputElem) inputElem.focus();
    return;
  }

  const submitBtn = document.getElementById('decoder-pilot-submit-btn');
  const loadingDiv = document.getElementById('decoder-pilot-loading');
  if (submitBtn) submitBtn.disabled = true;
  if (loadingDiv) loadingDiv.style.display = 'block';

  try {
    await session.sendUserTurn(text);
    renderDecoderPilotUI();
    showToast(`Pilot przygotował Krok ${session.stepNumber}!`, 'info');
  } catch (err) {
    showToast(`Błąd pilota: ${err.message}`, 'error');
    if (loadingDiv) {
      loadingDiv.innerHTML = `<span style="color: var(--accent-rose);">❌ ${escapeHtml(err.message)}</span>`;
    }
    if (submitBtn) submitBtn.disabled = false;
  }
}

function sendDecoderPilotQuickSuccess() {
  submitDecoderPilotInput("[Polecenie/zapytanie wykonało się pomyślnie (exit code 0 / brak błędu / potwierdzone)]");
}

function askDecoderStepFeedback(stepNumber) {
  const defaultText = `Krok ${stepNumber}: Wystąpił problem przy wykonaniu (błąd uprawnień / brak tabeli / brak pliku). Zaproponuj alternatywną, bezpieczną komendę lub zapytanie weryfikujące.`;
  const userFeedback = prompt(`Podaj informację zwrotną dla Kroku ${stepNumber} (lub wklej treść błędu):`, defaultText);
  if (userFeedback && userFeedback.trim()) {
    submitDecoderPilotInput(userFeedback.trim());
  }
}

function saveDecoderPilotSessionAsRunbook() {
  const session = window.geminiService?.getStackDecoderPilotSession();
  if (!session || session.turns.length === 0) {
    showToast("Brak historii sesji pilota do zapisania.");
    return;
  }

  const record = session.toRunbookRecord();
  if (window.appState && typeof window.appState.saveIncidentRunbook === 'function') {
    window.appState.saveIncidentRunbook(record);
    if (typeof window.renderRunbooksArchiveUI === 'function') {
      window.renderRunbooksArchiveUI();
    }
    showToast(`Zapisano sesję Pilota Dekodera do Bazy Runbooków!`, 'success');
  }
}

function copyDecoderPilotScript() {
  const session = window.geminiService?.getStackDecoderPilotSession();
  if (!session) return;
  const cmds = session.getAllCommands();
  if (cmds.length === 0) {
    showToast("Brak wygenerowanych poleceń do skopiowania.");
    return;
  }
  const scriptText = `#!/bin/bash\n# Wygenerowana procedura naprawcza Pilota AI (Dekoder Stack Trace)\n\n` + cmds.join('\n\n');
  navigator.clipboard.writeText(scriptText)
    .then(() => showToast("Skopiowano całą procedurę do schowka!", "success"))
    .catch(() => showToast("Błąd kopiowania do schowka.", "error"));
}

function resetDecoderPilotSession() {
  const session = window.geminiService?.getStackDecoderPilotSession();
  if (session) session.reset();
  const pilotOutput = document.getElementById('decoder-pilot-output');
  if (pilotOutput) pilotOutput.style.display = 'none';
  showToast("Zresetowano sesję Pilota AI.", "info");
}

function closeDecoderPilotUI() {
  const pilotOutput = document.getElementById('decoder-pilot-output');
  if (pilotOutput) pilotOutput.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.STACK_KB = STACK_KB;
  window.EXAMPLES = EXAMPLES;
  window.STACK_PRESETS = EXAMPLES;
  window.GEMINI_MODELS = GEMINI_MODELS;
  window.renderStackDecoderModule = renderStackDecoderModule;
  window.analyzeStackTrace = analyzeStackTrace;
  window.runDecoderLocalAnalysis = runDecoderLocalAnalysis;
  window.runDecoderPilotConsultation = runDecoderPilotConsultation;
  window.renderDecoderPilotUI = renderDecoderPilotUI;
  window.submitDecoderPilotInput = submitDecoderPilotInput;
  window.sendDecoderPilotQuickSuccess = sendDecoderPilotQuickSuccess;
  window.askDecoderStepFeedback = askDecoderStepFeedback;
  window.saveDecoderPilotSessionAsRunbook = saveDecoderPilotSessionAsRunbook;
  window.copyDecoderPilotScript = copyDecoderPilotScript;
  window.resetDecoderPilotSession = resetDecoderPilotSession;
  window.closeDecoderPilotUI = closeDecoderPilotUI;
  window.onDecoderGeminiModelChange = onDecoderGeminiModelChange;
  window.updateDecoderGeminiStatusUI = updateDecoderGeminiStatusUI;
  window.toggleDecoderGeminiConfigUI = toggleDecoderGeminiConfigUI;
  window.saveDecoderGeminiApiKeyUI = saveDecoderGeminiApiKeyUI;
  window.removeDecoderGeminiApiKeyUI = removeDecoderGeminiApiKeyUI;
  window.testDecoderGeminiConnectionUI = testDecoderGeminiConnectionUI;
  window.loadDecoderPreset = loadDecoderPreset;
  window.loadStackDecoderPreset = loadDecoderPreset;
  window.clearDecoderAll = clearDecoderAll;
}

})();
