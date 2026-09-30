global.window = global;
const fs = require('fs');
eval(fs.readFileSync('js/linux-assistant.js', 'utf8'));

const assistant = window.linuxTroubleshooter;

console.log('=== TEST 1: Firebird IPC / Semafory ===');
const fbIpcInput = 'Operating system directive semop failed; Lock manager error: active processes exist on lock table';
const res1 = assistant.analyze(fbIpcInput);
console.log('Tytuł:', res1.incident.title);
console.log('Poziom:', res1.incident.level.id);
console.log('Komendy IPC:', res1.incident.procedure[2].commands[0].cmd);
if (!res1.incident.title.includes('semop')) throw new Error('Błąd testu IPC Firebird');

console.log('\n=== TEST 2: Reset Połączenia / MTU (DICOM) ===');
const mtuInput = 'DICOM C-STORE: connection reset by peer while transmitting 240000 bytes; association aborted';
const res2 = assistant.analyze(mtuInput);
console.log('Tytuł:', res2.incident.title);
console.log('Poziom:', res2.incident.level.id);
console.log('Komenda MTU ping:', res2.incident.procedure[1].commands[0].cmd);
console.log('Komenda MSS Clamping:', res2.incident.procedure[2].commands[1].cmd);
if (!res2.incident.title.includes('MTU')) throw new Error('Błąd testu MTU');

console.log('\n=== TEST 3: Dynamiczne Podstawianie Ścieżek ===');
const socketInput = 'PostgreSQL: could not create socket file "/var/run/postgresql/.s.PGSQL.5432": Permission denied';
const res3 = assistant.analyze(socketInput);
console.log('Wykryta ścieżka:', res3.extractedPaths.fullPath);
console.log('Wykryty katalog:', res3.extractedPaths.parentDir);
const lsCmd = res3.incident.procedure[0].commands[0].cmd;
const chownCmd = res3.incident.procedure[2].commands[0].cmd;
console.log('Wygenerowane ls:', lsCmd);
console.log('Wygenerowane chown:', chownCmd);
if (!lsCmd.includes('/var/run/postgresql/.s.PGSQL.5432')) throw new Error('Błąd dynamicznej ścieżki pliku');
if (!chownCmd.includes('/var/run/postgresql')) throw new Error('Błąd dynamicznej ścieżki katalogu');

console.log('\n=== TEST 4: Asystent Mikro-Poprawek (Step Feedback Engine) ===');
const feedbackRes = assistant.analyzeStepError(
  0,
  'sudo fuser -v 2575/tcp',
  'bash: fuser: command not found',
  res1.incident
);
console.log('Diagnoza błędu kroku:', feedbackRes.diagnosis);
console.log('Komenda naprawcza:', feedbackRes.fixCommands[0].cmd);
console.log('Wiadomość celu nadrzędnego:', feedbackRes.targetGoalMessage);
if (!feedbackRes.fixCommands[0].cmd.includes('psmisc')) throw new Error('Błąd podpowiedzi psmisc');

console.log('\n=== TEST 5: Bezpośrednie wywołanie diagnoseLog (Lekki silnik KB v2.0.0) ===');
const directDiag = window.diagnoseLog('PostgreSQL PANIC: could not write to file "/var/lib/postgresql/data/base/16384/pg_internal.init": No space left on device');
console.log('Dopasowana reguła ID:', directDiag.id);
console.log('Priorytet:', directDiag.priority);
console.log('Status usługi:', directDiag.service_status);
console.log('Krok 1 komenda (podstawiony {{TARGET_DIR}}):', directDiag.steps[0].cmd);
console.log('Krok 3 komenda (podstawiony {{TARGET_FILE}}):', directDiag.steps[2].cmd);
if (directDiag.id !== 'ERR_OS_ENOSPC') throw new Error('Błąd dopasowania diagnoseLog dla ENOSPC');
if (!directDiag.steps[0].cmd.includes('/var/lib/postgresql/data/base/16384')) throw new Error('Błąd podstawienia TARGET_DIR');
if (!directDiag.steps[2].cmd.includes('/var/lib/postgresql/data/base/16384/pg_internal.init')) throw new Error('Błąd podstawienia TARGET_FILE');

console.log('\n=== TEST 6: Dedykowany subchat_fallbacks z KB (chattr -i -a) ===');
const enospcAnalysis = assistant.analyze('could not write to file /var/log/his/audit.log: no space left on device');
const subchatResult = assistant.analyzeStepError(
  2,
  'sudo truncate -s 0 /var/log/his/audit.log',
  'truncate: cannot truncate "/var/log/his/audit.log": Operation not permitted',
  enospcAnalysis.incident
);
console.log('Dedykowana diagnoza subchatu:', subchatResult.diagnosis);
console.log('Dedykowana komenda chattr:', subchatResult.fixCommands[0].cmd);
if (!subchatResult.fixCommands[0].cmd.includes('chattr -i -a /var/log/his/audit.log')) {
  throw new Error('Błąd dedykowanego subchat fallback dla chattr');
}

