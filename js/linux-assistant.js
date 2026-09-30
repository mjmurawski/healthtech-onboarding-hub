/**
 * HealthTech Onboarding Hub - Asystent Konsoli Linux & Generator Rozwiązań v4.0
 * 
 * Baza Wiedzy (KB JSON v2.0.0) & Silnik Diagnostyczny (Error-First):
 * 1. Zgodność z KB JSON v2.0.0 (priorytety, warstwy, bramki stanu, subchat_fallbacks).
 * 2. Lekki, deterministyczny silnik dopasowujący diagnoseLog(rawLog).
 * 3. Dynamiczna ekstrakcja ścieżek, portów i adresów IP z podstawianiem zmiennych {{TAG}}.
 * 4. 5-poziomowa hierarchia Error-First (Zasoby -> Uprawnienia/IPC/NFS -> Sieć/MTU -> Cykl życia -> Aplikacja/SQL).
 * 5. Incident Step Feedback Engine z obsługą subchat_fallbacks i zasadą niepowtarzania błędu.
 */

// Domyślna Baza Wiedzy Reguł Diagnostycznych (JSON v2.0.0)
const DEFAULT_KB = {
  "version": "2.0.0",
  "rules": [
    {
      "id": "ERR_OS_ENOSPC",
      "priority": 100,
      "layer": "HARDWARE_DISK",
      "triggers": ["no space left on device", "errno 28", "enospc", "iuse% 100", "could not write to file", "zapełniony dysk", "brak miejsca na dysku", "disk full"],
      "service_status": "CRITICAL_BLOCKED_L7",
      "title": "Wyczerpanie Przestrzeni Dyskowej lub Węzłów Indeksowych (ENOSPC)",
      "diagnosis": "Wyczerpanie miejsca na partycji lub wyczerpanie puli i-węzłów (Inodes). Procesy bazodanowe i aplikacje nie mogą zapisać plików tymczasowych ani logów transakcyjnych.",
      "safety_guard": "ZAKAZ wykonywania zapytań SQL (psql/mysql). ZAKAZ kasowania plików *.wal / *.fdb / *.db za pomocą 'rm'. Stosuj wyłącznie truncate na logach lub czyszczenie spakowanych archiwów.",
      "steps": [
        {
          "step": 1,
          "title": "Weryfikacja gigabajtów ORAZ węzłów indeksowych (Inodes)",
          "cmd": "df -hT {{TARGET_DIR}} && df -i {{TARGET_DIR}}",
          "verify": "Sprawdź kolumnę Use% oraz IUse%. Wartość 100% oznacza wyczerpanie zasobu."
        },
        {
          "step": 2,
          "title": "Zlokalizowanie największych starych plików w katalogu",
          "cmd": "sudo du -xh {{TARGET_DIR}} 2>/dev/null | sort -rh | head -n 15",
          "verify": "Zidentyfikuj, czy przestrzeń zajmują zrotowane logi, czy archiwa."
        },
        {
          "step": 3,
          "title": "Bezpieczne obcięcie aktywnego pliku lub usunięcie archiwów .gz",
          "cmd": "sudo find {{TARGET_DIR}} -type f -name '*.gz' -mtime +7 -delete && sudo truncate -s 0 {{TARGET_FILE}}",
          "verify": "df -hT {{TARGET_DIR}} musi wykazać co najmniej 15% wolnego miejsca."
        },
        {
          "step": 4,
          "title": "Weryfikacja zwolnienia miejsca i bezpieczny start usługi",
          "cmd": "df -hT {{TARGET_DIR}} && sudo systemctl start {{SERVICE_NAME}} && sudo systemctl status {{SERVICE_NAME}}",
          "verify": "systemctl status musi potwierdzić active (running) bez ponownych błędów I/O."
        }
      ],
      "subchat_fallbacks": {
        "operation not permitted": {
          "diagnosis": "Plik ma nałożony atrybut niezmienności (immutable / append-only) zabezpieczający log audytowy.",
          "cmd": "lsattr {{TARGET_FILE}} && sudo chattr -i -a {{TARGET_FILE}} && sudo truncate -s 0 {{TARGET_FILE}}",
          "verify": "lsattr {{TARGET_FILE}} nie powinno pokazywać flag 'i' ani 'a'."
        }
      }
    },
    {
      "id": "ERR_OS_ENOMEM_OOM",
      "priority": 100,
      "layer": "HARDWARE_RAM",
      "triggers": ["out of memory", "oom-killer", "killed process", "errno 12", "enomem", "total-vm", "memory cgroup out of memory", "heap space", "outofmemoryerror", "exited (137)"],
      "service_status": "DEAD",
      "title": "Krytyczny Brak Pamięci Operacyjnej RAM (Kernel OOM Killer)",
      "diagnosis": "Jądro Linuksa ubiło proces (np. JVM Tomcat/Mirth) z powodu braku fizycznej pamięci RAM lub przekroczenia limitu Cgroups.",
      "safety_guard": "Awaria dotyczy PAMIĘCI OPERACYJNEJ, a nie dysku! Nie usuwaj plików z dysku – dostosuj limity sterty Java (-Xmx) i włącz SWAP.",
      "steps": [
        {
          "step": 1,
          "title": "Weryfikacja incydentu OOM w dzienniku jądra i bilansu pamięci",
          "cmd": "sudo dmesg -T | grep -iE 'oom|killed process' | tail -n 10 && free -h",
          "verify": "Zwróć uwagę na kolumnę 'available' oraz rozmiar zabitego procesu (anon-rss)."
        },
        {
          "step": 2,
          "title": "Tymczasowe utworzenie 4GB awaryjnego pliku SWAP",
          "cmd": "sudo fallocate -l 4G /swapfile_emergency && sudo chmod 600 /swapfile_emergency && sudo mkswap /swapfile_emergency && sudo swapon /swapfile_emergency",
          "verify": "free -h musi wykazać obecność nowej przestrzeni Swap."
        },
        {
          "step": 3,
          "title": "Korekta sterty JVM i restart usługi",
          "cmd": "# Zmniejsz -Xmx w konfiguracji usługi medycznej, np. z -Xmx8g do -Xmx5g, a następnie:\nsudo systemctl restart {{SERVICE_NAME}}",
          "verify": "systemctl status {{SERVICE_NAME}} musi wskazywać active (running)."
        }
      ]
    },
    {
      "id": "ERR_FS_EPERM_EACCES",
      "priority": 90,
      "layer": "PERMISSIONS",
      "triggers": ["permission denied", "errno 13", "eacces", "operation not permitted", "errno 1", "eperm", "selinux", "avc: denied", "odmowa dostępu", "błąd uprawnień"],
      "service_status": "ALIVE_OR_BLOCKED",
      "title": "Brak Uprawnień do Plików lub Gniazd (Permission Denied / EACCES)",
      "diagnosis": "Brak uprawnień POSIX użytkownika systemowego, zablokowany dostęp do gniazda UNIX lub restrykcja profilu SELinux/AppArmor. Baza danych jest spójna i zdrowa.",
      "safety_guard": "KRYTYCZNE: Baza danych NIE JEST uszkodzona! ZAKAZ uruchamiania narzędzi naprawczych (gfix, pg_resetwal, vacuum full). Wymagana jest wyłącznie naprawa uprawnień w systemie plików.",
      "steps": [
        {
          "step": 1,
          "title": "Inspekcja uprawnień całej ścieżki do pliku / socketu",
          "cmd": "namei -l {{TARGET_PATH}} && ls -la {{TARGET_PATH}}",
          "verify": "Każdy katalog nadrzędny musi mieć uprawnienie wykonania (+x) dla grupy lub innych."
        },
        {
          "step": 2,
          "title": "Sprawdzenie blokad SELinux i kontekstu bezpieczeństwa",
          "cmd": "sudo dmesg -T | grep -iE 'avc|denied|apparmor' | tail -n 10 && (ls -Z {{TARGET_PATH}} 2>/dev/null || true)",
          "verify": "Sprawdź czy odmowa nie wynika z restrykcji kontekstu bezpieczeństwa SELinux."
        },
        {
          "step": 3,
          "title": "Korekta właściciela do dedykowanego demona usługi",
          "cmd": "sudo chown -R {{SERVICE_USER}}:{{SERVICE_USER}} {{TARGET_DIR}} && sudo chmod 775 {{TARGET_DIR}} && (test -f {{TARGET_PATH}} && sudo chmod 660 {{TARGET_PATH}} || true)",
          "verify": "ls -la {{TARGET_PATH}} musi potwierdzić nowego właściciela."
        },
        {
          "step": 4,
          "title": "Przywrócenie kontekstu SELinux i restart usługi",
          "cmd": "sudo restorecon -v {{TARGET_PATH}} 2>/dev/null || sudo aa-status 2>/dev/null; sudo systemctl restart {{SERVICE_NAME}}",
          "verify": "systemctl status {{SERVICE_NAME}} musi wskazywać active (running)."
        }
      ],
      "subchat_fallbacks": {
        "operation not permitted": {
          "diagnosis": "Uprawnienia zablokowane przez atrybuty ext4 (chattr) lub restrykcję uprawnień w kontenerze.",
          "cmd": "lsattr {{TARGET_PATH}} 2>/dev/null; sudo chmod u+w {{TARGET_PATH}}",
          "verify": "Sprawdź czy atrybut 'i' lub 'a' został zdjęty."
        }
      }
    },
    {
      "id": "ERR_STORAGE_NFS_PACS",
      "priority": 85,
      "layer": "STORAGE_NFS",
      "triggers": ["nfs: server not responding", "stale file handle", "timed out", "errno 116", "estale", "uninterruptible sleep", "mount.nfs", "pacs.*timeout", "timeout.*nfs"],
      "service_status": "HANG",
      "title": "Wiszący Montaż Sieciowy NFS / Storage Archiwum PACS",
      "diagnosis": "Zasób sieciowy NFS magazynu obrazów PACS/DICOM przestał odpowiadać. Procesy czytające/zapisujące wpadły w stan uśpienia jądra (D-state).",
      "safety_guard": "ZAKAZ twardego restartu serwera ani masowego ubijania Dockera. Standardowe 'umount' zawiesi terminal – wymagane jest odmontowanie lazy/force.",
      "steps": [
        {
          "step": 1,
          "title": "Identyfikacja procesów wiszących na punkcie montowania",
          "cmd": "sudo fuser -vm {{TARGET_PATH}} 2>/dev/null",
          "verify": "Zidentyfikuj PID procesów oczekujących na I/O w stanie D."
        },
        {
          "step": 2,
          "title": "Wymuszone i odroczone odmontowanie zasobu (Lazy Umount)",
          "cmd": "sudo umount -l -f {{TARGET_PATH}}",
          "verify": "df -hT nie powinno już zawieszać sesji i nie powinno zawierać tego montowania."
        },
        {
          "step": 3,
          "title": "Sprawdzenie statusu macierzy i montaż z flagą 'intr'",
          "cmd": "rpcinfo -p {{NFS_SERVER_IP}} && sudo mount -t nfs -o rw,hard,intr,timeo=60,retrans=2 {{NFS_SERVER_IP}}:{{NFS_EXPORT}} {{TARGET_PATH}}",
          "verify": "ls -la {{TARGET_PATH}} powinno wyświetlić listę plików badań DICOM."
        }
      ],
      "subchat_fallbacks": {
        "device or resource busy": {
          "diagnosis": "Punkt montowania nadal trzymany przez proces jądra.",
          "cmd": "sudo fuser -km {{TARGET_PATH}} 2>/dev/null || true && sudo umount -l -f {{TARGET_PATH}}",
          "verify": "df -hT potwierdza zwolnienie punktu montowania."
        }
      }
    },
    {
      "id": "ERR_NET_TCP_MTU_RESET",
      "priority": 75,
      "layer": "NETWORK_L4_MTU",
      "triggers": ["connection reset by peer", "tcp connection reset", "transmitting", "association aborted", "rst flag", "mtu", "pmtu"],
      "service_status": "ALIVE_OR_DOWN",
      "title": "Gwałtowne Zrywanie Połączeń (Connection Reset by Peer / MTU & RST Flag)",
      "diagnosis": "Połączenie TCP między aparatem medycznym (TK/MR/RTG) a serwerem PACS lub brokerem HL7 zostaje gwałtownie przerwane flagą RST w trakcie transmisji (np. po przesłaniu części danych/obrazów DICOM). Najczęstsze przyczyny w szpitalu to: niedopasowanie MTU na trasie (Jumbo Frames vs standard 1500 na switchach/VLAN) lub agresywny timeout w zaporze stanowej.",
      "safety_guard": "W sieciach szpitalnych starsze aparaty medyczne nie obsługują Path MTU Discovery. Zastosowanie MSS Clamping po stronie serwera jest w 100% bezpieczne i natychmiast stabilizuje transmisję bez rekonfiguracji aparatów.",
      "steps": [
        {
          "step": 1,
          "title": "Sprawdzenie zrzutu handshake TCP i flag RST w locie (tcpdump)",
          "cmd": "sudo tcpdump -nn -i any port {{TARGET_PORT}} -c 50 -vv",
          "verify": "Przechwyć pakiety i zidentyfikuj która strona wysyła flagę [R.] (RST)."
        },
        {
          "step": 2,
          "title": "Test fragmentacji pakietów (MTU 1500) z flagą DF (Don't Fragment) do aparatu",
          "cmd": "ping -M do -s 1472 {{SOURCE_IP_HOST}}",
          "verify": "Jeśli polecenie zwróci 'Frag needed', obniż rozmiar (np. 1400) by ustalić realne PMTU."
        },
        {
          "step": 3,
          "title": "Włączenie MSS Clamping w iptables (Automatyczne dopasowanie segmentu)",
          "cmd": "ip link show\nsudo iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu",
          "verify": "iptables -t mangle -L -n -v musi wykazać regułę TCPMSS."
        },
        {
          "step": 4,
          "title": "Weryfikacja liczby resetów TCP w statystykach jądra Linuksa",
          "cmd": "netstat -s | grep -iE 'reset|retransmit'",
          "verify": "Sprawdź spadek liczników retransmisji i resetów."
        }
      ]
    },
    {
      "id": "ERR_NET_HL7_MLLP",
      "priority": 70,
      "layer": "NETWORK",
      "triggers": ["mllp", "port 2575", "connection refused", "errno 111", "econnrefused", "connection timeout", "errno 110", "6661"],
      "service_status": "ALIVE_OR_DOWN",
      "title": "Brak Komunikacji Sieciowej MLLP / Connection Refused",
      "diagnosis": "Brak możliwości nawiązania sesji TCP na porcie MLLP brokera HL7 (np. 2575). Port nie nasłuchuje, zbindował się wyłącznie na 127.0.0.1 lub ruch odcina firewall.",
      "safety_guard": "ZAKAZ otwierania portu 2575 na cały świat (0.0.0.0/0). HL7 przesyła dane medyczne nieszyfrowanym tekstem – reguła firewalla musi zezwalać wyłącznie na IP analizatora.",
      "steps": [
        {
          "step": 1,
          "title": "Sprawdzenie czy port słucha na właściwym interfejsie sieciowym",
          "cmd": "sudo ss -tlpn | grep {{TARGET_PORT}}",
          "verify": "Kolumna Local Address musi wskazywać *:2575 lub 0.0.0.0:2575, a NIE 127.0.0.1:2575."
        },
        {
          "step": 2,
          "title": "Bezpieczne dopuszczenie podsieci analizatorów laboratoryjnych",
          "cmd": "sudo ufw allow from {{SOURCE_IP_SUBNET}} to any port {{TARGET_PORT}} proto tcp comment 'HL7 Inbound'",
          "verify": "sudo ufw status verbose potwierdza regułę z adresem źródłowym."
        },
        {
          "step": 3,
          "title": "Podgląd pakietów w czasie rzeczywistym (weryfikacja flag SYN/ACK)",
          "cmd": "sudo tcpdump -nn -i any port {{TARGET_PORT}} -c 20",
          "verify": "Sprawdź, czy po stronie serwera pojawiają się pakiety z flagą [S] od analizatora."
        }
      ]
    },
    {
      "id": "ERR_DB_FIREBIRD_IPC",
      "priority": 60,
      "layer": "DATABASE_FIREBIRD",
      "triggers": ["semop", "identifier removed", "lock manager error", "active processes exist on lock table", "isc_attach_database", "operating system directive semop"],
      "service_status": "CRITICAL_IPC",
      "title": "Firebird IPC: Błąd Menedżera Blokad i Osierocone Semafory (semop)",
      "diagnosis": "Osierocone semafory IPC pamięci współdzielonej po twardym resecie serwera lub awarii zasilania. Silnik Firebird nie może zarządzać tabelą blokad .fdb.",
      "safety_guard": "NIE URUCHAMIAJ gfix -mend! Plik bazy nie ma uszkodzonych stron, problem tkwi wyłącznie w pamięci ulotnej Linuksa.",
      "steps": [
        {
          "step": 1,
          "title": "Zatrzymanie usług Firebirda",
          "cmd": "sudo systemctl stop firebird || sudo killall -9 fbserver fbguard",
          "verify": "ps aux | grep fbserver nie powinno zwracać żadnych aktywnych procesów."
        },
        {
          "step": 2,
          "title": "Usunięcie wiszących plików tabeli blokad w katalogach tymczasowych",
          "cmd": "sudo rm -f /tmp/firebird* /var/run/firebird/*.lck /tmp/fb_* 2>/dev/null || true",
          "verify": "Katalogi /tmp i /var/run/firebird powinny być oczyszczone z blokad .lck."
        },
        {
          "step": 3,
          "title": "Wyczyszczenie osieroconych semaforów IPC w systemie",
          "cmd": "ipcs -s | grep -E 'firebird|0x' | awk '{print $2}' | xargs -r sudo ipcrm -s",
          "verify": "ipcs -s | grep firebird powinno być puste."
        },
        {
          "step": 4,
          "title": "Uruchomienie serwera Firebird",
          "cmd": "sudo systemctl start firebird",
          "verify": "systemctl status firebird musi wskazywać active (running)."
        }
      ]
    },
    {
      "id": "ERR_SRV_CRASH_FAILURE",
      "priority": 50,
      "layer": "SERVICE_CRASH",
      "triggers": ["status=1/failure", "code=exited, status=1", "main process exited", "failed to start", "active: failed", "segmentation fault", "sigsegv", "core dumped"],
      "service_status": "DEAD",
      "title": "Awaria Procesu Usługi (Main Process Exited / Status=1 Failure)",
      "diagnosis": "Proces usługi medycznej zakończył się błędem (status=1/FAILURE, code=exited lub segfault). Ponieważ usługa jest MARTWA, gniazdo TCP/socket nie istnieje. Wszystkie zapytania aplikacyjne (SQL/REST) zakończą się niepowodzeniem. Pierwszym zadaniem jest zbadanie dokładnego zrzutu logu systemd.",
      "safety_guard": "Nie wykonuj zapytań SQL/API, dopóki komenda 'systemctl is-active' nie zwróci wartości 'active'. Jeśli proces natychmiast pada, zbadaj czy w journalctl nie ma śladu braku biblioteki (.so) lub błędu składni pliku konfiguracyjnego.",
      "steps": [
        {
          "step": 1,
          "title": "Dokładna analiza przyczyny upadku w dzienniku systemd (journalctl)",
          "cmd": "sudo systemctl status {{SERVICE_NAME}} && sudo journalctl -u {{SERVICE_NAME}} -n 50 --no-pager -xe",
          "verify": "Pobierz 50 ostatnich linii logu z pełnym zrzutem błędu startowego."
        },
        {
          "step": 2,
          "title": "Weryfikacja zależności i integralności konfiguracji",
          "cmd": "sudo systemctl list-dependencies {{SERVICE_NAME}} && (sudo -u postgres postgres -C config_file 2>/dev/null || sudo test -f /etc/{{SERVICE_NAME}}.conf || true)",
          "verify": "Sprawdź czy usługi zależne są aktywne i konfiguracja jest czytelna."
        },
        {
          "step": 3,
          "title": "Zresetowanie stanu awarii i próba restartu",
          "cmd": "sudo systemctl reset-failed {{SERVICE_NAME}} && sudo systemctl start {{SERVICE_NAME}}",
          "verify": "Wyczyść licznik awarii w systemd i uruchom usługę ponownie."
        },
        {
          "step": 4,
          "title": "Weryfikacja czy proces ustabilizował się po starcie",
          "cmd": "sudo systemctl is-active {{SERVICE_NAME}} && sudo ss -tulpn | grep {{TARGET_PORT}}",
          "verify": "Potwierdź czy status zwraca 'active' i gniazda nasłuchu są otwarte."
        }
      ]
    },
    {
      "id": "ERR_DB_FIREBIRD_REPAIR",
      "priority": 45,
      "layer": "DATABASE_FIREBIRD",
      "triggers": ["consistency check", "corrupt", "uszkodzona baza", "gds check", "bad checksum"],
      "service_status": "CRITICAL_BLOCKED_L7",
      "title": "Procedura Naprawy Uszkodzonej Bazy Firebird (.fdb)",
      "diagnosis": "Wykryto błąd spójności logicznej stron bazy Firebird. Zgodnie z zasadą najmniejszej inwazyjności: ZAWSZE zaczynamy od inspekcji tylko do odczytu (gstat) oraz WYMAGANEJ KOPII BEZPIECZEŃSTWA przed użyciem gfix!",
      "safety_guard": "ZASADA STOPNIOWANIA: Nigdy nie odpalaj 'gfix -mend' bez wcześniejszego 'cp -a'! Jeśli w logu pojawił się błąd 'Permission denied', plik NIE jest uszkodzony i procedura gfix jest zabroniona.",
      "steps": [
        {
          "step": 1,
          "title": "KROK BEZWZGLĘDNIE WYMAGANY: Wykonanie kopii binarnej bazy (Przed jakąkolwiek naprawą!)",
          "cmd": "sudo cp -a {{TARGET_PATH}} {{TARGET_PATH}}_KOPIA_BEZPIECZENSTWA_$(date +%F_%H%M).fdb",
          "verify": "OBOWIĄZKOWE: Kopia zapasowa 1:1. Nigdy nie uruchamiaj gfix na jedynym pliku bazy!"
        },
        {
          "step": 2,
          "title": "Bezinwazyjna inspekcja nagłówka i integralności (Tylko Odczyt)",
          "cmd": "sudo gstat -h {{TARGET_PATH}} && sudo gfix -v -full {{TARGET_PATH}} -user SYSDBA -password masterkey",
          "verify": "Sprawdź numery OIT/OAT oraz wskaźnik flagi uszkodzenia bez modyfikacji pliku."
        },
        {
          "step": 3,
          "title": "Ostateczność: Oznaczenie uszkodzonych stron (Mend)",
          "cmd": "sudo gfix -mend -full -ignore {{TARGET_PATH}} -user SYSDBA -password masterkey",
          "verify": "Oznacz nieczytelne strony do pominięcia podczas zrzutu gbak."
        },
        {
          "step": 4,
          "title": "Zrzut logiczny (gbak) i odtworzenie nowej czystej bazy",
          "cmd": "sudo gbak -b -v -g {{TARGET_PATH}} /tmp/dump_ratunkowy.fbk -user SYSDBA -password masterkey && sudo gbak -c -v /tmp/dump_ratunkowy.fbk {{TARGET_PATH}}_nowa_naprawiona.fdb -user SYSDBA -password masterkey",
          "verify": "Zbuduj nową bazę ze świeżymi indeksami."
        }
      ]
    },
    {
      "id": "ERR_DB_POSTGRES_CONNS",
      "priority": 40,
      "layer": "DATABASE_POSTGRES",
      "triggers": ["too many connections", "remaining connection slots", "max_connections", "pool exhausted"],
      "service_status": "ALIVE",
      "title": "Zarządzanie Pulą Połączeń PostgreSQL (Too Many Connections)",
      "diagnosis": "Baza PostgreSQL działa poprawnie, ale osiągnęła limit max_connections z powodu aplikacji nie zamykających połączeń lub braku connection poolera (np. PgBouncer). Ponieważ proces żyje, wykonanie zapytań administracyjnych jako superuser jest bezpieczne.",
      "safety_guard": "Używaj 'systemctl reload', a nie 'restart', aby nie zrywać połączeń personelu szpitalnego podczas dyżuru.",
      "steps": [
        {
          "step": 1,
          "title": "Sprawdzenie stanu aktywnych sesji w bazie",
          "cmd": "sudo -u postgres psql -c \"SELECT count(*), state FROM pg_stat_activity GROUP BY state;\" && sudo -u postgres psql -c \"SELECT pid, client_addr, application_name, state, now() - query_start AS duration FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;\"",
          "verify": "Zlicz ile sesji jest w stanie 'active', a ile wisi w 'idle in transaction'."
        },
        {
          "step": 2,
          "title": "Łagodne zakończenie nieaktywnych wiszących sesji",
          "cmd": "sudo -u postgres psql -c \"SELECT pg_cancel_backend(<PID>);\" || sudo -u postgres psql -c \"SELECT pg_terminate_backend(<PID>);\"",
          "verify": "Zwolnij zablokowane połączenia bez restartu bazy."
        },
        {
          "step": 3,
          "title": "Podniesienie limitu połączeń i przeładowanie konfiguracji",
          "cmd": "sudo -u postgres psql -c \"ALTER SYSTEM SET max_connections = '300';\" && sudo systemctl reload postgresql",
          "verify": "Zastosuj zmiany bez przerywania aktywnych połączeń personelu szpitalnego."
        }
      ]
    },
    {
      "id": "ERR_NET_BIND_CONFLICT",
      "priority": 35,
      "layer": "NETWORK",
      "triggers": ["address already in use", "bind failed", "zajęty port", "bindexception"],
      "service_status": "ALIVE_OR_DOWN",
      "title": "Konflikt Bindowania Gniazda (Address Already in Use)",
      "diagnosis": "Usługa nie może wystartować, ponieważ poprzedni proces (lub inna instancja) nadal trzyma otwarte gniazdo TCP. Często występuje po nieudanym restarcie silnika Mirth Connect lub aplikacji w Delphi.",
      "safety_guard": "Zawsze sprawdź PID procesu poleceniem 'ps -fp' przed 'kill'. Unikaj ubijania niepowiązanych procesów systemowych.",
      "steps": [
        {
          "step": 1,
          "title": "Precyzyjna identyfikacja procesu trzymającego port",
          "cmd": "sudo ss -tulpn | grep {{TARGET_PORT}} && sudo fuser -v {{TARGET_PORT}}/tcp",
          "verify": "Wyświetl nazwę programu, PID i użytkownika gniazda."
        },
        {
          "step": 2,
          "title": "Sprawdzenie szczegółów procesu przed jego dotknięciem",
          "cmd": "ps -fp <PID>",
          "verify": "Upewnij się co to za proces przed wysłaniem sygnału."
        },
        {
          "step": 3,
          "title": "Stopniowane zakończenie wiszącego procesu (Najpierw SIGTERM)",
          "cmd": "sudo kill -15 <PID> || (sleep 3 && sudo kill -9 <PID> 2>/dev/null || true)",
          "verify": "KROK 1: Wyślij SIGTERM. Dopiero jeśli proces nie zwolnił portu, użyj SIGKILL."
        },
        {
          "step": 4,
          "title": "Uruchomienie właściwej usługi",
          "cmd": "sudo systemctl start {{SERVICE_NAME}} && sudo ss -tulpn | grep {{TARGET_PORT}}",
          "verify": "Potwierdź nasłuch z poprawnym PID."
        }
      ]
    }
  ]
};

