/**
 * PostgreSQL & Centrum Update SOP Module (pg-update-sop.js)
 * 
 * Standardowa Procedura Operacyjna (SOP) aktualizacji bazy danych PostgreSQL
 * oraz oprogramowania Centrum (LIS Marcel) autorstwa Adriana Wojtkowskiego.
 * 
 * Moduł produkcyjny:
 * 1. Procedura krok po kroku z interaktywną checklistą (localStorage)
 * 2. Ściągawka terminalowa z 1-Click kopiowaniem i wyszukiwarką na żywo
 * 3. Analiza Bloat w PostgreSQL & technika drastycznej redukcji dysku (1.3 TB -> 300 GB)
 * 4. Peryferia szpitalne (TigerVNC, Samba, Cron, Mirth, kontenery LXC)
 * 5. Obsługa serwerów satelitarnych Alab (Debian RDP & CZA bez Wine vs Gentoo z Wine)
 * 6. Integracja z Bazą Runbooków Hubu (appState.saveIncidentRunbook)
 */

(function () {
  'use strict';

  // Bezpieczne pomocniki
  const escapeHtml = function (str) {
    if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
      return window.escapeHtml(str);
    }
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const showToast = function (msg, type = 'info') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg, type);
    } else {
      console.log(`[Toast ${type}] ${msg}`);
    }
  };

  // Podświetlanie składni dla bloków kodu w stylu nowoczesnej dokumentacji (zgodne 1:1 ze zrzutem)
  const highlightCode = function (code, lang) {
    if (!code) return '';
    let escaped = escapeHtml(code);
    if (lang === 'sql') {
      const tokens = [];
      // 1. Zabezpieczenie stringów w apostrofach
      escaped = escaped.replace(/'([^']*)'/g, function (m) {
        const id = tokens.length;
        tokens.push('<span style="color: #7ee787;">' + m + '</span>');
        return '___SQL_TOK_' + id + '___';
      });
      // 2. Podświetlenie słów kluczowych SQL
      escaped = escaped.replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|AS|DISTINCT|COUNT|ALTER|TABLE|ADD|COLUMN|INSERT|INTO|VALUES|DROP|VIEW|RENAME|TO|BEGIN|COMMIT|ROLLBACK|VACUUM|FULL|VERBOSE|DO|CREATE|DATABASE|OWNER)\b/g, '<span style="color: #58a6ff;">$1</span>');
      // 3. Komentarze SQL
      escaped = escaped.replace(/(^|\n)(--.*$)/gm, '$1<span style="color: #8b949e;">$2</span>');
      // 4. Przywrócenie stringów
      escaped = escaped.replace(/___SQL_TOK_(\d+)___/g, function (_, id) {
        return tokens[parseInt(id, 10)];
      });
      return escaped;
    }
    if (lang === 'bash' || lang === 'sh') {
      // W Bashu kod jest czytelny i czysty (jak na zrzucie ekranu), ewentualne komentarze na szaro
      escaped = escaped.replace(/(^|\n)(#.*$)/gm, '$1<span style="color: #8b949e;">$2</span>');
      return escaped;
    }
    return escaped;
  };

  // Stan lokalny modułu
  const sopState = {
    activeSubTab: 'procedure', // 'procedure' | 'cheatsheet' | 'bloat' | 'peripherals'
    searchQuery: '',
    completedSteps: {}
  };

  // Klucz pamięci checklisty w localStorage
  const CHECKLIST_STORAGE_KEY = 'healthtech_pg_update_sop_checklist';

  function loadChecklistState() {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        sopState.completedSteps = JSON.parse(saved);
      }
    } catch (e) {
      sopState.completedSteps = {};
    }
  }

  function saveChecklistState() {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(sopState.completedSteps));
    } catch (e) {
      console.warn('Nie udało się zapisać stanu checklisty SOP:', e);
    }
  }

  /**
   * Baza Wiedzy SOP: Procedura Krok po Kroku (Wiedza Adriana Wojtkowskiego)
   */
  const SOP_STEPS = [
    {
      id: 'step_1',
      number: '1',
      title: 'Weryfikacja zerowej liczby połączeń & Kontrola usługi PostgreSQL',
      titleFormatted: 'Weryfikacja i Odcięcie Połączeń do Bazy <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">centrum</span>',
      badge: 'Zero-Connection Policy',
      badgeColor: '#ef476f',
      estimatedTime: '3-5 min',
      summary: 'Sprawdzenie czy żaden klient nie korzysta z bazy centrum, weryfikacja usług przez rc-status oraz zatrzymanie i uruchomienie usługi PostgreSQL (OpenRC na Gentoo lub systemd na Debian/Ubuntu).',
      descriptionHtml: 'Aktualizacja schematu bazy (skrypty SQL z <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">ALTER TABLE</span> , dropowaniem widoków itp.) wymaga wyłącznego dostępu do tabel ( <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">zlecenia</span> , <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">wykonania</span> , <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">wyniki</span> ). Jakiekolwiek aktywne połączenie spowoduje <strong style="color: #ffffff;">deadlock</strong> i zawieszenie aktualizacji na wiele godzin.',
      why: 'Modyfikacja schematu (DDL, ALTER TABLE, triggery) wymaga wyłącznych blokad (ACCESS EXCLUSIVE). Jakiekolwiek wiszące połączenie zablokuje migrację w nieskończoność lub spowoduje błąd deadlock.',
      adrianNote: 'Adrian Wojtkowski podkreśla: przed zalogowaniem sprawdza usługi przez rc-status (czy coś nie jest już pozatrzymywane), a w konsoli psql uruchamia po prostu SELECT * FROM pg_stat_activity WHERE datname = \'centrum\';. Nie potrzebujemy wypisywać wielu kolumn (pid, usename, state...), ponieważ w terminalu chodzi o natychmiastowy rzut oka na wynik: ma być dokładnie „(0 rows)”. Jeśli wiszą sesje aplikacji, zatrzymujemy usługę (/etc/init.d/postgresql-11 stop) lub zrzucamy sesje i uruchamiamy ponownie.',
      substeps: [
        {
          label: '1. Sprawdź stan odpalonych procesów i usług (OpenRC na Gentoo):',
          cmd: 'rc-status',
          lang: 'bash'
        },
        {
          label: '2. Zaloguj się do bazy jako administrator <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">postgres</span> :',
          cmd: 'psql -U postgres',
          lang: 'bash'
        },
        {
          label: '3. Sprawdź aktywne połączenia (dokładnie tak jak robi to Adrian):',
          cmd: "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';",
          lang: 'sql'
        },
        {
          label: '4. Ocena wyniku:',
          bullets: [
            '• Jeśli widzisz <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">(0 rows)</span> (lub ewentualnie procesy replikacji / <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">walwriter</span> , które nie blokują DDL) <strong style="color: #ffffff;">➔ Masz czysto, przechodzisz od razu do KROKU 2.</strong>',
            '• Jeśli widzisz jakiekolwiek wiersze sesji aplikacyjnych <strong style="color: #ffffff;">➔ Połączenia muszą zostać natychmiast zrzucone.</strong>'
          ]
        },
        {
          label: '5. Zatrzymanie procesu / usługi PostgreSQL (odcięcie połączeń przed aktualizacją):',
          items: [
            {
              sublabel: 'Dystrybucja Gentoo Linux (OpenRC):',
              cmd: '/etc/init.d/postgresql-11 stop',
              lang: 'bash'
            },
            {
              sublabel: 'Dystrybucja Debian / Ubuntu (systemd):',
              cmd: 'systemctl stop postgresql',
              lang: 'bash'
            },
            {
              sublabel: 'Alternatywa: Natychmiastowe zrzucenie wiszących połączeń z poziomu psql (bez zatrzymywania klastra):',
              cmd: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'centrum' AND pid <> pg_backend_pid();",
              lang: 'sql'
            }
          ]
        },
        {
          label: '6. Uruchomienie / restart procesu PostgreSQL po zrzuceniu sesji:',
          items: [
            {
              sublabel: 'Uruchomienie PostgreSQL — Gentoo Linux (OpenRC):',
              cmd: '/etc/init.d/postgresql-11 start',
              lang: 'bash'
            },
            {
              sublabel: 'Uruchomienie PostgreSQL — Debian / Ubuntu (systemd):',
              cmd: 'systemctl start postgresql',
              lang: 'bash'
            },
            {
              sublabel: 'Opcjonalnie: restart usługi PostgreSQL — Gentoo Linux (OpenRC):',
              cmd: '/etc/init.d/postgresql-11 restart',
              lang: 'bash'
            },
            {
              sublabel: 'Opcjonalnie: restart usługi PostgreSQL — Debian / Ubuntu (systemd):',
              cmd: 'systemctl restart postgresql',
              lang: 'bash'
            }
          ]
        },
        {
          label: '7. Ponowna weryfikacja zerowej liczby połączeń po restarcie (Musi zwrócić: (0 rows)):',
          cmd: "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';",
          lang: 'sql'
        }
      ],
      commands: [
        {
          label: 'Sprawdzenie stanu usług systemowych (Gentoo OpenRC)',
          cmd: 'rc-status',
          lang: 'bash'
        },
        {
          label: 'Wejście do konsoli PostgreSQL jako superuser',
          cmd: 'psql -U postgres',
          lang: 'bash'
        },
        {
          label: 'Weryfikacja zerowej liczby aktywnych połączeń (Musi zwrócić: (0 rows))',
          cmd: "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';",
          lang: 'sql'
        },
        {
          label: 'Zatrzymanie usługi PostgreSQL — Gentoo Linux (OpenRC)',
          cmd: '/etc/init.d/postgresql-11 stop',
          lang: 'bash'
        },
        {
          label: 'Zatrzymanie usługi PostgreSQL — Debian / Ubuntu (systemd)',
          cmd: 'systemctl stop postgresql',
          lang: 'bash'
        },
        {
          label: 'Awaryjne natychmiastowe zrzucenie wiszących połączeń z psql',
          cmd: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'centrum' AND pid <> pg_backend_pid();",
          lang: 'sql'
        },
        {
          label: 'Uruchomienie usługi PostgreSQL — Gentoo Linux (OpenRC)',
          cmd: '/etc/init.d/postgresql-11 start',
          lang: 'bash'
        },
        {
          label: 'Uruchomienie usługi PostgreSQL — Debian / Ubuntu (systemd)',
          cmd: 'systemctl start postgresql',
          lang: 'bash'
        },
        {
          label: 'Restart usługi PostgreSQL — Gentoo Linux (OpenRC)',
          cmd: '/etc/init.d/postgresql-11 restart',
          lang: 'bash'
        },
        {
          label: 'Restart usługi PostgreSQL — Debian / Ubuntu (systemd)',
          cmd: 'systemctl restart postgresql',
          lang: 'bash'
        },
        {
          label: 'Ponowna weryfikacja po restarcie (Musi zwrócić: (0 rows))',
          cmd: "psql -U postgres -c \"SELECT * FROM pg_stat_activity WHERE datname = 'centrum';\"",
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Wykonano komendę rc-status i sprawdzono stan odpalonych usług w systemie',
        'Zalogowano się do bazy jako administrator postgres i zweryfikowano brak połączeń',
        'Wykonano zapytanie do pg_stat_activity i potwierdzono wynik (0 rows)',
        'W razie potrzeby zatrzymano usługę bazy (/etc/init.d/postgresql-11 stop lub systemctl stop postgresql)',
        'Uruchomiono / zrestartowano proces PostgreSQL przed rozpoczęciem pracy na plikach',
        'Ponownie potwierdzono (0 rows) przed przystąpieniem do migracji DDL'
      ]
    },
    {
      id: 'step_2',
      number: '2',
      title: 'Przygotowanie katalogu roboczego & Trik z tabelą „wersja”',
      titleFormatted: 'Przygotowanie Katalogu Roboczego & Trik z Tabelą <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">wersja</span>',
      badge: 'SQL Schema Trick',
      badgeColor: '#ffb703',
      estimatedTime: '5-10 min',
      summary: 'Utworzenie katalogu wersji w /home/lab/marcel/service/, rozpakowanie paczki aktualizacji oraz kluczowa modyfikacja pierwszego pliku SQL.',
      descriptionHtml: 'Aktualizacje LIS Marcel często przeskakują o kilka wydań (np. z <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">5.2.0</span> do <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">5.3.2</span>). W pierwszym pliku SQL znajduje się wpis podbijający numer wersji, który może wywołać konflikt klucza unikalnego i zatrzymać skrypt instalacyjny.',
      why: 'Aktualizacje LIS Marcel często przeskakują o kilka wydań (np. z 5.2.0 do 5.3.2). W pierwszym pliku SQL znajduje się wpis podbijający numer wersji, który może wywołać konflikt klucza unikalnego i zatrzymać skrypt instalacyjny.',
      adrianNote: 'Trik Adriana Wojtkowskiego: „W pierwszym pliku SQL (np. 5.2.1.sql) wycinamy pierwszą linijkę INSERT INTO wersja..., żeby nie wywaliło błędu unikalności lub kolizji, a pozostałe instrukcje DDL (ALTER TABLE, procedury, triggery) się wykonały. Kolejne pliki (5.2.2.sql aż do 5.3.2.sql) bez problemu zaktualizują wersję do wartości docelowej”.',
      substeps: [
        {
          label: '1. Przejście do katalogu serwisowego i utworzenie podkatalogu wersji:',
          cmd: 'cd /home/lab/marcel/service/\nmkdir -p 532_przed_zmianami',
          lang: 'bash'
        },
        {
          label: '2. Rozpakowanie archiwum z nową wersją (skrypty SQL, update.sh, binarne exe):',
          cmd: 'tar -xvf update_centrum_5.3.2.tar.gz -C /home/lab/marcel/service/532_przed_zmianami/',
          lang: 'bash'
        },
        {
          label: '3. Edycja pierwszego pliku SQL i usunięcie pierwszej linijki INSERT INTO wersja (Trik Adriana):',
          cmd: "sed -i '1{/INSERT INTO wersja/d}' /home/lab/marcel/service/532_przed_zmianami/5.2.1.sql",
          lang: 'bash'
        },
        {
          label: '4. Weryfikacja pierwszych linii pliku SQL po modyfikacji:',
          cmd: 'head -n 5 /home/lab/marcel/service/532_przed_zmianami/5.2.1.sql',
          lang: 'bash'
        },
        {
          label: '5. Ocena wyniku:',
          bullets: [
            '• Upewnij się, że polecenie <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">head -n 5</span> nie pokazuje wpisu <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">INSERT INTO wersja</span> na samej górze pliku.',
            '• Kolejne pliki migracyjne (5.2.2.sql ➔ 5.3.2.sql) <strong style="color: #ffffff;">➔ Prawidłowo i automatycznie zaktualizują tabelę wersja do stanu docelowego.</strong>'
          ]
        }
      ],
      commands: [
        {
          label: 'Przejście do katalogu serwisowego i utworzenie podkatalogu wersji',
          cmd: 'cd /home/lab/marcel/service/\nmkdir -p 532_przed_zmianami',
          lang: 'bash'
        },
        {
          label: 'Rozpakowanie archiwum z nową wersją (skrypty SQL, update.sh, binarne exe)',
          cmd: 'tar -xvf update_centrum_5.3.2.tar.gz -C /home/lab/marcel/service/532_przed_zmianami/',
          lang: 'bash'
        },
        {
          label: 'Edycja pierwszego pliku SQL i usunięcie pierwszej linijki INSERT INTO wersja',
          cmd: "sed -i '1{/INSERT INTO wersja/d}' /home/lab/marcel/service/532_przed_zmianami/5.2.1.sql",
          lang: 'bash'
        },
        {
          label: 'Weryfikacja pierwszych linii pliku SQL po modyfikacji',
          cmd: 'head -n 5 /home/lab/marcel/service/532_przed_zmianami/5.2.1.sql',
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Katalog roboczy utworzony w /home/lab/marcel/service/',
        'Paczka aktualizacyjna poprawnie rozpakowana i zweryfikowana pod kątem uprawnień',
        'Zlokalizowano pierwszy plik SQL z łańcucha migracyjnego (np. 5.2.1.sql)',
        'Wycięto pierwszą linijkę INSERT INTO wersja z pierwszego pliku SQL'
      ]
    },
    {
      id: 'step_3',
      number: '3',
      title: 'Wykonanie skryptu aktualizacyjnego (update.sh)',
      titleFormatted: 'Wykonanie Skryptu Aktualizacyjnego <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">update.sh</span>',
      badge: 'Database Migration',
      badgeColor: '#3a86ff',
      estimatedTime: '5-15 min',
      summary: 'Uruchomienie skryptu update.sh, który sekwencyjnie wykonuje wszystkie pliki SQL na bazie centrum i rejestruje logi.',
      descriptionHtml: 'Skrypt <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">update.sh</span> aplikuje zmiany w strukturze tabel, nowe indeksy, funkcje PL/pgSQL oraz konwersje danych medycznych w bazie danych <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">centrum</span>.',
      why: 'Skrypt update.sh aplikuje zmiany w strukturze tabel, nowe indeksy, funkcje PL/pgSQL oraz konwersje danych medycznych.',
      adrianNote: 'Zawsze obserwuj wyjście terminala podczas działania update.sh. Jeśli skrypt zatrzyma się z błędem, sprawdź numer linii w pliku SQL. Dzięki wcześniejszemu wycięciu kolizyjnego INSERT-a do tabeli wersja skrypt przechodzi gładko.',
      substeps: [
        {
          label: '1. Nadanie uprawnień do wykonania i start skryptu aktualizacji:',
          cmd: 'cd /home/lab/marcel/service/532_przed_zmianami/\nchmod +x update.sh\n./update.sh',
          lang: 'bash'
        },
        {
          label: '2. Podgląd logów aktualizacji w czasie rzeczywistym:',
          cmd: 'tail -f update.log',
          lang: 'bash'
        },
        {
          label: '3. Weryfikacja aktualnej wersji zarejestrowanej w bazie danych centrum:',
          cmd: "psql -U postgres -d centrum -c \"SELECT * FROM wersja ORDER BY data DESC LIMIT 5;\"",
          lang: 'bash'
        },
        {
          label: '4. Ocena wyniku:',
          bullets: [
            '• Brak błędów krytycznych (<span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">FATAL</span>, <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">ERROR: relation does not exist</span>) w strumieniu wyjścia <strong style="color: #ffffff;">➔ Logi są czyste.</strong>',
            '• Tabela <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">wersja</span> wskazuje nową, docelową wersję oprogramowania LIS (np. <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">5.3.2</span>).'
          ]
        }
      ],
      commands: [
        {
          label: 'Nadanie uprawnień do wykonania i start skryptu aktualizacji',
          cmd: 'cd /home/lab/marcel/service/532_przed_zmianami/\nchmod +x update.sh\n./update.sh',
          lang: 'bash'
        },
        {
          label: 'Podgląd logów aktualizacji w czasie rzeczywistym (jeśli tworzony jest plik log)',
          cmd: 'tail -f update.log',
          lang: 'bash'
        },
        {
          label: 'Weryfikacja aktualnej wersji zarejestrowanej w bazie danych centrum',
          cmd: "psql -U postgres -d centrum -c \"SELECT * FROM wersja ORDER BY data DESC LIMIT 5;\"",
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Skrypt update.sh uruchomiony z katalogu serwisowego',
        'Brak błędów krytycznych (FATAL, ERROR: relation does not exist) w logu',
        'Tabela wersja wskazuje docelowy numer wydania (np. 5.3.2)'
      ]
    },
    {
      id: 'step_4',
      number: '4',
      title: 'Wymiana centrum.exe, uprawnienia i podpisanie licencji (Wine / kgp.exe)',
      titleFormatted: 'Wymiana <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">centrum.exe</span>, Uprawnienia i Podpisanie Licencji (Wine / kgp.exe)',
      badge: 'Binary & License Bit',
      badgeColor: '#8338ec',
      estimatedTime: '5 min',
      summary: 'Podmiana pliku centrum.exe, nadanie uprawnień lab:users (755) oraz aktywacja binarnego bitu licencji za pomocą Wine i kgp.exe.',
      descriptionHtml: 'Plik <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">centrum.exe</span> jest binarką Windows uruchamianą na serwerze i udostępnianą stacjom roboczym. Bez aktywacji bitu licencyjnego przez <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">kgp.exe -a</span> aplikacja blokuje użytkowników (tzw. ekran „czerwonej czaszki” / brak licencji).',
      why: 'Plik centrum.exe jest binarką Windows uruchamianą na serwerze i udostępnianą stacjom. Bez aktywacji bitu licencyjnego przez kgp.exe -a aplikacja blokuje użytkowników (tzw. ekran „czerwonej czaszki” / brak licencji).',
      adrianNote: 'Adrian Wojtkowski tłumaczy: „Program kgp.exe z flagą -a centrum.exe modyfikuje specyficzny bit w nagłówku/kodzie binarki PE pliku wykonywalnego oraz aktualizuje skojarzony plik .key. Bez uruchomienia tego przez Wine, centrum.exe nie odpali się u klientów i zgłosi błąd braku autoryzacji licencji”.',
      substeps: [
        {
          label: '1. Skopiowanie nowego centrum.exe do katalogu produkcyjnego:',
          cmd: 'cp /home/lab/marcel/service/532_przed_zmianami/centrum.exe /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: '2. Ustawienie prawidłowego właściciela i grupy (lab:users):',
          cmd: 'chown lab:users /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: '3. Nadanie uprawnień do uruchomienia (rwxr-xr-x):',
          cmd: 'chmod 755 /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: '4. Podpisanie licencji i aktywacja bitu PE za pomocą Wine (Kluczowy krok Adriana!):',
          cmd: 'cd /home/lab/marcel/\nwine kgp.exe -a centrum.exe',
          lang: 'bash'
        },
        {
          label: '5. Sprawdzenie daty modyfikacji i sumy kontrolnej centrum.exe oraz pliku .key:',
          cmd: 'ls -la /home/lab/marcel/centrum.exe /home/lab/marcel/*.key',
          lang: 'bash'
        },
        {
          label: '6. Ocena wyniku:',
          bullets: [
            '• Komenda <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">wine kgp.exe -a centrum.exe</span> zakończyła się sukcesem bez błędów konsoli Wine.',
            '• Plik <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">centrum.exe</span> oraz powiązany plik <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">.key</span> <strong style="color: #ffffff;">➔ Mają świeży znacznik czasu modyfikacji.</strong>'
          ]
        }
      ],
      commands: [
        {
          label: 'Skopiowanie nowego centrum.exe do katalogu docelowego',
          cmd: 'cp /home/lab/marcel/service/532_przed_zmianami/centrum.exe /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: 'Ustawienie prawidłowego właściciela i grupy (lab:users)',
          cmd: 'chown lab:users /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: 'Nadanie uprawnień do uruchomienia (rwxr-xr-x)',
          cmd: 'chmod 755 /home/lab/marcel/centrum.exe',
          lang: 'bash'
        },
        {
          label: 'Podpisanie licencji i aktywacja bitu PE za pomocą Wine (Kluczowy krok Adriana!)',
          cmd: 'cd /home/lab/marcel/\nwine kgp.exe -a centrum.exe',
          lang: 'bash'
        },
        {
          label: 'Sprawdzenie daty modyfikacji i sumy kontrolnej centrum.exe oraz pliku .key',
          cmd: 'ls -la /home/lab/marcel/centrum.exe /home/lab/marcel/*.key',
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Nowy plik centrum.exe skopiowany do /home/lab/marcel/',
        'Właściciel ustawiony na lab:users (lub lab:user zgodnie ze środowiskiem)',
        'Prawa pliku ustawione na 755',
        'Wykonano komendę wine kgp.exe -a centrum.exe bez błędów',
        'Plik .key został zaktualizowany'
      ]
    },
    {
      id: 'step_5',
      number: '5',
      title: 'Obsługa serwerów satelitarnych Alab (RDP & serwer CZA marcele.pl)',
      titleFormatted: 'Obsługa Serwerów Satelitarnych Alab (RDP & Serwer CZA <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">marcele.pl</span>)',
      badge: 'Alab Satellite Topology',
      badgeColor: '#00b4d8',
      estimatedTime: '10-15 min',
      summary: 'Procedura dla serwerów terminalowych RDP (Debian) oraz serwerów CZA (marcele.pl dla mikroskopistów zdalnych), które nie posiadają zainstalowanego Wine.',
      descriptionHtml: 'Serwery terminalowe Alab pracują na czystym Debianie bez zainstalowanego Wine. Nie można na nich bezpośrednio uruchomić <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">kgp.exe -a</span>, dlatego klucz przenosi się na maszynę Gentoo.',
      why: 'Serwery terminalowe Alab pracują na czystym Debianie bez zainstalowanego Wine. Nie można na nich bezpośrednio uruchomić kgp.exe -a.',
      adrianNote: 'Workflow Adriana dla Alab: 1. Pobieramy plik klucza .key z serwera Debian na główny serwer bazodanowy Gentoo (gdzie jest Wine). 2. Na serwerze Gentoo odpalamy wine kgp.exe -a centrum.exe z pobranym kluczem. 3. Odsyłamy podpisany centrum.exe oraz zaktualizowany .key z powrotem na serwer RDP/CZA. 4. Nadajemy chown lab:users i chmod 755.',
      substeps: [
        {
          label: '1. Pobranie pliku .key z serwera RDP (Debian) na serwer Gentoo (z Wine):',
          cmd: 'scp lab@rdp-server:/home/lab/marcel/*.key /home/lab/marcel/satellite_keys/',
          lang: 'bash'
        },
        {
          label: '2. Podpisanie binarki centrum.exe z kluczem satelity na serwerze Gentoo:',
          cmd: 'cd /home/lab/marcel/satellite_keys/\ncp /home/lab/marcel/service/532_przed_zmianami/centrum.exe .\nwine ../kgp.exe -a centrum.exe',
          lang: 'bash'
        },
        {
          label: '3. Odesłanie podpisanego centrum.exe i zaktualizowanego klucza na RDP / CZA:',
          cmd: 'scp centrum.exe *.key lab@rdp-server:/home/lab/marcel/\n# Dla serwera CZA (marcele.pl):\nscp centrum.exe *.key lab@cza.marcele.pl:/home/lab/marcel/',
          lang: 'bash'
        },
        {
          label: '4. Ustawienie uprawnień na serwerze docelowym RDP/CZA:',
          cmd: 'ssh lab@rdp-server "chown lab:users /home/lab/marcel/centrum.exe && chmod 755 /home/lab/marcel/centrum.exe"',
          lang: 'bash'
        },
        {
          label: '5. Ocena wyniku:',
          bullets: [
            '• Plik licencyjny <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">.key</span> oraz podpisany <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">centrum.exe</span> znajdują się na maszynie RDP i CZA z prawami <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">755</span>.',
            '• Zdalni pracownicy i mikroskopiści <strong style="color: #ffffff;">➔ Mogą zalogować się do systemu bez blokady licencji.</strong>'
          ]
        }
      ],
      commands: [
        {
          label: 'Krok 5.1: Pobranie pliku .key z serwera RDP (Debian) na serwer Gentoo (z Wine)',
          cmd: 'scp lab@rdp-server:/home/lab/marcel/*.key /home/lab/marcel/satellite_keys/',
          lang: 'bash'
        },
        {
          label: 'Krok 5.2: Podpisanie binarki centrum.exe z kluczem satelity na serwerze Gentoo',
          cmd: 'cd /home/lab/marcel/satellite_keys/\ncp /home/lab/marcel/service/532_przed_zmianami/centrum.exe .\nwine ../kgp.exe -a centrum.exe',
          lang: 'bash'
        },
        {
          label: 'Krok 5.3: Odesłanie podpisanego centrum.exe i zaktualizowanego klucza na RDP / CZA',
          cmd: 'scp centrum.exe *.key lab@rdp-server:/home/lab/marcel/\n# Dla serwera CZA (marcele.pl):\nscp centrum.exe *.key lab@cza.marcele.pl:/home/lab/marcel/',
          lang: 'bash'
        },
        {
          label: 'Krok 5.4: Ustawienie uprawnień na serwerze docelowym RDP/CZA',
          cmd: 'ssh lab@rdp-server "chown lab:users /home/lab/marcel/centrum.exe && chmod 755 /home/lab/marcel/centrum.exe"',
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Zidentyfikowano czy dane wdrożenie posiada serwer RDP lub satelitę CZA (marcele.pl)',
        'Plik klucza .key został bezpiecznie przetransferowany na maszynę z Wine',
        'Podpisano binarkę centrum.exe dla środowiska satelitarnego',
        'Pliki odesłane i zweryfikowano uprawnienia lab:users 755 na maszynie docelowej'
      ]
    },
    {
      id: 'step_6',
      number: '6',
      title: 'Czyszczenie powdrożeniowe, weryfikacja i dokumentacja Jira',
      titleFormatted: 'Czyszczenie Powdrożeniowe, Weryfikacja i Dokumentacja <span style="background: #2a2215; color: #e3b341; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; font-weight: 600;">Jira</span>',
      badge: 'Post-Deploy & Audit',
      badgeColor: '#06d6a0',
      estimatedTime: '5 min',
      summary: 'Usunięcie skryptów instalacyjnych i kgp.exe z katalogu produkcyjnego klienta, wznowienie usług peryferyjnych oraz wpis audytowy w zgłoszeniu Jira.',
      descriptionHtml: 'Pozostawienie narzędzia <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">kgp.exe</span> (key generator) oraz skryptów <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">update.sh</span> w katalogu produkcyjnym stwarza ryzyko naruszenia bezpieczeństwa oraz przypadkowego ponownego uruchomienia.',
      why: 'Pozostawienie narzędzia kgp.exe (key generator) oraz skryptów update.sh w katalogu produkcyjnym stwarza ryzyko naruszenia bezpieczeństwa oraz przypadkowego ponownego uruchomienia.',
      adrianNote: 'Adrian Wojtkowski zaznacza: po zakończeniu zawsze usuwamy ze środowiska klienta plik kgp.exe oraz update.sh. Klient nie powinien mieć dostępu do generatora licencji. Następnie uruchamiamy klienta z jednego stanowiska testowego i dokumentujemy wersję w tickecie.',
      substeps: [
        {
          label: '1. Usunięcie skryptów instalacyjnych i kgp.exe z katalogu roboczego klienta:',
          cmd: 'cd /home/lab/marcel/\nrm -f kgp.exe update.sh\n# Archiwizacja katalogu serwisowego (opcjonalnie z zabezpieczeniem uprawnień)\nchmod 700 /home/lab/marcel/service/532_przed_zmianami',
          lang: 'bash'
        },
        {
          label: '2. Wznowienie usług peryferyjnych (jeśli były wstrzymywane):',
          cmd: 'systemctl start smbd nmbd\n/etc/init.d/vnc restart # na Gentoo\n# Sprawdzenie kontenerów LXC:\nlxc-ls -f',
          lang: 'bash'
        },
        {
          label: '3. Testowe uruchomienie klienta Centrum ze stacji roboczej lub sesji VNC:',
          cmd: '# Logowanie użytkownika: lab / weryfikacja czy nie pojawia się komunikat braku licencji',
          lang: 'bash'
        },
        {
          label: '4. Ocena wyniku i audyt:',
          bullets: [
            '• Plik <span style="background: #2a2215; color: #e3b341; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">kgp.exe</span> <strong style="color: #ffffff;">➔ Bezwzględnie usunięty z katalogu produkcyjnego klienta.</strong>',
            '• Usługi peryferyjne (Samba, Mirth, VNC) <strong style="color: #ffffff;">➔ Pracują w stanie aktywnym.</strong>',
            '• Zgłoszenie Jira <strong style="color: #ffffff;">➔ Zaktualizowane o numer wersji, datę i czas przestoju (Downtime).</strong>'
          ]
        }
      ],
      commands: [
        {
          label: 'Usunięcie skryptów instalacyjnych i kgp.exe z katalogu roboczego klienta',
          cmd: 'cd /home/lab/marcel/\nrm -f kgp.exe update.sh\n# Archiwizacja katalogu serwisowego (opcjonalnie z zabezpieczeniem uprawnień)\nchmod 700 /home/lab/marcel/service/532_przed_zmianami',
          lang: 'bash'
        },
        {
          label: 'Wznowienie usług peryferyjnych (jeśli były wstrzymywane)',
          cmd: 'systemctl start smbd nmbd\n/etc/init.d/vnc restart # na Gentoo\n# Sprawdzenie kontenerów LXC:\nlxc-ls -f',
          lang: 'bash'
        },
        {
          label: 'Testowe uruchomienie klienta Centrum ze stacji roboczej lub sesji VNC',
          cmd: '# Logowanie użytkownika: lab / weryfikacja czy nie pojawia się komunikat braku licencji',
          lang: 'bash'
        }
      ],
      checklistItems: [
        'Plik kgp.exe bezwzględnie usunięty z katalogu klienta',
        'Pliki update.sh usunięte lub przeniesione do zabezpieczonego archiwum',
        'Usługi peryferyjne (Samba, Mirth, VNC) pracują w stanie aktywnym',
        'Potwierdzono poprawne uruchomienie klienta Centrum ze stacji roboczej',
        'Zgłoszenie Jira zaktualizowane o numer wersji, datę i czas przestoju'
      ]
    }
  ];

  /**
   * Baza Komend Ściągawki Terminalowej (Z filtrowaniem i 1-Click Copy)
   */
  const TERMINAL_COMMANDS = [
    {
      id: 'cmd_gentoo_rc_status',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Weryfikacja uruchomionych procesów i usług (OpenRC Gentoo)',
      cmd: 'rc-status',
      shell: 'bash (root)',
      explanation: 'Podstawowe sprawdzenie usług systemowych przed zalogowaniem do bazy danych (wskazówka Adriana Wojtkowskiego).'
    },
    {
      id: 'cmd_psql_check',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Weryfikacja braku aktywnych sesji bazy centrum (Musi dać: (0 rows))',
      cmd: "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';",
      shell: 'psql -U postgres',
      explanation: 'Dokładna komenda używana przez Adriana Wojtkowskiego. Szybki rzut oka na terminal: (0 rows) oznacza pełne bezpieczeństwo migracji DDL.'
    },
    {
      id: 'cmd_psql_inline',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Jednolinijkowe sprawdzenie sesji z poziomu powłoki Bash',
      cmd: "psql -U postgres -c \"SELECT * FROM pg_stat_activity WHERE datname = 'centrum';\"",
      shell: 'bash',
      explanation: 'Wywołanie zapytania bezpośrednio z konsoli Linuksa bez konieczności wchodzenia do interaktywnego psql.'
    },
    {
      id: 'cmd_gentoo_stop',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Zatrzymanie usługi PostgreSQL na Gentoo Linux (OpenRC)',
      cmd: '/etc/init.d/postgresql-11 stop',
      shell: 'bash (root)',
      explanation: 'Zatrzymanie procesu PostgreSQL przed aktualizacją w celu odcięcia wiszących klientów.'
    },
    {
      id: 'cmd_systemd_stop',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Zatrzymanie usługi PostgreSQL na Debian / Ubuntu (systemd)',
      cmd: 'systemctl stop postgresql',
      shell: 'bash (root)',
      explanation: 'Zatrzymanie demona bazy PostgreSQL w środowiskach Debian/Ubuntu.'
    },
    {
      id: 'cmd_psql_kill_sessions',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Wymuszone natychmiastowe zrzucenie wiszących połączeń bazy centrum (SQL)',
      cmd: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'centrum' AND pid <> pg_backend_pid();",
      shell: 'psql -U postgres',
      explanation: 'Zabija aktywne połączenia klientów do bazy centrum bez konieczności zatrzymywania całego klastra bazodanowego.'
    },
    {
      id: 'cmd_gentoo_start',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Uruchomienie usługi PostgreSQL na Gentoo Linux (OpenRC)',
      cmd: '/etc/init.d/postgresql-11 start',
      shell: 'bash (root)',
      explanation: 'Uruchomienie procesu PostgreSQL po zrzuceniu sesji.'
    },
    {
      id: 'cmd_systemd_start',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Uruchomienie usługi PostgreSQL na Debian / Ubuntu (systemd)',
      cmd: 'systemctl start postgresql',
      shell: 'bash (root)',
      explanation: 'Uruchomienie usługi bazy danych na serwerach Debian/Ubuntu.'
    },
    {
      id: 'cmd_gentoo_restart',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Restart PostgreSQL na Gentoo Linux (OpenRC)',
      cmd: '/etc/init.d/postgresql-11 restart',
      shell: 'bash (root)',
      explanation: 'Standardowy skrypt startowy OpenRC na serwerach Gentoo stosowanych w laboratoriach.'
    },
    {
      id: 'cmd_gentoo_status',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Status usługi PostgreSQL na Gentoo (OpenRC)',
      cmd: '/etc/init.d/postgresql-11 status',
      shell: 'bash (root)',
      explanation: 'Weryfikacja czy daemon bazy danych pracuje poprawnie po restarcie.'
    },
    {
      id: 'cmd_systemd_restart',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Restart PostgreSQL na Debian / Ubuntu (systemd)',
      cmd: 'systemctl restart postgresql',
      shell: 'bash (root)',
      explanation: 'Komenda restartu daemona PostgreSQL na serwerach zarządzanych przez systemd.'
    },
    {
      id: 'cmd_systemd_status',
      category: '1. Diagnostyka Sesji & Restart PostgreSQL',
      title: 'Status usługi PostgreSQL na Debianie (systemd)',
      cmd: 'systemctl status postgresql --no-pager',
      shell: 'bash',
      explanation: 'Podgląd stanu procesu i ostatnich logów startowych usługi.'
    },
    {
      id: 'cmd_mkdir_service',
      category: '2. Katalogi Robocze & Uprawnienia',
      title: 'Utworzenie katalogu nowej wersji w strukturze Marcela',
      cmd: 'mkdir -p /home/lab/marcel/service/532_przed_zmianami && cd /home/lab/marcel/service/532_przed_zmianami',
      shell: 'bash',
      explanation: 'Standardowa ścieżka serwisowa w instalacjach LIS Marcel.'
    },
    {
      id: 'cmd_sed_wersja',
      category: '2. Katalogi Robocze & Uprawnienia',
      title: 'Trik z wycięciem INSERT INTO wersja z pierwszego pliku SQL',
      cmd: "sed -i '1{/INSERT INTO wersja/d}' 5.2.1.sql",
      shell: 'bash',
      explanation: 'Usuwa kolizyjny wpis wersji z pierwszej linii pierwszego skryptu SQL, zapobiegając przerwaniu update.sh.'
    },
    {
      id: 'cmd_chown_lab',
      category: '2. Katalogi Robocze & Uprawnienia',
      title: 'Ustawienie uprawnień właściciela lab:users dla centrum.exe',
      cmd: 'chown lab:users /home/lab/marcel/centrum.exe',
      shell: 'bash (root)',
      explanation: 'Aplikacja centrum.exe musi należeć do użytkownika i grupy lab:users, aby stacje robocze miały do niej dostęp.'
    },
    {
      id: 'cmd_chmod_exe',
      category: '2. Katalogi Robocze & Uprawnienia',
      title: 'Nadanie uprawnień wykonywalności 755 (rwxr-xr-x)',
      cmd: 'chmod 755 /home/lab/marcel/centrum.exe',
      shell: 'bash',
      explanation: 'Wymagane do uruchomienia binarki przez klientów i środowisko Wine.'
    },
    {
      id: 'cmd_wine_sign',
      category: '3. Podpisywanie Binarki Wine (kgp.exe)',
      title: 'Podpisanie licencji i aktywacja binarnego bitu PE (Kluczowe!)',
      cmd: 'cd /home/lab/marcel/ && wine kgp.exe -a centrum.exe',
      shell: 'bash (użytkownik lab)',
      explanation: 'Modyfikuje bit w PE header centrum.exe oraz aktualizuje plik .key. Eliminuje ekran „czerwonej czaszki”.'
    },
    {
      id: 'cmd_wine_ver',
      category: '3. Podpisywanie Binarki Wine (kgp.exe)',
      title: 'Sprawdzenie obecności i wersji Wine w systemie',
      cmd: 'wine --version',
      shell: 'bash',
      explanation: 'Weryfikuje czy na serwerze dostępne jest środowisko Wine do uruchomienia kgp.exe.'
    },
    {
      id: 'cmd_scp_get_key',
      category: '4. Kopiowanie Satelickie (RDP & CZA marcele.pl)',
      title: 'Pobranie pliku .key z serwera Debian (RDP) na serwer Gentoo (Wine)',
      cmd: 'scp lab@rdp-server:/home/lab/marcel/*.key /home/lab/marcel/satellite_keys/',
      shell: 'bash (na maszynie Gentoo)',
      explanation: 'Używane gdy serwer RDP pracuje na czystym Debianie bez Wine — klucz podpisujemy na maszynie z Wine.'
    },
    {
      id: 'cmd_scp_send_back',
      category: '4. Kopiowanie Satelickie (RDP & CZA marcele.pl)',
      title: 'Odesłanie podpisanego centrum.exe oraz .key na serwer RDP / CZA',
      cmd: 'scp centrum.exe *.key lab@rdp-server:/home/lab/marcel/\nscp centrum.exe *.key lab@cza.marcele.pl:/home/lab/marcel/',
      shell: 'bash',
      explanation: 'Przesłanie gotowej, podpisanej binarki na serwer terminalowy RDP i serwer telepatologii CZA.'
    },
    {
      id: 'cmd_pg_dump_shrink',
      category: '5. PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB)',
      title: 'Pełny zrzut logiczny (pg_dump format custom) przed przebudową bazy',
      cmd: 'pg_dump -U postgres -Fc -d centrum -f /backup/centrum_$(date +%F_%H%M).dump',
      shell: 'bash',
      explanation: 'Metoda Adriana na drastyczną redukcję dead tuples po archiwizacji: czysty eksport danych logicznych.'
    },
    {
      id: 'cmd_pg_restore_shrink',
      category: '5. PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB)',
      title: 'Odtworzenie bazy z czystego zrzutu do świeżej instancji (Kompaktowe tabele i indeksy)',
      cmd: 'createdb -U postgres -O postgres centrum_nowa\npg_restore -U postgres -d centrum_nowa -v /backup/centrum_archived.dump',
      shell: 'bash',
      explanation: 'Nowa baza zajmuje tylko fizycznie potrzebną przestrzeń (np. 300 GB zamiast 1.3 TB zmartwiałych stron).'
    },
    {
      id: 'cmd_pg_size_check',
      category: '5. PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB)',
      title: 'Sprawdzenie fizycznego rozmiaru bazy centrum na dysku',
      cmd: "SELECT pg_size_pretty(pg_database_size('centrum')) AS rozmiar_bazy;",
      shell: 'psql -U postgres',
      explanation: 'Wyświetla czytelny rozmiar bazy danych (np. 450 GB).'
    },
    {
      id: 'cmd_vacuum_full',
      category: '5. PostgreSQL Bloat & Redukcja Dysku (1.3 TB -> 300 GB)',
      title: 'VACUUM FULL VERBOSE tabeli (Uwaga: blokada ACCESS EXCLUSIVE!)',
      cmd: 'VACUUM FULL VERBOSE zlecenia;',
      shell: 'psql -U postgres -d centrum',
      explanation: 'Przepisuje tabelę na nowo, zwalniając miejsce do systemu operacyjnego. Wymaga wyłącznej blokady i 2x tyle miejsca na dysku.'
    },
    {
      id: 'cmd_mirth_status',
      category: '6. Peryferia Szpitalne (Usługi do Kontroli)',
      title: 'Status silnika integracyjnego Mirth Connect (port HL7 MLLP 2575)',
      cmd: 'systemctl status mirth-connect --no-pager',
      shell: 'bash',
      explanation: 'Mirth Connect odpowiada za przesyłanie zleceń i wyników z analizatorów laboratoryjnych.'
    },
    {
      id: 'cmd_samba_status',
      category: '6. Peryferia Szpitalne (Usługi do Kontroli)',
      title: 'Status udziałów sieciowych Samba (smbd, nmbd)',
      cmd: 'systemctl status smbd nmbd --no-pager',
      shell: 'bash',
      explanation: 'Weryfikacja dostępności zasobów sieciowych Windows dla personelu szpitalnego.'
    },
    {
      id: 'cmd_vnc_gentoo',
      category: '6. Peryferia Szpitalne (Usługi do Kontroli)',
      title: 'Status sesji zdalnych TigerVNC na Gentoo',
      cmd: '/etc/init.d/vnc status',
      shell: 'bash (root)',
      explanation: 'Kontrola serwera pulpitu zdalnego używanego przez diagnostów i techników.'
    },
    {
      id: 'cmd_lxc_list',
      category: '6. Peryferia Szpitalne (Usługi do Kontroli)',
      title: 'Lista i stan kontenerów LXC (np. kontenery a12, elaborat w Alab)',
      cmd: 'lxc-ls -f',
      shell: 'bash (root)',
      explanation: 'Sprawdza czy kontenery aplikacji pomocniczych (a12, elaborat) są uruchomione (RUNNING) czy zatrzymane (STOPPED).'
    },
    {
      id: 'cmd_clean_kgp',
      category: '2. Katalogi Robocze & Uprawnienia',
      title: 'Bezpieczne usunięcie generatora kgp.exe po aktualizacji',
      cmd: 'cd /home/lab/marcel/ && rm -f kgp.exe update.sh',
      shell: 'bash (root)',
      explanation: 'Usuwa narzędzie licencjonowania z katalogu klienta po pomyślnym podpisaniu centrum.exe.'
    }
  ];

  /**
   * Główna funkcja renderująca moduł SOP
   */
  function renderPgUpdateSopModule() {
    const container = document.getElementById('pg-update-sop-container');
    if (!container) return;

    loadChecklistState();

    container.innerHTML = `
      <div class="sre-layout" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Pasek górny: Nawigacja podzakładek & Wskaźnik postępu -->
        <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--accent-cyan);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 1.8rem;">🐘</span>
              <div>
                <h3 style="margin: 0; font-size: 1.25rem;">Standard Operating Procedure (SOP) • PostgreSQL &amp; Centrum</h3>
                <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                  Baza wiedzy i instrukcja produkcyjna: <strong>Adrian Wojtkowski</strong> | Cel: <strong>LIS Marcel / PostgreSQL 11+ (Gentoo &amp; Debian)</strong>
                </div>
              </div>
            </div>

            <!-- Akcje globalne: Zapisz do Runbooków & Reset -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="sop-save-runbook-btn" title="Zapisz ten SOP jako procedurę w Bazie Runbooków">
                💾 Zapisz do Bazy Runbooków
              </button>
              <button class="btn btn-secondary btn-sm" id="sop-reset-checklist-btn" title="Zresetuj odznaczone kroki checklisty">
                🔄 Resetuj Checklistę
              </button>
            </div>
          </div>

          <!-- Pasek postępu kroków SOP -->
          <div style="margin-top: 14px; background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); padding: 10px 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px;">
              <span>Postęp realizacji procedury:</span>
              <strong id="sop-progress-label">0 / 6 kroków (0%)</strong>
            </div>
            <div style="height: 8px; background: var(--bg-primary); border-radius: 4px; overflow: hidden;">
              <div id="sop-progress-bar" style="height: 100%; width: 0%; background: var(--accent-teal); transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Zakładki wewnętrzne modułu -->
          <div style="display: flex; gap: 8px; margin-top: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; overflow-x: auto;">
            <button class="btn btn-sm ${sopState.activeSubTab === 'procedure' ? 'btn-primary' : 'btn-secondary'}" data-sop-subtab="procedure">
              📋 1. Pełna Procedura Krok po Kroku (SOP)
            </button>
            <button class="btn btn-sm ${sopState.activeSubTab === 'cheatsheet' ? 'btn-primary' : 'btn-secondary'}" data-sop-subtab="cheatsheet">
              ⚡ 2. Ściągawka Terminalowa (Cheat Sheet)
            </button>
            <button class="btn btn-sm ${sopState.activeSubTab === 'bloat' ? 'btn-primary' : 'btn-secondary'}" data-sop-subtab="bloat">
              🗄️ 3. PostgreSQL Bloat &amp; Redukcja Dysku (1.3 TB ➔ 300 GB)
            </button>
            <button class="btn btn-sm ${sopState.activeSubTab === 'peripherals' ? 'btn-primary' : 'btn-secondary'}" data-sop-subtab="peripherals">
              🛡️ 4. Peryferia Szpitalne (Usługi do Zatrzymania)
            </button>
            <button class="btn btn-sm ${sopState.activeSubTab === 'sandbox' ? 'btn-primary' : 'btn-secondary'}" data-sop-subtab="sandbox">
              🧪 5. Laboratorium SRE (Sandbox Docker &amp; WSL2)
            </button>
          </div>
        </div>

        <!-- Główna zawartość wybranej podzakładki -->
        <div id="sop-subtab-content"></div>

      </div>
    `;

    bindHeaderEvents();
    renderActiveSubTab();
    updateProgressUI();
  }

  function bindHeaderEvents() {
    const container = document.getElementById('pg-update-sop-container');
    if (!container) return;

    // Przełączanie podzakładek
    container.querySelectorAll('[data-sop-subtab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-sop-subtab');
        if (target) {
          sopState.activeSubTab = target;
          container.querySelectorAll('[data-sop-subtab]').forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
          });
          e.currentTarget.classList.remove('btn-secondary');
          e.currentTarget.classList.add('btn-primary');
          renderActiveSubTab();
        }
      });
    });

    // Reset checklisty
    const resetBtn = document.getElementById('sop-reset-checklist-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz zresetować stan checklisty aktualizacji PostgreSQL?')) {
          sopState.completedSteps = {};
          saveChecklistState();
          renderActiveSubTab();
          updateProgressUI();
          showToast('Zresetowano stan checklisty SOP.', 'info');
        }
      });
    }

    // Zapis do bazy runbooków
    const saveRunbookBtn = document.getElementById('sop-save-runbook-btn');
    if (saveRunbookBtn) {
      saveRunbookBtn.addEventListener('click', () => {
        savePgUpdateRunbookUI();
      });
    }
  }

  function updateProgressUI() {
    const totalSteps = SOP_STEPS.length;
    let completedCount = 0;

    SOP_STEPS.forEach(step => {
      if (sopState.completedSteps[step.id]) {
        completedCount++;
      }
    });

    const percent = Math.round((completedCount / totalSteps) * 100);

    const label = document.getElementById('sop-progress-label');
    if (label) {
      label.textContent = `${completedCount} / ${totalSteps} kroków (${percent}%)`;
    }

    const bar = document.getElementById('sop-progress-bar');
    if (bar) {
      bar.style.width = `${percent}%`;
      bar.style.backgroundColor = percent === 100 ? '#06d6a0' : (percent > 50 ? '#3a86ff' : '#00b4d8');
    }
  }

  function renderActiveSubTab() {
    const content = document.getElementById('sop-subtab-content');
    if (!content) return;

    if (sopState.activeSubTab === 'procedure') {
      renderProcedureTab(content);
    } else if (sopState.activeSubTab === 'cheatsheet') {
      renderCheatsheetTab(content);
    } else if (sopState.activeSubTab === 'bloat') {
      renderBloatTab(content);
    } else if (sopState.activeSubTab === 'peripherals') {
      renderPeripheralsTab(content);
    } else if (sopState.activeSubTab === 'sandbox') {
      renderSandboxTab(content);
    }
  }

  /**
   * Pomocnik renderujący nowoczesny blok kodu w stylu IDE / dokumentacji technicznej
   */
  /**
   * Pomocnik renderujący nowoczesny blok kodu w stylu IDE / dokumentacji technicznej (zgodny 1:1 ze zrzutem)
   */
  function renderCodeBox(cmdId, label, cmd, lang) {
    const langLabel = (lang === 'sql') ? 'sql' : 'bash';
    return `
      <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin: 8px 0 16px 0; overflow: hidden;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px 4px 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.82rem; color: #8b949e;">
          <span>${langLabel}</span>
          <button onclick="window.copyPgSopText('${cmdId}')" style="background: transparent; border: none; color: #8b949e; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 0.85rem; padding: 2px 4px; border-radius: 4px; transition: color 0.15s ease;" title="Kopiuj polecenie" onmouseover="this.style.color='#f0f6fc'" onmouseout="this.style.color='#8b949e'">
            <span style="opacity: 0.7; font-size: 0.8rem;">@</span> 📋
          </button>
        </div>
        <pre style="margin: 0; padding: 4px 16px 14px 16px; background: transparent; overflow-x: auto;"><code id="${cmdId}" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.92rem; line-height: 1.5; color: #e6edf3; white-space: pre;">${highlightCode(cmd, langLabel)}</code></pre>
      </div>
    `;
  }

  /**
   * Renderowanie podpunktów i komend kroku SOP (czysty układ zgodny ze zrzutem ekranu)
   */
  function renderStepSubsteps(step) {
    if (!step.substeps || step.substeps.length === 0) {
      return step.commands.map((c, idx) => {
        const cmdId = `sop-cmd-${step.id}-${idx}`;
        return renderCodeBox(cmdId, c.label, c.cmd, c.lang || 'bash');
      }).join('');
    }

    let html = '';
    step.substeps.forEach((sub, sIdx) => {
      if (sub.bullets) {
        html += `
          <div style="margin-top: 18px; margin-bottom: 16px;">
            <div style="font-size: 0.95rem; font-weight: 600; color: #f0f6fc; margin-bottom: 8px;">
              ${escapeHtml(sub.label)}
            </div>
            <ul style="margin: 6px 0 0 0; padding-left: 20px; list-style-type: none; color: #c9d1d9; font-size: 0.92rem; line-height: 1.6;">
              ${sub.bullets.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}
            </ul>
          </div>
        `;
      } else if (sub.items) {
        html += `
          <div style="margin-top: 18px; margin-bottom: 16px;">
            <div style="font-size: 0.95rem; font-weight: 600; color: #f0f6fc; margin-bottom: 8px;">
              ${escapeHtml(sub.label)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${sub.items.map((it, iIdx) => {
                const cmdId = `sop-cmd-${step.id}-s${sIdx}-i${iIdx}`;
                return `
                  <div>
                    ${it.sublabel ? `<div style="font-size: 0.85rem; color: #8b949e; margin: 6px 0 4px 0; font-weight: 500;">${escapeHtml(it.sublabel)}</div>` : ''}
                    ${renderCodeBox(cmdId, '', it.cmd, it.lang || 'bash')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else if (sub.cmd) {
        const cmdId = `sop-cmd-${step.id}-s${sIdx}`;
        html += `
          <div style="margin-top: 18px; margin-bottom: 8px;">
            <div style="font-size: 0.95rem; font-weight: 600; color: #f0f6fc; margin-bottom: 8px;">
              ${sub.label}
            </div>
            ${renderCodeBox(cmdId, '', sub.cmd, sub.lang || 'bash')}
          </div>
        `;
      }
    });

    return html;
  }

  /**
   * 1. PODZAKŁADKA: PROCEDURA KROK PO KROKU (Styl dokumentacji 1:1 ze zrzutem ekranu)
   */
  function renderProcedureTab(container) {
    let stepsHtml = '';

    SOP_STEPS.forEach(step => {
      const isDone = !!sopState.completedSteps[step.id];

      // Punkty kontrolne
      let checklistHtml = '';
      step.checklistItems.forEach((item, itemIdx) => {
        const itemKey = `${step.id}_item_${itemIdx}`;
        const itemChecked = !!sopState.completedSteps[itemKey];
        checklistHtml += `
          <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; cursor: pointer; font-size: 0.86rem;">
            <input type="checkbox" data-sop-item-key="${itemKey}" data-sop-step-id="${step.id}" ${itemChecked ? 'checked' : ''} style="margin-top: 3px; cursor: pointer;">
            <span style="${itemChecked ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: #c9d1d9;'}">${escapeHtml(item)}</span>
          </label>
        `;
      });

      stepsHtml += `
        <div style="margin-bottom: 36px;">
          
          <!-- Nagłówek kroku: KROK N: Tytuł -->
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.18rem; font-weight: 700; color: #f0f6fc; letter-spacing: -0.01em;">
              KROK ${step.number}: ${step.titleFormatted || escapeHtml(step.title)}
            </h3>

            <!-- Przełącznik zaliczenia kroku -->
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; background: #161b22; padding: 4px 10px; border-radius: 6px; border: 1px solid #30363d; font-size: 0.78rem; font-weight: 500; color: #8b949e;">
              <input type="checkbox" data-sop-step-toggle="${step.id}" ${isDone ? 'checked' : ''} style="cursor: pointer;">
              <span>Krok ${step.number} zaliczony</span>
            </label>
          </div>

          <!-- Opis kroku -->
          <p style="color: #c9d1d9; font-size: 0.92rem; line-height: 1.6; margin: 0 0 16px 0;">
            ${step.descriptionHtml || escapeHtml(step.summary)}
          </p>

          <!-- Podpunkty z boksami kodu -->
          <div style="margin-bottom: 16px;">
            ${renderStepSubsteps(step)}
          </div>

          <!-- Wiedza Adriana & Dlaczego to robimy -->
          <div style="margin: 20px 0; background: rgba(227, 179, 65, 0.06); border-left: 3px solid #e3b341; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 0.88rem; color: #c9d1d9; line-height: 1.5;">
            <strong style="color: #e3b341; display: block; margin-bottom: 4px;">💡 Wiedza Adriana Wojtkowskiego:</strong>
            ${escapeHtml(step.adrianNote)}
          </div>

          <!-- Quality Gates Checklist -->
          <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 18px; margin-top: 18px;">
            <div style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3fb950; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>✅</span> Lista kontrolna jakościowa (Quality Gates):
            </div>
            ${checklistHtml}
          </div>

          <hr style="border: none; border-top: 1px solid #21262d; margin: 36px 0;">

        </div>
      `;
    });

    container.innerHTML = `
      <div style="max-width: 960px; margin: 0 auto; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 1.35rem; font-weight: 700; color: #f0f6fc; margin: 0 0 12px 0; display: flex; align-items: center; gap: 10px;">
            <span>📋</span> Zaktualizowana Procedura Standardowa (SOP): Aktualizacja Bazy PostgreSQL i Centrum
          </h2>
          <div style="font-size: 0.88rem; color: #8b949e; line-height: 1.5;">
            Oficjalny proces aktualizacji schematu bazy danych i aplikacji klienckiej w środowiskach laboratoryjnych i szpitalnych (autor: <strong>Adrian Wojtkowski</strong>). Każdy krok posiada czytelny schemat komend, ocenę wyników oraz bramki jakościowe (Quality Gates).
          </div>
          <hr style="border: none; border-top: 1px solid #21262d; margin: 16px 0 28px 0;">
        </div>
        <div>
          ${stepsHtml}
        </div>
      </div>
    `;

    bindProcedureEvents(container);
  }

  function bindProcedureEvents(container) {
    // Checkbox kroku głównego
    container.querySelectorAll('[data-sop-step-toggle]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const stepId = e.target.getAttribute('data-sop-step-toggle');
        sopState.completedSteps[stepId] = e.target.checked;
        saveChecklistState();
        renderProcedureTab(container);
        updateProgressUI();
        if (e.target.checked) {
          showToast(`Krok oznaczony jako ukończony.`, 'success');
        }
      });
    });

    // Checkbox pojedynczych pozycji checklisty
    container.querySelectorAll('[data-sop-item-key]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const itemKey = e.target.getAttribute('data-sop-item-key');
        const stepId = e.target.getAttribute('data-sop-step-id');
        sopState.completedSteps[itemKey] = e.target.checked;

        // Sprawdź czy wszystkie itemy danego kroku są zaznaczone
        const step = SOP_STEPS.find(s => s.id === stepId);
        if (step) {
          const allItemsDone = step.checklistItems.every((_, idx) => !!sopState.completedSteps[`${stepId}_item_${idx}`]);
          if (allItemsDone) {
            sopState.completedSteps[stepId] = true;
          }
        }

        saveChecklistState();
        renderProcedureTab(container);
        updateProgressUI();
      });
    });
  }

  /**
   * 2. PODZAKŁADKA: ŚCIĄGAWKA TERMINALOWA (CHEAT SHEET)
   */
  function renderCheatsheetTab(container) {
    // Filtrowanie komend
    const query = (sopState.searchQuery || '').toLowerCase().trim();
    const filtered = TERMINAL_COMMANDS.filter(c => {
      if (!query) return true;
      return c.title.toLowerCase().includes(query) ||
             c.cmd.toLowerCase().includes(query) ||
             c.category.toLowerCase().includes(query) ||
             c.explanation.toLowerCase().includes(query);
    });

    // Grupowanie według kategorii
    const categories = {};
    filtered.forEach(cmd => {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    });

    let groupsHtml = '';
    const catKeys = Object.keys(categories);

    if (catKeys.length === 0) {
      groupsHtml = `
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">🔍</div>
          <h4>Nie znaleziono komend dla frazy: „${escapeHtml(sopState.searchQuery)}”</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Spróbuj wpisać inną frazę, np. psql, restart, wine, kgp, scp lub vacuum.</p>
        </div>
      `;
    } else {
      catKeys.forEach(catName => {
        const cmds = categories[catName];
        let itemsHtml = '';

        cmds.forEach(item => {
          itemsHtml += `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                <div>
                  <h5 style="margin: 0; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(item.title)}</h5>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Środowisko: <code style="color: var(--accent-cyan);">${escapeHtml(item.shell)}</code></div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('${item.id}')" style="font-size: 0.8rem; padding: 4px 10px;">
                  📋 Kopiuj
                </button>
              </div>

              <div style="background: #0b1120; border: 1px solid #1e293b; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px;">
                <pre style="margin: 0; background: transparent; padding: 0; overflow-x: auto;"><code id="${item.id}" style="font-family: var(--font-mono); font-size: 0.88rem; line-height: 1.5; color: #f1f5f9; white-space: pre;">${highlightCode(item.cmd, (item.shell && item.shell.includes('psql')) ? 'sql' : 'bash')}</code></pre>
              </div>

              <div style="font-size: 0.82rem; color: var(--text-secondary);">
                💡 ${escapeHtml(item.explanation)}
              </div>
            </div>
          `;
        });

        groupsHtml += `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <h4 style="margin: 0; font-size: 1.05rem; color: var(--accent-cyan);">${escapeHtml(catName)}</h4>
              <span class="badge" style="background: rgba(0, 180, 216, 0.15); color: var(--accent-cyan); font-size: 0.72rem;">${cmds.length} komend</span>
            </div>
            ${itemsHtml}
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div class="card" style="padding: 16px 20px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
          <div>
            <h4 style="margin: 0;">⚡ Podręczna Ściągawka Terminalowa (Adrian Wojtkowski Edition)</h4>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
              Błyskawiczne kopiowanie przetestowanych poleceń Bash, psql i OpenRC.
            </div>
          </div>
          <div style="flex: 1; max-width: 380px;">
            <input 
              type="text" 
              class="form-control" 
              id="sop-cheatsheet-search" 
              placeholder="🔍 Szukaj komendy (np. pg_stat_activity, wine, restart, scp)..." 
              value="${escapeHtml(sopState.searchQuery)}"
              style="width: 100%; padding: 8px 12px; font-size: 0.85rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary);"
            >
          </div>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 0.78rem; color: var(--text-muted); align-self: center;">Szybkie filtry:</span>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('')" style="font-size: 0.75rem; padding: 2px 8px;">Wszystkie</button>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('pg_stat_activity')" style="font-size: 0.75rem; padding: 2px 8px;">pg_stat_activity</button>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('restart')" style="font-size: 0.75rem; padding: 2px 8px;">Restart usługi</button>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('wine')" style="font-size: 0.75rem; padding: 2px 8px;">Wine &amp; kgp.exe</button>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('scp')" style="font-size: 0.75rem; padding: 2px 8px;">Satelity RDP/CZA</button>
          <button class="btn btn-secondary btn-sm" onclick="window.setPgSopFilter('vacuum')" style="font-size: 0.75rem; padding: 2px 8px;">Bloat &amp; Vacuum</button>
        </div>
      </div>

      <div>
        ${groupsHtml}
      </div>
    `;

    const searchInput = document.getElementById('sop-cheatsheet-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        sopState.searchQuery = e.target.value;
        renderCheatsheetTab(container);
        const inputRef = document.getElementById('sop-cheatsheet-search');
        if (inputRef) {
          inputRef.focus();
          inputRef.setSelectionRange(inputRef.value.length, inputRef.value.length);
        }
      });
    }
  }

  /**
   * 3. PODZAKŁADKA: POSTGRESQL BLOAT & REDUKCJA DYSKU (1.3 TB ➔ 300 GB)
   */
  function renderBloatTab(container) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Karta wprowadzenia architektonicznego -->
        <div class="card" style="border-left: 4px solid #8338ec;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 1.8rem;">🗄️</span>
            <div>
              <h3 style="margin: 0;">Problem PostgreSQL Bloat &amp; Strategia Zmniejszania Bazy</h3>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">
                Jak Adrian Wojtkowski zmniejszył bazę szpitalną z 1.3 TB do 300 GB po usunięciu starych danych
              </div>
            </div>
          </div>

          <p style="font-size: 0.9rem; line-height: 1.6; color: var(--text-primary); margin-bottom: 14px;">
            W silnikach baz danych z mechanizmem <strong>MVCC (Multi-Version Concurrency Control)</strong>, takich jak PostgreSQL, polecenie <code>DELETE</code> <strong>nie zwalnia ani jednego bajtu miejsca na dysku</strong>. Zamiast tego rekord jest jedynie oznaczany jako martwy (dead tuple). 
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 16px;">
            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <h5 style="color: #ef476f; margin-top: 0;">❌ Dlaczego zwykły VACUUM nie zmniejsza pliku?</h5>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">
                Zwykły proces <code>VACUUM</code> oczyszcza wskaźniki i rejestruje puste miejsce w tzw. <em>Free Space Map (FSM)</em>. Miejsce to może być ponownie użyte przez nowe instrukcje <code>INSERT</code>, ale fizyczny rozmiar plików relacji na dysku (w katalogu <code>/var/lib/postgresql/data/base/</code>) pozostaje bez zmian.
              </p>
            </div>

            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <h5 style="color: #ffb703; margin-top: 0;">⚠️ Pułapka i ryzyko VACUUM FULL</h5>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">
                <code>VACUUM FULL</code> przepisuje tabelę, usuwając bloat, ale:
                <br>1. Zakłada wyłączną blokadę <strong>ACCESS EXCLUSIVE</strong> (odrzuca nawet zapytania SELECT od laborantów).
                <br>2. Wymaga <strong>dodatkowej wolnej przestrzeni dyskowej równej rozmiarowi tabeli</strong>. Jeśli dysk ma 95% zapełnienia, VACUUM FULL wyłoży system z błędem <em>No space left on device</em>!
              </p>
            </div>

            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <h5 style="color: #06d6a0; margin-top: 0;">🏆 Rozwiązanie Adriana: pg_dump &amp; pg_restore</h5>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">
                W sytuacji dużej bazy po archiwizacji (np. usunięcie zleceń sprzed 5 lat) najlepszą, bezpieczną procedurą jest wykonanie logicznego zrzutu <code>pg_dump -Fc</code> i odtworzenie go do nowej bazy. Odtworzone tabele i indeksy B-Tree są w 100% zoptymalizowane i pozbawione bloatu.
              </p>
            </div>
          </div>
        </div>

        <!-- Sekcja porównania i workflow redukcji 1.3 TB -> 300 GB -->
        <div class="card">
          <h4 style="margin-top: 0; color: var(--accent-cyan);">🚀 Pełna Procedura Kurczenia Bazy (Dump + Restore Workflow)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
            Poniższy proces był stosowany w Alab przy redukcji bazy z 1.3 TB do 300 GB w kontrolowanym oknie serwisowym.
          </p>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-cyan); font-size: 0.88rem;">Krok 1: Weryfikacja bieżącego bloatu i rozmiaru bazy</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('bloat-sql-1')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj SQL</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="bloat-sql-1" style="font-family: var(--font-mono); font-size: 0.85rem; color: #a5d6ff;">-- Sprawdzenie rozmiaru bazy i 10 największych relacji
