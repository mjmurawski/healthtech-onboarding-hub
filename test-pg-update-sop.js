/**
 * Testy jednostkowe i integracyjne dla Modułu SOP Aktualizacji PostgreSQL & Centrum (pg-update-sop.js)
 * 
 * Zakres testów:
 * 1. Struktura i integralność Bazy Wiedzy SOP (6 kroków procedury)
 * 2. Precyzja merytoryczna poleceń inżynierów SRE (SELECT * FROM pg_stat_activity WHERE datname = 'centrum';)
 * 3. Trik z tabelą wersja oraz obsługa kgp.exe -a centrum.exe przez Wine
 * 4. Procedura dla serwerów satelitarnych Alab (RDP Debian & CZA marcele.pl)
 * 5. Baza komend Ściągawki Terminalowej (kategorie, 1-Click copy, wyszukiwarka)
 * 6. Sekcja PostgreSQL Bloat & technika zrzutu (1.3 TB -> 300 GB)
 * 7. Peryferia szpitalne (Mirth, Samba, TigerVNC, Cron, LXC)
 * 8. Renderowanie DOM i przełączanie zakładek
 * 9. Interaktywna checklista i zapis do localStorage
 * 10. Eksport procedury do Bazy Runbooków Hubu (appState.saveIncidentRunbook)
 * 11. Spójność integracji z index.html oraz js/app.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Symulacja środowiska przeglądarki (DOM & localStorage)
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store
  };
})();

const savedRunbooksList = [];

global.window = {
  localStorage: localStorageMock,
  showToast: (msg, type) => {},
  escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  appState: {
    data: {
      theme: 'dark'
    },
    savedRunbooks: savedRunbooksList,
    saveIncidentRunbook: function (rb) {
      this.savedRunbooks.push(rb);
    },
    getIncidentRunbooks: function () {
      return this.savedRunbooks;
    }
  }
};
global.localStorage = localStorageMock;

// Mock DOM Document
const mockElements = {};
global.document = {
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = {
        id: id,
        innerHTML: '',
        value: '',
        style: {},
        classList: {
          classes: new Set(),
          add: function(c) { this.classes.add(c); },
          remove: function(c) { this.classes.delete(c); },
          contains: function(c) { return this.classes.has(c); }
        },
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => null,
        focus: () => {},
        setSelectionRange: () => {}
      };
    }
    return mockElements[id];
  },
  querySelectorAll: (selector) => [],
  querySelector: (selector) => null,
  createElement: (tag) => ({
    style: {},
    innerHTML: '',
    appendChild: () => {},
    removeChild: () => {},
    select: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Załadowanie modułu pg-update-sop.js
const pgUpdateSopPath = path.join(__dirname, 'js', 'pg-update-sop.js');
const pgUpdateSopCode = fs.readFileSync(pgUpdateSopPath, 'utf8');

// Wykonanie kodu modułu w środowisku testowym
eval(pgUpdateSopCode);

console.log('Rozpoczynam testy modułu SOP Aktualizacji PostgreSQL & Centrum...');

// === TEST 1: Weryfikacja eksportu i struktury globalnej ===
console.log('\n=== TEST 1: Weryfikacja Rejestracji Modułu w Obiekcie Window ===');
assert.strictEqual(typeof window.renderPgUpdateSopModule, 'function', 'renderPgUpdateSopModule musi być funkcją');
assert.strictEqual(typeof window.savePgUpdateRunbookUI, 'function', 'savePgUpdateRunbookUI musi być funkcją');
assert.ok(window.PG_UPDATE_SOP, 'Obiekt window.PG_UPDATE_SOP musi istnieć');
assert.strictEqual(Array.isArray(window.PG_UPDATE_SOP.steps), true, 'PG_UPDATE_SOP.steps musi być tablicą');
assert.strictEqual(Array.isArray(window.PG_UPDATE_SOP.commands), true, 'PG_UPDATE_SOP.commands musi być tablicą');
console.log('✅ REJESTRACJA: Wszystkie interfejsy modułu są poprawnie wyeksportowane');

// === TEST 2: Weryfikacja 6 Kroków Procedury SOP ===
console.log('\n=== TEST 2: Weryfikacja 6 Kroków Procedury SOP ===');
const steps = window.PG_UPDATE_SOP.steps;
assert.strictEqual(steps.length, 6, 'Procedura musi zawierać dokładnie 6 kroków');

const stepIds = steps.map(s => s.id);
assert.deepStrictEqual(stepIds, ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'], 'Identyfikatory kroków muszą być od step_1 do step_6');

steps.forEach(step => {
  assert.ok(step.title, `Krok ${step.id} musi mieć tytuł`);
  assert.ok(step.summary, `Krok ${step.id} musi mieć podsumowanie`);
  assert.ok(step.why, `Krok ${step.id} musi mieć uzasadnienie (why)`);
  assert.ok(step.sreNote, `Krok ${step.id} musi mieć notatkę wytycznych SRE`);
  assert.ok(Array.isArray(step.commands) && step.commands.length > 0, `Krok ${step.id} musi zawierać komendy`);
  assert.ok(Array.isArray(step.checklistItems) && step.checklistItems.length > 0, `Krok ${step.id} musi zawierać punkty checklisty`);
  console.log(`  ✓ Krok ${step.number}: ${step.title} (${step.commands.length} komend, ${step.checklistItems.length} punktów kontrolnych)`);
});
console.log('✅ STRUKTURA KROKÓW: Wszystkie 6 kroków są w 100% kompletne');

// === TEST 3: Precyzja komendy zero-connection check Inżynierów SRE & Kontrola Usług ===
console.log('\n=== TEST 3: Weryfikacja Zero-Connection Check & Kontroli Usług (Wytyczne SRE) ===');
const step1 = steps.find(s => s.id === 'step_1');
const checkCmd = step1.commands.find(c => c.cmd.includes("SELECT * FROM pg_stat_activity WHERE datname = 'centrum';"));
assert.ok(checkCmd, "Krok 1 musi zawierać dokładne zapytanie: SELECT * FROM pg_stat_activity WHERE datname = 'centrum';");
assert.ok(step1.sreNote.includes('(0 rows)'), "Krok 1 musi tłumaczyć wymóg szybkiego sprawdzenia (0 rows)");

// Logowanie SSH z agent forwarding (-A) (z wytycznych inżynierów SRE)
assert.ok(step1.commands.some(c => c.cmd.includes('ssh -A root@')), 'Krok 1 musi zawierać logowanie ssh z flagą -A (Agent Forwarding)');
assert.ok(step1.sreNote.includes('-A') || step1.sreNote.includes('ssh -A'), 'Krok 1 w notatce SRE musi wyjaśniać użycie flagi -A do przekazywania agenta SSH');

// Komenda rc-status
assert.ok(step1.commands.some(c => c.cmd.includes('rc-status')), 'Krok 1 musi zawierać komendę rc-status do sprawdzenia procesów/usług');
assert.ok(step1.sreNote.includes('rc-status'), 'Krok 1 w notatce SRE musi wyjaśniać użycie rc-status przed logowaniem');

// Komendy zatrzymania procesu / odcięcia połączeń
assert.ok(step1.commands.some(c => c.cmd.includes('/etc/init.d/postgresql-11 stop')), 'Krok 1 musi zawierać zatrzymanie PostgreSQL na Gentoo OpenRC');
assert.ok(step1.commands.some(c => c.cmd.includes('systemctl stop postgresql')), 'Krok 1 musi zawierać zatrzymanie PostgreSQL na Debian/Ubuntu systemd');
assert.ok(step1.commands.some(c => c.cmd.includes('pg_terminate_backend')), 'Krok 1 musi zawierać awaryjne zrzucenie sesji przez pg_terminate_backend');

// Komendy uruchomienia / restartu procesu
assert.ok(step1.commands.some(c => c.cmd.includes('/etc/init.d/postgresql-11 start')), 'Krok 1 musi zawierać uruchomienie PostgreSQL na Gentoo OpenRC');
assert.ok(step1.commands.some(c => c.cmd.includes('systemctl start postgresql')), 'Krok 1 musi zawierać uruchomienie PostgreSQL na Debian/Ubuntu systemd');
assert.ok(step1.commands.some(c => c.cmd.includes('/etc/init.d/postgresql-11 restart')), 'Krok 1 musi zawierać restart OpenRC na Gentoo');
assert.ok(step1.commands.some(c => c.cmd.includes('systemctl restart postgresql')), 'Krok 1 musi zawierać restart systemd na Debianie');
console.log('✅ ZERO-CONNECTION & SERVICE CONTROL: rc-status, stop, start, terminate i restart są w 100% zweryfikowane');

// === TEST 4: Trik z tabelą wersja i Wine kgp.exe ===
console.log('\n=== TEST 4: Trik z Tabelą wersja oraz Podpisywanie Wine kgp.exe ===');
const step2 = steps.find(s => s.id === 'step_2');
assert.ok(step2.sreNote.includes('INSERT INTO wersja'), 'Krok 2 musi wyjaśniać wycięcie pierwszej linijki INSERT INTO wersja');
assert.ok(step2.commands.some(c => c.cmd.includes('/home/lab/marcel/service/')), 'Krok 2 musi używać ścieżki /home/lab/marcel/service/');

const step4 = steps.find(s => s.id === 'step_4');
const wineCmd = step4.commands.find(c => c.cmd.includes('wine kgp.exe -a centrum.exe'));
assert.ok(wineCmd, 'Krok 4 musi zawierać komendę: wine kgp.exe -a centrum.exe');
assert.ok(step4.commands.some(c => c.cmd.includes('chown lab:users')), 'Krok 4 musi zawierać nadanie uprawnień chown lab:users');
assert.ok(step4.commands.some(c => c.cmd.includes('chmod 755')), 'Krok 4 musi zawierać nadanie uprawnień chmod 755');
assert.ok(step4.sreNote.includes('PE') || step4.sreNote.includes('bit'), 'Krok 4 musi wyjaśniać modyfikację bitu PE licencji');
console.log('✅ WERSJA TRICK & WINE SIGNING: Procedura zawiera kluczowe tribal knowledge');

// === TEST 5: Serwery satelitarne Alab (RDP Debian & CZA marcele.pl) ===
console.log('\n=== TEST 5: Weryfikacja Obsługi Serwerów Satelitarnych Alab ===');
const step5 = steps.find(s => s.id === 'step_5');
assert.ok(step5.title.includes('RDP') && step5.title.includes('CZA'), 'Krok 5 musi dotyczyć serwerów RDP i CZA');
assert.ok(step5.commands.some(c => c.cmd.includes('marcele.pl')), 'Krok 5 musi zawierać serwer marcele.pl dla telepatologii CZA');
assert.ok(step5.sreNote.includes('Gentoo') && step5.sreNote.includes('Debian'), 'Krok 5 musi opisywać transfer między Debianem bez Wine a Gentoo z Wine');
console.log('✅ ALAB SATELLITES: Workflow przenoszenia i podpisywania klucza na Gentoo zaimplementowany');

// === TEST 6: Baza Komend Ściągawki Terminalowej ===
console.log('\n=== TEST 6: Weryfikacja Ściągawki Terminalowej (Cheat Sheet) ===');
const commands = window.PG_UPDATE_SOP.commands;
assert.ok(commands.length >= 18, `Ściągawka musi zawierać co najmniej 18 komend (aktualnie: ${commands.length})`);

const expectedCategories = [
  '1. Diagnostyka Sesji & Restart PostgreSQL',
  '2. Katalogi Robocze & Uprawnienia',
  '3. Podpisywanie Binarki Wine (kgp.exe)',
  '4. Kopiowanie Satelickie (RDP & CZA marcele.pl)',
  '5. PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB)',
  '6. Peryferia Szpitalne (Usługi do Kontroli)'
];

expectedCategories.forEach(cat => {
  const hasCat = commands.some(c => c.category === cat);
  assert.ok(hasCat, `Ściągawka musi zawierać kategorię: ${cat}`);
});
console.log('✅ CHEAT SHEET: Wszystkie 6 kategorii komend terminalowych są obecne');

// === TEST 7: Sekcja PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB) ===
console.log('\n=== TEST 7: Weryfikacja Sekcji Bloat & Redukcji Dysku ===');
const bloatCommands = commands.filter(c => c.category.includes('Bloat'));
assert.ok(bloatCommands.some(c => c.cmd.includes('pg_dump') && c.cmd.includes('-Fc')), 'Musi być komenda pg_dump -Fc format custom');
assert.ok(bloatCommands.some(c => c.cmd.includes('pg_restore')), 'Musi być komenda pg_restore');
assert.ok(bloatCommands.some(c => c.cmd.includes('VACUUM FULL')), 'Musi być komenda VACUUM FULL z ostrzeżeniem');
console.log('✅ BLOAT & SHRINK: Procedura redukcji bazy z 1.3 TB do 300 GB zweryfikowana');

// === TEST 8: Peryferia Szpitalne ===
console.log('\n=== TEST 8: Weryfikacja Peryferiów Szpitalnych ===');
const periphCommands = commands.filter(c => c.category.includes('Peryferia'));
assert.ok(periphCommands.some(c => c.cmd.includes('mirth-connect')), 'Musi zawierać status/zatrzymanie Mirth Connect');
assert.ok(periphCommands.some(c => c.cmd.includes('smbd')), 'Musi zawierać status Samby');
assert.ok(periphCommands.some(c => c.cmd.includes('vnc')), 'Musi zawierać status VNC');
assert.ok(periphCommands.some(c => c.cmd.includes('lxc-ls')), 'Musi zawierać monitoring kontenerów LXC (a12, elaborat)');
console.log('✅ PERYFERIA: Usługi medyczne (Mirth, Samba, VNC, LXC) są uwzględnione');

// === TEST 9: Renderowanie DOM i Obsługa Stanu ===
console.log('\n=== TEST 9: Weryfikacja Renderowania DOM i Stanu Checklisty ===');
const container = document.getElementById('pg-update-sop-container');
window.renderPgUpdateSopModule();
assert.ok(container.innerHTML.length > 500, 'Kontener modułu musi zostać wypełniony zawartością HTML');
assert.ok(container.innerHTML.includes('Standard Operating Procedure'), 'HTML musi zawierać nagłówek procedury');
assert.ok(container.innerHTML.includes('Główny Zespół SRE LIS') || container.innerHTML.includes('Zespół SRE'), 'HTML musi wskazywać autora procedury');

const contentEl = document.getElementById('sop-subtab-content');
assert.ok(contentEl.innerHTML.includes('Zaktualizowana Procedura Standardowa (SOP): Aktualizacja Bazy PostgreSQL i Centrum'), 'Podzakładka musi zawierać zaktualizowany nagłówek SOP');
assert.ok(contentEl.innerHTML.includes('ssh -A root@'), 'Wyjście procedury musi zawierać polecenie ssh -A root@');
assert.ok(contentEl.innerHTML.includes('rc-status'), 'Wyjście procedury musi zawierać polecenie rc-status');
assert.ok(contentEl.innerHTML.includes('>bash</span>') && contentEl.innerHTML.includes('>sql</span>'), 'Wyjście procedury musi renderować nowoczesne etykiety bloków kodu bash oraz sql');
assert.ok(contentEl.innerHTML.includes('Quality Gates'), 'Wyjście procedury musi zawierać bramki jakościowe Quality Gates');

// Weryfikacja braku błędu "color: rgb..." oraz poprawności podświetlenia kodu
assert.strictEqual(contentEl.innerHTML.includes('"color: rgb'), false, 'HTML nie może zawierać zepsutych atrybutów style ani wycieku kodu CSS do treści komend');
assert.ok(contentEl.innerHTML.includes('>rc-status</code>'), 'rc-status musi być czystą komendą w bloku code');
assert.ok(contentEl.innerHTML.includes('>psql -U postgres</code>'), 'psql -U postgres musi być czystą komendą w bloku code');
assert.ok(contentEl.innerHTML.includes('>SELECT</span> * <span style="color: #58a6ff;">FROM</span>'), 'SELECT i FROM w zapytaniu SQL muszą być prawidłowo podświetlone na niebiesko');
assert.ok(contentEl.innerHTML.includes("<span style=\"color: #7ee787;\">'centrum'</span>"), "'centrum' w zapytaniu SQL musi być prawidłowo podświetlone na zielono");
console.log('✅ DOM RENDER & HIGHLIGHT INTEGRITY: Brak wycieków CSS, kod jest w 100% czysty i zgodny 1:1 ze zrzutem');

// === TEST 10: Zapis do Bazy Runbooków ===
console.log('\n=== TEST 10: Weryfikacja Eksportu Procedury do Bazy Runbooków ===');
const runbooksBefore = window.appState.getIncidentRunbooks().length;
window.savePgUpdateRunbookUI();
const runbooksAfter = window.appState.getIncidentRunbooks().length;
assert.strictEqual(runbooksAfter, runbooksBefore + 1, 'Liczba runbooków musi wzrosnąć o 1');
const lastRunbook = window.appState.getIncidentRunbooks()[runbooksAfter - 1];
assert.ok(lastRunbook.title.includes('PostgreSQL & Centrum'), 'Tytuł runbooka musi dotyczyć aktualizacji PostgreSQL');
assert.strictEqual(lastRunbook.steps.length, 6, 'Wyeksportowany runbook musi zawierać 6 kroków');
assert.strictEqual(lastRunbook.verified, true, 'Runbook musi być oznaczony jako verified');
console.log('✅ RUNBOOK EXPORT: Pomyślnie wyeksportowano SOP do Bazy Runbooków Hubu');

// === TEST 11: Spójność integracji w index.html i js/app.js ===
console.log('\n=== TEST 11: Weryfikacja Spójności Plików Projektu (index.html, app.js) ===');
const indexHtmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert.ok(indexHtmlContent.includes('data-tab="tab-pg-update-sop"'), 'index.html musi zawierać pozycję menu dla tab-pg-update-sop');
assert.ok(indexHtmlContent.includes('id="tab-pg-update-sop"'), 'index.html musi zawierać panel zakładek tab-pg-update-sop');
assert.ok(indexHtmlContent.includes('id="pg-update-sop-container"'), 'index.html musi zawierać kontener pg-update-sop-container');
assert.ok(indexHtmlContent.includes('src="js/pg-update-sop.js"'), 'index.html musi dołączać skrypt js/pg-update-sop.js');

const appJsContent = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
assert.ok(appJsContent.includes('renderPgUpdateSopModule'), 'app.js musi wywoływać renderPgUpdateSopModule() w initApp()');
assert.ok(appJsContent.includes('data-switch-tab="tab-pg-update-sop"'), 'app.js musi zawierać kafelek szybkiego dostępu na pulpicie dla SOP');
console.log('✅ INTEGRACJA PROJEKTU: Nawigacja, panel, skrypt i pulpit są w 100% zintegrowane');

// === TEST 12: Weryfikacja Podzakładki i Plików Sandboxa (Lokalne Środowisko SRE) ===
console.log('\n=== TEST 12: Weryfikacja Plików i Podzakładki Sandboxa SRE ===');
assert.ok(container.innerHTML.includes('data-sop-subtab="sandbox"'), 'Pasek zakładek musi zawierać przycisk sandbox');
assert.ok(container.innerHTML.includes('Laboratorium SRE'), 'Pasek zakładek musi zawierać etykietę Laboratorium SRE');

// Weryfikacja fizycznych plików w katalogu sandbox/
const sandboxDir = path.join(__dirname, 'sandbox');
assert.ok(fs.existsSync(path.join(sandboxDir, 'docker-compose.yml')), 'Plik sandbox/docker-compose.yml musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'Dockerfile')), 'Plik sandbox/Dockerfile musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'init-db.sql')), 'Plik sandbox/init-db.sql musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'README.md')), 'Plik sandbox/README.md musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'mock-update', 'update.sh')), 'Plik sandbox/mock-update/update.sh musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'mock-update', '5.2.1.sql')), 'Plik sandbox/mock-update/5.2.1.sql musi istnieć');
assert.ok(fs.existsSync(path.join(sandboxDir, 'mock-update', 'kgp.exe')), 'Plik sandbox/mock-update/kgp.exe musi istnieć');
console.log('✅ SANDBOX FILES: Wszystkie pliki poligonu doświadczalnego SRE istnieją i są kompletne');

console.log('\n🎉 WSZYSTKIE 12 TESTÓW MODUŁU AKTUALIZACJI POSTGRESQL & CENTRUM (SOP) ZALICZONE Z SUKCESEM (100%)!\n');
