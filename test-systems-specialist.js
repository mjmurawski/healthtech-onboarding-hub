/**
 * Testy jednostkowe dla nowych modułów:
 * 1. Specjalista Systemów Medycznych (SYSTEMS_KB - LIS, eKrew, PatExpert, Genetyka)
 * 2. Dekoder Stack Trace'ów (STACK_KB - Java, .NET, Delphi, PG, Oracle)
 * 3. Generator SQL Diagnostyczny (SQL_TEMPLATES, UPDATE z ROLLBACK)
 * 4. Rozbudowany Mózg Runbooków (Full-text search, filtry po systemie, tagi)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Symulacja środowiska przeglądarki
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

global.window = {
  localStorage: localStorageMock,
  showToast: (msg) => {},
  escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
};
global.localStorage = localStorageMock;

// 1. Załaduj stan (state.js)
const stateCode = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
global.HEALTHTECH_DATA = {
  defaultSkills: { hl7_fhir: 2, delphi: 2, sql: 3, java: 3, python: 3, linux: 3 },
  studyPlan: [],
  firstWeekChecklist: []
};
eval(stateCode);

console.log('=== TEST 1: Weryfikacja Bazy Wiedzy Specjalisty Systemów (SYSTEMS_KB) ===');
const specialistCode = fs.readFileSync(path.join(__dirname, 'js', 'systems-specialist.js'), 'utf8');
eval(specialistCode);

const SYSTEMS_KB = window.SYSTEMS_KB;
assert(typeof SYSTEMS_KB === 'object', 'SYSTEMS_KB powinno być obiektem');
assert(SYSTEMS_KB.lis, 'Brak modułu LIS w SYSTEMS_KB');
assert(SYSTEMS_KB.ekrew, 'Brak modułu eKrew w SYSTEMS_KB');
assert(SYSTEMS_KB.patexpert, 'Brak modułu PatExpert w SYSTEMS_KB');
assert(SYSTEMS_KB.genetyka, 'Brak modułu Genetyka w SYSTEMS_KB');
assert(SYSTEMS_KB.ansible, 'Brak modułu Ansible w SYSTEMS_KB');

const totalScenarios = SYSTEMS_KB.lis.scenarios.length +
                       SYSTEMS_KB.ekrew.scenarios.length +
                       SYSTEMS_KB.patexpert.scenarios.length +
                       SYSTEMS_KB.genetyka.scenarios.length +
                       SYSTEMS_KB.ansible.scenarios.length;

console.log(`- LIS scenariusze: ${SYSTEMS_KB.lis.scenarios.length}`);
console.log(`- eKrew scenariusze: ${SYSTEMS_KB.ekrew.scenarios.length}`);
console.log(`- PatExpert scenariusze: ${SYSTEMS_KB.patexpert.scenarios.length}`);
console.log(`- Genetyka scenariusze: ${SYSTEMS_KB.genetyka.scenarios.length}`);
console.log(`- Ansible scenariusze: ${SYSTEMS_KB.ansible.scenarios.length}`);
console.log(`- Łączna liczba scenariuszy: ${totalScenarios}`);
assert(totalScenarios >= 30, `Powinno być co najmniej 30 scenariuszy, jest: ${totalScenarios}`);

Object.keys(SYSTEMS_KB).forEach(sysKey => {
  SYSTEMS_KB[sysKey].scenarios.forEach(sc => {
    assert(sc.id, `Brak ID w scenariuszu ${sc.title}`);
    assert(sc.title, `Brak tytułu w scenariuszu ${sc.id}`);
    assert(Array.isArray(sc.symptoms) && sc.symptoms.length > 0, `Brak objawów w ${sc.id}`);
    assert(sc.cause, `Brak przyczyny w ${sc.id}`);
    assert(Array.isArray(sc.steps), `Brak kroków w ${sc.id}`);
    assert(Array.isArray(sc.sqlQueries), `Brak zapytań SQL w ${sc.id}`);
  });
});
console.log('✅ SYSTEMS_KB: Wszystkie 30 scenariuszy (w tym Ansible) zawierają kompletne dane diagnostyczne');

console.log('\n=== TEST 2: Weryfikacja Dekodera Stack Trace (STACK_KB & Offline Matching) ===');
const decoderCode = fs.readFileSync(path.join(__dirname, 'js', 'stack-decoder.js'), 'utf8');
eval(decoderCode);

assert(typeof window.STACK_KB !== 'undefined' && Array.isArray(window.STACK_KB), 'STACK_KB powinno być tablicą');
console.log(`- Liczba wbudowanych reguł dekodera: ${window.STACK_KB.length}`);
assert(window.STACK_KB.length >= 15, `Powinno być co najmniej 15 reguł, jest: ${window.STACK_KB.length}`);

// Test dopasowania Java NPE
const sampleJavaNPE = `java.lang.NullPointerException
	at pl.med.lis.service.SampleValidator.validate(SampleValidator.java:142)
	at pl.med.lis.controller.OrderController.processOrder(OrderController.java:87)`;
const npeMatches = window.analyzeStackTrace(sampleJavaNPE);
assert(npeMatches.length > 0, 'Nie dopasowano wyjątku Java NPE');
assert(npeMatches[0].lang === 'Java', 'Błędny język dla Java NPE');
assert(npeMatches[0].diagnosticSQL && npeMatches[0].diagnosticSQL.sql.includes('SELECT'), 'Brak bezpiecznego SELECT dla Java NPE');
console.log('✅ Dekoder: Poprawnie zidentyfikowano Java NPE z gotowym zapytaniem SELECT');

// Test dopasowania Delphi Access Violation
const sampleDelphi = `EAccessViolation: Access violation at address 004A2B1C in module 'LIS.exe'. Read of address 00000000.`;
const delphiMatches = window.analyzeStackTrace(sampleDelphi);
assert(delphiMatches.length > 0, 'Nie dopasowano wyjątku Delphi');
assert(delphiMatches[0].lang.includes('Delphi'), 'Błędny język dla Delphi');
console.log('✅ Dekoder: Poprawnie zidentyfikowano Delphi EAccessViolation');

// Test dopasowania Oracle ORA-00054
const sampleOracle = `ORA-00054: resource busy and acquire with NOWAIT specified or timeout expired`;
const oraMatches = window.analyzeStackTrace(sampleOracle);
assert(oraMatches.length > 0, 'Nie dopasowano Oracle ORA-00054');
assert(oraMatches[0].diagnosticSQL.sql.includes('v$session'), 'Zapytanie dla ORA-00054 powinno badać v$session');
console.log('✅ Dekoder: Poprawnie zidentyfikowano Oracle ORA-00054 z zapytaniem do v$session');

console.log('\n=== TEST 3: Weryfikacja Generatora SQL (SQL_TEMPLATES & Bezpieczny UPDATE) ===');
const sqlGenCode = fs.readFileSync(path.join(__dirname, 'js', 'sql-generator.js'), 'utf8');
eval(sqlGenCode);

assert(typeof window.SQL_TEMPLATES === 'object', 'SQL_TEMPLATES powinno być obiektem');
assert(window.SQL_TEMPLATES.lis && window.SQL_TEMPLATES.ekrew && window.SQL_TEMPLATES.patexpert && window.SQL_TEMPLATES.genetyka, 'SQL_TEMPLATES powinno zawierać 4 systemy');

// Sprawdź zapytanie po kodzie kreskowym
const lisZlecenie = window.SQL_TEMPLATES.lis.zlecenie_by_kod.template('202409210001', 'postgresql');
assert(lisZlecenie.includes('202409210001'), 'Zapytanie powinno zawierać parametr');
assert(lisZlecenie.includes('SELECT') && !lisZlecenie.includes('DELETE') && !lisZlecenie.includes('DROP'), 'Zapytanie powinno być czystym SELECT');
console.log('✅ Generator SQL: Generuje poprawne zapytanie SELECT po kodzie kreskowym');

// Sprawdź czy funkcja highlightSQL koloruje składnię
const highlighted = window.highlightSQL("SELECT * FROM zlecenia WHERE status = 'NOWE';");
assert(highlighted.includes('var(--accent-cyan)'), 'Słowa kluczowe powinny być kolorowane');
assert(highlighted.includes('var(--accent-amber)'), 'Literały stringowe powinny być kolorowane');
console.log('✅ Generator SQL: highlightSQL poprawnie oznacza słowa kluczowe i literały');

console.log('\n=== TEST 4: Weryfikacja Rozbudowanego Drugiego Mózgu Runbooków (Wyszukiwarka & Tagi) ===');
const appState = window.appState;

appState.saveIncidentRunbook({
  title: "Zablokowany bufor zleceń analizatora LIS Cobas 6000",
  system: "LIS",
  category: "Komunikacja",
  errorLog: "Connection reset by peer on port 2575 MLLP",
  postMortemNotes: "Zresetowano sesję TCP: ss -tnp oraz zrestartowano usługę mirth-connect.",
  tags: ["analizator", "mirth", "mllp", "astm"]
});

appState.saveIncidentRunbook({
  title: "eKrew synchronizacja CKiK timeout połączenia",
  system: "eKrew",
  category: "Integracja",
  errorLog: "SSL certificate verify failed for endpoint ckik.gov.pl:443",
  postMortemNotes: "Zaktualizowano certyfikaty CA w systemie: update-ca-certificates.",
  tags: ["ckik", "ssl", "rejestr"]
});

appState.saveIncidentRunbook({
  title: "PatExpert brak miejsca na macierzy NFS dla skanów WSI",
  system: "PatExpert",
  category: "Pamięć Masowa",
  errorLog: "NFS write timeout after 30s for /mnt/pacs_storage/slide_001.svs",
  postMortemNotes: "Przemontowano zasób NFS z opcją hard,intr i wyczyszczono stare archiwa.",
  tags: ["wsi", "nfs", "storage", "svs"]
});

// Test 4.1: Wyszukiwanie pełnotekstowe
const searchResults1 = appState.searchRunbooks("eKrew timeout");
assert(searchResults1.length >= 1, 'Wyszukiwanie "eKrew timeout" powinno zwrócić co najmniej 1 wynik');
assert(searchResults1[0].system === 'eKrew', 'Pierwszy wynik powinien być z systemu eKrew');
console.log(`✅ Wyszukiwarka Runbooków: Fraza "eKrew timeout" zwróciła ${searchResults1.length} rekord(ów)`);

// Test 4.2: Wyszukiwanie po tagu
const searchResults2 = appState.searchRunbooks("mllp");
assert(searchResults2.length >= 1, 'Wyszukiwanie po tagu "mllp" powinno znaleźć runbook LIS');
assert(searchResults2[0].system === 'LIS', 'Wynik powinien pochodzić z systemu LIS');
console.log('✅ Wyszukiwarka Runbooków: Wyszukiwanie po tagu #mllp działa natychmiast');

// Test 4.3: Filtrowanie po systemie
const lisOnly = appState.filterRunbooksBySystem("LIS");
assert(lisOnly.every(r => r.system === 'LIS'), 'Wszystkie rekordy powinny mieć system LIS');
console.log(`✅ Filtrowanie: Filtr LIS zwrócił poprawnie ${lisOnly.length} rekord(ów)`);

console.log('\n=== TEST 5: Weryfikacja Agenta AI i Pilota REPL dla Systemów Medycznych (LIS, eKrew, PatExpert, Genetyka) ===');

// 5.1 Weryfikacja Presetów Produkcyjnych
const MEDICAL_PRESETS = window.MEDICAL_PRESETS;
assert(typeof MEDICAL_PRESETS === 'object', 'MEDICAL_PRESETS powinno być obiektem');
const presetKeys = Object.keys(MEDICAL_PRESETS);
console.log(`- Liczba szybkich scenariuszy produkcyjnych: ${presetKeys.length}`);
assert(presetKeys.length >= 16, `Powinno być co najmniej 16 presetów (4 na system), jest: ${presetKeys.length}`);

const presetSystems = { lis: 0, ekrew: 0, patexpert: 0, genetyka: 0, ansible: 0 };
presetKeys.forEach(k => {
  const p = MEDICAL_PRESETS[k];
  assert(p.system && presetSystems[p.system] !== undefined, `Nieprawidłowy system w presecie: ${k}`);
  assert(p.title && p.title.length > 5, `Brak lub zbyt krótki tytuł w presecie: ${k}`);
  assert(p.log && p.log.length > 10, `Brak lub zbyt krótki log w presecie: ${k}`);
  presetSystems[p.system]++;
});

assert.strictEqual(presetSystems.lis, 4, 'LIS powinien mieć dokładnie 4 presety');
assert.strictEqual(presetSystems.ekrew, 4, 'eKrew powinien mieć dokładnie 4 presety');
assert.strictEqual(presetSystems.patexpert, 4, 'PatExpert powinien mieć dokładnie 4 presety');
assert.strictEqual(presetSystems.genetyka, 4, 'Genetyka powinna mieć dokładnie 4 presety');
assert(presetSystems.ansible >= 5, `Ansible powinien mieć co najmniej 5 presetów, ma: ${presetSystems.ansible}`);
console.log('✅ MEDICAL_PRESETS: Wszystkie 5 systemów posiadają gotowe scenariusze szpitalne');

// 5.2 Załaduj i przetestuj gemini-service z rolami medycznymi i SRE
const geminiCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
eval(geminiCode);

const geminiService = window.geminiService;
assert(geminiService, 'window.geminiService powinien istnieć');

// Weryfikacja instrukcji systemowych per system
const lisInstr = geminiService.getMedicalPilotInstruction('lis');
assert(lisInstr.includes('LIS') && lisInstr.includes('ASTM') && lisInstr.includes('MLLP'), 'Prompt LIS powinien zawierać domenę ASTM/MLLP');

const ekrewInstr = geminiService.getMedicalPilotInstruction('ekrew');
assert(ekrewInstr.includes('eKrew') && ekrewInstr.includes('ISBT 128') && ekrewInstr.includes('CKiK'), 'Prompt eKrew powinien zawierać ISBT 128 i CKiK');

const patInstr = geminiService.getMedicalPilotInstruction('patexpert');
assert(patInstr.includes('PatExpert') && patInstr.includes('WSI') && patInstr.includes('NFS'), 'Prompt PatExpert powinien zawierać WSI i NFS');

const genInstr = geminiService.getMedicalPilotInstruction('genetyka');
assert(genInstr.includes('Genetyk') && genInstr.includes('VCF') && genInstr.includes('OOM'), 'Prompt Genetyka powinien zawierać VCF i OOM');

const ansibleInstr = geminiService.getMedicalPilotInstruction('ansible');
assert(ansibleInstr.includes('Ansible') && ansibleInstr.includes('playbook'), 'Prompt Ansible powinien zawierać domenę Ansible i playbook');

console.log('✅ Dedykowane instrukcje systemowe dla 5 systemów (w tym Ansible) zawierają pełny kontekst domenowy');

// 5.3 Weryfikacja instancji dedykowanego Pilota Medycznego
const medSession = geminiService.getMedicalPilotSession();
assert(medSession, 'getMedicalPilotSession() powinno zwracać instancję GeminiPilotSession');
medSession.reset();

// Test parsowania odpowiedzi Pilota z zapytaniem SQL
const mockSQLResponse = `💡 Diagnoza: Bufor analizatora zatrzymał się z powodu oczekujących zleceń bez potwierdzenia ACK.
🎯 Cel: Sprawdzenie liczby oczekujących zleceń wychodzących w buforze komunikacyjnym LIS
💻 Komenda:
\`\`\`sql
SELECT id, nr_zlecenia, status_kom, data_wys FROM zlecenia_wych WHERE status_kom = 'OCZEKUJE' ORDER BY data_wys ASC LIMIT 10;
\`\`\`
❓ Oczekiwanie: Wklej poniżej wynik zapytania z klienta SQL (np. DBeaver).`;

const parsedSQL = geminiService.parsePilotMessage(mockSQLResponse);
assert.strictEqual(parsedSQL.isSQL, true, 'Parser powinien wykryć, że komenda to zapytanie SQL');
assert.ok(parsedSQL.command.startsWith('SELECT'), 'Komenda powinna zaczynać się od SELECT bez znacznika sql');
assert.ok(!parsedSQL.command.startsWith('sql'), 'Komenda nie powinna zawierać prefiksu języka sql');
assert.strictEqual(parsedSQL.goal, 'Sprawdzenie liczby oczekujących zleceń wychodzących w buforze komunikacyjnym LIS');

// Symulacja pełnej sesji Pilota dla systemu LIS
medSession.systemType = 'lis';
medSession.rawLog = MEDICAL_PRESETS.lis_astm.log;
medSession.detectedService = 'lis-comm-daemon';
medSession.hypothesis = 'Zator bufora ASTM do analizatora Cobas';
medSession.status = 'ACTIVE';
medSession.stepNumber = 1;

medSession.turns.push({
  type: 'agent',
  stepNumber: 1,
  parsed: parsedSQL,
  timestamp: '14:00:00'
});

medSession.turns.push({
  type: 'user',
  stepNumber: 1,
  text: 'id | nr_zlecenia | status_kom | data_wys\n1  | 2024092101  | OCZEKUJE   | 2024-09-21 13:58:00\n(1 row)',
  timestamp: '14:00:20'
});

const mockResolvedResponse = `💡 Diagnoza: Restart procesu lis-comm-daemon udrożnił komunikację, analizator pobrał zlecenie i odesłał ramkę ACK.
🎉 [AWARIA ROZWIĄZANA]`;

const parsedResolved = geminiService.parsePilotMessage(mockResolvedResponse);
medSession.turns.push({
  type: 'agent',
  stepNumber: 2,
  parsed: parsedResolved,
  timestamp: '14:01:00'
});
medSession.isResolved = true;
medSession.status = 'RESOLVED';
medSession.stepNumber = 2;

// Eksport sesji do Runbooka
const runbook = medSession.toRunbookRecord();
assert.strictEqual(runbook.system, 'LIS', 'System w Runbooku powinien wynosić LIS');
assert.ok(runbook.tags.includes('lis'), 'Tagi powinny zawierać lis');
assert.ok(runbook.tags.includes('pilot-ai'), 'Tagi powinny zawierać pilot-ai');
assert.ok(runbook.postMortemNotes.includes('```sql'), 'Notatki Post-Mortem powinny zawierać blok z kodem sql');
assert.ok(runbook.postMortemNotes.includes('AWARIA ROZWIĄZANA'), 'Notatki powinny potwierdzać rozwiązanie awarii');

// 5.4 Symulacja pełnej sesji Pilota AI dla systemu Ansible
medSession.reset();
medSession.systemType = 'ansible';
medSession.rawLog = MEDICAL_PRESETS.ansible_failed.log;
medSession.detectedService = 'ansible-playbook';
medSession.hypothesis = 'Awaria zadania Ansible z niezerowym kodem rc=1';
medSession.status = 'ACTIVE';
medSession.stepNumber = 1;

const mockAnsibleResponse = `💡 Diagnoza: Zadanie playbooka zgłasza Connection Refused do bazy PostgreSQL na porcie 5432.
🎯 Cel: Weryfikacja stanu usługi PostgreSQL na hoście master
💻 Komenda:
\`\`\`bash
ansible his-db-master.med.local -m systemd -a "name=postgresql" --become
\`\`\`
❓ Oczekiwanie: Wklej wynik polecenia modułowego Ansible z terminala.`;

const parsedAnsible = geminiService.parsePilotMessage(mockAnsibleResponse);
assert.strictEqual(parsedAnsible.isSQL, false, 'Komenda powinna być rozpoznana jako bash');
assert.ok(parsedAnsible.command.includes('ansible'), 'Komenda powinna zawierać polecenie ansible');

medSession.turns.push({
  type: 'agent',
  stepNumber: 1,
  parsed: parsedAnsible,
  timestamp: '14:05:00'
});

medSession.turns.push({
  type: 'user',
  stepNumber: 1,
  text: 'his-db-master.med.local | SUCCESS => {\n    "name": "postgresql",\n    "status": {\n        "ActiveState": "active"\n    }\n}',
  timestamp: '14:05:25'
});

const mockAnsibleResolved = `💡 Diagnoza: Usługa bazy danych została uruchomiona, ponowne wykonanie playbooka z flagą --check zakończone sukcesem (changed=0, failed=0).
🎉 [AWARIA ROZWIĄZANA]`;

const parsedAnsibleResolved = geminiService.parsePilotMessage(mockAnsibleResolved);
medSession.turns.push({
  type: 'agent',
  stepNumber: 2,
  parsed: parsedAnsibleResolved,
  timestamp: '14:06:00'
});
medSession.isResolved = true;
medSession.status = 'RESOLVED';
medSession.stepNumber = 2;

const ansibleRunbook = medSession.toRunbookRecord();
assert.strictEqual(ansibleRunbook.system, 'Ansible (SRE)', 'System w Runbooku powinien wynosić Ansible (SRE)');
assert.ok(ansibleRunbook.tags.includes('ansible'), 'Tagi powinny zawierać ansible');
assert.ok(ansibleRunbook.tags.includes('sre'), 'Tagi powinny zawierać sre');
assert.ok(ansibleRunbook.postMortemNotes.includes('AWARIA ROZWIĄZANA'), 'Notatki powinny potwierdzać rozwiązanie awarii');

console.log('✅ Interaktywny Pilot Medyczny REPL bezbłędnie asystuje przy LIS, eKrew, PatExpert, Genetyce i Ansible');

console.log('\n=== TEST 6: Weryfikacja Konfiguracji i Przełącznika Modeli AI w Zakładce Systemów Medycznych ===');
assert(Array.isArray(window.GEMINI_MODELS), 'window.GEMINI_MODELS powinno być tablicą');
assert(window.GEMINI_MODELS.length >= 11, `Powinno być co najmniej 11 modeli Gemini, jest: ${window.GEMINI_MODELS.length}`);
const defaultModel = window.GEMINI_MODELS.find(m => m.value === 'gemini-3.5-flash');
assert(defaultModel, 'gemini-3.5-flash powinien znajdować się na liście modeli');
console.log(`- Liczba dostępnych modeli Gemini: ${window.GEMINI_MODELS.length}`);
console.log(`- Model domyślny: ${defaultModel.label} (${defaultModel.value})`);

// Mock document for DOM elements
global.document = {
  getElementById: (id) => {
    return {
      id: id,
      value: '',
      innerHTML: '',
      style: {},
      disabled: false
    };
  },
  querySelectorAll: (selector) => []
};

// Test zmiany modelu
window.onMedicalGeminiModelChange('gemini-2.5-flash');
assert.strictEqual(geminiService.getModel(), 'gemini-2.5-flash', 'Model w geminiService powinien zmienić się na gemini-2.5-flash');
assert.strictEqual(localStorage.getItem('healthtech_gemini_model'), 'gemini-2.5-flash', 'Model w localStorage powinien być zaktualizowany');

// Przywrócenie domyślnego gemini-3.5-flash
window.onMedicalGeminiModelChange('gemini-3.5-flash');
assert.strictEqual(geminiService.getModel(), 'gemini-3.5-flash', 'Model powinien powrócić do gemini-3.5-flash');
assert.strictEqual(localStorage.getItem('healthtech_gemini_model'), 'gemini-3.5-flash', 'Model w localStorage powinien być gemini-3.5-flash');

console.log('✅ Konfiguracja i synchronizacja modeli AI w zakładce LIS/eKrew/PatExpert/Genetyka działa bezbłędnie');

console.log('\n🎉 WSZYSTKIE TESTY NOWYCH MODUŁÓW I AGENTA MEDYCZNEGO ZALICZONE Z SUKCESEM (100%)!');