SELECT 
    schemaname, 
    relname AS tabela, 
    pg_size_pretty(pg_total_relation_size(relid)) AS rozmiar_calkowity,
    pg_size_pretty(pg_relation_size(relid)) AS rozmiar_danych,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS rozmiar_indeksow,
    n_dead_tup AS martwe_rekordy
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(relid) DESC 
LIMIT 10;</code></pre>
            </div>

            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-cyan); font-size: 0.88rem;">Krok 2: Wykonanie logicznego zrzutu kompresowanego (pg_dump format custom)</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('bloat-cmd-2')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Bash</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="bloat-cmd-2" style="font-family: var(--font-mono); font-size: 0.85rem; color: #a5d6ff;"># Zrzut w formacie Custom z kompresją strumieniową (można uruchomić wielowątkowo z -j 4)
pg_dump -U postgres -Fc -d centrum -f /backup/centrum_czyste_$(date +%F).dump</code></pre>
            </div>

            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-cyan); font-size: 0.88rem;">Krok 3: Utworzenie nowej bazy i odtworzenie struktury oraz danych</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('bloat-cmd-3')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Bash</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="bloat-cmd-3" style="font-family: var(--font-mono); font-size: 0.85rem; color: #a5d6ff;"># Utworzenie świeżej bazy o identycznym kodowaniu (np. WIN1250 lub UTF8)