class LinuxTroubleshooter {
  constructor() {
    this.hierarchyLevels = {
      LEVEL_1_RESOURCES: {
        id: "L1_RESOURCES",
        name: "Poziom 1: Sprzęt i Zasoby Systemowe (RAM / Dysk / Inody)",
        badge: "Zasoby Fizyczne OS",
        color: "var(--accent-rose)"
      },
      LEVEL_2_PERMISSIONS_IO: {
        id: "L2_PERMISSIONS_IO",
        name: "Poziom 2: Uprawnienia, I/O, IPC i Storage (Semafor / Prawa / NFS)",
        badge: "Uprawnienia, IPC & I/O",
        color: "var(--accent-amber)"
      },
      LEVEL_3_NETWORK: {
        id: "L3_NETWORK",
        name: "Poziom 3: Sieć L4, Sockety i MTU (MLLP / TCP / DICOM / Firewall)",
        badge: "Sieć L4, MTU & Porty",
        color: "var(--accent-cyan)"
      },
      LEVEL_4_SERVICE_LIFECYCLE: {
        id: "L4_SERVICE_LIFECYCLE",
        name: "Poziom 4: Cykl Życia Procesu (systemd / Crash / Segfault)",
        badge: "Cykl Życia Usługi",
        color: "var(--accent-purple)"
      },
      LEVEL_5_APPLICATION_SQL: {
        id: "L5_APPLICATION_SQL",
        name: "Poziom 5: Warstwa Aplikacyjna & Bazy Danych (SQL / Integracje)",
        badge: "Aplikacja / SQL",
        color: "var(--accent-teal)"
      }
    };

    this.kb = this.loadKB();
  }

