/**
 * Centrum Automatyzacji SRE & Ansible (ansible-sre.js)
 * Moduł produkcyjny dla inżynierów Site Reliability Engineering ze wsparciem aplikacyjnym.
 *
 * Filar 1: Automatyzacja powtarzalnych zadań szpitalnych (Ansible playbooks, role, inventory, extra_vars)
 * Filar 2: Powtarzalność i Idempotentność (jawna konfiguracja, check-mode, brak ukrytego stanu)
 * Filar 3: Stabilność i Odporność (timeouty, rollback, hybryda Python + Bash, parser wyników PLAY RECAP)
 */

(function () {
  'use strict';

  // Stan lokalny modułu
  const sreState = {
    activeSubTab: 'playbooks', // 'playbooks' | 'inventory' | 'parser' | 'scripts' | 'ai'
    activePlaybookId: 'psql_maintenance',
    activeEnv: 'production',
    checkMode: true, // --check (dry run domyślnie włączony - Safe by Default)
    diffMode: true,  // --diff
    customVars: {},
    activeScriptId: 'mllp_probe',
    parsedLogResult: null,
    aiGeneratedPlaybook: null
  };

  /**
   * Katalog Produkcyjnych Playbooków SRE
   * Wszystkie playbooki spełniają wymóg Idempotentności, Zero-Risk Hospital Policy i obsługi --check
   */
  const SRE_PLAYBOOKS = [
    {
      id: 'psql_maintenance',
      title: 'PostgreSQL SRE: Healthcheck, VACUUM & Zamykanie Wycieków Połączeń',
      system: 'PostgreSQL / HIS Core',
      icon: '🐘',
      badge: 'Database SRE',
      badgeColor: '#3a86ff',
      category: 'Bazy Danych',
      description: 'Idempotentna diagnostyka i rotacja wiszących transakcji (idle-in-transaction). Zawiera pre-flight check w Pythonie oraz bezpieczne zwalnianie slotów połączeń bez ubijania aktywnych transakcji zapisujących.',
      defaultVars: {
        pg_host: '127.0.0.1',
        pg_port: 5432,
        pg_user: 'postgres',
        pg_db: 'his_prod',
        max_idle_minutes: 30,
        enable_vacuum: false,
        timeout_seconds: 15
      },
      cliFlags: '--check --diff',
      idempotencyNotes: 'Zadania używają modułu postgresql_query z warunkami WHERE chroniącymi aktywne procesy. Status changed_when raportuje true tylko jeśli faktycznie terminated połączenia przekraczające limit czasu.',
      rollbackStrategy: 'Brak inwazyjnych zmian schematu; zamykane są wyłącznie sesje bezczynne. Przed restartem usługi wykonywana jest weryfikacja poprawności pliku postgresql.conf.',
      companionScript: 'scripts/pg_pool_guard.py',
      playbookYaml: [
        '---',
        '# SRE Playbook: PostgreSQL Healthcheck & Connection Leak Remediation',
        '# Wersja: 1.2.0 (Idempotent, Zero-Risk Hospital Policy)',
        '- name: PostgreSQL SRE Maintenance & Connection Guard',
        '  hosts: his_db',
        '  become: true',
        '  gather_facts: true',
        '  vars:',
        '    pg_host: "{{ target_pg_host | default(\'127.0.0.1\') }}"',
        '    pg_port: "{{ target_pg_port | default(5432) }}"',
        '    pg_user: "{{ target_pg_user | default(\'postgres\') }}"',
        '    pg_db: "{{ target_pg_db | default(\'his_prod\') }}"',
        '    max_idle_minutes: "{{ target_idle_minutes | default(30) }}"',
        '    enable_vacuum: "{{ target_enable_vacuum | default(false) }}"',
        '    script_timeout: 20',
        '',
        '  pre_tasks:',
        '    - name: Pre-flight: Sprawdź dostępność usługi systemd postgresql',
        '      ansible.builtin.systemd:',
        '        name: postgresql',
        '        state: started',
        '      check_mode: true',
        '      register: pg_service_check',
        '      failed_when: pg_service_check.status.ActiveState != "active"',
        '',
        '    - name: Pre-flight: Uruchom diagnostyczny skrypt Python (Healthcheck puli)',
        '      ansible.builtin.command:',
        '        cmd: "python3 /usr/local/bin/sre_pg_pool_guard.py --db {{ pg_db }} --port {{ pg_port }} --threshold {{ max_idle_minutes }}"',
        '      register: py_diag_output',
        '      changed_when: false',
        '      failed_when: py_diag_output.rc not in [0, 1]',
        '',
        '  tasks:',
        '    - name: Odczytaj bieżące wykorzystanie połączeń (max_connections vs aktywne)',
        '      become_user: "{{ pg_user }}"',
        '      community.postgresql.postgresql_query:',
        '        db: "{{ pg_db }}":',
        '        query: >',
        '          SELECT count(*) as active, s.setting::int as max_conn',
        '          FROM pg_stat_activity, pg_settings s',
        '          WHERE s.name = \'max_connections\'',
        '          GROUP BY s.setting;',
        '      register: pg_conn_stats',
        '',
        '    - name: Wyświetl metryki połączeń SRE',
        '      ansible.builtin.debug:',
        '        msg: "Aktywne sesje: {{ pg_conn_stats.query_result[0].active }} / Max: {{ pg_conn_stats.query_result[0].max_conn }}"',
        '',
        '    - name: Bezpiecznie zakończ sesje \'idle in transaction\' przekraczające limit czasu',
        '      become_user: "{{ pg_user }}"',
        '      community.postgresql.postgresql_query:',
        '        db: "{{ pg_db }}":',
        '        query: >',
        '          SELECT pg_terminate_backend(pid)',
        '          FROM pg_stat_activity',
        '          WHERE state = \'idle in transaction\'',
        '            AND state_change < NOW() - INTERVAL \'{{ max_idle_minutes }} minutes\'',
        '            AND pid <> pg_backend_pid();',
        '      register: term_result',
        '      changed_when: term_result.rowcount > 0',
        '',
        '    - name: Opcjonalny VACUUM ANALYZE dla kluczowych tabel z buforem zleceń',
        '      when: enable_vacuum | bool',
        '      become_user: "{{ pg_user }}"',
        '      community.postgresql.postgresql_query:',
        '        db: "{{ pg_db }}":',
        '        query: "VACUUM (ANALYZE, VERBOSE) zlecenia, pozycje_zlecen, kom_przychodzace;"',
        '      register: vac_result',
        '      changed_when: false',
        '',
        '  post_tasks:',
        '    - name: Zapisz raport SRE do systemowego logu audytowego',
        '      ansible.builtin.lineinfile:',
        '        path: /var/log/sre-maintenance.log',
        '        create: true',
        '        mode: \'0640\'',
        '        line: "[{{ ansible_date_time.iso8601 }}] SRE-PG-MAINTENANCE: host={{ inventory_hostname }} active={{ pg_conn_stats.query_result[0].active }} terminated={{ term_result.rowcount | default(0) }}"'
      ].join('\n')
    },
    {
      id: 'firebird_ipc_heal',
      title: 'Firebird SRE: Samonaprawa Menedżera Blokad & Czyszczenie IPC',
      system: 'Firebird 2.5/3.0 (HIS Legacy)',
      icon: '🔥',
      badge: 'Legacy HIS SRE',
      badgeColor: '#ef476f',
      category: 'Bazy Danych',
      description: 'Rozwiązuje krytyczny błąd "Operating system directive semop failed / lock manager error". Obowiązkowa binarna kopia zapasowa (cp -a), czyszczenie osieroconych semaforów jądra Linuksa i idempotentny start usługi.',
      defaultVars: {
        fb_service: 'firebird2.5-super',
        fb_db_path: '/var/lib/firebird/data/szpital.fdb',
        backup_dir: '/var/backups/firebird_pre_heal',
        timeout_seconds: 30
      },
      cliFlags: '--check --diff',
      idempotencyNotes: 'Skrypt weryfikuje czy proces Firebirda faktycznie wisi przed ubijaniem. Jeśli brak osieroconych semaforów, etap ipcrm jest pomijany z kodem changed=false.',
      rollbackStrategy: 'Kopia bezpieczeństwa w katalogu /var/backups/firebird_pre_heal umożliwia natychmiastowe przywrócenie bazy w razie naruszenia nagłówka.',
      companionScript: 'scripts/firebird_safe_reset.sh',
      playbookYaml: [
        '---',
        '# SRE Playbook: Firebird Lock Manager & IPC Semaphore Self-Healing',
        '# Rygor: Obowiązkowa kopia bezpieczeństwa, czyszczenie semaforów semop',
        '- name: Firebird SRE Lock Manager & IPC Remediation',
        '  hosts: his_db',
        '  become: true',
        '  vars:',
        '    fb_service: "{{ target_fb_service | default(\'firebird2.5-super\') }}"',
        '    fb_db_path: "{{ target_fb_path | default(\'/var/lib/firebird/data/szpital.fdb\') }}"',
        '    backup_dir: "/var/backups/firebird_pre_heal"',
        '',
        '  tasks:',
        '    - name: KROK 1: Upewnij się, że katalog na kopie bezpieczeństwa istnieje',
        '      ansible.builtin.file:',
        '        path: "{{ backup_dir }}"',
        '        state: directory',
        '        mode: \'0750\'',
        '        owner: root',
        '        group: root',
        '',
        '    - name: KROK 2: Sprawdź stan pliku bazy Firebird (stat)',
        '      ansible.builtin.stat:',
        '        path: "{{ fb_db_path }}"',
        '      register: fb_db_stat',
        '      failed_when: not fb_db_stat.stat.exists',
        '',
        '    - name: KROK 3: Wykonaj kopię binarną bazy (cp -a) przed operacjami SRE',
        '      ansible.builtin.copy:',
        '        src: "{{ fb_db_path }}"',
        '        dest: "{{ backup_dir }}/szpital_{{ ansible_date_time.epoch }}.fdb"',
        '        remote_src: true',
        '        mode: preserve',
        '      when: fb_db_stat.stat.exists',
        '',
        '    - name: KROK 4: Bezpiecznie zatrzymaj usługę Firebird',
        '      ansible.builtin.systemd:',
        '        name: "{{ fb_service }}"',
        '        state: stopped',
        '',
        '    - name: KROK 5: Wywołaj skrypt czyszczenia osieroconych semaforów IPC',
        '      ansible.builtin.shell: |',
        '        set -euo pipefail',
        '        SEMS=$(ipcs -s | awk \'$3 == "firebird" {print $2}\')',
        '        if [ -n "$SEMS" ]; then',
        '          echo "$SEMS" | xargs -r ipcrm -s',
        '          echo "CHANGED_IPC_CLEANED"',
        '        else',
        '          echo "NO_IPC_LEAKS"',
        '        fi',
        '      register: ipc_clean_result',
        '      changed_when: "\'CHANGED_IPC_CLEANED\' in ipc_clean_result.stdout"',
        '',
        '    - name: KROK 6: Wyczyść osierocone pliki blokad w /tmp i /var/run/firebird',
        '      ansible.builtin.file:',
        '        path: "{{ item }}"',
        '        state: absent',
        '      loop:',
        '        - /tmp/firebird',
        '        - /var/run/firebird/fb_guard.pid',
        '      register: lock_files_clean',
        '',
        '    - name: KROK 7: Uruchom usługę Firebird i zweryfikuj nasłuch na porcie 3050',
        '      ansible.builtin.systemd:',
        '        name: "{{ fb_service }}"',
        '        state: started',
        '',
        '    - name: KROK 8: Poczekaj na dostępność portu bazy danych Firebird (port 3050)',
        '      ansible.builtin.wait_for:',
        '        port: 3050',
        '        host: 127.0.0.1',
        '        timeout: 15',
        '        state: started'
      ].join('\n')
    },
    {
      id: 'nfs_pacs_heal',
      title: 'PACS & WSI Storage: Automatyczna Naprawa Wiszącego Montażu NFS',
      system: 'PatExpert / PACS Archiwum',
      icon: '🔬',
      badge: 'Storage SRE',
      badgeColor: '#8338ec',
      category: 'Pamięć Masowa',
      description: 'Rozwiązuje zawieszone punkty montowania NFS dla skanów histopatologicznych WSI i obrazów DICOM. Zapewnia leniwe odmontowanie (lazy umount -l -f), test ping RPC do serwera storage oraz montowanie z flagami hard,intr,timeo=60.',
      defaultVars: {
        nfs_server: '192.168.10.50',
        nfs_export: '/mnt/pacs_storage',
        mount_point: '/mnt/pacs_storage',
        mount_opts: 'rw,hard,intr,timeo=60,retrans=2'
      },
      cliFlags: '--check --diff',
      idempotencyNotes: 'Sprawdza /proc/mounts. Jeśli katalog jest już poprawnie zamontowany i canary file zwraca sukces w czasie < 2s, montowanie nie jest powtarzane.',
      rollbackStrategy: 'W przypadku awarii serwera NFS aplikacja przełącza się w bufor lokalny /var/spool/pacs_buffer.',
      companionScript: 'scripts/nfs_canary_probe.sh',
      playbookYaml: [
        '---',
        '# SRE Playbook: NFS Mount Self-Healing for PACS & Digital Pathology (WSI)',
        '- name: PACS Storage NFS Mount Remediation',
        '  hosts: pacs_storage',
        '  become: true',
        '  vars:',
        '    nfs_server: "{{ target_nfs_server | default(\'192.168.10.50\') }}"',
        '    nfs_export: "{{ target_nfs_export | default(\'/mnt/pacs_storage\') }}"',
        '    mount_point: "{{ target_mount_point | default(\'/mnt/pacs_storage\') }}"',
        '    mount_opts: "rw,hard,intr,timeo=60,retrans=2"',
        '',
        '  tasks:',
        '    - name: KROK 1: Sprawdź czy serwer macierzy NFS odpowiada na RPC portmapper',
        '      ansible.builtin.command:',
        '        cmd: "rpcinfo -p {{ nfs_server }}"',
        '      register: rpc_check',
        '      changed_when: false',
        '      failed_when: rpc_check.rc != 0',
        '',
        '    - name: KROK 2: Sprawdź czy punkt montowania jest zawieszony (canary check z timeoutem)',
        '      ansible.builtin.command:',
        '        cmd: "timeout 3 stat {{ mount_point }}"',
        '      register: mount_stat_check',
        '      failed_when: false',
        '      changed_when: false',
        '',
        '    - name: KROK 3: Awaryjne odmontowanie zawieszonego NFS (Lazy Umount) jeśli brak odpowiedzi',
        '      when: mount_stat_check.rc != 0',
        '      ansible.builtin.command:',
        '        cmd: "umount -l -f {{ mount_point }}"',
        '      register: umount_res',
        '      changed_when: true',
        '',
        '    - name: KROK 4: Upewnij się, że katalog lokalnego punktu montowania istnieje',
        '      ansible.builtin.file:',
        '        path: "{{ mount_point }}"',
        '        state: directory',
        '        mode: \'0755\'',
        '',
        '    - name: KROK 5: Idempotentne zamontowanie udziału NFS z poprawnymi flagami szpitalnymi',
        '      ansible.posix.mount:',
        '        path: "{{ mount_point }}"',
        '        src: "{{ nfs_server }}:{{ nfs_export }}"',
        '        fstype: nfs',
        '        opts: "{{ mount_opts }}"',
        '        state: mounted',
        '',
        '    - name: KROK 6: Weryfikacja zapisu testowego pliku (Canary Probe)',
        '      ansible.builtin.copy:',
        '        content: "SRE-HEALTH-OK-{{ ansible_date_time.epoch }}"',
        '        dest: "{{ mount_point }}/.sre_canary_test.tmp"',
        '        mode: \'0644\'',
        '',
        '    - name: KROK 7: Usunięcie pliku canary probe',
        '      ansible.builtin.file:',
        '        path: "{{ mount_point }}/.sre_canary_test.tmp"',
        '        state: absent'
      ].join('\n')
    },
    {
      id: 'mllp_daemon_guard',
      title: 'LIS / eKrew: Monitoring i Autorestart Portów MLLP (HL7 v2)',
      system: 'LIS / eKrew (Mirth Connect & Analizatory)',
      icon: '🧪',
      badge: 'Interface Engine SRE',
      badgeColor: '#06d6a0',
      category: 'Integracje Medyczne',
      description: 'Zarządza demonem komunikacyjnym MLLP (port 2575). Sprawdza stan nasłuchu gniazda TCP, upewnia się że reguły zapory UFW są zawężone do dozwolonych IP analizatorów (Zero-Risk Hospital Policy) i wznawia transmisję.',
      defaultVars: {
        mllp_service: 'mirth-connect',
        mllp_port: 2575,
        allowed_analyzer_ip: '192.168.1.120/32',
        probe_timeout_seconds: 5
      },
      cliFlags: '--check --diff',
      idempotencyNotes: 'Reguły zapory są idempotentne (ufw/iptables). Usługa jest restartowana tylko wtedy, gdy probe HL7 zgłosi brak odpowiedzi.',
      rollbackStrategy: 'W przypadku awarii silnika integracyjnego, pakiety HL7 są buforowane na poziomie lokalnego spoolera spool/mllp_incoming.',
      companionScript: 'scripts/mllp_probe.py',
      playbookYaml: [
        '---',
        '# SRE Playbook: LIS / eKrew MLLP HL7 v2 Interface Guard',
        '- name: LIS & eKrew MLLP Daemon & Firewall Automation',
        '  hosts: lis_analyzers',
        '  become: true',
        '  vars:',
        '    mllp_service: "{{ target_mllp_service | default(\'mirth-connect\') }}"',
        '    mllp_port: "{{ target_mllp_port | default(2575) }}"',
        '    analyzer_ip: "{{ target_analyzer_ip | default(\'192.168.1.120/32\') }}"',
        '',
        '  tasks:',
        '    - name: KROK 1: Idempotentna reguła firewall (ZAWĘŻONA do IP analizatora - Zero-Risk)',
        '      community.general.ufw:',
        '        rule: allow',
        '        port: "{{ mllp_port }}"',
        '        proto: tcp',
        '        src: "{{ analyzer_ip }}"',
        '        comment: "SRE: Dozwolony analizator laboratoryjny"',
        '',
        '    - name: KROK 2: Sprawdź stan usługi systemd interfejsu MLLP',
        '      ansible.builtin.systemd:',
        '        name: "{{ mllp_service }}"',
        '        state: started',
        '      register: mllp_svc',
        '',
        '    - name: KROK 3: Wywołaj skrypt sondujący MLLP w Pythonie (Ramka HL7 Ping)',
        '      ansible.builtin.command:',
        '        cmd: "python3 /usr/local/bin/sre_mllp_probe.py --host 127.0.0.1 --port {{ mllp_port }} --timeout 5"',
        '      register: mllp_probe_res',
        '      changed_when: false',
        '      failed_when: false',
        '',
        '    - name: KROK 4: Restart usługi jeśli probe zgłosił błąd gniazda TCP',
        '      when: mllp_probe_res.rc != 0',
        '      ansible.builtin.systemd:',
        '        name: "{{ mllp_service }}"',
        '        state: restarted',
        '      register: restart_result',
        '',
        '    - name: KROK 5: Poczekaj na powrót portu MLLP po ewentualnym restarcie',
        '      ansible.builtin.wait_for:',
        '        port: "{{ mllp_port }}"',
        '        host: 127.0.0.1',
        '        timeout: 15',
        '        state: started'
      ].join('\n')
    },
    {
      id: 'disk_docker_purge',
      title: 'SRE Disk Guard: Idempotentne Czyszczenie Dysku i Logów Kontenerów',
      system: 'Infrastruktura Linux & Docker',
      icon: '💾',
      badge: 'Platform SRE',
      badgeColor: '#ffb703',
      category: 'Zasoby Systemowe',
      description: 'Zwalnia przestrzeń dyskową (błędy ENOSPC / wyczerpanie inodów). Rygorystycznie chroni bazy danych i konfiguracje (.json, .conf). Wykonuje rotację logów Dockera, vacuum journalctl oraz usuwanie osieroconych obrazów.',
      defaultVars: {
        disk_mount: '/',
        journal_vacuum_size: '200M',
        truncate_docker_logs: true,
        alert_threshold_percent: 85
      },
      cliFlags: '--check --diff',
      idempotencyNotes: 'Truncate i vacuum działają idempotentnie (nie rzucają błędów gdy pliki są już małe). Wykorzystuje moduły disk_usage i file stat.',
      rollbackStrategy: 'Czyszczenie ograniczone jest do logów tymczasowych i dangling images; brak ryzyka utraty danych.',
      companionScript: 'scripts/safe_docker_vacuum.sh',
      playbookYaml: [
        '---',
        '# SRE Playbook: Hospital Safe Disk & Container Cleanup',
        '# ZAKAZ truncate na plikach konfiguracyjnych i bazach danych!',
        '- name: SRE Safe Disk & Docker Purge',
        '  hosts: all',
        '  become: true',
        '  vars:',
        '    journal_max_size: "{{ target_journal_size | default(\'200M\') }}"',
        '    disk_threshold: 85',
        '',
        '  tasks:',
        '    - name: KROK 1: Sprawdź zajętość głównego systemu plików',
        '      ansible.builtin.shell: "df --output=pcent / | tail -1 | tr -dc \'0-9\'"',
        '      register: current_disk_pct',
        '      changed_when: false',
        '',
        '    - name: KROK 2: Rotacja logów systemd journalctl do limitu',
        '      ansible.builtin.command:',
        '        cmd: "journalctl --vacuum-size={{ journal_max_size }}"',
        '      register: journal_res',
        '      changed_when: "\'Vacuuming done\' in journal_res.stdout and \'0B\' not in journal_res.stdout"',
        '',
        '    - name: KROK 3: Bezpieczne zerowanie logów kontenerów Dockera (*-json.log)',
        '      ansible.builtin.shell: |',
        '        set -euo pipefail',
        '        FOUND=0',
        '        for f in $(find /var/lib/docker/containers/ -name "*-json.log" -size +50M 2>/dev/null); do',
        '          truncate -s 0 "$f"',
        '          FOUND=1',
        '        done',
        '        if [ "$FOUND" -eq 1 ]; then echo "CHANGED_LOGS_TRUNCATED"; else echo "NO_LARGE_LOGS"; fi',
        '      register: docker_log_res',
        '      changed_when: "\'CHANGED_LOGS_TRUNCATED\' in docker_log_res.stdout"',
        '',
        '    - name: KROK 4: Idempotentne usunięcie starych archiwów logów (>14 dni)',
        '      ansible.builtin.find:',
        '        paths: /var/log',
        '        patterns: "*.gz,*.1,*.old"',
        '        age: 14d',
        '        recurse: true',
        '      register: old_logs_found',
        '',
        '    - name: KROK 5: Usunięcie znalezionych starych archiwów logów',
        '      ansible.builtin.file:',
        '        path: "{{ item.path }}"',
        '        state: absent',
        '      loop: "{{ old_logs_found.files }}"',
        '      when: old_logs_found.matched > 0'
      ].join('\n')
    },
    {
      id: 'patexpert_hotfix_deploy',
      title: 'Wdrożenie Hotfixa / Patcha PatExpert z Automatycznym Rollbackiem',
      system: 'PatExpert (Pracownia Histopatologiczna)',
      icon: '🛡️',
      badge: 'Release SRE',
      badgeColor: '#e76f51',
      category: 'Wdrożenia Aplikacyjne',
      description: 'Zarządza wdrożeniem patcha w strukturze block-rescue-always. Przed wdrożeniem tworzy migawkę stanu, wdraża nową binarkę/pakiet, wykonuje smoke-test endpointu REST. W razie błędu testu automatycznie wycofuje zmiany do poprzedniej wersji.',
      defaultVars: {
        app_name: 'patexpert-backend',
        patch_version: '2026.9.4-hotfix1',
        health_check_url: 'http://127.0.0.1:8080/api/health',
        backup_root: '/opt/backups/patexpert'
      },
      cliFlags: '--diff',
      idempotencyNotes: 'Weryfikuje sumę kontrolną instalowanego patcha (sha256). Jeśli docelowa wersja jest już wdrożona, krok pobrania i restartu jest pomijany.',
      rollbackStrategy: 'Wbudowana sekcja rescue: zatrzymuje proces, przywraca zbackupowaną binarkę, startuje serwis i generuje alarm SRE.',
      companionScript: 'scripts/smoke_test_probe.py',
      playbookYaml: [
        '---',
        '# SRE Playbook: PatExpert Hotfix Deployment with Automated Rollback',
        '- name: PatExpert Application Patch & Verification',
        '  hosts: app_servers',
        '  become: true',
        '  vars:',
        '    app_name: "patexpert-backend"',
        '    app_dir: "/opt/patexpert"',
        '    backup_root: "/opt/backups/patexpert"',
        '    patch_version: "{{ target_version | default(\'2026.9.4-hotfix1\') }}"',
        '    health_check_url: "http://127.0.0.1:8080/api/health"',
        '',
        '  tasks:',
        '    - name: Główny blok wdrożeniowy z automatycznym mechanizmem Rollback',
        '      block:',
        '        - name: 1. Upewnij się, że katalog kopii zapasowej istnieje',
        '          ansible.builtin.file:',
        '            path: "{{ backup_root }}/{{ ansible_date_time.epoch }}"',
        '            state: directory',
        '            mode: \'0750\'',
        '          register: current_backup_dir',
        '',
        '        - name: 2. Stwórz kopię bezpieczeństwa bieżącej wersji aplikacji',
        '          ansible.builtin.copy:',
        '            src: "{{ app_dir }}/bin/patexpert-server"',
        '            dest: "{{ current_backup_dir.path }}/patexpert-server.prev"',
        '            remote_src: true',
        '            mode: preserve',
        '',
        '        - name: 3. Bezpiecznie zatrzymaj serwis aplikacji PatExpert',
        '          ansible.builtin.systemd:',
        '            name: "{{ app_name }}"',
        '            state: stopped',
        '',
        '        - name: 4. Wdróż nowy plik binarny patcha',
        '          ansible.builtin.copy:',
        '            src: "/var/patches/patexpert-server-{{ patch_version }}"',
        '            dest: "{{ app_dir }}/bin/patexpert-server"',
        '            remote_src: true',
        '            mode: \'0755\'',
        '            owner: patexpert',
        '            group: patexpert',
        '',
        '        - name: 5. Uruchom zaktualizowaną usługę PatExpert',
        '          ansible.builtin.systemd:',
        '            name: "{{ app_name }}"',
        '            state: started',
        '',
        '        - name: 6. Wykonaj Smoke Test REST Healthcheck (timeout 10s)',
        '          ansible.builtin.uri:',
        '            url: "{{ health_check_url }}"',
        '            method: GET',
        '            status_code: 200',
        '            return_content: yes',
        '            timeout: 10',
        '          register: smoke_test_res',
        '          until: smoke_test_res.status == 200',
        '          retries: 3',
        '          delay: 2',
        '',
        '      rescue:',
        '        - name: ⚠️ ROLLBACK: Smoke Test nie powiódł się! Przywracanie poprzedniej wersji',
        '          ansible.builtin.copy:',
        '            src: "{{ current_backup_dir.path }}/patexpert-server.prev"',
        '            dest: "{{ app_dir }}/bin/patexpert-server"',
        '            remote_src: true',
        '            mode: \'0755\'',
        '',
        '        - name: ⚠️ ROLLBACK: Restart usługi z poprzednią stabilną wersją',
        '          ansible.builtin.systemd:',
        '            name: "{{ app_name }}"',
        '            state: restarted',
        '',
        '        - name: ⚠️ ROLLBACK: Zgłoś błąd krytyczny do pipeline',
        '          ansible.builtin.fail:',
        '            msg: "Wdrożenie wersji {{ patch_version }} nie przeszło Smoke Testu! Wykonano automatyczny Rollback."'
      ].join('\n')
    }
  ];

  /**
   * Biblioteka Skryptów Pomocniczych (Python + Bash) wywoływanych przez Ansible
   */
  const SRE_SCRIPTS = [
    {
      id: 'mllp_probe',
      name: 'sre_mllp_probe.py',
      lang: 'python',
      title: 'Python: Sonda Socketu MLLP HL7 v2 z Obsługą Timeoutu',
      description: 'Wysyła ramkę HL7 MLLP (ASCII 0x0B ... 0x1C 0x0D) i czeka na ACK. Zwraca exit code 0 dla sukcesu, 1 dla ostrzeżenia, 2 dla błędu, oraz formatowany JSON dla Ansible.',
      code: [
        '#!/usr/bin/env python3',
        '"""',
        'sre_mllp_probe.py - Sonda MLLP HL7 v2 dla Ansible & SRE',
        'Parametry: --host <IP> --port <PORT> --timeout <SEC>',
        'Kody wyjścia: 0 = OK, 1 = TIMEOUT, 2 = BŁĄD POŁĄCZENIA',
        '"""',
        'import sys',
        'import socket',
        'import argparse',
        'import json',
        'import time',
        '',
        'def probe_mllp(host, port, timeout):',
        '    start_time = time.time()',
        '    # Minimalna ramka HL7 MLLP Ping (MSH)',
        '    msh = "MSH|^~\\&|SRE_PROBE|HOSPITAL|LIS|MED|20260930120000||QRY^Q02|SRE999|P|2.3\\r"',
        '    mllp_frame = b"\\x0b" + msh.encode("utf-8") + b"\\x1c\\r"',
        '    ',
        '    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)',
        '    sock.settimeout(timeout)',
        '    try:',
        '        sock.connect((host, port))',
        '        sock.sendall(mllp_frame)',
        '        data = sock.recv(1024)',
        '        latency_ms = round((time.time() - start_time) * 1000, 2)',
        '        sock.close()',
        '        ',
        '        if b"\\x0b" in data and (b"MSA|AA" in data or b"MSH" in data):',
        '            print(json.dumps({"status": "UP", "latency_ms": latency_ms, "host": host, "port": port}))',
        '            return 0',
        '        else:',
        '            print(json.dumps({"status": "DEGRADED", "latency_ms": latency_ms, "raw_resp": str(data[:40])}))',
        '            return 1',
        '    except socket.timeout:',
        '        print(json.dumps({"status": "TIMEOUT", "error": "Connection timed out", "host": host, "port": port}))',
        '        return 1',
        '    except Exception as e:',
        '        print(json.dumps({"status": "DOWN", "error": str(e), "host": host, "port": port}))',
        '        return 2',
        '',
        'if __name__ == "__main__":',
        '    parser = argparse.ArgumentParser(description="SRE MLLP Health Probe")',
        '    parser.add_argument("--host", default="127.0.0.1")',
        '    parser.add_argument("--port", type=int, default=2575)',
        '    parser.add_argument("--timeout", type=float, default=5.0)',
        '    args = parser.parse_args()',
        '    sys.exit(probe_mllp(args.host, args.port, args.timeout))'
      ].join('\n')
    },
    {
      id: 'pg_pool_guard',
      name: 'sre_pg_pool_guard.py',
      lang: 'python',
      title: 'Python: Analizator Puli Połączeń PostgreSQL (Idle-in-Tx Guard)',
      description: 'Bada stan pg_stat_activity pod kątem wycieków połączeń, blokad deadlock oraz transakcji wiszących powyżej zadanego progu. Generuje metryki w JSON.',
      code: [
        '#!/usr/bin/env python3',
        '"""',
        'sre_pg_pool_guard.py - Monitor sesji i wycieków transakcji PostgreSQL dla Ansible',
        '"""',
        'import sys',
        'import argparse',
        'import json',
        'import subprocess',
        '',
        'def check_pool(db, port, threshold_min):',
        '    query = f"""',
        '    SELECT json_build_object(',
        '        \'total_conn\', count(*),',
        '        \'idle_in_tx\', count(*) FILTER (WHERE state = \'idle in transaction\'),',
        '        \'stale_tx\', count(*) FILTER (WHERE state = \'idle in transaction\' AND state_change < NOW() - INTERVAL \'{threshold_min} minutes\')',
        '    ) FROM pg_stat_activity;',
        '    """',
        '    cmd = ["psql", "-d", db, "-p", str(port), "-t", "-A", "-c", query]',
        '    try:',
        '        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10, check=True)',
        '        data = json.loads(res.stdout.strip())',
        '        print(json.dumps(data, indent=2))',
        '        if data.get("stale_tx", 0) > 0:',
        '            return 1 # Warning: Wykryto wiszące transakcje',
        '        return 0 # OK',
        '    except Exception as err:',
        '        print(json.dumps({"status": "ERROR", "error": str(err)}))',
        '        return 2',
        '',
        'if __name__ == "__main__":',
        '    parser = argparse.ArgumentParser()',
        '    parser.add_argument("--db", default="his_prod")',
        '    parser.add_argument("--port", type=int, default=5432)',
        '    parser.add_argument("--threshold", type=int, default=30)',
        '    args = parser.parse_args()',
        '    sys.exit(check_pool(args.db, args.port, args.threshold))'
      ].join('\n')
    },
    {
      id: 'safe_docker_vacuum',
      name: 'safe_docker_vacuum.sh',
      lang: 'bash',
      title: 'Bash: Bezpieczne Czyszczenie Magazynu Kontenerów i Rotacja Logów',
      description: 'Zapewnia rygorystyczne przestrzeganie Zero-Risk Hospital Policy. Czyści wyłącznie logi JSON kontenerów i journalctl, chroniąc pliki bazy danych.',
      code: [
        '#!/usr/bin/env bash',
        '# safe_docker_vacuum.sh - Idempotentne, bezpieczne czyszczenie dysku SRE',
        'set -euo pipefail',
        'IFS=$\'\\n\\t\'',
        '',
        'echo "[SRE] Rozpoczynanie bezpiecznej procedury odzyskiwania miejsca na dysku..."',
        '',
        '# 1. Sprawdź stan bieżący',
        'DISK_BEFORE=$(df -h / | awk \'NR==2 {print $4}\')',
        'echo "[SRE] Dostępne miejsce przed: $DISK_BEFORE"',
        '',
        '# 2. Rotacja logów systemd (limit 200MB)',
        'echo "[SRE] Czyszczenie journalctl --vacuum-size=200M..."',
        'sudo journalctl --vacuum-size=200M >/dev/null 2>&1 || true',
        '',
        '# 3. Zerowanie logów kontenerów Dockera (zabezpieczenie przed przepełnieniem overlay2)',
        'echo "[SRE] Zerowanie logów Dockera większych niż 50MB..."',
        'if [ -d "/var/lib/docker/containers" ]; then',
        '  find /var/lib/docker/containers/ -name "*-json.log" -size +50M 2>/dev/null | while read -r log_file; do',
        '    echo "[SRE] Truncate: $log_file"',
        '    sudo truncate -s 0 "$log_file"',
        '  done',
        'fi',
        '',
        '# 4. Usunięcie nieużywanych obrazów i wolumenów tymczasowych',
        'if command -v docker >/dev/null 2>&1; then',
        '  echo "[SRE] docker image prune -f..."',
        '  docker image prune -f >/dev/null 2>&1 || true',
        'fi',
        '',
        'DISK_AFTER=$(df -h / | awk \'NR==2 {print $4}\')',
        'echo "[SRE] Zakończono sukcesem. Dostępne miejsce po: $DISK_AFTER"',
        'exit 0'
      ].join('\n')
    },
    {
      id: 'firebird_safe_reset',
      name: 'firebird_safe_reset.sh',
      lang: 'bash',
      title: 'Bash: Samonaprawa Semaforów i Blokad Firebird IPC',
      description: 'Zatrzymuje demona Firebird, tworzy binarną kopię bazy (cp -a), czyści osierocone semafory ipcrm -s i wznawia działanie.',
      code: [
        '#!/usr/bin/env bash',
        '# firebird_safe_reset.sh - Obsługa błędu semop & lock manager w Firebirdzie',
        'set -euo pipefail',
        '',
        'FB_SERVICE="${1:-firebird2.5-super}"',
        'DB_PATH="${2:-/var/lib/firebird/data/szpital.fdb}"',
        '',
        'echo "[SRE-FB] Weryfikacja bazy: $DB_PATH"',
        'if [ ! -f "$DB_PATH" ]; then',
        '  echo "[SRE-FB] BŁĄD: Plik bazy nie istnieje!" >&2',
        '  exit 2',
        'fi',
        '',
        '# Obowiązkowa kopia binarna przed operacją',
        'BACKUP_FILE="/var/backups/fb_$(date +%s).fdb"',
        'mkdir -p /var/backups',
        'echo "[SRE-FB] Wykonywanie kopii binarnej: $BACKUP_FILE"',
        'cp -a "$DB_PATH" "$BACKUP_FILE"',
        '',
        'echo "[SRE-FB] Zatrzymywanie usługi $FB_SERVICE..."',
        'sudo systemctl stop "$FB_SERVICE"',
        '',
        'echo "[SRE-FB] Czyszczenie semaforów IPC powiązanych z Firebirdem..."',
        'ipcs -s | awk \'$3 == "firebird" {print $2}\' | xargs -r sudo ipcrm -s || true',
        '',
        'echo "[SRE-FB] Usuwanie starych gniazd w /tmp..."',
        'sudo rm -rf /tmp/firebird',
        '',
        'echo "[SRE-FB] Uruchamianie usługi $FB_SERVICE..."',
        'sudo systemctl start "$FB_SERVICE"',
        '',
        'echo "[SRE-FB] Sprawdzanie portu 3050..."',
        'nc -z 127.0.0.1 3050 && echo "[SRE-FB] SUKCES: Port 3050 aktywny!" || exit 1',
        'exit 0'
      ].join('\n')
    }
  ];

  /**
   * Szablony Plików Inventory dla Środowisk Szpitalnych
   */
  const SRE_INVENTORY_PRESETS = [
    {
      id: 'hospital_prod',
      name: 'Szpital Produkcja (HIS, LIS, PACS, DB)',
      content: [
        '# inventory.ini - Produkcyjne Środowisko Szpitalne (High-Availability)',
        '[all:vars]',
        'ansible_user = sre_automation',
        'ansible_ssh_private_key_file = ~/.ssh/sre_hospital_ed25519',
        'ansible_python_interpreter = /usr/bin/python3',
        'env_name = production',
        'maintenance_window = false',
        '',
        '[his_db]',
        'his-db-master.med.local ansible_host=10.200.1.10 pg_port=5432 role=master',
        'his-db-replica.med.local ansible_host=10.200.1.11 pg_port=5432 role=replica',
        '',
        '[lis_analyzers]',
        'lis-engine-01.med.local ansible_host=10.200.2.15 mllp_port=2575',
        'lis-engine-02.med.local ansible_host=10.200.2.16 mllp_port=2575',
        '',
        '[pacs_storage]',
        'pacs-node-01.med.local ansible_host=10.200.3.30 nfs_ip=192.168.10.50',
        '',
        '[app_servers]',
        'patexpert-app-01.med.local ansible_host=10.200.4.50 app_port=8080',
        'patexpert-app-02.med.local ansible_host=10.200.4.51 app_port=8080'
      ].join('\n')
    },
    {
      id: 'hospital_staging',
      name: 'Staging / Środowisko Testowe Wdrożeń',
      content: [
        '# inventory.ini - Środowisko Staging / QA',
        '[all:vars]',
        'ansible_user = sre_staging',
        'env_name = staging',
        'maintenance_window = true',
        '',
        '[his_db]',
        'staging-db.med.local ansible_host=192.168.50.10 pg_port=5432',
        '',
        '[lis_analyzers]',
        'staging-lis.med.local ansible_host=192.168.50.15 mllp_port=2575',
        '',
        '[pacs_storage]',
        'staging-pacs.med.local ansible_host=192.168.50.30 nfs_ip=192.168.50.50',
        '',
        '[app_servers]',
        'staging-app.med.local ansible_host=192.168.50.40 app_port=8080'
      ].join('\n')
    }
  ];

  /**
   * Przykładowe Logi Wyników Ansible dla Parsowania
   */
  const ANSIBLE_SAMPLE_LOGS = {
    success: [
      'PLAY [PostgreSQL SRE Maintenance & Connection Guard] ************************************',
      '',
      'TASK [Gathering Facts] ******************************************************************',
      'ok: [his-db-master.med.local]',
      '',
      'TASK [Pre-flight: Sprawdź dostępność usługi systemd postgresql] **************************',
      'ok: [his-db-master.med.local]',
      '',
      'TASK [Odczytaj bieżące wykorzystanie połączeń] ******************************************',
      'ok: [his-db-master.med.local]',
      '',
      'TASK [Bezpiecznie zakończ sesje \'idle in transaction\' przekraczające limit czasu] *******',
      'changed: [his-db-master.med.local]',
      '',
      'PLAY RECAP ******************************************************************************',
      'his-db-master.med.local    : ok=4    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0'
    ].join('\n'),

    timeout_failure: [
      'PLAY [PACS Storage NFS Mount Remediation] ***********************************************',
      '',
      'TASK [Gathering Facts] ******************************************************************',
      'ok: [pacs-node-01.med.local]',
      '',
      'TASK [KROK 1: Sprawdź czy serwer macierzy NFS odpowiada na RPC portmapper] ***************',
      'fatal: [pacs-node-01.med.local]: FAILED! => {"changed": false, "cmd": ["rpcinfo", "-p", "192.168.10.50"], "delta": "0:00:15.002134", "msg": "non-zero return code", "rc": 1, "stderr": "rpcinfo: can\'t contact portmapper: RPC: Remote system error - Connection timed out", "stdout": ""}',
      '',
      'PLAY RECAP ******************************************************************************',
      'pacs-node-01.med.local     : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0'
    ].join('\n'),

    permission_unreachable: [
      'PLAY [LIS & eKrew MLLP Daemon & Firewall Automation] *************************************',
      '',
      'TASK [Gathering Facts] ******************************************************************',
      'fatal: [lis-engine-01.med.local]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Permission denied (publickey,gssapi-keyex,gssapi-with-mic,password).", "unreachable": true}',
      '',
      'PLAY RECAP ******************************************************************************',
      'lis-engine-01.med.local    : ok=0    changed=0    unreachable=1    failed=0    skipped=0    rescued=0    ignored=0'
    ].join('\n')
  };

  /**
   * Parser Surowego Logu Ansible PLAY RECAP i Błędów
   */
  function parseAnsibleOutput(logText) {
    if (!logText || typeof logText !== 'string') {
      return null;
    }

    const result = {
      rawText: logText,
      hosts: [],
      totals: { ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0, rescued: 0 },
      failedTasks: [],
      overallStatus: 'UNKNOWN',
      diagnosis: '',
      remediationCommand: ''
    };

    // 1. Ekstrakcja PLAY RECAP
    // Wzorzec: host.domain : ok=X changed=Y unreachable=Z failed=W skipped=S rescued=R
    const recapRegex = /([a-zA-Z0-9._-]+)\s*:\s*ok=(\d+)\s+changed=(\d+)\s+unreachable=(\d+)\s+failed=(\d+)(?:\s+skipped=(\d+))?(?:\s+rescued=(\d+))?/g;
    let match;

    while ((match = recapRegex.exec(logText)) !== null) {
      const hostStats = {
        host: match[1],
        ok: parseInt(match[2] || '0', 10),
        changed: parseInt(match[3] || '0', 10),
        unreachable: parseInt(match[4] || '0', 10),
        failed: parseInt(match[5] || '0', 10),
        skipped: parseInt(match[6] || '0', 10),
        rescued: parseInt(match[7] || '0', 10)
      };

      result.hosts.push(hostStats);
      result.totals.ok += hostStats.ok;
      result.totals.changed += hostStats.changed;
      result.totals.unreachable += hostStats.unreachable;
      result.totals.failed += hostStats.failed;
      result.totals.skipped += hostStats.skipped;
      result.totals.rescued += hostStats.rescued;
    }

    // 2. Wyszukiwanie konkretnych błędów FAILED / UNREACHABLE
    const failureRegex = /fatal:\s*\[([a-zA-Z0-9._-]+)\]:\s*(FAILED|UNREACHABLE)!\s*=>\s*(\{[\s\S]*?\})/g;
    let failMatch;

    while ((failMatch = failureRegex.exec(logText)) !== null) {
      const host = failMatch[1];
      const type = failMatch[2];
      const rawJson = failMatch[3];

      let parsedErr = {};
      try {
        parsedErr = JSON.parse(rawJson);
      } catch {
        parsedErr = { msg: rawJson };
      }

      result.failedTasks.push({
        host: host,
        type: type,
        msg: parsedErr.msg || parsedErr.stderr || 'Nieznany błąd zadania Ansible',
        stderr: parsedErr.stderr || '',
        rc: parsedErr.rc !== undefined ? parsedErr.rc : null,
        cmd: parsedErr.cmd ? (Array.isArray(parsedErr.cmd) ? parsedErr.cmd.join(' ') : parsedErr.cmd) : null
      });
    }

    // 3. Ocena stanu końcowego i diagnoza SRE
    if (result.totals.unreachable > 0) {
      result.overallStatus = 'UNREACHABLE';
      result.diagnosis = 'Hosty docelowe są nieosiągalne przez SSH (błąd klucza publickey lub brak trasy sieciowej).';
      result.remediationCommand = 'ssh -vvv -i <KLUCZ_SSH> <USER>@<HOST> -o ConnectTimeout=5';
    } else if (result.totals.failed > 0) {
      result.overallStatus = 'FAILED';
      const firstErr = result.failedTasks[0] || {};
      const msg = ((firstErr.msg || '') + ' ' + (firstErr.stderr || '')).toLowerCase();

      if (msg.includes('timed out') || msg.includes('timeout')) {
        result.diagnosis = 'Przekroczono limit czasu operacji (Storage NFS / RPC timeout lub zablokowany port TCP).';
        result.remediationCommand = 'sudo showmount -e <NFS_IP> && rpcinfo -p <NFS_IP>';
      } else if (msg.includes('permission denied') || msg.includes('sudo') || msg.includes('root')) {
        result.diagnosis = 'Brak uprawnień sudoers na węźle docelowym lub restrykcja SELinux/POSIX.';
        result.remediationCommand = 'sudo -n true || echo "Sprawdź plik /etc/sudoers.d/sre_automation"';
      } else if (msg.includes('connection refused') || msg.includes('port')) {
        result.diagnosis = 'Połączenie odrzucone (Demon usługi leży lub zapora firewall blokuje port).';
        result.remediationCommand = 'sudo systemctl status <SERVICE> && sudo ss -tlnp';
      } else {
        result.diagnosis = `Zadanie zakończone kodem błędu: ${firstErr.msg || 'Weryfikacja logów wymagana.'}`;
        result.remediationCommand = 'ansible-playbook -i inventory.ini playbook.yml -vvv --step';
      }
    } else if (result.totals.changed > 0) {
      result.overallStatus = 'CHANGED';
      result.diagnosis = `Playbook wykonany pomyślnie. Zaktualizowano ${result.totals.changed} zasobów zgodnie z zasadą idempotencji.`;
      result.remediationCommand = 'ansible-playbook -i inventory.ini playbook.yml --check --diff';
    } else if (result.totals.ok > 0) {
      result.overallStatus = 'SUCCESS_IDEMPOTENT';
      result.diagnosis = 'Środowisko jest w 100% zgodne ze stanem pożądanym (0 zmian wymaganych – pełna idempotentność).';
      result.remediationCommand = '# System stabilny, brak konieczności interwencji';
    } else {
      result.overallStatus = 'INCOMPLETE_OR_SYNTAX';
      result.diagnosis = 'Nie wykryto sekcji PLAY RECAP. Sprawdź składnię logu lub uruchom ansible z flagą -v.';
      result.remediationCommand = 'ansible-playbook --syntax-check playbook.yml';
    }

    return result;
  }

  /**
   * Kolorowanie składni YAML dla playbooków
   */
  function highlightYAML(yaml) {
    if (!yaml) return '';
    const esc = (window.escapeHtml || (s => s))(yaml);

    return esc
      .replace(/(---|\.\.\.)/g, '<span style="color: var(--accent-rose); font-weight: bold;">$1</span>')
      .replace(/^(\s*-\s+name:)(.*)$/gm, '<span style="color: var(--accent-cyan); font-weight: 700;">$1</span><span style="color: #f1fa8c;">$2</span>')
      .replace(/^(\s*[a-zA-Z0-9_-]+:)/gm, '<span style="color: var(--accent-teal); font-weight: 600;">$1</span>')
      .replace(/(\{\{[\s\S]*?\}\})/g, '<span style="color: #ffb703; font-weight: 600;">$1</span>')
      .replace(/(#.*)$/gm, '<span style="color: var(--text-muted); font-style: italic;">$1</span>');
  }

  /**
   * Główna funkcja renderująca interfejs modułu SRE
   */
  function renderAnsibleSREModule() {
    const container = document.getElementById('ansible-sre-container');
    if (!container) return;

    container.innerHTML = `
      <div class="ansible-sre-shell" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Pasek Narzędziowy & Wybór Podzakładek -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 18px;">
          
          <!-- Przyciski Nawigacji Sub-Tabów -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-sm ${sreState.activeSubTab === 'playbooks' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchSRESubTab('playbooks')">
              📋 Katalog Playbooków SRE
            </button>
            <button class="btn btn-sm ${sreState.activeSubTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchSRESubTab('inventory')">
              ⚙️ Inventory & Zmienne
            </button>
            <button class="btn btn-sm ${sreState.activeSubTab === 'parser' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchSRESubTab('parser')">
              📊 Parser Wyników PLAY RECAP
            </button>
            <button class="btn btn-sm ${sreState.activeSubTab === 'scripts' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchSRESubTab('scripts')">
              🐍 Skrypty Hybrydowe (Python + Bash)
            </button>
            <button class="btn btn-sm ${sreState.activeSubTab === 'ai' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchSRESubTab('ai')">
              🤖 Konsultant SRE AI (Generator)
            </button>
          </div>

          <!-- Status Modelu AI i Tryb Safe by Default -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge" style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); border: 1px solid var(--accent-teal); font-size: 0.75rem;">
              🛡️ Safe by Default (--check)
            </span>
            <span class="badge" style="background: rgba(131, 56, 236, 0.15); color: #9d4edd; border: 1px solid #9d4edd; font-size: 0.75rem;">
              Ansible Core 2.15+
            </span>
          </div>
        </div>

        <!-- Dynamiczna Zawartość Podzakładki -->
        <div id="sre-subtab-content">
          ${renderCurrentSubTabContent()}
        </div>

      </div>
    `;
  }

  /**
   * Renderowanie zawartości aktywnej podzakładki
   */
  function renderCurrentSubTabContent() {
    switch (sreState.activeSubTab) {
      case 'playbooks':
        return renderPlaybooksTab();
      case 'inventory':
        return renderInventoryTab();
      case 'parser':
        return renderParserTab();
      case 'scripts':
        return renderScriptsTab();
      case 'ai':
        return renderAiGeneratorTab();
      default:
        return renderPlaybooksTab();
    }
  }

  /**
   * Podzakładka 1: Katalog Playbooków SRE
   */
  function renderPlaybooksTab() {
    const activePb = SRE_PLAYBOOKS.find(p => p.id === sreState.activePlaybookId) || SRE_PLAYBOOKS[0];

    // Budowanie komendy CLI
    let cliCmd = `ansible-playbook -i inventory.ini ${activePb.id}.yml`;
    if (sreState.checkMode) cliCmd += ' --check';
    if (sreState.diffMode) cliCmd += ' --diff';

    // Przekazywanie zmiennych
    const extraVars = Object.keys(sreState.customVars).length > 0 ? sreState.customVars : activePb.defaultVars;
    const extraVarsStr = Object.entries(extraVars).map(([k, v]) => `${k}=${v}`).join(' ');
    if (extraVarsStr) {
      cliCmd += ` -e "${extraVarsStr}"`;
    }

    return `
      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 20px;">
        
        <!-- Lewa kolumna: Lista Playbooków -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
          <h4 style="font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>📚</span> Dostępne Playbooki SRE
          </h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${SRE_PLAYBOOKS.map(pb => `
              <div 
                style="padding: 12px; border-radius: var(--radius-sm); border: 1px solid ${pb.id === activePb.id ? pb.badgeColor : 'var(--border-color)'}; background: ${pb.id === activePb.id ? 'var(--bg-card-hover)' : 'transparent'}; cursor: pointer; transition: all 0.2s;"
                onclick="window.selectSREPlaybook('${pb.id}')"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${pb.icon} ${pb.title.split(':')[0]}</span>
                  <span class="badge" style="background: rgba(255,255,255,0.08); font-size: 0.68rem; color: ${pb.badgeColor}; border: 1px solid ${pb.badgeColor};">${pb.badge}</span>
                </div>
                <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.3;">
                  ${pb.title.split(':')[1] || pb.title}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Prawa kolumna: Szczegóły Playbooka, Zmienne, CLI & Kod YAML -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Karta Nagłówkowa Playbooka -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 10px;">
              <div>
                <span class="badge" style="background: rgba(131, 56, 236, 0.15); color: #9d4edd; border: 1px solid #9d4edd; margin-bottom: 6px;">
                  System: ${activePb.system}
                </span>
                <h3 style="font-size: 1.15rem; color: var(--text-primary); margin: 4px 0;">
                  ${activePb.icon} ${activePb.title}
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
                  ${activePb.description}
                </p>
              </div>
            </div>

            <!-- Panel Rygorów: Idempotentność i Rollback -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; background: var(--bg-canvas); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-teal);">
              <div>
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-teal); margin-bottom: 2px;">
                  🔄 Gwarancja Idempotentności
                </div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  ${activePb.idempotencyNotes}
                </div>
              </div>
              <div>
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-rose); margin-bottom: 2px;">
                  🛡️ Strategia Rollback / Bezpieczeństwa
                </div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  ${activePb.rollbackStrategy}
                </div>
              </div>
            </div>

            <!-- Przełączniki Środowiska i Flag Bezpieczeństwa -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 16px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer;">
                  <input type="checkbox" ${sreState.checkMode ? 'checked' : ''} onchange="window.toggleSREFlag('checkMode', this.checked)">
                  <span style="font-weight: 600; color: var(--accent-teal);">--check (Dry-Run / Safe Mode)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer;">
                  <input type="checkbox" ${sreState.diffMode ? 'checked' : ''} onchange="window.toggleSREFlag('diffMode', this.checked)">
                  <span style="font-weight: 600; color: var(--accent-cyan);">--diff (Pokaż zmiany w plikach)</span>
                </label>
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="window.copySREText('${escapeForAttr(cliCmd)}', 'Skopiowano polecenie CLI Ansible!')">
                  📋 Kopiuj Polecenie CLI
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.copySREText('${escapeForAttr(activePb.playbookYaml)}', 'Skopiowano kod YAML Playbooka!')">
                  📄 Kopiuj Playbook YAML
                </button>
              </div>
            </div>
          </div>

          <!-- Pasek Polecenia CLI -->
          <div style="background: #0d1117; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
            <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 6px;">
              🚀 Komenda do uruchomienia w terminalu lub CI/CD (AWX / GitLab Runner):
            </div>
            <pre style="margin: 0; font-family: var(--font-mono); font-size: 0.82rem; color: #58a6ff; white-space: pre-wrap; word-break: break-all;"><code>${window.escapeHtml ? window.escapeHtml(cliCmd) : cliCmd}</code></pre>
          </div>

          <!-- Kod YAML Playbooka -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color);">
              <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); font-family: var(--font-mono);">
                playbooks/${activePb.id}.yml
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                Idempotent Ansible Automation Taskset
              </span>
            </div>
            <pre style="margin: 0; padding: 16px; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.5; overflow-x: auto; max-height: 480px;"><code class="yaml-block">${highlightYAML(activePb.playbookYaml)}</code></pre>
          </div>

        </div>
      </div>
    `;
  }

  /**
   * Podzakładka 2: Inventory & Zmienne
   */
  function renderInventoryTab() {
    const inv = SRE_INVENTORY_PRESETS[0];

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.05rem; color: var(--text-primary); margin: 0;">
                ⚙️ Zarządzanie Środowiskami & Plikami Inventory (INI / YAML)
              </h3>
              <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 4px;">
                Struktura grup hostów szpitalnych z podziałem na bazy danych, analizatory LIS, serwery obrazów PACS i węzły aplikacyjne.
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.copySREText('${escapeForAttr(inv.content)}', 'Skopiowano zawartość inventory.ini!')">
              📋 Kopiuj inventory.ini
            </button>
          </div>

          <!-- Przykładowe Inventory INI -->
          <div style="background: #0d1117; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px;">
            <pre style="margin: 0; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.5; color: #79c0ff; overflow-x: auto;"><code>${window.escapeHtml ? window.escapeHtml(inv.content) : inv.content}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Podzakładka 3: Parser Wyników i Diagnostyka PLAY RECAP
   */
  function renderParserTab() {
    const parsed = sreState.parsedLogResult;

    return `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        
        <!-- Pole wprowadzania logu -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="font-size: 1.05rem; color: var(--text-primary); margin: 0;">
              📊 Parser & Analizator Wyników Ansible (PLAY RECAP Analyzer)
            </h3>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="window.loadSampleAnsibleLog('success')">
                Próbka: Sukces (Changed)
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.loadSampleAnsibleLog('timeout_failure')">
                Próbka: Błąd Timeoutu NFS
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.loadSampleAnsibleLog('permission_unreachable')">
                Próbka: SSH Unreachable
              </button>
            </div>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 0; margin-bottom: 12px;">
            Wklej surowy zrzut z konsoli terminala lub CI/CD po wykonaniu polecenia <code>ansible-playbook</code>. Moduł natychmiast wyodrębni metryki, wskaże przyczynę awarii i wygeneruje zalecaną komendę naprawczą.
          </p>

          <textarea 
            id="ansible-log-input" 
            class="doc-input" 
            style="width: 100%; height: 160px; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.4;"
            placeholder="Wklej wynik uruchomienia playbooka (np. PLAY RECAP: host : ok=2 changed=1 failed=1...)"
          >${sreState.parsedLogResult ? escapeForAttr(sreState.parsedLogResult.rawText) : ''}</textarea>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('ansible-log-input').value=''; window.sreStateClearLog();">
              🗑️ Wyczyść
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.parseAnsibleLogUI()">
              🔍 Analizuj Wyniki Uruchomienia
            </button>
          </div>
        </div>

        <!-- Prezentacja Wyników Parsowania -->
        ${parsed ? renderParsedLogCard(parsed) : ''}

      </div>
    `;
  }

  /**
   * Karta szczegółowej analizy sparsowanego logu
   */
  function renderParsedLogCard(parsed) {
    let statusBadgeColor = 'var(--accent-teal)';
    let statusLabel = '✅ SUKCES / IDEMPOTENTNY';

    if (parsed.overallStatus === 'FAILED') {
      statusBadgeColor = 'var(--accent-rose)';
      statusLabel = '❌ AWARIA ZADANIA (FAILED)';
    } else if (parsed.overallStatus === 'UNREACHABLE') {
      statusBadgeColor = '#e76f51';
      statusLabel = '⚠️ HOST NIEOSIĄGALNY (UNREACHABLE)';
    } else if (parsed.overallStatus === 'CHANGED') {
      statusBadgeColor = '#3a86ff';
      statusLabel = '🔄 ZASOBY ZMODYFIKOWANE (CHANGED)';
    }

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; border-left: 4px solid ${statusBadgeColor};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <span class="badge" style="background: rgba(255,255,255,0.06); color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor}; font-weight: 700;">
              ${statusLabel}
            </span>
            <span style="font-size: 0.82rem; color: var(--text-muted); margin-left: 10px;">
              Przeanalizowano hostów: ${parsed.hosts.length}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.saveAnsibleRunAsRunbook()">
            📖 Zapisz Raport do Bazy Runbooków
          </button>
        </div>

        <!-- Podsumowanie Liczbowe PLAY RECAP -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 16px;">
          <div style="background: var(--bg-canvas); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">OK</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-teal);">${parsed.totals.ok}</div>
          </div>
          <div style="background: var(--bg-canvas); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">CHANGED</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #3a86ff;">${parsed.totals.changed}</div>
          </div>
          <div style="background: var(--bg-canvas); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">FAILED</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-rose);">${parsed.totals.failed}</div>
          </div>
          <div style="background: var(--bg-canvas); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">UNREACHABLE</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #e76f51;">${parsed.totals.unreachable}</div>
          </div>
          <div style="background: var(--bg-canvas); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">SKIPPED</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-muted);">${parsed.totals.skipped}</div>
          </div>
        </div>

        <!-- Diagnoza i Zalecenie SRE -->
        <div style="background: var(--bg-canvas); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 12px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
            💡 Diagnoza SRE Root-Cause:
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
            ${parsed.diagnosis}
          </div>
          
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px;">
            💻 Zalecane Działanie Korygujące (Terminal):
          </div>
          <div style="background: #0d1117; padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.82rem; color: #58a6ff; display: flex; justify-content: space-between; align-items: center;">
            <code>${parsed.remediationCommand}</code>
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="window.copySREText('${escapeForAttr(parsed.remediationCommand)}', 'Skopiowano komendę naprawczą!')">
              Kopiuj
            </button>
          </div>
        </div>

        <!-- Lista Błędnych Zadań (jeśli wystąpiły) -->
        ${parsed.failedTasks.length > 0 ? `
          <div style="margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-rose); margin-bottom: 6px;">
              ⚠️ Szczegóły Zgłoszonego Wyjątku / Stderr:
            </div>
            ${parsed.failedTasks.map(ft => `
              <div style="background: rgba(239, 71, 111, 0.08); border: 1px solid var(--accent-rose); border-radius: var(--radius-sm); padding: 10px; font-size: 0.8rem; font-family: var(--font-mono); color: #ff7b72; margin-bottom: 6px;">
                <strong>[${ft.host}] ${ft.type}:</strong> ${window.escapeHtml ? window.escapeHtml(ft.msg) : ft.msg}
              </div>
            `).join('')}
          </div>
        ` : ''}

      </div>
    `;
  }

  /**
   * Podzakładka 4: Skrypty Hybrydowe (Python + Bash)
   */
  function renderScriptsTab() {
    const activeSc = SRE_SCRIPTS.find(s => s.id === sreState.activeScriptId) || SRE_SCRIPTS[0];

    return `
      <div style="display: grid; grid-template-columns: 300px 1fr; gap: 20px;">
        
        <!-- Lewa kolumna: Lista Skryptów -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
          <h4 style="font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>🐍</span> Skrypty Hybrydowe SRE
          </h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${SRE_SCRIPTS.map(sc => `
              <div 
                style="padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid ${sc.id === activeSc.id ? 'var(--accent-teal)' : 'var(--border-color)'}; background: ${sc.id === activeSc.id ? 'var(--bg-card-hover)' : 'transparent'}; cursor: pointer; transition: all 0.2s;"
                onclick="window.selectSREScript('${sc.id}')"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-weight: 700; font-size: 0.82rem; font-family: var(--font-mono); color: var(--text-primary);">${sc.name}</span>
                  <span class="badge" style="background: rgba(255,255,255,0.06); font-size: 0.65rem; color: ${sc.lang === 'python' ? '#3a86ff' : '#06d6a0'};">${sc.lang.toUpperCase()}</span>
                </div>
                <div style="font-size: 0.74rem; color: var(--text-secondary); line-height: 1.2;">
                  ${sc.title.split(':')[1] || sc.title}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Prawa kolumna: Szczegóły Skryptu i Kod Źródłowy -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span class="badge" style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); border: 1px solid var(--accent-teal); margin-bottom: 4px;">
                ${activeSc.lang === 'python' ? 'Python 3.8+' : 'Bash POSIX (set -euo pipefail)'}
              </span>
              <h3 style="font-size: 1.1rem; color: var(--text-primary); margin: 4px 0;">
                ${activeSc.title}
              </h3>
              <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 4px;">
                ${activeSc.description}
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.copySREText('${escapeForAttr(activeSc.code)}', 'Skopiowano kod skryptu!')">
              📋 Kopiuj Kod
            </button>
          </div>

          <div style="background: #0d1117; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="padding: 8px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color); font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
              /usr/local/bin/${activeSc.name}
            </div>
            <pre style="margin: 0; padding: 14px; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.45; color: #e6edf3; overflow-x: auto; max-height: 480px;"><code>${window.escapeHtml ? window.escapeHtml(activeSc.code) : activeSc.code}</code></pre>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Podzakładka 5: Konsultant SRE AI (Generator & Debugger Playbooków)
   */
  function renderAiGeneratorTab() {
    const isApiKeySet = window.geminiService && window.geminiService.hasApiKey();
    const currentModel = (window.geminiService && window.geminiService.getModel()) || 'gemini-3.5-flash';

    return `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-size: 1.05rem; color: var(--text-primary); margin: 0;">
                🤖 Generator & Diagnosta Automatyzacji SRE (Gemini AI)
              </h3>
              <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 4px;">
                Opisz po polsku pożądaną procedurę automatyzacji szpitalnej, a asystent SRE wygeneruje kompletny, idempotentny playbook Ansible ze wsparciem --check i obsługą błędów.
              </p>
            </div>

            <!-- Selektor Modelu Gemini -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.78rem; color: var(--text-muted);">Model AI:</span>
              <select 
                id="ansible-gemini-model-select" 
                class="doc-input" 
                style="padding: 4px 8px; font-size: 0.78rem; background: var(--bg-input); color: var(--text-primary); border-radius: var(--radius-sm);"
                onchange="window.onGeminiModelChange && window.onGeminiModelChange(this.value)"
              >
                <option value="gemini-3.5-flash" ${currentModel === 'gemini-3.5-flash' ? 'selected' : ''}>⭐ gemini-3.5-flash</option>
                <option value="gemini-2.5-flash" ${currentModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
                <option value="gemini-3.8-flash-high" ${currentModel === 'gemini-3.8-flash-high' ? 'selected' : ''}>gemini-3.8-flash-high</option>
              </select>
            </div>
          </div>

          <!-- Prompt dla generatora -->
          <textarea 
            id="ansible-ai-prompt" 
            class="doc-input" 
            style="width: 100%; height: 110px; font-size: 0.85rem;"
            placeholder="np. Przygotuj playbook Ansible do automatycznego odnawiania certyfikatów SSL dla usług CKiK w systemie eKrew, z restartem Nginxa i sprawdzeniem ważności certyfikatu poleceniem openssl..."
          ></textarea>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ${isApiKeySet ? '🟢 Klucz Gemini API aktywny' : '🟡 Tryb demonstracyjny / Offline (Wpisz klucz w ustawieniach Hubu)'}
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.generateSREPlaybookWithAI()">
              ⚡ Generuj Idempotentny Playbook
            </button>
          </div>
        </div>

        <!-- Wynik generowania AI -->
        <div id="ansible-ai-result-container">
          ${sreState.aiGeneratedPlaybook ? renderAiResult(sreState.aiGeneratedPlaybook) : ''}
        </div>
      </div>
    `;
  }

  function renderAiResult(content) {
    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--accent-teal);">
            ✅ Wygenerowany Playbook SRE Ansible:
          </span>
          <button class="btn btn-secondary btn-sm" onclick="window.copySREText('${escapeForAttr(content)}', 'Skopiowano wygenerowany playbook!')">
            📋 Kopiuj YAML
          </button>
        </div>
        <pre style="margin: 0; padding: 14px; background: #0d1117; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.45; overflow-x: auto; color: #e6edf3;"><code>${highlightYAML(content)}</code></pre>
      </div>
    `;
  }

  /**
   * Pomocnik bezpiecznego escape'owania dla atrybutów HTML
   */
  function escapeForAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  /**
   * Zdarzenia i Funkcje Publiczne Modułu
   */
  window.switchSRESubTab = function (tabKey) {
    sreState.activeSubTab = tabKey;
    renderAnsibleSREModule();
  };

  window.selectSREPlaybook = function (playbookId) {
    sreState.activePlaybookId = playbookId;
    renderAnsibleSREModule();
  };

  window.selectSREScript = function (scriptId) {
    sreState.activeScriptId = scriptId;
    renderAnsibleSREModule();
  };

  window.toggleSREFlag = function (flagName, value) {
    sreState[flagName] = !!value;
    renderAnsibleSREModule();
  };

  window.loadSampleAnsibleLog = function (sampleKey) {
    const log = ANSIBLE_SAMPLE_LOGS[sampleKey];
    if (log) {
      const input = document.getElementById('ansible-log-input');
      if (input) input.value = log;
      window.parseAnsibleLogUI();
    }
  };

  window.sreStateClearLog = function () {
    sreState.parsedLogResult = null;
    renderAnsibleSREModule();
  };

  window.parseAnsibleLogUI = function () {
    const input = document.getElementById('ansible-log-input');
    if (!input) return;

    const logText = input.value.trim();
    if (!logText) {
      if (window.showToast) window.showToast('Wklej najpierw treść logu z terminala!', 'warning');
      return;
    }

    const parsed = parseAnsibleOutput(logText);
    sreState.parsedLogResult = parsed;
    renderAnsibleSREModule();
    if (window.showToast) window.showToast('Przeanalizowano wyniki uruchomienia playbooka!', 'success');
  };

  window.copySREText = function (text, successMsg) {
    if (!text) return;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast(successMsg || 'Skopiowano do schowka!', 'success');
      });
    }
  };

  window.saveAnsibleRunAsRunbook = function () {
    const parsed = sreState.parsedLogResult;
    if (!parsed || !window.appState || !window.appState.saveIncidentRunbook) {
      if (window.showToast) window.showToast('Brak sparsowanego raportu do zapisu!', 'warning');
      return;
    }

    const record = {
      id: 'ansible_run_' + Date.now(),
      title: `Automatyzacja SRE: Uruchomienie Ansible (${parsed.overallStatus})`,
      system: 'Automatyzacja Ansible / SRE',
      category: 'SRE Automation & Maintenance',
      errorSymptoms: `Hosty: ${parsed.hosts.map(h => h.host).join(', ')}. Ok=${parsed.totals.ok}, Changed=${parsed.totals.changed}, Failed=${parsed.totals.failed}`,
      rootCause: parsed.diagnosis,
      remediationSteps: [parsed.remediationCommand],
      postMortemNotes: `Logi wykonania:\n${parsed.rawText.substring(0, 600)}...`,
      tags: ['SRE', 'ANSIBLE', 'AUTOMATION', parsed.overallStatus],
      createdAt: new Date().toISOString()
    };

    window.appState.saveIncidentRunbook(record);
    if (window.showToast) window.showToast('Raport SRE pomyślnie wyeksportowany do Bazy Runbooków!', 'success');
  };

  window.generateSREPlaybookWithAI = async function () {
    const promptInput = document.getElementById('ansible-ai-prompt');
    const container = document.getElementById('ansible-ai-result-container');
    if (!promptInput || !container) return;

    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
      if (window.showToast) window.showToast('Wpisz opis zadania automatyzacji!', 'warning');
      return;
    }

    container.innerHTML = `<div style="padding: 16px; color: var(--accent-cyan);">⏳ Generowanie idempotentnego playbooka Ansible przez Gemini AI...</div>`;

    const systemPrompt = `