createdb -U postgres -E WIN1250 -O lab centrum_skurczona

# Odtworzenie danych bez bloatu
pg_restore -U postgres -d centrum_skurczona -v /backup/centrum_czyste_*.dump</code></pre>
            </div>

            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-cyan); font-size: 0.88rem;">Krok 4: Podmiana nazw baz (Atomic Switch) i weryfikacja</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('bloat-cmd-4')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj SQL</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="bloat-cmd-4" style="font-family: var(--font-mono); font-size: 0.85rem; color: #a5d6ff;">-- W konsoli psql jako postgres:
ALTER DATABASE centrum RENAME TO centrum_stara_bloat;
ALTER DATABASE centrum_skurczona RENAME TO centrum;

-- Po upewnieniu się że aplikacja działa i raporty się otwierają:
-- DROP DATABASE centrum_stara_bloat;</code></pre>
            </div>

          </div>
        </div>

      </div>
    `;
  }

  /**
   * 4. PODZAKŁADKA: PERYFERIA SZPITALNE (USŁUGI DO ZATRZYMANIA)
   */
  function renderPeripheralsTab(container) {
    const peripherals = [
      {
        name: 'TigerVNC / Pulpity Zdalne',
        desc: 'Sesje zdalne personelu i techników laboratorium. Zatrzymanie zapobiega uruchamianiu aplikacji Marcel w trakcie podmiany plików wykonywalnych.',
        serviceGentoo: '/etc/init.d/vnc stop',
        serviceDebian: 'systemctl stop vncserver@:1',
        icon: '🖥️'
      },
      {
        name: 'Samba (smbd & nmbd)',
        desc: 'Udziały sieciowe Windows wykorzystywane do wymiany plików wyników, skanów i wydruków PDF ze stacjami roboczymi.',
        serviceGentoo: '/etc/init.d/samba stop',
        serviceDebian: 'systemctl stop smbd nmbd',
        icon: '📁'
      },
      {
        name: 'Cron / Zadania Harmonogramu',
        desc: 'Skrypty cykliczne (ETL, nocne backupy, synchronizatory ze szpitalnym HIS). Jeśli skrypt uruchomi się w trakcie aktualizacji, spowoduje konflikt bazy.',
        serviceGentoo: '/etc/init.d/cron stop',
        serviceDebian: 'systemctl stop cron',
        icon: '⏰'
      },
      {
        name: 'Mirth Connect (HL7 Integrator)',
        desc: 'Silnik integracyjny HL7 v2 / MLLP odbierający wyniki z analizatorów na porcie 2575. Musi zostać wstrzymany, aby nie próbował zapisywać danych w migracyjnej bazie.',
        serviceGentoo: '/etc/init.d/mirth-connect stop',
        serviceDebian: 'systemctl stop mirth-connect',
        icon: '🔬'
      },
      {
        name: 'Kontenery LXC (np. a12, elaborat w Alab)',
        desc: 'Kontenery systemowe hostingujące moduły webowe i satelity laboratoryjne w infrastrukturze Alab.',
        serviceGentoo: 'lxc-stop -n a12\nlxc-stop -n elaborat',
        serviceDebian: 'lxc-stop -n a12\nlxc-stop -n elaborat',
        icon: '📦'
      }
    ];

    let cardsHtml = '';
    peripherals.forEach((p, idx) => {
      const gId = `periph-g-${idx}`;
      const dId = `periph-d-${idx}`;

      cardsHtml += `
        <div class="card" style="margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.5rem;">${p.icon}</span>
            <div>
              <h4 style="margin: 0; font-size: 1.05rem;">${escapeHtml(p.name)}</h4>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(p.desc)}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-top: 10px;">
            <div style="background: var(--bg-input); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">Gentoo (OpenRC):</span>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('${gId}')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="${gId}" style="font-family: var(--font-mono); font-size: 0.8rem; color: #a5d6ff;">${escapeHtml(p.serviceGentoo)}</code></pre>
            </div>

            <div style="background: var(--bg-input); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 0.75rem; color: var(--accent-teal); font-weight: 600;">Debian / Ubuntu (systemd):</span>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('${dId}')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
              </div>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="${dId}" style="font-family: var(--font-mono); font-size: 0.8rem; color: #a5d6ff;">${escapeHtml(p.serviceDebian)}</code></pre>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="card" style="padding: 16px 20px; margin-bottom: 18px; border-left: 4px solid var(--accent-teal);">
        <h4 style="margin: 0;">🛡️ Lista Kontrolna Usług Peryferyjnych (Przed i Po Aktualizacji)</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; margin-bottom: 0;">
          Podczas aktualizacji bazy danych i binariów Centrum należy tymczasowo wstrzymać usługi towarzyszące, aby zapobiec modyfikacjom tabel przez systemy zintegrowane i otwartym blokadom plików SMB.
        </p>
      </div>

      <div>
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * 5. PODZAKŁADKA: LOKALNE LABORATORIUM SRE (SANDBOX DOCKER & WSL2)
   */
  function renderSandboxTab(container) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Karta wprowadzenia do Sandboxa -->
        <div class="card" style="border-left: 4px solid var(--accent-teal);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <span style="font-size: 2rem;">🧪</span>
            <div>
              <h3 style="margin: 0;">Lokalny Poligon Doświadczalny SRE (Sandbox)</h3>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">
                Zasada SRE: <em>Nigdy nie ucz się procedury na produkcji szpitalnej! Przetestuj każdy krok w 100% bezpiecznym środowisku lokalnym.</em>
              </div>
            </div>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-primary); margin: 0; line-height: 1.6;">
            Na Twoim komputerze z systemem Windows przygotowaliśmy gotowe pliki środowiska testowego w katalogu <code>sandbox/</code>. 
            Pozwala ono odwzorować pełną architekturę LIS Marcel: bazę danych <strong>centrum</strong> (PostgreSQL), tabelę <strong>wersja</strong> z historycznymi wpisami, strukturę folderów <code>/home/lab/marcel/service/</code>, użytkownika <code>lab:users</code>, a także drugi serwer udający satelitę terminalową RDP Alab bez Wine!
          </p>
        </div>

        <!-- 2 Metody uruchomienia -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          
          <!-- Metoda 1: Docker Compose -->
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-top: 3px solid var(--accent-cyan);">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--accent-cyan);">🐳 Metoda 1: Docker &amp; Docker Compose</h4>
                <span class="badge" style="background: rgba(0, 180, 216, 0.2); color: var(--accent-cyan); font-size: 0.72rem;">Zalecane SRE (1 Komenda)</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
                Wymaga Docker Desktop. Tworzy dwa izolowane kontenery: <code>marcel-db-sandbox</code> (PostgreSQL 14 + Wine) oraz <code>satellite-rdp-sandbox</code> (Debian bez Wine).
              </p>

              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Start środowiska w PowerShell / Bash:</span>
                  <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('sb-docker-up')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
                </div>
                <pre style="margin: 0; background: transparent; padding: 0;"><code id="sb-docker-up" style="font-family: var(--font-mono); font-size: 0.82rem; color: #a5d6ff;">cd sandbox
