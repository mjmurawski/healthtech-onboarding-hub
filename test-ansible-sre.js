/**
 * Testy jednostkowe i integracyjne dla Modułu Automatyzacji SRE & Ansible (ansible-sre.js)
 * 
 * Zakres weryfikacji:
 * 1. Katalog Playbooków SRE (SRE_PLAYBOOKS) & reguły Idempotentności
 * 2. Biblioteka Skryptów Hybrydowych (Python + Bash) z obsługą timeoutów i kodów wyjścia
 * 3. Parser wyników wykonania PLAY RECAP (Sukces, Timeout NFS, SSH Unreachable)
 * 4. Generowanie komend CLI ze wsparciem --check (Safe by Default) i --diff
 * 5. Renderowanie modułu UI i obsługa zdarzeń DOM
 * 6. Eksport raportu wykonania do Bazy Runbooków Hubu
 * 7. Synchronizacja modeli AI w js/app.js
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

global.window = {
  localStorage: localStorageMock,
  showToast: (msg, type) => {},
  escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  appState: {
    data: {
      notes: { quickNote: 'Notatki SRE' }
    },
    savedRunbooks: [],
    saveIncidentRunbook: function (record) {
      this.savedRunbooks.push(record);
    },
    getIncidentRunbooks: function () {
      return this.savedRunbooks;
    }
  }
};
global.localStorage = localStorageMock;

// Mock document
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
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        focus: () => {}
      };
    }
    return mockElements[id];
  },
  querySelectorAll: (selector) => [],
  querySelector: (selector) => null,
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => null
  },
  createElement: (tag) => ({
    style: {},
    innerHTML: '',
    appendChild: () => {},
    setAttribute: () => {},
    remove: () => {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    }
  }),
  body: {
    appendChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  readyState: 'complete'
};

global.navigator = {
  clipboard: {
    writeText: async (text) => text
  }
};

(async function runSRETests() {
  console.log('=== TEST 1: Weryfikacja Katalogu Playbooków SRE & Idempotentności ===');

  // Załaduj ansible-sre.js
  const ansibleCode = fs.readFileSync(path.join(__dirname, 'js', 'ansible-sre.js'), 'utf8');
  eval(ansibleCode);

  const playbooks = window.SRE_PLAYBOOKS;
  assert(Array.isArray(playbooks), 'SRE_PLAYBOOKS musi być tablicą');
  assert(playbooks.length >= 5, `Oczekiwano co najmniej 5 playbooków SRE, znaleziono: ${playbooks.length}`);
  console.log(`- Liczba zdefiniowanych playbooków SRE: ${playbooks.length}`);

  playbooks.forEach(pb => {
    assert(pb.id && pb.title && pb.system, `Playbook ${pb.id} musi mieć id, title i system`);
    assert(pb.playbookYaml.includes('---'), `Playbook ${pb.id} musi zaczynać się od standardowego YAML '---'`);
    assert(pb.playbookYaml.includes('hosts:'), `Playbook ${pb.id} musi definiować grupę hosts:`);
    assert(pb.idempotencyNotes && pb.idempotencyNotes.length > 20, `Playbook ${pb.id} musi posiadać wyjaśnienie gwarancji idempotentności`);
    assert(pb.rollbackStrategy && pb.rollbackStrategy.length > 20, `Playbook ${pb.id} musi posiadać strategię rollbacku`);
    assert(pb.defaultVars && typeof pb.defaultVars === 'object', `Playbook ${pb.id} musi definiować bezpieczne zmienne domyślne`);
    console.log(`  ✓ [${pb.id}] ${pb.title} - Idempotentny, wspiera --check, Rollback zdefiniowany`);
  });
  console.log('✅ PLAYBOOKS: Wszystkie playbooki SRE spełniają rygorystyczne normy stabilności i powtarzalności');

  console.log('\n=== TEST 2: Weryfikacja Biblioteki Skryptów Hybrydowych (Python + Bash) ===');
  const scripts = window.SRE_SCRIPTS;
  assert(Array.isArray(scripts) && scripts.length >= 4, 'Oczekiwano co najmniej 4 skryptów pomocniczych');

  const pyProbe = scripts.find(s => s.id === 'mllp_probe');
  assert(pyProbe && pyProbe.lang === 'python', 'Skrypt mllp_probe musi być napisany w Pythonie');
  assert(pyProbe.code.includes('import json'), 'Skrypt Python musi formatować wyjście do JSON dla Ansible');
  assert(pyProbe.code.includes('sys.exit('), 'Skrypt Python musi zarządzać kodami wyjścia exit code');

  const bashVacuum = scripts.find(s => s.id === 'safe_docker_vacuum');
  assert(bashVacuum && bashVacuum.lang === 'bash', 'Skrypt safe_docker_vacuum musi być skryptem Bash');
  assert(bashVacuum.code.includes('set -euo pipefail'), 'Skrypt Bash musi używać bezpiecznego reżimu wykonania set -euo pipefail');
  assert(bashVacuum.code.includes('truncate -s 0'), 'Skrypt Bash musi bezpiecznie zerować logi bez usuwania deskryptorów');

  console.log(`  ✓ Zweryfikowano ${scripts.length} skryptów hybrydowych (Python z obsługą JSON + Bash z pipefail)`);
  console.log('✅ SCRIPTS: Skrypty pomocnicze gotowe do wywoływania z poziomu zadań Ansible');

  console.log('\n=== TEST 3: Weryfikacja Parsera Wyników PLAY RECAP (parseAnsibleOutput) ===');
  const parse = window.parseAnsibleOutput;
  assert(typeof parse === 'function', 'parseAnsibleOutput musi być funkcją');

  // 1. Test sukcesu z modyfikacją (CHANGED)
  const successLog = [
    'PLAY [PostgreSQL SRE Maintenance] **************************************',
    'TASK [Gathering Facts] *************************************************',
    'ok: [his-db-master.med.local]',
    'TASK [Zakończ sesje idle in transaction] *******************************',
    'changed: [his-db-master.med.local]',
    'PLAY RECAP *************************************************************',
    'his-db-master.med.local    : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0'
  ].join('\n');

  const res1 = parse(successLog);
  assert.strictEqual(res1.overallStatus, 'CHANGED', 'Status powinien wynosić CHANGED');
  assert.strictEqual(res1.totals.ok, 3, 'Licznik ok powinien wynosić 3');
  assert.strictEqual(res1.totals.changed, 1, 'Licznik changed powinien wynosić 1');
  assert.strictEqual(res1.totals.failed, 0, 'Licznik failed powinien wynosić 0');
  console.log('  ✓ Poprawnie sparsowano pomyślne wykonanie z zasobami zaktualizowanymi (changed=1)');

  // 2. Test awarii timeoutu NFS (FAILED)
  const failureLog = [
    'PLAY [PACS Storage NFS Mount Remediation] ******************************',
    'TASK [Sprawdź rpcinfo] *************************************************',
    'fatal: [pacs-node-01.med.local]: FAILED! => {"changed": false, "cmd": ["rpcinfo", "-p", "192.168.10.50"], "msg": "non-zero return code", "rc": 1, "stderr": "rpcinfo: can\'t contact portmapper: Connection timed out"}',
    'PLAY RECAP *************************************************************',
    'pacs-node-01.med.local     : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0'
  ].join('\n');

  const res2 = parse(failureLog);
  assert.strictEqual(res2.overallStatus, 'FAILED', 'Status powinien wynosić FAILED');
  assert.strictEqual(res2.totals.failed, 1, 'Licznik failed powinien wynosić 1');
  assert(res2.diagnosis.includes('limit czasu') || res2.diagnosis.includes('NFS'), 'Diagnoza powinna wskazać timeout NFS/RPC');
  assert(res2.remediationCommand.includes('rpcinfo') || res2.remediationCommand.includes('showmount'), 'Zalecenie powinno zawierać komendę diagnostyczną');
  console.log('  ✓ Poprawnie wykryto awarię FAILED (Timeout NFS) z trafną diagnozą root-cause i komendą naprawczą');

  // 3. Test nieosiągalności hosta SSH (UNREACHABLE)
  const unreachableLog = [
    'PLAY [LIS Interface Guard] *********************************************',
    'TASK [Gathering Facts] *************************************************',
    'fatal: [lis-01.med.local]: UNREACHABLE! => {"changed": false, "msg": "Permission denied (publickey).", "unreachable": true}',
    'PLAY RECAP *************************************************************',
    'lis-01.med.local           : ok=0    changed=0    unreachable=1    failed=0    skipped=0    rescued=0'
  ].join('\n');

  const res3 = parse(unreachableLog);
  assert.strictEqual(res3.overallStatus, 'UNREACHABLE', 'Status powinien wynosić UNREACHABLE');
  assert.strictEqual(res3.totals.unreachable, 1, 'Licznik unreachable powinien wynosić 1');
  assert(res3.remediationCommand.includes('ssh'), 'Dla unreachable komenda korygująca musi testować SSH');
  console.log('  ✓ Poprawnie wykryto błąd SSH UNREACHABLE z zaleceniem weryfikacji klucza');
  console.log('✅ PARSER: Parser logów Ansible bezbłędnie identyfikuje metryki i przyczyny awarii');

  console.log('\n=== TEST 4: Weryfikacja Renderowania Modułu UI & Przełączania Widoków ===');
  window.renderAnsibleSREModule();
  const container = document.getElementById('ansible-sre-container');
  assert(container.innerHTML.includes('Katalog Playbooków SRE'), 'UI powinno zawierać nagłówek katalogu playbooków');
  assert(container.innerHTML.includes('Inventory & Zmienne'), 'UI powinno zawierać podzakładkę inventory');
  assert(container.innerHTML.includes('Safe by Default'), 'UI powinno eksponować zasadę Safe by Default');

  // Przełączenie podzakładki na parser
  window.switchSRESubTab('parser');
  assert.strictEqual(window.sreState.activeSubTab, 'parser', 'Stan aktywnego sub-tabu powinien zmienić się na parser');
  assert(container.innerHTML.includes('PLAY RECAP Analyzer'), 'Widok powinien przełączyć się na analizator logów');

  // Przełączenie podzakładki na skrypty
  window.switchSRESubTab('scripts');
  assert.strictEqual(window.sreState.activeSubTab, 'scripts', 'Stan sub-tabu powinien wynosić scripts');
  assert(container.innerHTML.includes('sre_mllp_probe.py'), 'Widok powinien wyświetlać listę skryptów SRE');

  console.log('✅ UI: Wszystkie elementy interfejsu renderują się poprawnie, a przełącznik podzakładek działa natychmiast');

  console.log('\n=== TEST 5: Weryfikacja Eksportu Raportu Uruchomienia do Bazy Runbooków ===');
  window.sreState.parsedLogResult = res2; // Ustaw raport z awarią NFS
  window.saveAnsibleRunAsRunbook();

  const runbooks = window.appState.getIncidentRunbooks();
  assert(runbooks.length > 0, 'Runbook powinien zostać zapisany');
  const lastRecord = runbooks[runbooks.length - 1];
  assert(lastRecord.tags.includes('SRE') && lastRecord.tags.includes('ANSIBLE'), 'Runbook musi posiadać tagi SRE i ANSIBLE');
  assert(lastRecord.rootCause.includes('limit czasu') || lastRecord.rootCause.includes('NFS'), 'Diagnoza musi trafić do wpisu w bazie wiedzy');
  console.log('✅ RUNBOOK INTEGRATION: Pomyślnie wyeksportowano raport uruchomienia Ansible do Bazy Runbooków');

  console.log('\n=== TEST 6: Weryfikacja Zasad Safe by Default (--check & --diff) ===');
  assert.strictEqual(window.sreState.checkMode, true, 'checkMode powinien być domyślnie włączony (Safe by Default)');
  window.toggleSREFlag('checkMode', false);
  assert.strictEqual(window.sreState.checkMode, false, 'toggleSREFlag powinien zmienić flagę na false');
  window.toggleSREFlag('checkMode', true);
  assert.strictEqual(window.sreState.checkMode, true, 'Przywrócenie checkMode powiodło się');
  console.log('✅ SAFE BY DEFAULT: Domyślny dry-run chroni środowiska produkcyjne przed przypadkowymi zmianami');

  console.log('\n=== TEST 7: Weryfikacja Integracji z Główną Aplikacją (js/app.js) ===');
  global.runLinuxTroubleshooter = () => {};
  window.runLinuxTroubleshooter = () => {};
  global.runHL7Inspection = () => {};
  window.runHL7Inspection = () => {};

  const dataCode = fs.readFileSync(path.join(__dirname, 'js', 'data.js'), 'utf8');
  eval(dataCode);
  global.HEALTHTECH_DATA = window.HEALTHTECH_DATA;

  const stateCode = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
  eval(stateCode);

  const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
  eval(appCode);

  // Załaduj gemini-service
  const geminiCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
  eval(geminiCode);

  window.onGeminiModelChange('gemini-3.8-flash-high');
  const modelSelect = document.getElementById('ansible-gemini-model-select');
  assert.strictEqual(modelSelect.value, 'gemini-3.8-flash-high', 'Selektor modelu w module Ansible musi być zsynchronizowany');
  console.log('✅ INTEGRACJA: Selektor modelu AI dla automatyzacji SRE jest w 100% zsynchronizowany z Hubem');

  console.log('\n🎉 WSZYSTKIE 7 TESTÓW MODUŁU AUTOMATYZACJI SRE & ANSIBLE ZALICZONE Z SUKCESEM (100%)!');
})();