  /**
   * Ładowanie bazy wiedzy (z localStorage jeśli istnieje lub domyślna)
   */
  loadKB() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('healthtech_linux_kb_v2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.rules)) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Nie udało się załadować KB z localStorage, używam domyślnej:', e);
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_KB));
  }

  /**
   * Zapis bazy wiedzy do localStorage
   */
  saveKB(newKb) {
    if (!newKb || !Array.isArray(newKb.rules)) {
      throw new Error('Niepoprawny format Bazy Wiedzy (wymagany obiekt z tablicą rules)');
    }
    this.kb = JSON.parse(JSON.stringify(newKb));
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('healthtech_linux_kb_v2', JSON.stringify(this.kb, null, 2));
    }
    return true;
  }

  /**
   * Przywrócenie domyślnej bazy wiedzy
   */
  resetKB() {
    this.kb = JSON.parse(JSON.stringify(DEFAULT_KB));
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('healthtech_linux_kb_v2');
    }
    return this.kb;
  }

  /**
   * Dynamiczna ekstrakcja ścieżek z logu użytkownika
   */
  extractPaths(rawText) {
    if (!rawText) return { detected: false, fullPath: null, parentDir: null, fileName: null };

    // Wyszukaj bezwzględne ścieżki w uniksowym formacie
    const pathRegex = /(?:\/[a-zA-Z0-9_\.\-]+)+/g;
    const matches = rawText.match(pathRegex) || [];

    const validPaths = matches.filter(p => {
      return p.length > 3 && 
             !p.startsWith('/dev/null') && 
             !p.startsWith('/dev/zero') && 
             !p.startsWith('/proc/') &&
             !p.startsWith('/sys/');
    });

    if (validPaths.length > 0) {
      // Pobieramy najbardziej specyficzną (najdłuższą) ścieżkę z logu
      const sorted = [...validPaths].sort((a, b) => b.length - a.length);
      const fullPath = sorted[0].replace(/[:,\(\)'"\]]+$/, '');
      const lastSlash = fullPath.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? fullPath.substring(0, lastSlash) : '/';
      const fileName = fullPath.substring(lastSlash + 1);

      return {
        detected: true,
        fullPath,
        parentDir,
        fileName
      };
    }

    return {
      detected: false,
      fullPath: null,
      parentDir: null,
      fileName: null
    };
  }

  /**
   * Lekki, deterministyczny silnik dopasowujący reguły (diagnoseLog)
   * Ekstrakcja parametrów dynamicznych, priorytetyzacja i podstawienie zmiennych {{TAG}}
   */
  diagnoseLog(rawLog) {
    if (!rawLog || !rawLog.trim()) return null;

    const logLower = rawLog.toLowerCase();

    // 1. Ekstrakcja parametrów dynamicznych z logu użytkownika
    const extracted = this.extractPaths(rawLog);
    const targetPath = extracted.detected ? extracted.fullPath : "/var/log";
    const targetFile = targetPath.includes(".") ? targetPath : targetPath + "/app.log";
    const targetDir = extracted.detected ? extracted.parentDir : (targetPath.includes(".") ? targetPath.substring(0, targetPath.lastIndexOf("/")) : targetPath);
    
    // Port
    const portMatch = rawLog.match(/(?:port\s+|:)(\d{2,5})/i);
    const targetPort = portMatch ? portMatch[1] : (logLower.includes("dicom") ? "104" : (logLower.includes("postgres") ? "5432" : (logLower.includes("firebird") ? "3050" : "2575")));

    // Adres IP (np. analizator lub serwer NFS)
    const ipMatch = rawLog.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const detectedIp = ipMatch ? ipMatch[0] : null;

    const serviceUser = targetPath.includes("postgres") || logLower.includes("postgres") 
      ? "postgres" 
      : (targetPath.includes("firebird") || logLower.includes("firebird") 
        ? "firebird" 
        : (logLower.includes("mirth") ? "mirth" : "meduser"));

    const serviceName = logLower.includes("postgres") 
      ? "postgresql" 
      : (logLower.includes("firebird") 
        ? "firebird" 
        : (logLower.includes("mirth") ? "mirth" : "his-core"));

    // 2. Szukanie pasujących reguł i sortowanie po priorytecie (najwyższy wygrywa)
    const matches = this.kb.rules.filter(rule => 
      rule.triggers.some(trigger => {
        if (trigger.includes(".*")) {
          try {
            return new RegExp(trigger, "i").test(rawLog);
          } catch(e) {
            return logLower.includes(trigger.toLowerCase());
          }
        }
        return logLower.includes(trigger.toLowerCase());
      })
    );

    if (matches.length === 0) {
      return null;
    }

    // Sortuj od najwyższego priorytetu (np. 100 wygrywa z 60)
    matches.sort((a, b) => b.priority - a.priority);
    const matchedRule = JSON.parse(JSON.stringify(matches[0])); // Głęboka kopia

    // 3. Dynamiczne podstawienie wyciągniętych ścieżek i parametrów pod znaczniki {{TAG}}
    const replacements = {
      "{{TARGET_PATH}}": targetPath,
      "{{TARGET_DIR}}": targetDir,
      "{{TARGET_FILE}}": targetFile,
      "{{TARGET_PORT}}": targetPort,
      "{{SERVICE_USER}}": serviceUser,
      "{{SERVICE_NAME}}": serviceName,
      "{{SOURCE_IP_SUBNET}}": detectedIp ? `${detectedIp}/32` : "192.168.10.0/24",
      "{{SOURCE_IP_HOST}}": detectedIp || "<IP_APARATU_LUB_STACJI>",
      "{{NFS_SERVER_IP}}": detectedIp || "10.0.8.200",
      "{{NFS_EXPORT}}": targetPath.startsWith("/mnt") ? targetPath : "/pacs_share"
    };

    // Podstawienie w krokach
    matchedRule.steps.forEach(step => {
      for (const [placeholder, val] of Object.entries(replacements)) {
        if (step.cmd) step.cmd = step.cmd.replaceAll(placeholder, val);
        if (step.verify) step.verify = step.verify.replaceAll(placeholder, val);
        if (step.title) step.title = step.title.replaceAll(placeholder, val);
      }
    });

    // Podstawienie w subchat_fallbacks
    if (matchedRule.subchat_fallbacks) {
      for (const fbKey of Object.keys(matchedRule.subchat_fallbacks)) {
        const fb = matchedRule.subchat_fallbacks[fbKey];
        for (const [placeholder, val] of Object.entries(replacements)) {
          if (fb.cmd) fb.cmd = fb.cmd.replaceAll(placeholder, val);
          if (fb.verify) fb.verify = fb.verify.replaceAll(placeholder, val);
          if (fb.diagnosis) fb.diagnosis = fb.diagnosis.replaceAll(placeholder, val);
        }
      }
    }

    // Dołącz metadane ekstrakcji
    matchedRule._extracted = {
      targetPath,
      targetDir,
      targetFile,
      targetPort,
      detectedIp,
      serviceUser,
      serviceName
    };

    return matchedRule;
  }

  /**
   * Główna metoda analizy incydentu (analizuje błąd, mapuje warstwę i generuje procedurę)
   */
  analyze(userInput) {
    if (!userInput || !userInput.trim()) return null;

    const raw = userInput.trim();
    const text = raw.toLowerCase();

    // 1. Detekcja ścieżek z logu
    const extractedPaths = this.extractPaths(raw);

    // 2. Detekcja stanu procesu (Alive vs Dead Gate)
    const isDead = this.detectDeadProcess(text);

    // 3. Detekcja kontekstu encji
    const entityContext = this.detectEntityContext(text);

    // 4. Dopasowanie przez silnik KB JSON v2.0.0
    const matchedRule = this.diagnoseLog(raw);

    let incident = null;

    if (matchedRule) {
      // Określ poziom hierarchii Error-First
      let level = this.hierarchyLevels.LEVEL_1_RESOURCES;
      if (matchedRule.layer === "HARDWARE_DISK" || matchedRule.layer === "HARDWARE_RAM") {
        level = this.hierarchyLevels.LEVEL_1_RESOURCES;
      } else if (matchedRule.layer === "PERMISSIONS" || matchedRule.layer === "STORAGE_NFS" || (matchedRule.layer === "DATABASE_FIREBIRD" && matchedRule.id === "ERR_DB_FIREBIRD_IPC")) {
        level = this.hierarchyLevels.LEVEL_2_PERMISSIONS_IO;
      } else if (matchedRule.layer === "NETWORK" || matchedRule.layer === "NETWORK_L4_MTU") {
        level = this.hierarchyLevels.LEVEL_3_NETWORK;
      } else if (matchedRule.layer === "SERVICE_CRASH") {
        level = this.hierarchyLevels.LEVEL_4_SERVICE_LIFECYCLE;
      } else if (matchedRule.layer === "DATABASE_POSTGRES" || (matchedRule.layer === "DATABASE_FIREBIRD" && matchedRule.id === "ERR_DB_FIREBIRD_REPAIR")) {
        level = this.hierarchyLevels.LEVEL_5_APPLICATION_SQL;
      }

      // Określ stan procesu (bramka stanu)
      let ruleIsDead = isDead;
      if (matchedRule.service_status === "CRITICAL_BLOCKED_L7" || matchedRule.service_status === "DEAD" || matchedRule.service_status === "HANG" || matchedRule.service_status === "CRITICAL_IPC") {
        ruleIsDead = true;
      } else if (matchedRule.service_status === "ALIVE") {
        ruleIsDead = false;
      }

      // Przekształcenie kroków steps w strukturę procedure kompatybilną z widokiem UI i testami
      const procedure = matchedRule.steps.map((s, idx) => {
        // Jeśli komenda składa się z wielu linii, rozdziel na pojedyncze komendy
        const rawLines = s.cmd.split('\n').map(l => l.trim()).filter(Boolean);
        const commands = rawLines.map((line, lIdx) => ({
          cmd: line,
          desc: lIdx === 0 ? (s.verify || s.title) : s.title
        }));

        return {
          step: `${s.step}. ${s.title}`,
          verify: s.verify,
          commands: commands.length > 0 ? commands : [{ cmd: s.cmd, desc: s.verify || s.title }]
        };
      });

      incident = {
        ruleId: matchedRule.id,
        level: level,
        title: matchedRule.title || matchedRule.id,
        severity: level.badge,
        diagnosis: matchedRule.diagnosis,
        safetyTips: matchedRule.safety_guard || "Zachowaj ostrożność podczas wykonywania poleceń na serwerach szpitalnych.",
        isDeadProcess: ruleIsDead,
        procedure: procedure,
        subchat_fallbacks: matchedRule.subchat_fallbacks || {},
        rawRule: matchedRule
      };
    } else {
      // Fallback ogólny jeśli nie znaleziono reguły w KB
      incident = this.getGenericTriage(text, isDead, entityContext, extractedPaths);
    }

    return {
      incident,
      isDead: incident ? incident.isDeadProcess : isDead,
      entityContext,
      extractedPaths,
      userInput: raw
    };
  }

  /**
   * Rozpoznawanie znaczników martwego procesu (Bramka Stanu Procesu)
   */
  detectDeadProcess(text) {
    if (text.includes("remaining connection slots") || 
        text.includes("password authentication failed") || 
        text.includes("too many clients") ||
        text.includes("connection reset by peer")) {
      if (!text.includes("main process exited") && 
          !text.includes("code=exited") && 
          !text.includes("status=1") && 
          !text.includes("panic")) {
        return false;
      }
    }

    const deadMarkers = [
      "panic",
      "main process exited",
      "code=exited",
      "status=1/failure",
      "status=2",
      "status=127",
      "killed process",
      "out of memory",
      "oom-killer",
      "crashloopbackoff",
      "exited (1)",
      "exited (137)",
      "active: failed",
      "active: inactive",
      "failed to start",
      "core dumped",
      "segmentation fault",
      "sigsegv",
      "process terminated",
      "usługa leży",
      "proces padł",
      "wywalił się"
    ];

    return deadMarkers.some(marker => text.includes(marker));
  }

  detectEntityContext(text) {
    return {
      isPostgres: /postgres|psql|5432/i.test(text),
      isFirebird: /firebird|fbserver|fbguard|\.fdb|3050|gds|semop/i.test(text),
      isMirth: /mirth|nextgen|connect|channel|kanał/i.test(text),
      isPacs: /pacs|orthanc|dcm4chee|dicom|dcm/i.test(text),
      isDocker: /docker|container|compose|kontener/i.test(text),
      isJava: /java|jvm|heap|jar/i.test(text)
    };
  }

  getGenericTriage(text, isDead, entity, paths) {
    return {
      ruleId: "GENERIC_TRIAGE",
      level: isDead ? this.hierarchyLevels.LEVEL_4_SERVICE_LIFECYCLE : this.hierarchyLevels.LEVEL_1_RESOURCES,
      title: isDead ? "Awaria Usługi - Wstępny Triage Diagnostyczny (Proces Zatrzymany)" : "Ogólna Procedura Diagnostyczna Incydentu Linux",
      severity: isDead ? "Proces Zatrzymany" : "Diagnostyka Podstawowa",
      diagnosis: isDead 
        ? "Wykryto, że proces usługi lub kontener uległ awarii. Zgodnie z bramką stanu procesu, zapytania aplikacyjne zostały zablokowane. Skup się na analizie dziennika systemd i weryfikacji zasobów fizycznych."
        : "Nie zidentyfikowano specyficznego kodu błędu. Poniższa procedura bezinwazyjnie sprawdza stan zasobów (RAM/Dysk), błędy jądra oraz status usług medycznych.",
      isDeadProcess: isDead,
      safetyTips: "Zawsze wykonuj komendy diagnostyczne tylko do odczytu przed jakimkolwiek restartem procesów na produkcji.",
      procedure: [
        {
          step: "1. Sprawdzenie zasobów fizycznych (RAM, Swap, Dysk)",
          verify: "Sprawdź kolumny free, available oraz Use%",
          commands: [
            { cmd: "free -h", desc: "Sprawdź czy pamięć RAM nie jest wyczerpana (brak OOM)" },
            { cmd: "df -hT && df -i", desc: "Sprawdź czy partycje nie mają 100% zajętości lub braku inodów" }
          ]
        },
        {
          step: "2. Przegląd najświeższych błędów systemowych (journalctl & dmesg)",
          verify: "Przeanalizuj komunikaty o statusie err..emerg",
          commands: [
            { cmd: "sudo journalctl -p err..emerg -n 40 --no-pager", desc: "Sprawdź ostatnie błędy o wysokim priorytecie w dzienniku" },
            { cmd: "sudo dmesg -T | grep -iE 'error|oom|segfault|denied|timeout' | tail -n 20", desc: "Sprawdź ostrzeżenia jądra Linuksa" }
          ]
        },
        {
          step: "3. Status usług medycznych i nasłuchujących portów",
          verify: "Upewnij się które jednostki systemd zgłosiły failed",
          commands: [
            { cmd: "systemctl list-units --type=service --state=failed", desc: "Pokaż usługi systemowe które zakończyły się awarią" },
            { cmd: "sudo ss -tulpn | grep -E '2575|6661|5432|3050|8080'", desc: "Sprawdź stan portów szpitalnych" }
          ]
        }
      ],
      subchat_fallbacks: {}
    };
  }

  /**
   * SILNIK ROZWIĄZYWANIA BŁĘDÓW KROKU (Incident Step Feedback Engine)
   * Obsługa dedykowanych subchat_fallbacks z reguły KB oraz ogólnej bazy błędów konsoli
   */
  analyzeStepError(stepIndex, originalCmd, terminalOutput, incident) {
    if (!terminalOutput || !terminalOutput.trim()) {
      return {
        success: false,
        message: "Wklej treść błędu z terminala, aby asystent mógł przygotować mikro-poprawkę."
      };
    }

    const out = terminalOutput.trim().toLowerCase();
    const nextStepNum = stepIndex + 2;

    let diagnosis = "";
    let fixCommands = [];
    let advice = "";

    // 0. Sprawdzenie DEDYKOWANYCH subchat_fallbacks z dopasowanej reguły KB
    if (incident && incident.subchat_fallbacks) {
      for (const [triggerKey, fb] of Object.entries(incident.subchat_fallbacks)) {
        if (out.includes(triggerKey.toLowerCase())) {
          diagnosis = fb.diagnosis;
          const fbCmds = fb.cmd.split('\n').map(l => l.trim()).filter(Boolean);
          fixCommands = fbCmds.map(c => ({
            cmd: c,
            desc: fb.verify || "Dedykowana mikro-poprawka reguły KB"
          }));
          advice = fb.verify || "Wykonaj procedurę odblokowującą.";
          break;
        }
      }
    }

    // Jeśli nie dopasowano dedykowanego subchat_fallback, zastosuj inteligentną bazę ogólną:
    if (fixCommands.length === 0) {
      // 1. Brakujące narzędzia (command not found)
      if (out.includes("command not found") || out.includes("nie znaleziono polecenia") || out.includes("not found")) {
        if (out.includes("fuser")) {
          diagnosis = "Brak narzędzia 'fuser' (pakiet psmisc nie jest zainstalowany w systemie).";
          fixCommands = [
            { cmd: "sudo apt-get update && sudo apt-get install -y psmisc", desc: "Dla Ubuntu/Debian" },
            { cmd: "sudo dnf install -y psmisc", desc: "Dla RHEL / Rocky / AlmaLinux" }
          ];
        } else if (out.includes("netstat")) {
          diagnosis = "Brak narzędzia 'netstat' (pakiet net-tools).";
          fixCommands = [
            { cmd: "sudo apt-get install -y net-tools", desc: "Instalacja net-tools (Debian/Ubuntu)" },
            { cmd: "sudo ss -tulpn", desc: "Alternatywne nowoczesne polecenie wbudowane w system (zamiast netstat)" }
          ];
        } else if (out.includes("tcpdump")) {
          diagnosis = "Brak narzędzia do zrzutu pakietów tcpdump.";
          fixCommands = [
            { cmd: "sudo apt-get update && sudo apt-get install -y tcpdump", desc: "Instalacja tcpdump" }
          ];
        } else if (out.includes("ipcs") || out.includes("ipcrm")) {
          diagnosis = "Brak pakietu util-linux zawierającego narzędzia semaforów IPC.";
          fixCommands = [
            { cmd: "sudo apt-get install -y util-linux", desc: "Instalacja util-linux" }
          ];
        } else if (out.includes("gstat") || out.includes("gfix") || out.includes("gbak")) {
          diagnosis = "Narzędzia konsolowe Firebirda nie znajdują się w zmiennej PATH.";
          fixCommands = [
            { cmd: "export PATH=$PATH:/opt/firebird/bin", desc: "Dopisz katalog binarny Firebirda do PATH w bieżącej sesji" },
            { cmd: "sudo /opt/firebird/bin/gstat -h /var/lib/firebird/data/*.fdb", desc: "Użyj bezpośredniej bezwzględnej ścieżki do narzędzia" }
          ];
        } else if (out.includes("psql")) {
          diagnosis = "Brak klienta psql (postgresql-client).";
          fixCommands = [
            { cmd: "sudo apt-get install -y postgresql-client", desc: "Instalacja klienta PostgreSQL" }
          ];
        } else {
          diagnosis = "Wykryto brakującą komendę w systemie.";
          fixCommands = [
            { cmd: "which " + (originalCmd.split(' ')[0] || "komenda"), desc: "Sprawdź dostępność polecenia w PATH" }
          ];
        }
        advice = "Zainstaluj brakujący pakiet narzędziowy.";
      }

      // 2. Device or resource busy (Wiszący zasób)
      else if (out.includes("device or resource busy") || out.includes("zasób zajęty")) {
        diagnosis = "Zasób sieciowy lub plik jest trzymany przez proces jądra i nie może zostać zwolniony standardowym poleceniem.";
        fixCommands = [
          { cmd: "sudo fuser -km /mnt/pacs_storage 2>/dev/null || true", desc: "Zabij procesy trzymające punkt montowania" },
          { cmd: "sudo umount -l -f /mnt/pacs_storage", desc: "Wykonaj odmontowanie leniwe (Lazy Umount)" }
        ];
        advice = "Użyj odmontowania leniwego (-l), które natychmiast odpina wiszący punkt z drzewa VFS.";
      }

      // 2B. Read-only file system (np. w Dockerze, BuildKit lub po błędzie I/O jądra)
      else if (out.includes("read-only file system") || out.includes("read only file system") || out.includes("read-only") || out.includes("read only")) {
        const dockerPath = out.includes("/var/lib/docker") ? "/var/lib/docker" : "";
        diagnosis = "System plików (lub magazyn kontenerów Docker) został przemontowany w tryb tylko do odczytu (Read-Only) z powodu błędu wejścia/wyjścia (I/O) lub restrykcji zabezpieczającej jądra Linuksa.";
        fixCommands = [
          { cmd: "mount | grep -iE 'read-only| \\/.* \\(ro' || cat /proc/mounts | grep -w ro", desc: "Zidentyfikuj który punkt montowania został oznaczony jako tylko do odczytu (ro)" },
          { cmd: "sudo dmesg -T | grep -iE 'error|remount-ro|I/O error|EXT4-fs' | tail -n 15", desc: "Sprawdź dziennik jądra pod kątem uszkodzeń sektorów dysku lub systemu plików" },
          { cmd: dockerPath ? `sudo mount -o remount,rw ${dockerPath} 2>/dev/null || sudo mount -o remount,rw /` : "sudo mount -o remount,rw /", desc: "Spróbuj bezpiecznie przemontować partycję w tryb zapisu (rw)" },
          { cmd: "sudo systemctl restart docker", desc: "Zrestartuj usługę Docker po przywróceniu praw do zapisu" }
        ];
        advice = "Przemontuj partycję w tryb 'rw' i zweryfikuj stan nośnika w dmesg.";
      }

      // 3. Permission denied / Operation not permitted
      else if (out.includes("permission denied") || out.includes("operation not permitted") || out.includes("odmowa dostępu")) {
        diagnosis = "Polecenie wymagało uprawnień roota lub zablokował je brak sudo.";
        fixCommands = [
          { cmd: "sudo " + originalCmd.replace(/^sudo\s+/, ''), desc: "Uruchom to samo polecenie z prefiksem sudo" }
        ];
        advice = "Podnieś uprawnienia do poziomu administratora.";
      }

      // 4. No such file or directory
      else if (out.includes("no such file or directory") || out.includes("nie ma takiego pliku ani katalogu")) {
        diagnosis = "Wskazana ścieżka lub katalog nadrzędny nie istnieje w systemie.";
        fixCommands = [
          { cmd: "sudo mkdir -p $(dirname <sciezka>)", desc: "Utwórz brakujący katalog nadrzędny" },
          { cmd: "ls -ld /var/run/postgresql /var/lib/firebird /mnt/pacs* 2>/dev/null", desc: "Sprawdź rzeczywiste istniejące katalogi usług medycznych" }
        ];
        advice = "Zweryfikuj czy nie ma literówki w nazwie ścieżki z logu.";
      }

      // 5. Connection refused na etapie testu
      else if (out.includes("connection refused") || out.includes("odrzucono połączenie")) {
        diagnosis = "Gniazdo TCP nadal nie przyjmuje połączeń — usługa może jeszcze startować lub nasłuchuje na innym porcie.";
        fixCommands = [
          { cmd: "sudo ss -tulpn", desc: "Sprawdź listę wszystkich aktualnie otwartych portów" },
          { cmd: "sudo journalctl -e -n 20", desc: "Sprawdź ostatnie komunikaty o ewentualnym błędzie startu" }
        ];
        advice = "Upewnij się, że usługa zakończyła inicjalizację.";
      }

      // Fallback
      else {
        diagnosis = "Wystąpił nieoczekiwany błąd wykonania kroku.";
        fixCommands = [
          { cmd: "sudo journalctl -xe -n 25 --no-pager", desc: "Pobierz najświeższe szczegółowe logi błędu systemd" }
        ];
        advice = "Przeanalizuj komunikat błędu.";
      }
    }

    // Zasada niepowtarzania: filtrujemy komendy naprawcze, aby żadna nie była identyczna z komendą która zawiodła
    let filteredFixCommands = fixCommands.filter(c => c.cmd.trim() !== originalCmd.trim());

    // =========================================================================
    // REGUŁA BEZPIECZEŃSTWA: Ochrona plików konfiguracyjnych i baz danych przed truncate
    // Jeśli krok zawierał truncate na pliku innym niż .log, korygujemy polecenie główne
    // =========================================================================
    let dangerousTruncate = null;
    if (originalCmd && originalCmd.includes("truncate")) {
      const truncPathMatch = originalCmd.match(/truncate\s+(?:-[a-zA-Z0-9_\-]+\s+)*\d*[kKmMgGtT]?\s*([\/][a-zA-Z0-9_\.\-\*\/\?]+)/i);
      if (truncPathMatch && truncPathMatch[1]) {
        const filePath = truncPathMatch[1];
        const lastSlash = filePath.lastIndexOf('/');
        const fileName = lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;

        // Jeśli plik nie kończy się na .log (np. .json, .conf, .db, .xml, .ini, .yaml)
        const isLog = /\.log(?:\.[\w\-]+)?$/i.test(fileName);
        if (!isLog) {
          const isDockerEnv = (originalCmd + " " + out + " " + filePath).toLowerCase().includes("docker");
          const safeCmd = isDockerEnv
            ? "sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log"
            : "sudo journalctl --vacuum-size=200M && sudo find /var/log -type f -name '*.gz' -mtime +7 -delete";

          dangerousTruncate = {
            fileName,
            filePath,
            safeCmd,
            isDockerEnv
          };

          // Dodaj bezpieczną alternatywę do komend naprawczych jeśli jeszcze jej nie ma
          if (!filteredFixCommands.some(c => c.cmd.includes("containers/*/*-json.log") || c.cmd.includes("vacuum-size"))) {
            filteredFixCommands.push({
              cmd: safeCmd,
              desc: `Zwolnij miejsce na logach zamiast zerować plik ${fileName}`
            });
          }
        }
      }
    }

    let targetGoalMessage = `✅ Przeszkoda w Kroku ${stepIndex + 1} została przeanalizowana. Po wykonaniu powyższej mikro-poprawki możesz powtórzyć ten krok lub przejść do Kroku ${nextStepNum} głównej procedury: "${incident ? incident.title : 'Przywrócenie usługi'}".`;

    if (dangerousTruncate) {
      targetGoalMessage = `⚠️ System plików jest już w trybie zapisu (rw). Zamiast zerować plik konfiguracyjny ${dangerousTruncate.fileName}, zwolnij miejsce czyszcząc logi Dockera: \`${dangerousTruncate.safeCmd}\`.`;
    }

    return {
      success: true,
      stepIndex,
      originalCmd,
      diagnosis,
      fixCommands: filteredFixCommands.length > 0 ? filteredFixCommands : fixCommands,
      targetGoalMessage,
      dangerousTruncate: dangerousTruncate ? {
        fileName: dangerousTruncate.fileName,
        filePath: dangerousTruncate.filePath,
        correctedCmd: dangerousTruncate.safeCmd
      } : null
    };
  }
}

// Globalna instancja oraz bezpośrednia funkcja pomocnicza diagnoseLog
let troubleshooterInstance = null;
if (typeof window !== 'undefined') {
  troubleshooterInstance = new LinuxTroubleshooter();
  window.linuxTroubleshooter = troubleshooterInstance;
  window.diagnoseLog = function(rawLog) {
    return window.linuxTroubleshooter.diagnoseLog(rawLog);
  };
  window.DEFAULT_KB = DEFAULT_KB;
}