docker compose up -d</code></pre>
              </div>

              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Wejście do konsoli jako użytkownik lab:</span>
                  <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('sb-docker-exec')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
                </div>
                <pre style="margin: 0; background: transparent; padding: 0;"><code id="sb-docker-exec" style="font-family: var(--font-mono); font-size: 0.82rem; color: #a5d6ff;">docker exec -it -u lab marcel-db-sandbox bash</code></pre>
              </div>
            </div>

            <div style="margin-top: 14px; font-size: 0.75rem; color: var(--text-muted);">
              🔄 Reset środowiska do zera: <code>docker compose down -v &amp;&amp; docker compose up -d</code>
            </div>
          </div>

          <!-- Metoda 2: WSL2 na Windows -->
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-top: 3px solid var(--accent-amber);">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--accent-amber);">🐧 Metoda 2: WSL2 (Ubuntu / Debian)</h4>
                <span class="badge" style="background: rgba(255, 183, 3, 0.2); color: var(--accent-amber); font-size: 0.72rem;">Natywny Linux na Windows</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
                Dla osób bez Docker Desktop. Działa bezpośrednio w Windows Subsystem for Linux (WSL2) z pełnym dostępem do systemd i psql.
              </p>

              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Krok 1: Instalacja PostgreSQL i Wine w Ubuntu:</span>
                  <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('sb-wsl-install')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
                </div>
                <pre style="margin: 0; background: transparent; padding: 0;"><code id="sb-wsl-install" style="font-family: var(--font-mono); font-size: 0.82rem; color: #a5d6ff;">sudo apt update &amp;&amp; sudo apt install -y postgresql postgresql-contrib
