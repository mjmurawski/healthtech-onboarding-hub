(function() {
'use strict';

const SQL_TEMPLATES = {
  lis: {
    zlecenie_by_kod: {
      label: 'Zlecenie po kodzie kreskowym',
      paramLabel: 'Kod kreskowy próbki',
      paramPlaceholder: 'np. 2024091500042',
      template: (param, db) => {
        let limitClause = '';
        if (db === 'postgresql') limitClause = 'LIMIT 100';
        else if (db === 'firebird') limitClause = '';
        
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 100';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 100';

        return `${selectPrefix} 
  z.id,
  z.nr_zlecenia,
  z.kod_kreskowy,
  z.status,
  z.data_rejestracji,
  z.data_przyjecia,
  p.pesel,
  p.imie || ' ' || p.nazwisko AS pacjent,
  o.nazwa AS oddzial
FROM zlecenia z
  JOIN pacjenci p ON z.id_pacjenta = p.id
  LEFT JOIN oddzialy o ON z.id_oddzialu = o.id
WHERE z.kod_kreskowy = '${param}'
${db === 'oracle' ? 'AND ROWNUM <= 100' : ''}
${db === 'postgresql' ? limitClause : ''};`;
      }
    },
    pozycje_zlecenia: { 
      label: 'Pozycje zlecenia (badania)', 
      paramLabel: 'ID zlecenia', 
      paramPlaceholder: 'np. 102938',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 100';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 100';
        
        return `${selectPrefix}
  pz.id,
  pz.id_zlecenia,
  pz.kod_badania,
  s.nazwa AS nazwa_badania,
  pz.status,
  pz.wynik,
  pz.jednostka,
  pz.flaga,
  pz.data_wykonania
FROM pozycje_zlecenia pz
  JOIN slownik_badan s ON pz.kod_badania = s.kod
WHERE pz.id_zlecenia = ${param || 0}
${db === 'oracle' ? 'AND ROWNUM <= 100' : ''}
${db === 'postgresql' ? 'LIMIT 100' : ''};`;
      }
    },
    kolejka_prob: { 
      label: 'Status w kolejce próbek', 
      paramLabel: 'ID zlecenia', 
      paramPlaceholder: 'np. 102938',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 100';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 100';
        
        return `${selectPrefix}
  k.id,
  k.id_zlecenia,
  k.nr_probki,
  k.stanowisko,
  k.status,
  k.data_dodania
FROM kolejka_probek k
WHERE k.id_zlecenia = ${param || 0}
ORDER BY k.data_dodania DESC
${db === 'oracle' ? 'AND ROWNUM <= 100' : ''}
${db === 'postgresql' ? 'LIMIT 100' : ''};`;
      } 
    },
    kom_wychodzace: { 
      label: 'Komunikaty wychodzące do analizatora', 
      paramLabel: 'ID zlecenia', 
      paramPlaceholder: 'np. 102938',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 100';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 100';
        
        let dateFilter = '';
        if (db === 'postgresql') dateFilter = "NOW() - INTERVAL '7 days'";
        else if (db === 'oracle') dateFilter = "SYSDATE - 7";
        else if (db === 'sqlserver') dateFilter = "GETDATE() - 7";
        else if (db === 'firebird') dateFilter = "CURRENT_TIMESTAMP - 7";
        
        return `${selectPrefix}
  hw.id,
  hw.id_zlecenia,
  hw.id_analizatora,
  a.nazwa AS analizator,
  hw.typ_komunikatu,
  hw.tresc_hl7,
  hw.status,
  hw.data_wyslania,
  hw.ilosc_bledow
FROM hl7_wychodzace hw
  JOIN analizatory a ON hw.id_analizatora = a.id
WHERE hw.id_zlecenia = ${param || 0}
  AND hw.data_utworzenia >= ${dateFilter}
${db === 'oracle' ? 'AND ROWNUM <= 100' : ''}
${db === 'postgresql' ? 'LIMIT 100' : ''};`;
      } 
    },
    wyniki: { 
      label: 'Wyniki badań do zlecenia', 
      paramLabel: 'ID zlecenia',
      paramPlaceholder: 'np. 102938', 
      template: (param, db) => {
        return `SELECT
  w.id,
  w.id_zlecenia,
  w.kod_parametru,
  w.wartosc_tekstowa,
  w.wartosc_liczbowa,
  w.zakres_ref_min,
  w.zakres_ref_max,
  w.data_autoryzacji,
  w.id_diagnosty
FROM wyniki w
WHERE w.id_zlecenia = ${param || 0};`;
      } 
    },
    sesje_kom: { 
      label: 'Aktywne sesje komunikacyjne', 
      paramLabel: '(brak - lista)', 
      paramPlaceholder: 'brak',
      template: (_, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 50';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 50';
        
        let dateFilter = '';
        if (db === 'postgresql') dateFilter = "NOW() - INTERVAL '1 day'";
        else if (db === 'oracle') dateFilter = "SYSDATE - 1";
        else if (db === 'sqlserver') dateFilter = "GETDATE() - 1";
        else if (db === 'firebird') dateFilter = "CURRENT_TIMESTAMP - 1";

        return `${selectPrefix}
  s.id,
  s.id_analizatora,
  a.nazwa,
  s.status,
  s.data_rozpoczecia,
  s.ostatnia_aktywnosc,
  s.bajty_wyslane,
  s.bajty_odebrane
FROM sesje_komunikacyjne s
  JOIN analizatory a ON s.id_analizatora = a.id
WHERE s.status = 'AKTYWNA' 
  OR s.ostatnia_aktywnosc >= ${dateFilter}
ORDER BY s.ostatnia_aktywnosc DESC
${db === 'oracle' ? 'AND ROWNUM <= 50' : ''}
${db === 'postgresql' ? 'LIMIT 50' : ''};`;
      } 
    }
  },
  ekrew: {
    preparat_by_nr: { 
      label: 'Preparat po numerze', 
      paramLabel: 'Nr preparatu / ISBT 128', 
      paramPlaceholder: 'np. =P01232312345600',
      template: (param, db) => {
        return `SELECT 
  p.id, 
  p.nr_preparatu, 
  p.kod_isbt, 
  p.typ_krwi, 
  p.rh, 
  p.status, 
  p.data_pobrania, 
  p.data_waznosci 
FROM preparaty p 
WHERE p.nr_preparatu = '${param}' OR p.kod_isbt = '${param}';`;
      } 
    },
    transakcje_temp: { 
      label: 'Transakcje tymczasowe preparatu', 
      paramLabel: 'ID preparatu', 
      paramPlaceholder: 'np. 998877',
      template: (param, db) => {
        return `SELECT
  t.id,
  t.id_preparatu,
  t.typ_operacji,
  t.uzytkownik,
  t.stacja_robocza,
  t.data_rozpoczecia,
  t.data_zakonczenia,
  t.status_transakcji
FROM transakcje_preparatow t
WHERE t.id_preparatu = ${param || 0}
ORDER BY t.data_rozpoczecia DESC;`;
      } 
    },
    zamowienia: { 
      label: 'Zamówienia na krew', 
      paramLabel: 'ID zamówienia lub oddziału', 
      paramPlaceholder: 'np. 1020',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 100';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 100';

        return `${selectPrefix}
  z.id,
  z.id_oddzialu,
  o.nazwa AS oddzial,
  z.status,
  z.priorytet,
  z.data_zlozenia,
  z.data_realizacji,
  z.uwagi
FROM zamowienia_krew z
  LEFT JOIN oddzialy o ON z.id_oddzialu = o.id
WHERE z.id = ${param || 0} OR z.id_oddzialu = ${param || 0}
ORDER BY z.data_zlozenia DESC
${db === 'oracle' ? 'AND ROWNUM <= 100' : ''}
${db === 'postgresql' ? 'LIMIT 100' : ''};`;
      } 
    },
    synchronizacja: { 
      label: 'Status synchronizacji z CKiK', 
      paramLabel: '(brak - lista)', 
      paramPlaceholder: 'brak',
      template: (_, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 20';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 20';
        
        return `${selectPrefix}
  s.id,
  s.kierunek,
  s.typ_danych,
  s.status,
  s.data_rozpoczecia,
  s.data_zakonczenia,
  s.liczba_rekordow,
  s.komunikat_bledu
FROM logi_synchronizacji_ckik s
ORDER BY s.data_rozpoczecia DESC
${db === 'oracle' ? 'AND ROWNUM <= 20' : ''}
${db === 'postgresql' ? 'LIMIT 20' : ''};`;
      } 
    }
  },
  patexpert: {
    badanie_by_nr: { 
      label: 'Badanie patomorfologiczne', 
      paramLabel: 'Nr badania', 
      paramPlaceholder: 'np. PAT-2024-001',
      template: (param, db) => {
        return `SELECT 
  b.id, 
  b.nr_badania, 
  b.status, 
  b.data_rejestracji, 
  b.id_lekarza, 
  s.sciezka_pliku, 
  s.status_uploadu, 
  s.rozmiar_mb 
FROM badania b 
  LEFT JOIN skany_wsi s ON b.id = s.id_badania 
WHERE b.nr_badania = '${param}';`;
      } 
    },
    skany_wsi: { 
      label: 'Skany WSI bez powiązanego badania', 
      paramLabel: '(brak - lista)', 
      paramPlaceholder: 'brak',
      template: (_, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 50';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 50';

        return `${selectPrefix}
  s.id,
  s.nazwa_pliku,
  s.sciezka_pliku,
  s.rozmiar_mb,
  s.data_utworzenia,
  s.status_przetwarzania
FROM skany_wsi s
WHERE s.id_badania IS NULL
ORDER BY s.data_utworzenia DESC
${db === 'oracle' ? 'AND ROWNUM <= 50' : ''}
${db === 'postgresql' ? 'LIMIT 50' : ''};`;
      } 
    },
    konwersje: { 
      label: 'Błędy konwersji obrazów', 
      paramLabel: '(brak - lista)', 
      paramPlaceholder: 'brak',
      template: (_, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 50';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 50';
        
        return `${selectPrefix}
  k.id,
  k.id_skanu,
  k.format_zrodlowy,
  k.format_docelowy,
  k.data_rozpoczecia,
  k.status,
  k.komunikat_bledu,
  k.kod_bledu
FROM kolejka_konwersji k
WHERE k.status = 'BŁĄD'
ORDER BY k.data_rozpoczecia DESC
${db === 'oracle' ? 'AND ROWNUM <= 50' : ''}
${db === 'postgresql' ? 'LIMIT 50' : ''};`;
      } 
    }
  },
  genetyka: {
    plik_vcf: { 
      label: 'Plik VCF / FASTQ po próbce', 
      paramLabel: 'ID próbki lub nazwa pliku', 
      paramPlaceholder: 'np. SAMP-9900',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 10';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 10';
        
        return `${selectPrefix}
  p.id,
  p.id_probki,
  p.nazwa_pliku,
  p.sciezka,
  p.typ_pliku,
  p.rozmiar_gb,
  p.suma_kontrolna,
  p.data_dodania
FROM pliki_sekwencjonowania p
WHERE p.id_probki = '${param}' OR p.nazwa_pliku LIKE '%${param}%'
${db === 'oracle' ? 'AND ROWNUM <= 10' : ''}
${db === 'postgresql' ? 'LIMIT 10' : ''};`;
      } 
    },
    zadania_pipeline: { 
      label: 'Aktywne zadania pipeline', 
      paramLabel: '(brak - lista)', 
      paramPlaceholder: 'brak',
      template: (_, db) => {
        return `SELECT
  z.id,
  z.id_probki,
  z.nazwa_pipeline,
  z.status,
  z.krok_biezacy,
  z.procent_ukonczenia,
  z.data_startu,
  z.estymowany_czas_zakonczenia,
  z.wezel_obliczeniowy
FROM zadania_pipeline z
WHERE z.status IN ('W_KOLEJCE', 'W_TOKU')
ORDER BY z.data_startu ASC;`;
      } 
    },
    raporty: { 
      label: 'Raporty genetyczne – status generowania', 
      paramLabel: 'ID pacjenta lub badania', 
      paramPlaceholder: 'np. 12345',
      template: (param, db) => {
        let selectPrefix = 'SELECT';
        if (db === 'sqlserver') selectPrefix = 'SELECT TOP 20';
        else if (db === 'firebird') selectPrefix = 'SELECT FIRST 20';

        return `${selectPrefix}
  r.id,
  r.id_badania,
  r.id_pacjenta,
  r.wersja_szablonu,
  r.status,
  r.sciezka_pdf,
  r.podpis_cyfrowy,
  r.data_wygenerowania
FROM raporty_genetyczne r
WHERE r.id_badania = '${param}' OR r.id_pacjenta = '${param}'
ORDER BY r.data_wygenerowania DESC
${db === 'oracle' ? 'AND ROWNUM <= 20' : ''}
${db === 'postgresql' ? 'LIMIT 20' : ''};`;
      } 
    }
  }
};

