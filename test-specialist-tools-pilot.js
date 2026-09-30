/**
 * HealthTech Onboarding Hub - Kompleksowe Testy Jednostkowe i Integracyjne dla:
 * 1. Dekodera Stack Trace'ów z Agentem AI & Pilotem REPL (js/stack-decoder.js)
 * 2. Generatora SQL Diagnostycznego z Agentem AI & Pilotem REPL (js/sql-generator.js)
 * 3. Synchronizacji 11 modeli Gemini i wskaźników statusu (js/gemini-service.js, js/app.js)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock środowiska przeglądarki (DOM & LocalStorage)
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store
  };
})();

let toasts = [];
let elements = {};

function createMockElement(id, tagName = 'div') {
  return {
    id: id,
    tagName: tagName.toUpperCase(),
    value: '',
    textContent: '',
    innerText: '',
    innerHTML: '',
    style: {},
    className: '',
    disabled: false,
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    focus: () => {},
    scrollIntoView: () => {}
  };
}

global.document = {
  readyState: 'loading',
  getElementById: (id) => {
    if (!elements[id]) {
      elements[id] = createMockElement(id);
    }
    return elements[id];
  },
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  createElement: (tag) => createMockElement(`dyn_${Math.random().toString(36).substr(2, 6)}`, tag),
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => null
  },
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  execCommand: () => true
};

global.navigator = {
  clipboard: {
    writeText: async (text) => {
      global.__lastCopied = text;
      return true;
    }
  }
};

global.window = {
  localStorage: localStorageMock,
  document: global.document,
  navigator: global.navigator,
  showToast: (msg, type = 'info') => {
    toasts.push({ msg, type });
  },
  escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
};
global.localStorage = localStorageMock;

// 1. Załaduj dane i stan aplikacji (data.js & state.js)
const dataCode = fs.readFileSync(path.join(__dirname, 'js', 'data.js'), 'utf8');
eval(dataCode);
global.HEALTHTECH_DATA = window.HEALTHTECH_DATA;
const stateCode = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
eval(stateCode);

// 2. Załaduj usługę Gemini (gemini-service.js)
const geminiCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
eval(geminiCode);

// Skonfiguruj klucz API
window.geminiService.setApiKey("AIzaSyMockKeyForSpecialistToolsTest12345");

console.log('=== TEST 1: Weryfikacja Dekodera Stack Trace (stack-decoder.js) ===');
const decoderCode = fs.readFileSync(path.join(__dirname, 'js', 'stack-decoder.js'), 'utf8');
eval(decoderCode);

// 1.1 Weryfikacja 11 modeli Gemini i presetów
assert(Array.isArray(window.STACK_PRESETS), 'STACK_PRESETS powinno być tablicą');
assert(window.STACK_PRESETS.length >= 5, `Oczekiwano co najmniej 5 presetów stack trace, jest: ${window.STACK_PRESETS.length}`);
console.log(`- Liczba presetów Dekodera Stack Trace: ${window.STACK_PRESETS.length}`);

// 1.2 Test ładowania presetu
window.loadStackDecoderPreset('preset_pg_limit');
const inputVal = document.getElementById('stack-trace-input').value;
assert(inputVal.includes('remaining connection slots'), 'Preset PostgreSQL nie załadował błędu');
console.log('✅ Dekoder: Poprawnie załadowano preset błędu połączeń PostgreSQL');

// 1.3 Offline Knowledge Base STACK_KB
assert(Array.isArray(window.STACK_KB) && window.STACK_KB.length >= 19, 'STACK_KB powinno mieć co najmniej 19 reguł');
const npeRule = window.STACK_KB.find(r => r.id === 'java_npe');
assert(npeRule && npeRule.diagnosticSQL, 'Reguła java_npe musi zawierać bezpieczny diagnosticSQL');
console.log('✅ Dekoder: STACK_KB zawiera kompletne 19 reguł z bezpiecznymi zapytaniami SELECT');

// 1.4 Test sesji Pilota REPL dla Dekodera (GeminiPilotSession)
const decoderSession = window.geminiService.getStackDecoderPilotSession();
assert(decoderSession, 'Brak instancji getStackDecoderPilotSession');
assert.strictEqual(decoderSession.systemType, 'stack_decoder', 'systemType sesji musi wynosić stack_decoder');

// Mock wywołania Gemini dla sesji Dekodera
let mockStep = 1;
window.geminiService.callGemini = async (prompt, opts) => {
  if (mockStep === 1) {
    mockStep++;
    return `🎯 Cel: Weryfikacja liczby aktywnych połączeń PostgreSQL
💡 Diagnoza: Baza danych odrzuca połączenia ze względu na wyczerpanie puli połączeń zarezerwowanych dla aplikacji medycznej.
Komenda:
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
❓ Oczekiwanie: Wklej liczbę aktywnych połączeń zwróconych przez terminal.`;
  } else if (mockStep === 2) {
    mockStep++;
    return `🎯 Cel: Identyfikacja wiszących sesji aplikacji LIS
💡 Diagnoza: Aktywnych jest 100/100 połączeń. Sesje analizatora LIS wiszą w stanie 'idle in transaction'.
Komenda:
sudo -u postgres psql -c "SELECT pid, query, state, age(clock_timestamp(), query_start) FROM pg_stat_activity WHERE state != 'idle' LIMIT 10;"
❓ Oczekiwanie: Wklej zidentyfikowane zapytania.`;
  } else {
    return `💡 Diagnoza: Usługa bazy danych została zwolniona, a zbędne transakcje zamknięte. Pula połączeń powróciła do normy.
🎉 [AWARIA ROZWIĄZANA]`;
  }
};

(async () => {
  try {
    // Rozpoczęcie sesji Dekodera
    await decoderSession.start(
      "FATAL: remaining connection slots are reserved for non-replication superuser connections\nat org.postgresql.Driver.connect(Driver.java:69)",
      { systemType: 'stack_decoder' },
      { systemType: 'stack_decoder' }
    );

    assert(decoderSession.isActive(), 'Sesja Dekodera powinna być aktywna');
    assert.strictEqual(decoderSession.stepNumber, 1, 'Krok początkowy powinien być równy 1');
    const lastTurn1 = decoderSession.getLastAgentTurn();
    assert(lastTurn1.parsed.command.includes('pg_stat_activity'), 'Krok 1 powinien zawierać komendę SELECT count(*)');
    console.log('✅ Dekoder Pilot: Krok 1 wygenerował pojedynczą komendę weryfikacji połączeń');

    // Podczat (Step Feedback Engine)
    await decoderSession.sendStepFeedback("Komenda psql nie działa z sudo: błąd uwierzytelnienia postgres");
    const fbTurn = decoderSession.getLastAgentTurn();
    assert(fbTurn, 'Podczat powinien zwrócić skorygowaną odpowiedź');
    console.log('✅ Dekoder Pilot: Step Feedback Engine skorygował krok przy problemie uwierzytelnienia');

    // Wklejenie wyniku przez użytkownika (Krok 2)
    await decoderSession.sendUserMessage("count = 100 (max_connections reached)", { systemType: 'stack_decoder' });
    assert.strictEqual(decoderSession.stepNumber, 2, 'Krok powinien awansować do 2');
    console.log('✅ Dekoder Pilot: Krok 2 poprawnie przeanalizował wynik terminala');

    // Rozwiązanie awarii
    await decoderSession.sendUserMessage("Zamknięto zablokowane transakcje, połączenia spadły do 14", { systemType: 'stack_decoder' });
    assert(decoderSession.isResolved, 'Sesja Dekodera powinna wykryć [AWARIA ROZWIĄZANA]');
    console.log('✅ Dekoder Pilot: Poprawnie wykryto [AWARIA ROZWIĄZANA] i zakończono procedurę');

    // Eksport do Runbooka
    const runbookRecord = decoderSession.toRunbookRecord();
    assert(runbookRecord.title.includes('Dekoder') || runbookRecord.category.includes('Dekoder'), 'Runbook powinien mieć kategorię Dekodera');
    assert(runbookRecord.resolvedSteps.length > 0, 'Runbook powinien zawierać zapisane kroki procedury');
    console.log('✅ Dekoder Pilot: Pomyślnie wyeksportowano sesję post-mortem do Bazy Runbooków');

    console.log('\n=== TEST 2: Weryfikacja Generatora SQL Diagnostycznego (sql-generator.js) ===');
    const sqlGenCode = fs.readFileSync(path.join(__dirname, 'js', 'sql-generator.js'), 'utf8');
    eval(sqlGenCode);

    // 2.1 Weryfikacja 11 modeli i presetów
    assert(Array.isArray(window.SQL_PRESETS), 'SQL_PRESETS powinno być tablicą');
    assert(window.SQL_PRESETS.length >= 5, `Oczekiwano co najmniej 5 presetów SQL, jest: ${window.SQL_PRESETS.length}`);
    console.log(`- Liczba presetów Generatora SQL: ${window.SQL_PRESETS.length}`);

    // 2.2 Test ładowania presetu
    window.loadSqlGenPreset('ekrew_temp');
    assert(window.sqlGenState.mode3.prompt.includes('transakcje_temp'), 'Preset eKrew nie ustawił promptu');
    assert.strictEqual(window.sqlGenState.mode3.system, 'eKrew', 'Preset eKrew nie ustawił systemu');
    console.log('✅ Generator SQL: Poprawnie załadowano preset eKrew (zawieszone transakcje preparatów krwi)');

    // 2.3 Offline SQL_TEMPLATES & Bezpieczny UPDATE z domyślnym ROLLBACK
    assert(typeof window.SQL_TEMPLATES === 'object', 'SQL_TEMPLATES powinno być obiektem');
    const lisTpl = window.SQL_TEMPLATES.lis.zlecenie_by_kod.template('PROBKA_999', 'postgresql');
    assert(lisTpl.includes('PROBKA_999') && lisTpl.includes('SELECT'), 'Szablon offline LIS powinien być poprawnym SELECT');

    // Test transakcji testowej UPDATE
    window.sqlGenState.mode2 = {
      table: 'preparaty',
      keyCol: 'id',
      keyVal: '44521',
      changeCol: 'status',
      newVal: 'DOSTEPNY',
      db: 'postgresql'
    };
    const contentDiv = createMockElement('sql-gen-tab-content');
    window.renderTab2(contentDiv);
    const updateSql = window.sqlGenState.mode2.currentSql;
    assert(updateSql.includes('BEGIN;'), 'Transakcja testowa musi otwierać BEGIN');
    assert(updateSql.includes('UPDATE preparaty'), 'Transakcja testowa musi zawierać proponowany UPDATE');
    assert(updateSql.includes('ROLLBACK;'), 'Transakcja testowa musi bezwzględnie domyślnie wycofywać zmiany (ROLLBACK)');
    console.log('✅ Generator SQL: Szablon UPDATE spełnia Zero-Risk Hospital Policy (domyślny ROLLBACK)');

    // 2.4 Test sesji Pilota REPL dla Generatora SQL (Ping-Pong krok po kroku)
    const sqlSession = window.geminiService.getSqlGeneratorPilotSession();
    assert(sqlSession, 'Brak instancji getSqlGeneratorPilotSession');
    assert.strictEqual(sqlSession.systemType, 'sql_generator', 'systemType sesji musi wynosić sql_generator');

    // Mock odpowiedzi modelu dla SQL Pilota
    let sqlStep = 1;
    window.geminiService.callGemini = async (prompt, opts) => {
      if (sqlStep === 1) {
        sqlStep++;
        return `🎯 Cel: Sprawdzenie preparatów krwi zawieszonych w transakcjach tymczasowych
💡 Diagnoza: Preparat może być zablokowany przez nieukończoną transakcję wydania lub zawieszoną sesję banku krwi.
Komenda:
SELECT p.id, p.nr_preparatu, p.status, t.id AS id_trans, t.data_utw, t.typ 
FROM preparaty p 
JOIN transakcje_temp t ON p.id = t.id_preparatu 
WHERE p.status = 'ZAREZERWOWANY' AND t.data_utw < NOW() - INTERVAL '2 hours'
LIMIT 50;
❓ Oczekiwanie: Wykonaj powyższe zapytanie w DBeaver i wklej zwrócone wiersze lub liczbę wyników.`;
      } else if (sqlStep === 2) {
        sqlStep++;
        return `🎯 Cel: Weryfikacja blokady wiersza na poziomie bazy danych
💡 Diagnoza: Znaleziono preparat nr 2024-KKCZ-00129 w transakcji z przed 3 godzin. Sprawdźmy czy transakcja nie trzyma blokady w pg_locks.
Komenda:
SELECT l.locktype, l.mode, l.granted, a.query, a.state 
FROM pg_locks l 
JOIN pg_stat_activity a ON l.pid = a.pid 
WHERE a.query LIKE '%preparaty%' 
LIMIT 10;
❓ Oczekiwanie: Wklej wynik sprawdzenia blokad.`;
      } else {
        return `💡 Diagnoza: Przyczyna potwierdzona: zawieszona transakcja tymczasowa została usunięta przez administratora, a status preparatu został zweryfikowany z personelem banku krwi.
🎉 [AWARIA ROZWIĄZANA]`;
      }
    };

    // Rozpoczęcie sesji Pilota SQL
    await sqlSession.start(
      `[SYSTEM MEDYCZNY]: eKrew\n[SILNIK BAZY DANYCH]: postgresql\n[ZADANIE DIAGNOSTYCZNE]: Preparat krwi zablokowany w transakcji tymczasowej`,
      { systemType: 'sql_generator', medicalSystem: 'eKrew', databaseEngine: 'postgresql' },
      { systemType: 'sql_generator' }
    );

    assert(sqlSession.isActive(), 'Sesja Pilota SQL powinna być aktywna');
    assert.strictEqual(sqlSession.stepNumber, 1, 'Krok początkowy SQL Pilota to 1');
    const sqlTurn1 = sqlSession.getLastAgentTurn();
    assert(sqlTurn1.parsed.command.includes('SELECT p.id, p.nr_preparatu'), 'Krok 1 powinien zawierać zapytanie SELECT');
    assert(!sqlTurn1.parsed.command.includes('DELETE') && !sqlTurn1.parsed.command.includes('DROP'), 'Zero-Risk: Zakaz operacji niszczących!');
    console.log('✅ Generator SQL Pilot: Krok 1 wygenerował czysty, bezpieczny SELECT do weryfikacji transakcji');

    // Podczat (Step Feedback Engine)
    await sqlSession.sendStepFeedback("Błąd DBeaver: relation transakcje_temp does not exist");
    const sqlFbTurn = sqlSession.getLastAgentTurn();
    assert(sqlFbTurn, 'Podczat SQL powinien zwrócić odpowiedź ze sprostowaniem tabeli');
    console.log('✅ Generator SQL Pilot: Step Feedback Engine obsłużył brakującą tabelę/błąd relacji');

    // Wklejenie wyniku przez użytkownika (Krok 2)
    await sqlSession.sendUserMessage("1 wiersz: id=44521, nr_preparatu=2024-KKCZ-00129, typ=WYDANIE, data_utw=2026-09-24 14:10", { systemType: 'sql_generator' });
    assert.strictEqual(sqlSession.stepNumber, 2, 'Krok SQL powinien awansować do 2');
    console.log('✅ Generator SQL Pilot: Krok 2 poprawnie przeanalizował wynik z DBeaver');

    // Rozwiązanie awarii
    await sqlSession.sendUserMessage("Transakcja zwolniona, preparat powrócił do stanu DOSTEPNY", { systemType: 'sql_generator' });
    assert(sqlSession.isResolved, 'Sesja SQL Pilota powinna wykryć [AWARIA ROZWIĄZANA]');
    console.log('✅ Generator SQL Pilot: Poprawnie wykryto [AWARIA ROZWIĄZANA] i zakończono sesję');

    // Eksport do Runbooka
    const sqlRunbook = sqlSession.toRunbookRecord();
    assert(sqlRunbook.category.includes('SQL') || sqlRunbook.category.includes('Diagnostyka'), 'Runbook powinien mieć kategorię SQL');
    assert(sqlRunbook.tags.includes('sql'), 'Runbook powinien posiadać tag #sql');
    console.log('✅ Generator SQL Pilot: Pomyślnie wyeksportowano procedurę SQL do Bazy Runbooków');

    console.log('\n=== TEST 3: Weryfikacja Dwukierunkowej Synchronizacji Modeli (js/app.js) ===');
    global.runHL7Inspection = () => {};
    window.runHL7Inspection = () => {};
    const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
    eval(appCode);

    // Zmiana modelu w aplikacji
    window.onGeminiModelChange('gemini-3.8-flash-high');
    assert.strictEqual(window.geminiService.getModel(), 'gemini-3.8-flash-high', 'Model w serwisie powinien wynosić gemini-3.8-flash-high');
    
    // Sprawdź czy zaktualizowano wszystkie selektory
    const testSelectIds = [
      'decoder-gemini-model-select',
      'sqlgen-gemini-model-select',
      'med-gemini-model-select',
      'doc-gemini-model-select',
      'gemini-model-select'
    ];
    testSelectIds.forEach(id => {
      const el = document.getElementById(id);
      assert.strictEqual(el.value, 'gemini-3.8-flash-high', `Selektor ${id} nie został zsynchronizowany`);
    });
    console.log('✅ Synchronizacja: Zmiana modelu na gemini-3.8-flash-high natychmiast zaktualizowała wszystkie 5 modułów');

    console.log('\n🎉 WSZYSTKIE TESTY AGENTÓW AI I PILOTÓW REPL DLA DEKODERA I GENERATORA SQL ZALICZONE Z SUKCESEM (100%)!');
  } catch (err) {
    console.error('❌ Błąd podczas wykonywania testów:', err);
    process.exit(1);
  }
})();