sudo dpkg --add-architecture i386
sudo apt update &amp;&amp; sudo apt install -y wine wine32 wine64</code></pre>
              </div>

              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Krok 2: Konfiguracja usera lab i struktury Marcela:</span>
                  <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('sb-wsl-user')" style="font-size: 0.7rem; padding: 2px 6px;">📋 Kopiuj</button>
                </div>
                <pre style="margin: 0; background: transparent; padding: 0;"><code id="sb-wsl-user" style="font-family: var(--font-mono); font-size: 0.82rem; color: #a5d6ff;">sudo useradd -m -s /bin/bash -g users lab
sudo mkdir -p /home/lab/marcel/service
sudo chown -R lab:users /home/lab
sudo -u postgres psql -c "CREATE USER lab WITH SUPERUSER PASSWORD 'lab';"
sudo -u postgres psql -c "CREATE DATABASE centrum OWNER lab;"</code></pre>
              </div>
            </div>

            <div style="margin-top: 14px; font-size: 0.75rem; color: var(--text-muted);">
              💡 Baza centrum zostanie zainicjalizowana z prawami użytkownika lab.
            </div>
          </div>

        </div>

        <!-- Ćwiczenia Praktyczne SRE Krok po Kroku -->
        <div class="card">
          <h4 style="margin-top: 0; color: var(--accent-teal);">🎯 4 Ćwiczenia Praktyczne do Wykonania w Piaskownicy</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
            Wykonaj poniższe 4 scenariusze wewnątrz kontenera / WSL, aby nabyć pamięć mięśniową przed prawdziwym oknem serwisowym.
          </p>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Ćwiczenie 1 -->
            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-cyan); font-size: 0.9rem;">Ćwiczenie 1: Symulacja wiszącej transakcji &amp; Test zapytania Adriana (0 rows)</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('ex-1-cmd')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Komendy</button>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 8px 0;">
                W oknie 1 uruchamiasz wiszącą transakcję (np. laborant zostawił otwarty program). W oknie 2 sprawdzasz czy zapytanie Adriana wykryje brak zerowych połączeń:
              </p>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="ex-1-cmd" style="font-family: var(--font-mono); font-size: 0.83rem; color: #a5d6ff;"># W oknie A (symulacja zawieszonej sesji laboranta):