const SQL_SYSTEM_INSTRUCTION = `Jesteś ekspertem SQL dla systemów medycznych (LIS, eKrew, PatExpert, Genetyka).
Wygeneruj WYŁĄCZNIE zapytanie SELECT do diagnostyki. BEZWZGLĘDNY ZAKAZ generowania UPDATE, DELETE, INSERT, DROP, TRUNCATE, ALTER!
Zapytanie powinno być:
- Bezpieczne (tylko odczyt)
- Używać aliasów tabel dla czytelności
- Zawierać JOIN-y do tabel słownikowych gdzie to konieczne
- Mieć komentarze (--) wyjaśniające każdą sekcję
- Zakończone średnikiem
Odpowiedz TYLKO blokiem SQL (\`\`\`sql ... \`\`\`), bez żadnego dodatkowego tekstu!`;

const escapeHtml = function(unsafe) {
  if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
    return window.escapeHtml(unsafe);
  }
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const showToast = function(message, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[Toast ${type}] ${message}`);
  }
};

function highlightSQL(sql) {
  if (!sql) return '';
  let highlighted = escapeHtml(sql);

  // Comments (muted) - process first and ensure -- is preceded by whitespace/line start
  highlighted = highlighted.replace(/(^|[\r\n\s])(--[^\r\n]*)/g, '$1<span style="color: var(--text-muted);">$2</span>');

  // String literals (amber)
  highlighted = highlighted.replace(/(&#039;.*?&#039;|&#39;.*?&#39;|'.*?')/g, '<span style="color: var(--accent-amber);">$1</span>');

  // Keywords (cyan)
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 
    'IN', 'LIKE', 'IS', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'TOP', 'FIRST', 'AS', 
    'DISTINCT', 'COUNT', 'SUM', 'MAX', 'MIN', 'AVG', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BEGIN', 
    'COMMIT', 'ROLLBACK', 'UPDATE', 'SET', 'INSERT', 'INTO', 'VALUES', 'DELETE', 'TRANSACTION'
  ];
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  
  highlighted = highlighted.replace(keywordRegex, (match) => {
    return `<span style="color: var(--accent-cyan); font-weight: bold;">${match.toUpperCase()}</span>`;
  });

  // Numbers (teal)
  const numberRegex = /\b(\d+(?:\.\d+)?)\b/g;
  highlighted = highlighted.replace(numberRegex, '<span style="color: var(--accent-teal);">$1</span>');

  return highlighted;
}

function copySQLBlock(sqlText) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(sqlText).then(() => {
      showToast('Skopiowano kod SQL do schowka', 'success');
    }).catch(err => {
      showToast('Błąd podczas kopiowania: ' + err, 'error');
    });
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = sqlText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Skopiowano kod SQL do schowka', 'success');
    } catch (err) {
      showToast('Błąd podczas kopiowania', 'error');
    }
    document.body.removeChild(textArea);
  }
}

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
 * Gotowe presety diagnostyczne zapytań SQL dla systemów medycznych
 */
const SQL_PRESETS = [
  {
    id: 'lis_buffer',
    icon: '🧪',
    system: 'LIS',
    db: 'postgresql',
    title: 'LIS: Zablokowane bufory ASTM/HL7',
    desc: 'Zlecenia wychodzące w buforze ze statusem OCZEKUJE wiszące >15 min',
    prompt: "Analizator laboratoryjny Cobas przestał pobierać nowe zlecenia z bufora. Sprawdź w bazie LIS zlecenia wychodzące w buforze ASTM/HL7 ze statusem OCZEKUJE lub BLAD, które wiszą dłużej niż 15 minut, wraz z numerami próbek i czasem rejestracji."
  },
  {
    id: 'ekrew_temp',
    icon: '🩸',
    system: 'eKrew',
    db: 'postgresql',
    title: 'eKrew: Zawieszone transakcje preparatów krwi',
    desc: 'Preparaty w statusie ZAREZERWOWANY w transakcje_temp starsze niż 2h',
    prompt: "Preparat krwi (KKCz) widnieje jako zablokowany do wydania mimo braku aktywnego zamówienia. Znajdź w bazie eKrew preparaty w statusie ZAREZERWOWANY powiązane z transakcjami tymczasowymi w tabeli transakcje_temp starszymi niż 2 godziny."
  },
  {
    id: 'patexpert_wsi',
    icon: '🔬',
    system: 'PatExpert',
    db: 'postgresql',
    title: 'PatExpert: Brakujące skany WSI na macierzy',
    desc: 'Badania z ostatnich 7 dni bez powiązanego pliku skanu WSI',
    prompt: "Lekarz patomorfolog zgłasza brak podglądu skanu mikroskopowego w przeglądarce. Sprawdź badania histopatologiczne z ostatnich 7 dni, które posiadają status ZAKONCZONE, ale brakuje dla nich powiązanego pliku skanu WSI w tabeli skany_wsi lub status uploadu to BLAD."
  },
  {
    id: 'genetyka_pipeline',
    icon: '🧬',
    system: 'Genetyka',
    db: 'postgresql',
    title: 'Genetyka: Wiszące zadania pipeline NGS',
    desc: 'Procesy w zadania_pipeline bez aktualizacji od ponad 1 godziny',
    prompt: "Pipeline bioinformatyczny analizy NGS zatrzymał się bez zakończenia. Zlokalizuj w zadania_pipeline procesy ze statusem AKTYWNY lub PRZETWARZANY, których pole data_ostatniej_aktualizacji nie zmieniło się od ponad 1 godziny, wraz z próbką i identyfikatorem joba."
  },
  {
    id: 'postgres_locks',
    icon: '🐘',
    system: 'LIS',
    db: 'postgresql',
    title: 'PostgreSQL: Blokady tabel i długie locki',
    desc: 'Identyfikacja blokujących sesji, idle in transaction i locków pg_locks',
    prompt: "Aplikacja medyczna zgłasza timeouty zapytań SQL do bazy PostgreSQL. Sprawdź aktywne blokady tabel, sesje w stanie 'idle in transaction' oraz zidentyfikuj blokujący PID i zapytanie SQL przy użyciu pg_stat_activity i pg_locks."
  }
];

/**
 * Wczytuje wybrany preset do formularza generatora SQL
 */
function loadSqlGenPreset(presetId) {
  const preset = SQL_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  if (!window.sqlGenState) {
    window.sqlGenState = {
      activeTab: 3,
      mode1: { system: 'lis', entity: 'zlecenie_by_kod', param: '', db: 'postgresql' },
      mode2: { table: '', keyCol: '', keyVal: '', changeCol: '', newVal: '', db: 'postgresql' },
      mode3: { prompt: '', system: 'LIS', db: 'postgresql' }
    };
  }

  window.sqlGenState.activeTab = 3;
  window.sqlGenState.mode3.prompt = preset.prompt;
  window.sqlGenState.mode3.system = preset.system;
  window.sqlGenState.mode3.db = preset.db || 'postgresql';

  window.sqlGenRenderTabs();

  const promptInput = document.getElementById('ai-prompt');
  if (promptInput) {
    promptInput.value = preset.prompt;
    promptInput.focus();
  }

  showToast(`Załadowano preset diagnostyczny: ${preset.title}`, 'info');
}

/**
 * Zmiana modelu AI z paska narzędzi Generatora SQL
 */
function onSqlGenGeminiModelChange(modelName) {
  if (!window.geminiService || !modelName) return;

  window.geminiService.setModel(modelName);

  const ids = [
    'sqlgen-gemini-model-select',
    'sqlgen-gemini-config-model-select',
    'sqlgen-pilot-inline-model-select',
    'decoder-gemini-model-select',
    'decoder-gemini-config-model-select',
    'decoder-pilot-inline-model-select',
    'med-gemini-model-select',
    'med-gemini-config-model-select',
    'med-pilot-inline-model-select',
    'doc-gemini-model-select',
    'doc-gemini-config-model-select',
    'gemini-model-select'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== modelName) {
      el.value = modelName;
    }
  });

  updateSqlGenGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  showToast(`Ustawiono aktywny model AI: ${modelName}`, 'success');
}

/**
 * Aktualizacja wskaźnika statusu API w Generatorze SQL
 */
function updateSqlGenGeminiStatusUI() {
  const btn = document.getElementById('sqlgen-gemini-status-btn');
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
    btn.title = `Brak klucza API Gemini. Kliknij aby wprowadzić klucz lub korzystaj z wbudowanych szablonów.`;
  }

  const modelSelect = document.getElementById('sqlgen-gemini-model-select');
  if (modelSelect && modelSelect.value !== currentModel) {
    modelSelect.value = currentModel;
  }
}

/**
 * Otwiera / zamyka rozwijany panel konfiguracji API
 */
function toggleSqlGenGeminiConfigUI() {
  const panel = document.getElementById('sqlgen-gemini-config-section');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderSqlGenGeminiConfigUI();
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Renderuje zawartość panelu konfiguracji API
 */
function renderSqlGenGeminiConfigUI() {
  const panel = document.getElementById('sqlgen-gemini-config-section');
  if (!panel || !window.geminiService) return;

  const hasKey = window.geminiService.hasApiKey();
  const currentKey = window.geminiService.getApiKey();
  const currentModel = window.geminiService.getModel();
  const maskedKey = currentKey ? `${currentKey.substring(0, 6)}...${currentKey.substring(currentKey.length - 4)}` : '';

  panel.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>⚙️ Konfiguracja Google Gemini API (Generator SQL)</span>
        </h4>
        <button class="btn btn-secondary btn-sm" onclick="window.toggleSqlGenGeminiConfigUI()">✕ Zamknij</button>
      </div>
      <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 16px;">
        Klucz API jest przechowywany wyłącznie w pamięci Twojej przeglądarki (Bring Your Own Key). Model Gemini napędza Agenta AI w formułowaniu bezpiecznych zapytań SELECT oraz prowadzeniu sesji REPL krok po kroku.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Klucz Google Gemini API:</label>
          <div style="display: flex; gap: 8px;">
            <input type="password" id="sqlgen-gemini-key-input" class="form-control" style="flex: 1; font-family: monospace;" 
                   placeholder="AIzaSy..." value="${escapeHtml(currentKey || '')}">
            <button class="btn btn-primary btn-sm" onclick="window.saveSqlGenGeminiApiKeyUI()">💾 Zapisz</button>
            ${hasKey ? `<button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.removeSqlGenGeminiApiKeyUI()">🗑️</button>` : ''}
          </div>
          ${hasKey ? `<div style="font-size: 0.75rem; color: var(--accent-teal); margin-top: 4px;">Aktywny klucz: ${maskedKey}</div>` : ''}
        </div>

        <div>
          <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Aktywny Model Gemini:</label>
          <select id="sqlgen-gemini-config-model-select" class="form-control" onchange="window.onSqlGenGeminiModelChange(this.value)">
            ${GEMINI_MODELS.map(m => `<option value="${m.value}" ${m.value === currentModel ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
          </select>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
            Domyślny: <code>gemini-3.5-flash</code> (szybki, deterministyczny, zoptymalizowany pod zapytania SQL).
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <button class="btn btn-secondary btn-sm" onclick="window.testSqlGenGeminiConnectionUI()">⚡ Testuj Połączenie</button>
        <span id="sqlgen-gemini-test-status" style="font-size: 0.82rem; color: var(--text-secondary);"></span>
      </div>
    </div>
  `;
}

/**
 * Zapisanie klucza API z panelu
 */
function saveSqlGenGeminiApiKeyUI() {
  const input = document.getElementById('sqlgen-gemini-key-input');
  if (!input || !window.geminiService) return;
  const val = input.value.trim();
  if (!val) {
    showToast("Wprowadź prawidłowy klucz Gemini API!", "warning");
    return;
  }
  window.geminiService.setApiKey(val);
  updateSqlGenGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  renderSqlGenGeminiConfigUI();
  showToast("Klucz Gemini API został zapisany pomyślnie!", "success");
}

/**
 * Usunięcie klucza API z panelu
 */
function removeSqlGenGeminiApiKeyUI() {
  if (!window.geminiService) return;
  if (!confirm("Czy na pewno chcesz usunąć klucz Gemini API z przeglądarki?")) return;
  window.geminiService.removeApiKey();
  updateSqlGenGeminiStatusUI();
  if (typeof window.updateGeminiStatusUI === 'function') {
    window.updateGeminiStatusUI();
  }
  renderSqlGenGeminiConfigUI();
  showToast("Usunięto klucz Gemini API.", "info");
}

/**
 * Test połączenia z modelem Gemini
 */
async function testSqlGenGeminiConnectionUI() {
  const statusEl = document.getElementById('sqlgen-gemini-test-status');
  if (!window.geminiService || !statusEl) return;
  if (!window.geminiService.hasApiKey()) {
    statusEl.innerHTML = `<span style="color: var(--accent-rose);">❌ Brak klucza API!</span>`;
    return;
  }

  statusEl.innerHTML = `<span>⏳ Testowanie zapytania testowego do bazy...</span>`;
  try {
    const res = await window.geminiService.callGemini(
      "Odpowiedz w jednym zdaniu po polsku: czy jesteś gotowy do bezpiecznej diagnostyki szpitalnych baz danych SQL?",
      { maxOutputTokens: 60 }
    );
    statusEl.innerHTML = `<span style="color: var(--accent-teal);">✅ Połączono! Odpowiedź: "${escapeHtml(res.trim())}"</span>`;
  } catch (err) {
    statusEl.innerHTML = `<span style="color: var(--accent-rose);">❌ Błąd: ${escapeHtml(err.message)}</span>`;
  }
}

/**
 * Główna funkcja renderująca moduł Generatora SQL
 */
function renderSQLGeneratorModule() {
  const container = document.getElementById('sql-generator-container');
  if (!container) return;

  const currentModel = window.geminiService ? window.geminiService.getModel() : 'gemini-3.5-flash';

  container.innerHTML = `
    <!-- Pasek nagłówka z wyborem modelu AI i statusem połączenia -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="flex: 1; min-width: 280px;">
          <h2 style="color: var(--text-primary); margin: 0 0 6px 0; font-size: 1.4rem; display: flex; align-items: center; gap: 10px;">
            <span>🗄️ Generator SQL Diagnostyczny &amp; Interaktywny Pilot REPL</span>
          </h2>
          <p style="color: var(--text-secondary); margin: 0; font-size: 0.88rem;">
            Bezpieczne zapytania diagnostyczne SELECT dla systemów LIS, eKrew, PatExpert i Genetyka. Szablony offline, bezpieczny UPDATE z domyślnym ROLLBACK oraz Agent AI w trybie Ping-Pong krok po kroku.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Model Gemini:</label>
            <select id="sqlgen-gemini-model-select" class="form-control" style="font-size: 0.82rem; padding: 4px 8px; width: 230px;" onchange="window.onSqlGenGeminiModelChange(this.value)">
              ${GEMINI_MODELS.map(m => `<option value="${m.value}" ${m.value === currentModel ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Status API:</label>
            <button id="sqlgen-gemini-status-btn" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; border-width: 1.5px;" onclick="window.toggleSqlGenGeminiConfigUI()">
              Wczytywanie...
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px; align-self: flex-end;">
            <button class="btn btn-secondary btn-sm" style="font-size: 0.8rem;" onclick="window.toggleSqlGenGeminiConfigUI()">
              ⚙️ Konfiguracja API
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rozwijany panel konfiguracji Gemini API -->
    <div id="sqlgen-gemini-config-section" style="display: none;"></div>

    <!-- Główny kontener nawigacji po trybach działania -->
    <div style="background-color: var(--bg-card); border-radius: var(--radius-md); padding: 1.25rem; border: 1px solid var(--border-color);">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex-wrap: wrap;">
        <button id="tab-btn-1" class="btn btn-primary" style="flex: 1; min-width: 180px;" onclick="window.sqlGenState.activeTab = 1; window.sqlGenRenderTabs();">
          📋 Szybki SELECT (Baza Szablonów)
        </button>
        <button id="tab-btn-2" class="btn btn-secondary" style="flex: 1; min-width: 180px;" onclick="window.sqlGenState.activeTab = 2; window.sqlGenRenderTabs();">
          ⚠️ Szablon UPDATE (Transakcja Testowa)
        </button>
        <button id="tab-btn-3" class="btn btn-secondary" style="flex: 1; min-width: 220px;" onclick="window.sqlGenState.activeTab = 3; window.sqlGenRenderTabs();">
          🤖 Interaktywny Pilot SQL (Ping-Pong REPL)
        </button>
      </div>

      <div id="sql-gen-tab-content"></div>
    </div>
  `;

  if (!window.sqlGenState) {
    window.sqlGenState = {
      activeTab: 1,
      mode1: { system: 'lis', entity: 'zlecenie_by_kod', param: '', db: 'postgresql' },
      mode2: { table: '', keyCol: '', keyVal: '', changeCol: '', newVal: '', db: 'postgresql' },
      mode3: { prompt: '', system: 'LIS', db: 'postgresql', resultSql: null }
    };
  }

  updateSqlGenGeminiStatusUI();
  window.sqlGenRenderTabs();
}

window.sqlGenRenderTabs = function() {
  const state = window.sqlGenState;
  
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`tab-btn-${i}`);
    if (btn) {
      if (state.activeTab === i) {
        btn.className = 'btn btn-primary';
      } else {
        btn.className = 'btn btn-secondary';
      }
    }
  }

  const contentDiv = document.getElementById('sql-gen-tab-content');
  if (!contentDiv) return;

  if (state.activeTab === 1) {
    renderTab1(contentDiv);
  } else if (state.activeTab === 2) {
    renderTab2(contentDiv);
  } else if (state.activeTab === 3) {
    renderTab3(contentDiv);
  }
};

function renderTab1(container) {
  const state = window.sqlGenState.mode1;
  const sysKeys = Object.keys(SQL_TEMPLATES);
  
  const systemOptions = sysKeys.map(sys => 
    `<option value="${sys}" ${state.system === sys ? 'selected' : ''}>${sys.toUpperCase()}</option>`
  ).join('');

  const entities = SQL_TEMPLATES[state.system];
  const entityOptions = Object.keys(entities).map(ent => 
    `<option value="${ent}" ${state.entity === ent ? 'selected' : ''}>${entities[ent].label}</option>`
  ).join('');

  const currentEntity = entities[state.entity] || entities[Object.keys(entities)[0]];
  const paramLabel = currentEntity.paramLabel;
  const paramPlaceholder = currentEntity.paramPlaceholder || '';

  const generatedSql = currentEntity.template(state.param, state.db);
  window.sqlGenState.mode1.currentSql = generatedSql;
  const highlightedSql = highlightSQL(generatedSql);

  container.innerHTML = `
    <div style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.88rem;">
      Wybierz system medyczny, encję i silnik bazy, aby wygenerować bezpieczne, zoptymalizowane zapytanie SELECT z gotowymi aliasami i JOIN-ami. Działa w 100% offline.
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">System</label>
        <select id="mode1-system" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(1, 'system', this.value); window.sqlGenUpdateState(1, 'entity', Object.keys(SQL_TEMPLATES[this.value])[0]); window.sqlGenRenderTabs();">
          ${systemOptions}
        </select>
      </div>
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Baza danych</label>
        <select id="mode1-db" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(1, 'db', this.value); window.sqlGenRenderTabs();">
          <option value="postgresql" ${state.db === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
          <option value="oracle" ${state.db === 'oracle' ? 'selected' : ''}>Oracle</option>
          <option value="sqlserver" ${state.db === 'sqlserver' ? 'selected' : ''}>SQL Server</option>
          <option value="firebird" ${state.db === 'firebird' ? 'selected' : ''}>Firebird</option>
        </select>
      </div>
    </div>
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Encja</label>
      <select id="mode1-entity" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(1, 'entity', this.value); window.sqlGenRenderTabs();">
        ${entityOptions}
      </select>
    </div>

    <div style="margin-bottom: 1rem;">
      <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">${escapeHtml(paramLabel)}</label>
      <input type="text" id="mode1-param" placeholder="${escapeHtml(paramPlaceholder)}" value="${escapeHtml(state.param)}" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(1, 'param', this.value); window.sqlGenRenderTabsDebounced();">
    </div>

    <div style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; position: relative;">
      <pre style="margin: 0; font-family: var(--font-mono); color: var(--text-primary); white-space: pre-wrap; word-break: break-all;"><code>${highlightedSql}</code></pre>
      
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-sm btn-primary" onclick="window.copySQLFromTab(1)">📋 Kopiuj SQL</button>
        <button class="btn btn-sm btn-secondary" onclick="window.copySQLFromTab(1, true)">📤 Otwórz w DBeaver (skopiuj i wklej)</button>
      </div>
    </div>
  `;
}

function renderTab2(container) {
  const state = window.sqlGenState.mode2;
  
  let generatedSql = '';
  const { table, keyCol, keyVal, changeCol, newVal, db } = state;
  const t = table || '{table_name}';
  const kc = keyCol || '{key_col}';
  const kv = keyVal || '{key_val}';
  const cc = changeCol || '{change_col}';
  const nv = newVal || '{new_val}';

  if (db === 'postgresql') {
    generatedSql = `-- ⚠️ BEZPIECZNA TRANSAKCJA TESTOWA — DOMYŚLNIE ROLLBACK!
-- Zmień ROLLBACK na COMMIT dopiero po wizualnej weryfikacji wyników!

BEGIN;

-- 1. WERYFIKACJA PRZED ZMIANĄ
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- 2. PROPONOWANA KOREKTA
UPDATE ${t}
SET ${cc} = '${nv}',
    modified_by = 'support_manual',
    modified_at = NOW()
WHERE ${kc} = ${kv};

-- 3. WERYFIKACJA PO ZMIANIE
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- ⚠️ DOMYŚLNIE WYCOFAJ ZMIANY! Zmień poniższe na COMMIT dopiero po weryfikacji!
ROLLBACK;`;
  } else if (db === 'oracle') {
    generatedSql = `-- ⚠️ BEZPIECZNA TRANSAKCJA TESTOWA — DOMYŚLNIE ROLLBACK!
-- Zmień ROLLBACK na COMMIT dopiero po wizualnej weryfikacji wyników!

-- 1. WERYFIKACJA PRZED ZMIANĄ
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- 2. PROPONOWANA KOREKTA
UPDATE ${t}
SET ${cc} = '${nv}',
    modified_by = 'support_manual',
    modified_at = SYSDATE
WHERE ${kc} = ${kv};

-- 3. WERYFIKACJA PO ZMIANIE
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- ⚠️ DOMYŚLNIE WYCOFAJ ZMIANY! Zmień poniższe na COMMIT dopiero po weryfikacji!
ROLLBACK;`;
  } else if (db === 'sqlserver') {
    generatedSql = `-- ⚠️ BEZPIECZNA TRANSAKCJA TESTOWA — DOMYŚLNIE ROLLBACK!
-- Zmień ROLLBACK na COMMIT dopiero po wizualnej weryfikacji wyników!

BEGIN TRANSACTION;

-- 1. WERYFIKACJA PRZED ZMIANĄ
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- 2. PROPONOWANA KOREKTA
UPDATE ${t}
SET ${cc} = '${nv}',
    modified_by = 'support_manual',
    modified_at = GETDATE()
WHERE ${kc} = ${kv};

-- 3. WERYFIKACJA PO ZMIANIE
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- ⚠️ DOMYŚLNIE WYCOFAJ ZMIANY! Zmień poniższe na COMMIT dopiero po weryfikacji!
ROLLBACK TRANSACTION;`;
  } else if (db === 'firebird') {
    generatedSql = `-- ⚠️ BEZPIECZNA TRANSAKCJA TESTOWA — DOMYŚLNIE ROLLBACK!
-- Zmień ROLLBACK na COMMIT dopiero po wizualnej weryfikacji wyników!

SET TRANSACTION;

-- 1. WERYFIKACJA PRZED ZMIANĄ
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- 2. PROPONOWANA KOREKTA
UPDATE ${t}
SET ${cc} = '${nv}',
    modified_by = 'support_manual',
    modified_at = CURRENT_TIMESTAMP
WHERE ${kc} = ${kv};

-- 3. WERYFIKACJA PO ZMIANIE
SELECT ${kc}, ${cc}, modified_by, modified_at
FROM ${t}
WHERE ${kc} = ${kv};

-- ⚠️ DOMYŚLNIE WYCOFAJ ZMIANY! Zmień poniższe na COMMIT dopiero po weryfikacji!
ROLLBACK;`;
  }

  window.sqlGenState.mode2.currentSql = generatedSql;
  const highlightedSql = highlightSQL(generatedSql);

  container.innerHTML = `
    <div style="background-color: rgba(255, 60, 60, 0.1); border-left: 4px solid var(--accent-rose); padding: 1rem; margin-bottom: 1rem; border-radius: var(--radius-sm); color: var(--text-primary);">
      <strong>⚠️ DOMYŚLNIE ROLLBACK!</strong> To zapytanie NIE zmieni danych dopóki nie zastąpisz ROLLBACK słowem COMMIT. Zweryfikuj wyniki SELECT po UPDATE przed zatwierdzeniem!
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Tabela</label>
        <input type="text" value="${escapeHtml(state.table)}" placeholder="np. zlecenia" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(2, 'table', this.value); window.sqlGenRenderTabsDebounced();">
      </div>
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Baza danych</label>
        <select style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(2, 'db', this.value); window.sqlGenRenderTabs();">
          <option value="postgresql" ${state.db === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
          <option value="oracle" ${state.db === 'oracle' ? 'selected' : ''}>Oracle</option>
          <option value="sqlserver" ${state.db === 'sqlserver' ? 'selected' : ''}>SQL Server</option>
          <option value="firebird" ${state.db === 'firebird' ? 'selected' : ''}>Firebird</option>
        </select>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Kolumna klucza</label>
        <input type="text" value="${escapeHtml(state.keyCol)}" placeholder="np. id" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(2, 'keyCol', this.value); window.sqlGenRenderTabsDebounced();">
      </div>
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Wartość klucza</label>
        <input type="text" value="${escapeHtml(state.keyVal)}" placeholder="np. 12345" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(2, 'keyVal', this.value); window.sqlGenRenderTabsDebounced();">
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Kolumna do zmiany</label>
        <input type="text" value="${escapeHtml(state.changeCol)}" placeholder="np. status" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(2, 'changeCol', this.value); window.sqlGenRenderTabsDebounced();">
      </div>
      <div>
        <label style="display: block; color: var(--text-secondary); margin-bottom: 0.25rem;">Nowa wartość</label>
        <input type="text" value="${escapeHtml(state.newVal)}" placeholder="np. ANULOWANE" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onkeyup="window.sqlGenUpdateState(2, 'newVal', this.value); window.sqlGenRenderTabsDebounced();">
      </div>
    </div>

    <div style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; position: relative;">
      <pre style="margin: 0; font-family: var(--font-mono); color: var(--text-primary); white-space: pre-wrap; word-break: break-all;"><code>${highlightedSql}</code></pre>
      
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-sm btn-primary" onclick="window.copySQLFromTab(2)">📋 Kopiuj SQL</button>
        <button class="btn btn-sm btn-secondary" onclick="window.copySQLFromTab(2, true)">📤 Otwórz w DBeaver (skopiuj i wklej)</button>
      </div>
    </div>
  `;
}

/**
 * Renderuje Tryb 3: Interaktywny Pilot SQL REPL (Ping-Pong krok po kroku)
 */
function renderTab3(container) {
  const state = window.sqlGenState.mode3;
  const session = window.geminiService?.getSqlGeneratorPilotSession();
  const isSessionActive = session && session.isActive();

  let html = `
    <!-- Szybkie presety diagnostyczne -->
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
          ⚡ Gotowe Presety Diagnostyczne (Kliknij aby załadować):
        </span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px;">
        ${SQL_PRESETS.map(p => `
          <div onclick="window.loadSqlGenPreset('${p.id}')" 
               style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; gap: 2px;"
               onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.background='rgba(0, 180, 216, 0.08)';"
               onmouseout="this.style.borderColor='var(--border-color)'; this.style.background='var(--bg-input)';">
            <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              <span>${p.icon}</span> <span>${escapeHtml(p.title)}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.2;">
              ${escapeHtml(p.desc)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Formularz zapytania diagnostycznego -->
    <div style="margin-bottom: 1rem;">
      <label style="display: block; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
        Opisz problem diagnostyczny lub zapytanie w języku naturalnym:
      </label>
      <textarea id="ai-prompt" placeholder="np. 'Znajdź wszystkie zlecenia pacjenta z PESEL 85010212345 z ostatnich 7 dni, dla których analizator nie odesłał jeszcze wyniku, i sprawdź status w kolejce próbek.'" 
                style="width: 100%; min-height: 90px; padding: 0.75rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); resize: vertical; font-family: inherit; font-size: 0.9rem;" 
                onkeyup="window.sqlGenUpdateState(3, 'prompt', this.value);">${escapeHtml(state.prompt || '')}</textarea>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
      <div>
        <label style="display: block; color: var(--text-secondary); font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">
          System Medyczny:
        </label>
        <select id="ai-system" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(3, 'system', this.value);">
          <option value="LIS" ${state.system === 'LIS' ? 'selected' : ''}>🧪 LIS – Laboratorium Medyczne</option>
          <option value="eKrew" ${state.system === 'eKrew' ? 'selected' : ''}>🩸 eKrew – Bank Krwi i Serologia</option>
          <option value="PatExpert" ${state.system === 'PatExpert' ? 'selected' : ''}>🔬 PatExpert – Patomorfologia i WSI</option>
          <option value="Genetyka" ${state.system === 'Genetyka' ? 'selected' : ''}>🧬 Genetyka Molekularna i NGS</option>
          <option value="PostgreSQL" ${state.system === 'PostgreSQL' ? 'selected' : ''}>🐘 PostgreSQL SRE (Baza szpitalna)</option>
        </select>
      </div>

      <div>
        <label style="display: block; color: var(--text-secondary); font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">
          Silnik Bazy Danych:
        </label>
        <select id="ai-db" style="width: 100%; padding: 0.5rem; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);" onchange="window.sqlGenUpdateState(3, 'db', this.value);">
          <option value="postgresql" ${state.db === 'postgresql' ? 'selected' : ''}>PostgreSQL (LIMIT, NOW())</option>
          <option value="oracle" ${state.db === 'oracle' ? 'selected' : ''}>Oracle (ROWNUM, SYSDATE)</option>
          <option value="sqlserver" ${state.db === 'sqlserver' ? 'selected' : ''}>SQL Server (TOP, GETDATE())</option>
          <option value="firebird" ${state.db === 'firebird' ? 'selected' : ''}>Firebird (FIRST, CURRENT_TIMESTAMP)</option>
        </select>
      </div>
    </div>

    <!-- Przyciski akcji -->
    <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;">
      <button id="ai-pilot-btn" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px; font-weight: 600; padding: 0.6rem 1.2rem; background: #0284c7; border-color: #0284c7;" onclick="window.runSqlGenPilotConsultation()">
        <span>🚀 Uruchom Interaktywnego Pilota SQL (Ping-Pong REPL)</span>
      </button>

      <button id="ai-generate-btn" class="btn btn-secondary" style="display: flex; align-items: center; gap: 6px;" onclick="window.generateAIQuery()">
        <span>⚡ Jednorazowe zapytanie SELECT (Quick Mode)</span>
      </button>

      <button class="btn btn-secondary btn-sm" onclick="window.clearSqlGenForm()">
        🗑️ Wyczyść
      </button>
    </div>

    <!-- Kontener wyników Quick Mode (jednorazowe) -->
    <div id="ai-result-container" style="margin-bottom: 1.5rem; display: ${state.resultSql ? 'block' : 'none'};">
      ${state.resultSql ? `
        <div style="background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; position: relative;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.5rem; text-transform: uppercase;">
            Wynik pojedynczego zapytania SELECT:
          </div>
          <pre style="margin: 0; font-family: var(--font-mono); color: var(--text-primary); white-space: pre-wrap; word-break: break-all;"><code>${highlightSQL(state.resultSql)}</code></pre>
          
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-primary" onclick="window.copySQLFromTab(3)">📋 Kopiuj SQL</button>
            <button class="btn btn-sm btn-secondary" onclick="window.copySQLFromTab(3, true)">📤 Otwórz w DBeaver (skopiuj i wklej)</button>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Kontener Interaktywnego Pilota REPL -->
    <div id="sqlgen-pilot-output" style="display: ${isSessionActive ? 'block' : 'none'};"></div>
  `;

  container.innerHTML = html;

  if (isSessionActive) {
    renderSqlGenPilotUI();
  }
}

/**
 * Czyszczenie formularza
 */
function clearSqlGenForm() {
  const promptInput = document.getElementById('ai-prompt');
  if (promptInput) promptInput.value = '';
  if (window.sqlGenState && window.sqlGenState.mode3) {
    window.sqlGenState.mode3.prompt = '';
    window.sqlGenState.mode3.resultSql = null;
  }
  const resContainer = document.getElementById('ai-result-container');
  if (resContainer) resContainer.style.display = 'none';
  showToast("Wyczyszczono formularz.", "info");
}

/* ==========================================================================
   SILNIK INTERAKTYWNEGO PILOTA REPL DLA GENERATORA SQL (Ping-Pong)
   ========================================================================== */

/**
 * Uruchomienie nowej sesji Pilota AI dla zapytań SQL
 */
async function runSqlGenPilotConsultation() {
  const promptInput = document.getElementById('ai-prompt');
  const promptText = promptInput ? promptInput.value.trim() : (window.sqlGenState?.mode3?.prompt || "");

  if (!promptText) {
    showToast("Opisz problem diagnostyczny przed uruchomieniem Pilota SQL!", "warning");
    if (promptInput) promptInput.focus();
    return;
  }

  if (!window.geminiService || !window.geminiService.hasApiKey()) {
    showToast("Brak klucza Gemini API. Kliknij 'Konfiguracja API' aby wprowadzić klucz.", "warning");
    toggleSqlGenGeminiConfigUI();
    return;
  }

  const sysSelect = document.getElementById('ai-system');
  const systemVal = sysSelect ? sysSelect.value : (window.sqlGenState?.mode3?.system || 'LIS');

  const dbSelect = document.getElementById('ai-db');
  const dbVal = dbSelect ? dbSelect.value : (window.sqlGenState?.mode3?.db || 'postgresql');

  const outputContainer = document.getElementById('sqlgen-pilot-output');
  if (outputContainer) {
    outputContainer.style.display = 'block';
    outputContainer.innerHTML = `
      <div style="background: var(--bg-card); border: 2px solid #0284c7; border-radius: var(--radius-md); padding: 24px; text-align: center;">
        <div style="font-size: 2.2rem; animation: pulse 1.5s infinite;">🧠</div>
        <h4 style="margin: 12px 0 6px 0; color: #0284c7;">Pilot SQL analizuje strukturę bazy...</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
          Inicjalizacja procedury Ping-Pong, formułowanie hipotezy diagnostycznej i przygotowanie pierwszego zapytania SELECT...
        </p>
      </div>
    `;
    outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  try {
    const session = window.geminiService.getSqlGeneratorPilotSession();
    const systemContext = {
      systemType: 'sql_generator',
      medicalSystem: systemVal,
      databaseEngine: dbVal
    };

    const initialLog = `[SYSTEM MEDYCZNY]: ${systemVal}
[SILNIK BAZY DANYCH]: ${dbVal}
[ZADANIE DIAGNOSTYCZNE]: ${promptText}`;

    await session.start(initialLog, systemContext, { systemType: 'sql_generator' });
    renderSqlGenPilotUI();
    showToast("Interaktywny Pilot SQL rozpoczął sesję diagnostyczną!", "success");
  } catch (err) {
    if (outputContainer) {
      outputContainer.innerHTML = `
        <div style="background: var(--bg-card); border: 2px solid var(--accent-rose); border-radius: var(--radius-md); padding: 20px;">
          <h4 style="color: var(--accent-rose); margin: 0 0 8px 0;">❌ Błąd uruchomienia Pilota SQL</h4>
          <p style="font-size: 0.85rem; color: var(--text-primary); margin: 0 0 12px 0;">${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary btn-sm" onclick="window.runSqlGenPilotConsultation()">🔄 Ponów próbę</button>
        </div>
      `;
    }
    showToast(`Błąd pilota: ${err.message}`, "error");
  }
}

/**
 * Renderuje interaktywny interfejs Pilota REPL dla Generatora SQL
 */
function renderSqlGenPilotUI() {
  const container = document.getElementById('sqlgen-pilot-output');
  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (!container || !session || !session.isActive()) return;

  const currentModel = window.geminiService.getModel();
  const isResolved = session.isResolved;
  const themeColor = '#0284c7'; // Błękitno-szafirowy akcent dla SQL Pilota

  container.style.display = 'block';

  let html = `
    <div style="background: var(--bg-card); border: 2px solid ${themeColor}; border-radius: var(--radius-md); padding: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
      
      <!-- Pasek Pamięci Kontekstowej (Memory Header) -->
      <div style="background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
            🧠 SESJA PILOTA SQL
          </span>
          <span style="background: var(--bg-input); border: 1px solid var(--border-color); font-size: 0.76rem; padding: 2px 8px; border-radius: 4px; color: var(--text-primary);">
            System: <strong>${escapeHtml(session.context?.medicalSystem || 'LIS')}</strong>
          </span>
          <span style="background: var(--bg-input); border: 1px solid var(--border-color); font-size: 0.76rem; padding: 2px 8px; border-radius: 4px; color: var(--accent-amber);">
            Baza: <strong>${escapeHtml(session.context?.databaseEngine || 'PostgreSQL')}</strong>
          </span>
          <span style="background: var(--bg-input); border: 1px solid var(--border-color); font-size: 0.76rem; padding: 2px 8px; border-radius: 4px; color: var(--text-primary);">
            Krok: <strong>${session.stepNumber}</strong>
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Model w locie:</label>
          <select id="sqlgen-pilot-inline-model-select" class="form-control" style="font-size: 0.75rem; padding: 2px 6px; width: 170px;" onchange="window.onSqlGenGeminiModelChange(this.value)">
            ${GEMINI_MODELS.map(m => `<option value="${m.value}" ${m.value === currentModel ? 'selected' : ''}>${escapeHtml(m.label.split(' ')[0] + ' ' + m.value)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 8px;" onclick="window.resetSqlGenPilotSession()">
            ✕ Zakończ sesję
          </button>
        </div>
      </div>

      <!-- Karta Wstępnej Hipotezy Diagnostycznej -->
      ${session.hypothesis ? `
        <div style="background: var(--bg-input); border-left: 3px solid ${themeColor}; padding: 8px 12px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 16px; font-size: 0.84rem;">
          <strong style="color: #38bdf8;">💡 Wstępna hipoteza diagnostyczna:</strong> ${escapeHtml(session.hypothesis)}
        </div>
      ` : ''}

      <!-- Historia Konwersacji Ping-Pong (Chronologia kroków) -->
      <div id="sqlgen-pilot-history" style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px;">
  `;

  // Renderowanie dotychczasowych tur
  session.turns.forEach((turn, idx) => {
    const isLatestAgentTurn = (idx === session.turns.length - 1 && turn.type === 'agent');

    if (turn.type === 'agent') {
      if (isLatestAgentTurn && !isResolved) {
        // Ostatnia tura agenta zostanie zrenderowana w dedykowanym Aktywnym Kontenerze Kroku poniżej
        return;
      }

      html += `
        <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #38bdf8;">
              🤖 Agent AI (Krok ${turn.stepNumber})
            </span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">
              ${new Date(turn.timestamp).toLocaleTimeString('pl-PL')}
            </span>
          </div>

          ${turn.parsed.goal ? `
            <div style="font-size: 0.86rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
              🎯 Cel: ${escapeHtml(turn.parsed.goal)}
            </div>
          ` : ''}

          ${turn.parsed.diagnosis ? `
            <div style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 8px; background: rgba(0,0,0,0.15); padding: 6px 10px; border-radius: 4px;">
              💡 <em>${escapeHtml(turn.parsed.diagnosis)}</em>
            </div>
          ` : ''}

          ${turn.parsed.command ? `
            <div style="background: #0d1117; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 6px; position: relative;">
              <pre style="margin: 0; font-family: monospace; font-size: 0.82rem; color: #79c0ff; white-space: pre-wrap; word-break: break-all;"><code>${highlightSQL(turn.parsed.command)}</code></pre>
              <button class="btn btn-secondary btn-sm" style="position: absolute; top: 6px; right: 6px; font-size: 0.7rem; padding: 2px 6px;" 
                      onclick="window.copySQLBlock(decodeURIComponent('${encodeURIComponent(turn.parsed.command)}'))">📋 Kopiuj</button>
            </div>
          ` : ''}
        </div>
      `;
    } else if (turn.type === 'user') {
      html += `
        <div style="background: rgba(6, 214, 160, 0.05); border: 1px solid rgba(6, 214, 160, 0.25); border-radius: var(--radius-sm); padding: 10px 14px; margin-left: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-teal);">
              👤 Inżynier Wsparcia (Wynik z bazy / DBeaver)
            </span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">
              ${new Date(turn.timestamp).toLocaleTimeString('pl-PL')}
            </span>
          </div>
          <pre style="margin: 0; font-family: monospace; font-size: 0.8rem; color: var(--text-primary); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto;">${escapeHtml(turn.text)}</pre>
        </div>
      `;
    }
  });

  html += `</div>`; // Koniec historii

  // =========================================================================
  // STAN 1: AWARIA ROZWIĄZANA - Wyświetl Podsumowanie, Runbook i Eksport
  // =========================================================================
  if (isResolved) {
    const lastTurn = session.getLastAgentTurn();
    html += `
      <div style="background: rgba(6, 214, 160, 0.1); border: 2px solid var(--accent-teal); border-radius: var(--radius-md); padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <span style="font-size: 1.8rem;">🎉</span>
          <div>
            <h4 style="margin: 0; color: var(--accent-teal);">[AWARIA ROZWIĄZANA] - Procedura Diagnostyczna Zakończona!</h4>
            <div style="font-size: 0.82rem; color: var(--text-secondary);">
              Zgłoszenie pomyślnie zdiagnozowane w ${session.stepNumber} krokach. Zero-Risk Hospital Policy spełniona.
            </div>
          </div>
        </div>

        ${lastTurn?.parsed?.diagnosis ? `
          <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px; font-size: 0.86rem; color: var(--text-primary); border-left: 3px solid var(--accent-teal);">
            <strong>Podsumowanie root-cause:</strong><br/>
            ${escapeHtml(lastTurn.parsed.diagnosis)}
          </div>
        ` : ''}

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px; background: var(--accent-teal); border-color: var(--accent-teal); color: #000;" 
                  onclick="window.saveSqlGenPilotSessionAsRunbook()">
            💾 Zapisz procedurę SQL do Bazy Runbooków
          </button>
          <button class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;" 
                  onclick="window.copySqlGenPilotScript()">
            📋 Kopiuj pełny skrypt SQL sesji
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.resetSqlGenPilotSession()">
            🔄 Nowe zapytanie diagnostyczne
          </button>
        </div>
      </div>
    `;
  } 
  // =========================================================================
  // STAN 2: AKTYWNY KROK - Diagnoza, Zapytanie SELECT, Podczat i Wklejanie Wyniku
  // =========================================================================
  else {
    const lastTurn = session.getLastAgentTurn();
    const parsed = lastTurn ? lastTurn.parsed : null;

    if (parsed) {
      const sqlCommand = parsed.command || "";

      html += `
        <div style="background: var(--bg-card); border: 2px solid ${themeColor}; border-radius: var(--radius-md); padding: 18px; margin-bottom: 16px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            <span style="font-size: 0.95rem; font-weight: 700; color: #38bdf8;">
              KROK ${session.stepNumber}: ${escapeHtml(parsed.goal || 'Zapytanie weryfikujące')}
            </span>
            <span style="background: rgba(2, 132, 199, 0.15); color: #38bdf8; font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 4px;">
              OCZEKUJE NA WYNIK SELECT
            </span>
          </div>

          ${parsed.diagnosis ? `
            <div style="font-size: 0.88rem; color: var(--text-primary); margin-bottom: 12px; background: rgba(0,0,0,0.15); padding: 10px 12px; border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
              <strong style="color: #38bdf8;">💡 Diagnoza / Stan weryfikacji:</strong> ${escapeHtml(parsed.diagnosis)}
            </div>
          ` : ''}

          <!-- Pojedyncze Zapytanie SQL (Single-Command Enforcement) -->
          ${sqlCommand ? `
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">
                  🗄️ Bezpieczne zapytanie diagnostyczne SELECT (DBeaver / psql):
                </span>
                <span style="font-size: 0.72rem; color: var(--accent-teal);">✓ Read-Only (Zero-Risk)</span>
              </div>
              <div style="background: #0d1117; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; position: relative;">
                <pre style="margin: 0; font-family: monospace; font-size: 0.86rem; color: #79c0ff; white-space: pre-wrap; word-break: break-all;"><code>${highlightSQL(sqlCommand)}</code></pre>
                <div style="margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end;">
                  <button class="btn btn-primary btn-sm" style="font-size: 0.76rem; padding: 4px 10px;" 
                          onclick="window.copySQLBlock(decodeURIComponent('${encodeURIComponent(sqlCommand)}'))">
                    📋 Kopiuj SQL
                  </button>
                  <button class="btn btn-secondary btn-sm" style="font-size: 0.76rem; padding: 4px 10px;" 
                          onclick="window.copySQLBlock(decodeURIComponent('${encodeURIComponent(sqlCommand)}')); window.showToast('Skopiowano! Wklej zapytanie w DBeaver.', 'info');">
                    📤 Otwórz w DBeaver
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          ${parsed.expectation ? `
            <div style="font-size: 0.84rem; color: var(--accent-amber); margin-bottom: 14px; background: rgba(255, 183, 3, 0.08); padding: 8px 12px; border-radius: var(--radius-sm);">
              <strong>❓ Oczekiwanie Agenta:</strong> ${escapeHtml(parsed.expectation)}
            </div>
          ` : ''}

          <!-- Step Feedback Engine (Podczat do bieżącego kroku) -->
          <div style="background: rgba(0,0,0,0.18); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 16px;">
            <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
              💬 Masz wątpliwości lub błąd przy tym zapytaniu? (Podczat kroku):
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <input type="text" id="sqlgen-step-feedback-input" class="form-control" style="flex: 1; font-size: 0.82rem;" 
                     placeholder="np. 'Błąd: relation zlecenia does not exist', 'Za długi czas wykonania', 'Zwróciło ORA-00942'...">
              <button class="btn btn-secondary btn-sm" onclick="window.askSqlGenStepFeedback()">Zapytaj AI</button>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" 
                      onclick="window.sendSqlGenPilotQuickSuccess()">
                ✅ Zwróciło wyniki (sukces)
              </button>
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" 
                      onclick="window.askSqlGenStepFeedback('Błąd: tabela lub widok nie istnieje w bazie (np. ORA-00942 / relation does not exist). Sprawdź w information_schema.tables lub ALL_TABLES poprawną nazwę.')">
                ⚠️ Błąd: Brak tabeli / relacji
              </button>
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" 
                      onclick="window.askSqlGenStepFeedback('Błąd: brak uprawnień SELECT (permission denied / insufficient privileges). Zaproponuj zapytanie do tabeli dostępnej bez uprawnień administratora.')">
                🔒 Błąd: Brak uprawnień do tabeli
              </button>
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" 
                      onclick="window.askSqlGenStepFeedback('Zapytanie wykonało się pomyślnie, ale zwróciło 0 wierszy (pusty wynik). Brak rekordów spełniających warunki. Zaproponuj szerszy zakres filtrów.')">
                🔍 Wynik pusty: 0 wierszy
              </button>
            </div>
          </div>

          <!-- Wprowadzanie wyniku z DBeaver / terminala (Ping-Pong) -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              📋 Wklej wynik zapytania z DBeaver / psql / SQL Developer:
            </label>
            <textarea id="sqlgen-pilot-user-input" class="form-control" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 0.82rem; margin-bottom: 10px;" 
                      placeholder="Wklej tutaj wynik z DBeaver (nagłówki, wiersze danych lub informację 'Fetched 0 rows')..."></textarea>
            
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-primary" style="display: flex; align-items: center; gap: 6px; font-weight: 600; background: #0284c7; border-color: #0284c7;" 
                      onclick="window.submitSqlGenPilotInput()">
                <span>🔍 Weryfikuj wynik z AI i przejdź do kolejnego kroku ➡️</span>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.sendSqlGenPilotQuickSuccess()">
                ⚡ Szybkie potwierdzenie: Sukces / Wyniki poprawne
              </button>
            </div>
          </div>

        </div>
      `;
    }
  }

  html += `</div>`; // Koniec kontenera sesji
  container.innerHTML = html;
}

/**
 * Przesłanie wyniku zapytania do Agenta w trybie Ping-Pong
 */
async function submitSqlGenPilotInput() {
  const inputElem = document.getElementById('sqlgen-pilot-user-input');
  const userText = inputElem ? inputElem.value.trim() : "";

  if (!userText) {
    showToast("Wklej wynik z DBeaver / psql przed wysłaniem!", "warning");
    if (inputElem) inputElem.focus();
    return;
  }

  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (!session || !session.isActive()) return;

  const btn = event?.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Analiza wyniku w toku...";
  }

  try {
    await session.sendUserMessage(userText, { systemType: 'sql_generator' });
    renderSqlGenPilotUI();
    showToast(`Otrzymano odpowiedź dla Kroku ${session.stepNumber}!`, "success");
    const hist = document.getElementById('sqlgen-pilot-output');
    if (hist) hist.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showToast(`Błąd odpowiedzi AI: ${err.message}`, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerText = "🔍 Weryfikuj wynik z AI i przejdź do kolejnego kroku ➡️";
    }
  }
}

/**
 * Szybkie potwierdzenie sukcesu bez ręcznego wklejania
 */
function sendSqlGenPilotQuickSuccess() {
  const inputElem = document.getElementById('sqlgen-pilot-user-input');
  if (inputElem) {
    inputElem.value = "Zapytanie wykonało się pomyślnie w DBeaver i zwróciło poprawne rekordy danych. Przejdź do weryfikacji lub zamknięcia incydentu.";
  }
  submitSqlGenPilotInput();
}

/**
 * Podczat - zgłoszenie problemu z zapytaniem / błędu składni
 */
async function askSqlGenStepFeedback(customFeedback) {
  const inputElem = document.getElementById('sqlgen-step-feedback-input');
  const feedback = customFeedback || (inputElem ? inputElem.value.trim() : "");

  if (!feedback) {
    showToast("Wpisz treść problemu lub wybierz jeden z gotowych kafelków!", "warning");
    if (inputElem) inputElem.focus();
    return;
  }

  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (!session || !session.isActive()) return;

  try {
    showToast("Przesyłam wątpliwość do Agenta AI...", "info");
    await session.sendStepFeedback(feedback, { systemType: 'sql_generator' });
    renderSqlGenPilotUI();
    showToast("Agent AI skorygował zapytanie!", "success");
  } catch (err) {
    showToast(`Błąd podczatu: ${err.message}`, "error");
  }
}

/**
 * Eksport ukończonej sesji SQL do Bazy Runbooków
 */
function saveSqlGenPilotSessionAsRunbook() {
  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (!session || !session.isActive()) return;

  const record = session.toRunbookRecord();
  if (window.appState && typeof window.appState.addRunbook === 'function') {
    window.appState.addRunbook(record);
    showToast("Pomyślnie wyeksportowano procedurę SQL do Bazy Runbooków!", "success");
    if (typeof window.renderRunbookList === 'function') {
      window.renderRunbookList();
    }
  } else {
    showToast("Zapisano procedurę SQL w pamięci podręcznej.", "info");
  }
}

/**
 * Kopiuje wszystkie zapytania SQL z sesji jako jeden spójny skrypt
 */
function copySqlGenPilotScript() {
  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (!session) return;

  const cmds = session.getAllCommands();
  if (!cmds || cmds.length === 0) {
    showToast("Brak zapytań SQL w bieżącej sesji.", "warning");
    return;
  }

  const header = `-- ========================================================\n` +
                 `-- PROCEDURA DIAGNOSTYCZNA SQL (INTERAKTYWNY PILOT REPL)\n` +
                 `-- System: ${session.context?.medicalSystem || 'LIS'} | Baza: ${session.context?.databaseEngine || 'PostgreSQL'}\n` +
                 `-- Data: ${new Date().toLocaleString('pl-PL')}\n` +
                 `-- Status: ${session.isResolved ? 'AWARIA ROZWIĄZANA' : 'W toku'}\n` +
                 `-- ========================================================\n\n`;

  const script = header + cmds.map((cmd, i) => `-- Krok ${i + 1}\n${cmd}\n`).join('\n');
  copySQLBlock(script);
}

/**
 * Reset sesji Pilota SQL
 */
function resetSqlGenPilotSession() {
  const session = window.geminiService?.getSqlGeneratorPilotSession();
  if (session) {
    session.reset();
  }
  const out = document.getElementById('sqlgen-pilot-output');
  if (out) {
    out.innerHTML = '';
    out.style.display = 'none';
  }
  showToast("Zresetowano sesję Pilota SQL.", "info");
}

window.sqlGenUpdateState = function(tabIndex, key, value) {
  if (!window.sqlGenState) return;
  if (!window.sqlGenState[`mode${tabIndex}`]) {
    window.sqlGenState[`mode${tabIndex}`] = {};
  }
  window.sqlGenState[`mode${tabIndex}`][key] = value;
};

let renderTimeout = null;
window.sqlGenRenderTabsDebounced = function() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    window.sqlGenRenderTabs();
  }, 200); // 200ms debounce
};

/**
 * Jednorazowe wygenerowanie zapytania przez AI (Quick Mode)
 */
window.generateAIQuery = async function() {
  const state = window.sqlGenState.mode3;
  if (!state.prompt || state.prompt.trim() === '') {
    showToast('Wprowadź najpierw opis problemu', 'error');
    return;
  }

  const btn = document.getElementById('ai-generate-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Generowanie...';
  }

  try {
    if (window.geminiService && window.geminiService.generateDiagnosticSQL) {
      const sql = await window.geminiService.generateDiagnosticSQL(state.prompt, state.system);
      window.sqlGenState.mode3.resultSql = sql;
      window.sqlGenRenderTabs();
      showToast('Wygenerowano zapytanie AI', 'success');
    } else if (window.geminiService && window.geminiService.callGemini) {
      const fullPrompt = `System: ${state.system}\nProblem: ${state.prompt}`;
      const response = await window.geminiService.callGemini(fullPrompt, { systemInstruction: SQL_SYSTEM_INSTRUCTION });
      
      let sql = response;
      const sqlMatch = response.match(/```sql\s*([\s\S]*?)\s*```/);
      if (sqlMatch && sqlMatch[1]) {
        sql = sqlMatch[1].trim();
      } else {
        const fallbackMatch = response.match(/```([\s\S]*?)```/);
        if (fallbackMatch && fallbackMatch[1]) {
          sql = fallbackMatch[1].trim();
        }
      }

      window.sqlGenState.mode3.resultSql = sql;
      window.sqlGenRenderTabs();
      showToast('Wygenerowano zapytanie AI', 'success');
    } else {
      showToast('Błąd: Usługa Gemini AI jest niedostępna.', 'error');
    }
  } catch (error) {
    console.error('AI Error:', error);
    showToast('Wystąpił błąd podczas generowania zapytania: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ Jednorazowe zapytanie SELECT (Quick Mode)';
    }
  }
};

window.copySQLFromTab = function(tabIndex, notifyDBeaver = false) {
  let sql = '';
  if (tabIndex === 1 && window.sqlGenState?.mode1) {
    sql = window.sqlGenState.mode1.currentSql || '';
  } else if (tabIndex === 2 && window.sqlGenState?.mode2) {
    sql = window.sqlGenState.mode2.currentSql || '';
  } else if (tabIndex === 3 && window.sqlGenState?.mode3) {
    sql = window.sqlGenState.mode3.resultSql || '';
  }

  if (!sql) {
    showToast('Brak wygenerowanego kodu SQL do skopiowania', 'warning');
    return;
  }
  copySQLBlock(sql);
  if (notifyDBeaver) {
    showToast('Skopiowano! Otwórz DBeaver i wklej zapytanie.', 'info');
  }
};

if (typeof window !== 'undefined') {
  window.SQL_TEMPLATES = SQL_TEMPLATES;
  window.SQL_PRESETS = SQL_PRESETS;
  window.highlightSQL = highlightSQL;
  window.renderSQLGeneratorModule = renderSQLGeneratorModule;
  window.copySQLBlock = copySQLBlock;
  window.loadSqlGenPreset = loadSqlGenPreset;
  window.onSqlGenGeminiModelChange = onSqlGenGeminiModelChange;
  window.updateSqlGenGeminiStatusUI = updateSqlGenGeminiStatusUI;
  window.toggleSqlGenGeminiConfigUI = toggleSqlGenGeminiConfigUI;
  window.renderSqlGenGeminiConfigUI = renderSqlGenGeminiConfigUI;
  window.saveSqlGenGeminiApiKeyUI = saveSqlGenGeminiApiKeyUI;
  window.removeSqlGenGeminiApiKeyUI = removeSqlGenGeminiApiKeyUI;
  window.testSqlGenGeminiConnectionUI = testSqlGenGeminiConnectionUI;
  window.runSqlGenPilotConsultation = runSqlGenPilotConsultation;
  window.renderSqlGenPilotUI = renderSqlGenPilotUI;
  window.submitSqlGenPilotInput = submitSqlGenPilotInput;
  window.sendSqlGenPilotQuickSuccess = sendSqlGenPilotQuickSuccess;
  window.askSqlGenStepFeedback = askSqlGenStepFeedback;
  window.saveSqlGenPilotSessionAsRunbook = saveSqlGenPilotSessionAsRunbook;
  window.copySqlGenPilotScript = copySqlGenPilotScript;
  window.resetSqlGenPilotSession = resetSqlGenPilotSession;
  window.renderTab1 = renderTab1;
  window.renderTab2 = renderTab2;
  window.renderTab3 = renderTab3;
  window.clearSqlGenForm = clearSqlGenForm;
}

})();