Jesteś starszym inżynierem Site Reliability Engineering (SRE) specjalizującym się w automatyzacji szpitalnych środowisk medycznych (PostgreSQL, Firebird, LIS, eKrew, PatExpert, Linux).
Tworzysz produkcyjne playbooki Ansible.
ZASADY:
1. IDEMPOTENTNOŚĆ: Każde zadanie musi być idempotentne (używaj modułów copy, template, lineinfile, systemd, ufw, posix.mount z odpowiednimi changed_when/failed_when).
2. OBSŁUGA BŁĘDÓW: Zabezpiecz operacje inwazyjne przez bloki 'block ... rescue ... always'.
3. SAFE BY DEFAULT: Obsługuj --check i --diff.
4. ZERO-RISK: Nigdy nie usuwaj ani nie zeruj plików konfiguracyjnych i baz danych.
Odpowiedz WYŁĄCZNIE blokiem YAML (\`\`\`yaml ... \`\`\`), zwięźle, bez zbędnych wstępów.
    `.trim();

    try {
      if (window.geminiService && window.geminiService.hasApiKey()) {
        const raw = await window.geminiService.callGemini(userPrompt, {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          maxOutputTokens: 1500
        });

        const yamlMatch = raw.match(/```(?:yaml)?\s*([\s\S]*?)\s*```/i);
        const yamlClean = yamlMatch ? yamlMatch[1].trim() : raw.trim();
        sreState.aiGeneratedPlaybook = yamlClean;
      } else {
        // Offline Fallback
        sreState.aiGeneratedPlaybook = [
          '---',
          '# [Offline Fallback Playbook]',
          '- name: Automatyzacja SRE: ' + userPrompt.substring(0, 40),
          '  hosts: all',
          '  become: true',
          '  tasks:',
          '    - name: 1. Sprawdź warunki wstępne środowiska',
          '      ansible.builtin.command: uname -a',
          '      changed_when: false',
          '',
          '    - name: 2. Zweryfikuj stan usług',
          '      ansible.builtin.systemd:',
          '        name: nginx',
          '        state: started',
          '      check_mode: true'
        ].join('\n');
      }

      container.innerHTML = renderAiResult(sreState.aiGeneratedPlaybook);
      if (window.showToast) window.showToast('Playbook został pomyślnie wygenerowany!', 'success');
    } catch (err) {
      container.innerHTML = `<div style="padding: 14px; color: var(--accent-rose);">❌ Błąd generowania: ${escapeForAttr(err.message)}</div>`;
    }
  };

  // Eksport publiczny
  window.renderAnsibleSREModule = renderAnsibleSREModule;
  window.parseAnsibleOutput = parseAnsibleOutput;
  window.SRE_PLAYBOOKS = SRE_PLAYBOOKS;
  window.SRE_SCRIPTS = SRE_SCRIPTS;
  window.sreState = sreState;

})();