psql -U lab -d centrum -c "SELECT pg_sleep(120);"

# W oknie B (Twoja kontrola SRE przed migracją):
psql -U postgres -d centrum -c "SELECT * FROM pg_stat_activity WHERE datname = 'centrum';"
# Zobaczysz aktywne połączenie! Nie ma (0 rows). Nie wolno zaczynać aktualizacji!</code></pre>
            </div>

            <!-- Ćwiczenie 2 -->
            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-amber); font-size: 0.9rem;">Ćwiczenie 2: Trik Adriana z wycięciem INSERT INTO wersja w 5.2.1.sql</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('ex-2-cmd')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Komendy</button>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 8px 0;">
                Sprawdź dlaczego skrypt wywala błąd bez triku Adriana i jak jedna komenda <code>sed</code> rozwiązuje problem:
              </p>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="ex-2-cmd" style="font-family: var(--font-mono); font-size: 0.83rem; color: #a5d6ff;">cd /home/lab/marcel/service/532_przed_zmianami/

# 1. Sprawdź zawartość pierwszego pliku SQL:
head -n 2 5.2.1.sql

# 2. Wycięcie kolizyjnej pierwszej linijki INSERT INTO wersja (Trik Adriana):
sed -i '1{/INSERT INTO wersja/d}' 5.2.1.sql