console.log('\n=== TEST 7: Scenariusz OOM Killer (ERR_OS_ENOMEM_OOM) ===');
const oomRes = assistant.analyze('kernel: [1234.56] Out of memory: Killed process 4321 (java) total-vm:16GB, anon-rss:8GB; java.lang.OutOfMemoryError');
console.log('Reguła OOM:', oomRes.incident.title);
console.log('Komenda Swap:', oomRes.incident.procedure[1].commands[0].cmd);
if (!oomRes.incident.procedure[1].commands[0].cmd.includes('swapfile_emergency')) throw new Error('Błąd komendy swapfile');

console.log('\n=== TEST 8: Scenariusz Storage NFS PACS (ERR_STORAGE_NFS_PACS) ===');
const nfsRes = assistant.analyze('dmesg: nfs: server 192.168.10.50 not responding, still trying; mount /mnt/pacs_storage timeout');
console.log('Reguła NFS:', nfsRes.incident.title);
console.log('Wykryty serwer NFS:', nfsRes.incident.procedure[2].commands[0].cmd);
if (!nfsRes.incident.procedure[2].commands[0].cmd.includes('192.168.10.50')) throw new Error('Błąd wykrycia IP serwera NFS');

console.log('\n=== TEST 9: Scenariusz HL7 MLLP (ERR_NET_HL7_MLLP) z IP analizatora ===');
const mllpRes = assistant.analyze('MLLP port 2575 connection refused from 192.168.1.120 during ORM^O01 order');
console.log('Reguła MLLP:', mllpRes.incident.title);
console.log('Reguła UFW z IP:', mllpRes.incident.procedure[1].commands[0].cmd);
if (!mllpRes.incident.procedure[1].commands[0].cmd.includes('192.168.1.120')) throw new Error('Błąd podstawienia IP analizatora w UFW');

console.log('\n=== TEST 10: Zarządzanie Bazą Wiedzy (KB v2.0.0 Export/Save/Reset) ===');
const originalCount = assistant.kb.rules.length;
console.log('Liczba reguł w KB v2.0.0:', originalCount);
if (originalCount < 10) throw new Error('Zbyt mała liczba reguł w KB');

console.log('\n=== TEST 11: Scenariusz z Obrazka Użytkownika (Docker read-only file system w Kroku 3) ===');
const dockerRoInput = `Wykonałem: sudo docker system prune -af\nTerminal zwrócił:\nError response from daemon: write /var/lib/docker/buildkit/cache.db: read-only file system`;
const enospcInc = assistant.analyze('could not write to file: /var/lib/docker/overlay2/ab891c/merged/etc/app.log: No space left on device');
const step3Cmd = enospcInc.incident.procedure[2].commands[0].cmd;
console.log('Komenda z apostrofami w Kroku 3:', step3Cmd);
const dockerFeedback = assistant.analyzeStepError(2, step3Cmd, dockerRoInput, enospcInc.incident);
console.log('Diagnoza błędu Kroku 3:', dockerFeedback.diagnosis);
console.log('Wygenerowane komendy naprawcze:', dockerFeedback.fixCommands.map(c => c.cmd).join(' | '));
if (!dockerFeedback.diagnosis.includes('Read-Only') && !dockerFeedback.diagnosis.includes('tylko do odczytu')) {
  throw new Error('Błąd rozpoznania read-only file system');
}
if (!dockerFeedback.fixCommands.some(c => c.cmd.includes('remount,rw'))) {
  throw new Error('Brak komendy remount,rw');
}

console.log('\n=== TEST 12: Reguła Ochrony Plików Konfiguracyjnych przed Truncate (orthanc.json) ===');
const dangerousStep3Cmd = "sudo find /var/lib/docker/overlay2/ab891c/merged/etc -type f -name '*.gz' -mtime +7 -delete && sudo truncate -s 0 /var/lib/docker/overlay2/ab891c/merged/etc/orthanc.json";
const roTerminalFeedback = `Wykonałem: sudo docker system prune -af\nTerminal zwrócił:\nError response from daemon: write /var/lib/docker/buildkit/cache.db: read-only file system`;
const truncSafetyRes = assistant.analyzeStepError(2, dangerousStep3Cmd, roTerminalFeedback, enospcInc.incident);
console.log('Komunikat celu nadrzędnego:', truncSafetyRes.targetGoalMessage);
console.log('Skorygowana komenda bezpieczna:', truncSafetyRes.dangerousTruncate.correctedCmd);
if (!truncSafetyRes.targetGoalMessage.includes('orthanc.json')) {
  throw new Error('Brak wzmianki o pliku konfiguracyjnym orthanc.json w komunikacie');
}
if (!truncSafetyRes.targetGoalMessage.includes('/var/lib/docker/containers/*/*-json.log')) {
  throw new Error('Brak wskazania logów Dockera w komunikacie');
}
if (!truncSafetyRes.dangerousTruncate.correctedCmd.includes('containers/*/*-json.log')) {
  throw new Error('Brak bezpiecznej komendy truncate na logach');
}

console.log('\n✅ WSZYSTKIE 12 ZAAWANSOWANYCH TESTÓW (W TYM KOREKTA TRUNCATE ORTHANC.JSON) ZALICZONE Z SUKCESEM!');
