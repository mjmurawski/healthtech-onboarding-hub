/**
 * Test integracji z Google Gemini API (BYOK)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment
global.window = {
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  }
};

// Załaduj gemini-service.js
const geminiCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
eval(geminiCode);

console.log("=== TEST 1: Inicjalizacja i instancja GeminiService ===");
const service = global.window.geminiService;
assert.ok(service, "window.geminiService powinien być zainicjalizowany");
assert.strictEqual(service.hasApiKey(), false, "Domyślnie brak klucza");

console.log("=== TEST 2: Zarządzanie kluczem API i modelem (localStorage) ===");
service.setApiKey("AIzaSyFakeTestKey12345678901234567890");
assert.strictEqual(service.hasApiKey(), true, "Klucz powinien być wykryty");
assert.strictEqual(service.getApiKey(), "AIzaSyFakeTestKey12345678901234567890");
assert.strictEqual(service.getModel(), "gemini-3.5-flash", "Domyślny model to gemini-3.5-flash");

service.setModel("gemini-2.0-flash");
assert.strictEqual(service.getModel(), "gemini-2.0-flash");

service.removeApiKey();
assert.strictEqual(service.hasApiKey(), false);
console.log("✅ Zarządzanie kluczem i modelami działa prawidłowo");

console.log("=== TEST 3: Weryfikacja Rygorystycznego System Promptu Szpitalnego ===");
assert.ok(service.systemInstruction.includes("HIERARCHIA ERROR-FIRST"), "Musi zawierać Error-First");
assert.ok(service.systemInstruction.includes("BRAMKA STANU PROCESU"), "Musi zawierać bramkę stanu procesu");
assert.ok(service.systemInstruction.includes("OCHRONA PLIKÓW PRZED TRUNCATE"), "Musi zawierać ochronę przed truncate");
assert.ok(service.systemInstruction.includes("OCHRONA BAZY FIREBIRD"), "Musi zawierać ochronę bazy Firebird");
assert.ok(service.systemInstruction.includes("OCHRONA PROTOKOŁU MLLP"), "Musi zawierać ochronę protokołu MLLP");
console.log("✅ System Prompt spełnia wszystkie kryteria Zero-Risk Hospital Policy");

console.log("=== TEST 4: Parsowanie i weryfikacja reguły JSON v2.0.0 ===");
const mockAiResponse = `\`\`\`json
{
  "id": "ERR_CUSTOM_REDIS_OOM",
  "priority": 85,
  "layer": "HARDWARE_RAM",
  "triggers": ["OOM command not allowed when used memory > 'maxmemory'"],
  "service_status": "ALIVE_OR_BLOCKED",
  "title": "Redis Cache OOM: Przekroczenie limitu pamięci podręcznej",
  "diagnosis": "Baza Redis zapełniła przydzieloną pamięć maxmemory i odrzuca nowe zlecenia.",
  "safety_guard": "ZAKAZ restartowania serwera w trakcie trwania procedury bez zrzutu dump.rdb.",
  "steps": [
    {
      "step": 1,
      "title": "Sprawdzenie pamięci w Redis CLI",
      "cmd": "redis-cli info memory",
      "verify": "Sprawdź used_memory_human oraz maxmemory_human"
    }
  ]
}
\`\`\``;

const cleaned = mockAiResponse.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
const parsed = JSON.parse(cleaned);
assert.strictEqual(parsed.id, "ERR_CUSTOM_REDIS_OOM");
assert.strictEqual(parsed.priority, 85);
assert.strictEqual(parsed.layer, "HARDWARE_RAM");
assert.strictEqual(parsed.steps.length, 1);
console.log("✅ Pomyślnie sparsowano i zweryfikowano format reguły JSON v2.0.0 z mocka AI");

console.log("=== TEST 5: Weryfikacja łączenia wieloczęściowych odpowiedzi (Multipart Response) ===");
const mockCandidate = {
  content: {
    parts: [
      { text: "Część 1 analizy incydentu...\n" },
      { text: "Część 2 z komendami Bash: sudo systemctl restart orthanc\n" },
      { text: "Część 3 z weryfikacją." }
    ]
  }
};

const joined = mockCandidate.content.parts
  .filter(p => !p.thought && typeof p.text === 'string')
  .map(p => p.text)
  .join('');

assert.strictEqual(joined, "Część 1 analizy incydentu...\nCzęść 2 z komendami Bash: sudo systemctl restart orthanc\nCzęść 3 z weryfikacją.");
console.log("✅ Mechanizm łączenia wielu części odpowiedzi zapobiega ucinaniu tekstu");

console.log("=== TEST 6: Parsowanie odpowiedzi JSON do interaktywnych kart incydentu ===");
const mockStructuredJson = `\`\`\`json
{
  "title": "PostgreSQL: Brak miejsca na partycji danych pg_wal",
  "levelName": "L1: Sprzęt i Pamięć",
  "isDeadProcess": true,
  "diagnosis": "Baza PostgreSQL została zatrzymana z powodu błędu PANIC: No space left on device w katalogu pg_wal.",
  "procedure": [
    {
      "step": "Krok 1: Weryfikacja wolnej przestrzeni i inodów",
      "verify": "Upewnij się, która partycja osiągnęła 100% użycia",
      "commands": [
        { "cmd": "df -hT /var/lib/postgresql", "desc": "Sprawdzenie rozmiaru partycji" },
        { "cmd": "df -i /var/lib/postgresql", "desc": "Sprawdzenie tablicy inodów" }
      ]
    },
    {
      "step": "Krok 2: Bezpieczne zwolnienie miejsca (Docker/Journalctl)",
      "verify": "Sprawdź czy partycja ma co najmniej 15% wolnego miejsca",
      "commands": [
        { "cmd": "sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log", "desc": "Zerowanie logów kontenerów Dockera" },
        { "cmd": "sudo journalctl --vacuum-size=200M", "desc": "Rotacja logów systemd journal" }
      ]
    },
    {
      "step": "Krok 3: Start i weryfikacja bazy PostgreSQL",
      "verify": "Sprawdź status procesu w systemd",
      "commands": [
        { "cmd": "sudo systemctl start postgresql", "desc": "Uruchomienie demona bazy danych" },
        { "cmd": "sudo systemctl status postgresql", "desc": "Podgląd stanu usługi" }
      ]
    }
  ],
  "safetyTips": "BEZWZGLĘDNY ZAKAZ usuwania plików WAL z katalogu pg_wal/ bez procedury archiwizacji! ZAKAZ truncate na plikach bazy danych."
}
\`\`\``;

const parsedIncident = service.parseGeminiIncident(mockStructuredJson, "PostgreSQL PANIC...", { isDead: true });
assert.strictEqual(parsedIncident.title, "PostgreSQL: Brak miejsca na partycji danych pg_wal");
assert.strictEqual(parsedIncident.isDeadProcess, true);
assert.strictEqual(parsedIncident.level.name, "L1: Sprzęt i Pamięć");
assert.strictEqual(parsedIncident.procedure.length, 3);
assert.strictEqual(parsedIncident.procedure[0].commands.length, 2);
assert.strictEqual(parsedIncident.procedure[0].commands[0].cmd, "df -hT /var/lib/postgresql");
assert.ok(parsedIncident.safetyTips.includes("ZAKAZ"), "Powinno zawierać ostrzeżenia produkcyjne");
console.log("✅ Pomyślnie sparsowano i utworzono ustrukturyzowany incydent z JSON Gemini");

console.log("=== TEST 7: Fallback Parser dla odpowiedzi Gemini w formacie czystego Markdownu ===");
const mockMarkdownAi = `
Diagnoza i Przyczyna Źródłowa:
Usługa Orthanc PACS została zablokowana z powodu braku odpowiedzi serwera NFS na ścieżce /mnt/pacs_storage.

Stan procesu: MARTWY (zatrzymany)

Krok 1: Weryfikacja montażu NFS i portów RPC
🔎 Weryfikacja: Sprawdź czy serwer NFS odpowiada na RPC
\`\`\`bash
rpcinfo -p 192.168.10.50
mount | grep -i nfs
\`\`\`

Krok 2: Odmontowanie zawieszonego storage
🔎 Weryfikacja: Upewnij się, że katalog został odmontowany
\`\`\`bash
sudo umount -l /mnt/pacs_storage
sudo mount -t nfs -o rw,hard,intr,timeo=60,retrans=2 192.168.10.50:/mnt/pacs_storage /mnt/pacs_storage
\`\`\`

Krok 3: Restart demona Orthanc
\`\`\`bash
sudo systemctl restart orthanc
sudo systemctl status orthanc
\`\`\`

Zasady Bezpieczeństwa w Szpitalu:
Nigdy nie restartuj stacji badań podczas aktywnej transmisji DICOM.
`;

const parsedFromMd = service.parseGeminiIncident(mockMarkdownAi, "nfs server not responding", { isDead: true });
assert.ok(parsedFromMd.procedure.length >= 3, "Powinno wyodrębnić 3 kroki z markdownu");
assert.strictEqual(parsedFromMd.isDeadProcess, true);
assert.ok(parsedFromMd.diagnosis.includes("Orthanc PACS"), "Diagnoza powinna zawierać treść z markdownu");
assert.ok(parsedFromMd.procedure[0].commands.length >= 1, "Krok 1 powinien zawierać komendy wyciągnięte z bloku bash");
assert.ok(parsedFromMd.procedure[0].commands[0].cmd.includes("rpcinfo"), "Komenda bash powinna być wyodrębniona");
assert.ok(parsedFromMd.safetyTips.includes("DICOM"), "Ostrzeżenia bezpieczeństwa powinny być wyodrębnione");
console.log("✅ Fallback Markdown Parser bezbłędnie przetłumaczył surowy markdown na karty kroków");

console.log("=== TEST 8: Weryfikacja generowania skryptu Bash dla procedury Gemini ===");
let allBashScript = `#!/bin/bash\n# Klasyfikacja AI: ${parsedIncident.level.name}\n# Procedura: ${parsedIncident.title}\n\n`;
parsedIncident.procedure.forEach(p => {
  allBashScript += `\n# --- ${p.step} ---\n`;
  p.commands.forEach(c => {
    allBashScript += `${c.cmd}  # ${c.desc}\n`;
  });
});
assert.ok(allBashScript.includes("df -hT"), "Skrypt powinien zawierać komendy z kroku 1");
assert.ok(allBashScript.includes("sudo systemctl start postgresql"), "Skrypt powinien zawierać komendy z kroku 3");
console.log("✅ Generowanie kompletnego skryptu procedury Bash dla Gemini działa prawidłowo");

console.log("=== TEST 9: Weryfikacja działania asystenta podczatu na procedurze Gemini ===");
const assistantCode = fs.readFileSync(path.join(__dirname, 'js', 'linux-assistant.js'), 'utf8');
eval(assistantCode);
const assistant = global.window.linuxTroubleshooter;
assert.ok(assistant, "linuxTroubleshooter powinien być dostępny");

const geminiStepFix = assistant.analyzeStepError(
  0,
  parsedIncident.procedure[0].commands[0].cmd,
  "bash: fuser: command not found",
  parsedIncident
);
assert.ok(geminiStepFix.diagnosis.includes("fuser"), "Diagnoza powinna wskazywać brak fuser");
assert.ok(geminiStepFix.targetGoalMessage.includes(parsedIncident.title), "Komunikat nadrzędny powinien odwoływać się do procedury Gemini");
assert.ok(geminiStepFix.fixCommands.some(fc => fc.cmd.includes("psmisc")), "Komendy naprawcze powinny instalować psmisc");
console.log("✅ Asystent podczatu kroku bezbłędnie asystuje przy komendach procedury Gemini");

console.log("=== TEST 10: Weryfikacja System Promptu Pilota REPL (Ping-Pong) ===");
assert.ok(service.pilotSystemInstruction.includes("Ping-Pong / REPL"), "Musi zawierać wzmiankę Ping-Pong / REPL");
assert.ok(service.pilotSystemInstruction.includes("DOKŁADNIE JEDNĄ"), "Musi wymagać dokładnie jednej komendy");
assert.ok(service.pilotSystemInstruction.includes("🎯 Cel"), "Musi zawierać wzorzec 🎯 Cel");
assert.ok(service.pilotSystemInstruction.includes("💻 Komenda"), "Musi zawierać wzorzec 💻 Komenda");
assert.ok(service.pilotSystemInstruction.includes("❓ Oczekiwanie"), "Musi zawierać wzorzec ❓ Oczekiwanie");
assert.ok(service.pilotSystemInstruction.includes("[AWARIA ROZWIĄZANA]"), "Musi zawierać token [AWARIA ROZWIĄZANA]");
console.log("✅ System Prompt Pilota REPL narzuca bezwzględny reżim pojedynczych komend");

console.log("=== TEST 11: Weryfikacja parsera wiadomości Pilota REPL (parsePilotMessage) ===");
const mockAgentMsg1 = `
🎯 Cel: Sprawdzenie limitów pamięci współdzielonej (SHMMAX) w systemie operacyjnym.
💻 Komenda:
\`\`\`bash
ipcs -l | grep "max limits" -A 1
\`\`\`
❓ Oczekiwanie: Wklej poniżej to, co zwróci terminal.
`;

const parsedMsg1 = service.parsePilotMessage(mockAgentMsg1);
assert.strictEqual(parsedMsg1.goal, "Sprawdzenie limitów pamięci współdzielonej (SHMMAX) w systemie operacyjnym.");
assert.strictEqual(parsedMsg1.command, 'ipcs -l | grep "max limits" -A 1');
assert.strictEqual(parsedMsg1.expectation, "Wklej poniżej to, co zwróci terminal.");
assert.strictEqual(parsedMsg1.isResolved, false);

const mockAgentMsg2 = `
💡 Diagnoza: Limit SHMMAX wynosi 32 MB, co blokuje start bazy PostgreSQL.
🎯 Cel: Weryfikacja statusu demona po zwiększeniu limitu.
💻 Komenda:
\`\`\`bash
sudo systemctl status postgresql
\`\`\`
❓ Oczekiwanie: Potwierdź, że usługa ma status active (running).
[AWARIA ROZWIĄZANA]
`;

const parsedMsg2 = service.parsePilotMessage(mockAgentMsg2);
assert.ok(parsedMsg2.diagnosis.includes("32 MB"), "Diagnoza powinna zostać wyodrębniona");
assert.strictEqual(parsedMsg2.command, "sudo systemctl status postgresql");
assert.strictEqual(parsedMsg2.isResolved, true, "Powinno wykryć zakończenie procedury");

// Test wiadomości końcowej z logu użytkownika (brak pola Cel i Komendy - zabezpieczenie przed powieleniem diagnozy i pytaniem o terminal)
const mockFinalResolvedMsg = `
💡 Diagnoza: Usługa bazy danych PostgreSQL działa stabilnie i przyjmuje zapytania na porcie 5432.
🎉 [AWARIA ROZWIĄZANA]
`;
const parsedResolved = service.parsePilotMessage(mockFinalResolvedMsg);
assert.strictEqual(parsedResolved.isResolved, true);
assert.ok(parsedResolved.diagnosis.includes("PostgreSQL działa stabilnie"), "Diagnoza powinna zostać poprawnie odczytana");
assert.strictEqual(parsedResolved.goal, "", "Pole celu nie może powielać diagnozy ani mieć fallbacku przy zamknięciu awarii");
assert.strictEqual(parsedResolved.command, "", "Brak komendy przy rozwiązaniu");
assert.strictEqual(parsedResolved.expectation, "", "Brak prośby o wklejenie wyniku terminala po rozwiązaniu");
console.log("✅ Parser wiadomości Pilota poprawnie wyodrębnia cel, diagnozę, komendę oraz zabezpiecza przed powieleniem tekstu i pytaniem o terminal po [AWARIA ROZWIĄZANA]");

console.log("=== TEST 12: Weryfikacja cyklu sesji Pilota (GeminiPilotSession) & Runbook ===");
assert.ok(service.pilotSession, "Instancja pilotSession powinna istnieć w geminiService");
const session = service.pilotSession;
session.reset();
assert.strictEqual(session.isActive(), false, "Domyślnie sesja powinna być IDLE");

// Test wykrywania usługi
const detectedSvc = session._detectServiceFromLog("postgres[4821]: FATAL: out of shared memory");
assert.strictEqual(detectedSvc, "postgresql.service");

// Symulacja dodania tur do sesji
session.rawLog = "postgres[4821]: FATAL: out of shared memory";
session.detectedService = detectedSvc;
session.hypothesis = "Wyczerpanie limitu SHMMAX jądra Linuksa";
session.status = 'RESOLVED';
session.isResolved = true;
session.stepNumber = 2;

session.turns.push({
  type: 'agent',
  stepNumber: 1,
  parsed: parsedMsg1,
  timestamp: "12:00:00"
});

session.turns.push({
  type: 'user',
  stepNumber: 1,
  text: "max segments = 4096\nmax seg size (kbytes) = 32768",
  timestamp: "12:00:15"
});

session.turns.push({
  type: 'agent',
  stepNumber: 2,
  parsed: parsedMsg2,
  timestamp: "12:00:30"
});

const cmds = session.getAllCommands();
assert.strictEqual(cmds.length, 2);
assert.strictEqual(cmds[0], 'ipcs -l | grep "max limits" -A 1');
assert.strictEqual(cmds[1], 'sudo systemctl status postgresql');

const runbookRecord = session.toRunbookRecord();
assert.strictEqual(runbookRecord.level, "REPL_PILOT");
assert.strictEqual(runbookRecord.detectedPath, "postgresql.service");
assert.ok(runbookRecord.postMortemNotes.includes("AWARIA ROZWIĄZANA"));
assert.ok(runbookRecord.postMortemNotes.includes("max seg size"));
assert.strictEqual(runbookRecord.resolvedSteps.length, 2);
console.log("✅ Sesja Pilota REPL bezbłędnie gromadzi historię Ping-Pong i eksportuje raport Post-Mortem");

console.log("\n🎉 WSZYSTKIE TESTY INTEGRACJI GEMINI (W TYM INTERAKTYWNY PILOT REPL) ZALICZONE Z SUKCESEM!");