# 3. Uruchomienie aktualizacji:
chmod +x update.sh
./update.sh
# Wynik: Baza zaktualizowana bezbłędnie do wersji 5.3.2!</code></pre>
            </div>

            <!-- Ćwiczenie 3 -->
            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #8338ec; font-size: 0.9rem;">Ćwiczenie 3: Wymiana centrum.exe, uprawnienia lab:users &amp; Wine kgp.exe</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('ex-3-cmd')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Komendy</button>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 8px 0;">
                Przećwicz podstawienie binarki, nadanie uprawnień i podpisanie licencji (likwidacja ekranu czerwonej czaszki):
              </p>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="ex-3-cmd" style="font-family: var(--font-mono); font-size: 0.83rem; color: #a5d6ff;">cp centrum.exe /home/lab/marcel/centrum.exe
cp kgp.exe /home/lab/marcel/kgp.exe
cd /home/lab/marcel/

chown lab:users centrum.exe
chmod 755 centrum.exe

# Podpisanie licencji (symulator / Wine):
./kgp.exe -a centrum.exe # lub: wine kgp.exe -a centrum.exe
ls -la centrum.exe centrum.key</code></pre>
            </div>

            <!-- Ćwiczenie 4 -->
            <div style="background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #06d6a0; font-size: 0.9rem;">Ćwiczenie 4: Transfer klucza satelity RDP (Alab Workflow)</strong>
                <button class="btn btn-secondary btn-sm" onclick="window.copyPgSopText('ex-4-cmd')" style="font-size: 0.75rem; padding: 2px 8px;">📋 Kopiuj Komendy</button>
              </div>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 8px 0;">
                Przetestuj procedurę dla serwera RDP (który nie ma Wine):
              </p>
              <pre style="margin: 0; background: transparent; padding: 0;"><code id="ex-4-cmd" style="font-family: var(--font-mono); font-size: 0.83rem; color: #a5d6ff;"># Pobranie klucza z satelity:
scp lab@satellite-rdp:/home/lab/marcel/centrum.key /home/lab/marcel/satellite_keys/

# Podpisanie na maszynie z Wine:
cd /home/lab/marcel/satellite_keys/
cp /home/lab/marcel/centrum.exe .
../kgp.exe -a centrum.exe

# Odesłanie podpisanego zestawu:
scp centrum.exe centrum.key lab@satellite-rdp:/home/lab/marcel/</code></pre>
            </div>

          </div>
        </div>

      </div>
    `;
  }

  /**
   * Zapis do Bazy Runbooków Hubu
   */
  function savePgUpdateRunbookUI() {
    if (!window.appState || typeof window.appState.saveIncidentRunbook !== 'function') {
      showToast('Moduł appState nie jest w pełni załadowany.', 'warning');
      return;
    }

    const runbook = {
      id: 'runbook_pg_update_' + Date.now(),
      title: 'SOP: Aktualizacja Bazy PostgreSQL & Centrum (LIS Marcel)',
      system: 'PostgreSQL / Centrum LIS',
      category: 'Procedura Produkcyjna',
      createdAt: new Date().toISOString(),
      author: 'Adrian Wojtkowski / Zespół SRE',
      severity: 'Planned Maintenance',
      summary: 'Oficjalna procedura aktualizacji bazy PostgreSQL i oprogramowania Centrum z obsługą zero-connection check, OpenRC, triku tabeli wersja, binarki Wine kgp.exe oraz serwerów satelitarnych RDP i CZA.',
      steps: SOP_STEPS.map(s => ({
        stepNumber: s.number,
        title: s.title,
        keyCommand: s.commands[0]?.cmd || '',
        adrianNote: s.adrianNote
      })),
      verified: true
    };

    window.appState.saveIncidentRunbook(runbook);
    showToast('Pomyślnie zapisano procedurę SOP w Bazie Runbooków Hubu!', 'success');
  }

  /**
   * Globalne pomocniki dostępne z okna przeglądarki
   */
  window.copyPgSopText = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent || el.innerText || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Skopiowano polecenie do schowka!', 'success');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  function fallbackCopy(text) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast('Skopiowano do schowka!', 'success');
    } catch (e) {
      showToast('Nie udało się skopiować automatycznie.', 'warning');
    }
    document.body.removeChild(tempInput);
  }

  window.setPgSopFilter = function (keyword) {
    sopState.searchQuery = keyword;
    const container = document.getElementById('sop-subtab-content');
    if (container) {
      renderCheatsheetTab(container);
    }
  };

  // Rejestracja w obiekcie globalnym window
  window.renderPgUpdateSopModule = renderPgUpdateSopModule;
  window.savePgUpdateRunbookUI = savePgUpdateRunbookUI;
  window.PG_UPDATE_SOP = {
    steps: SOP_STEPS,
    commands: TERMINAL_COMMANDS,
    saveChecklistState,
    loadChecklistState
  };

})();
