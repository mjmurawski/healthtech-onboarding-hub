/**
 * Systems Specialist Module
 * 
 * HealthTech Onboarding Hub - Moduł Bazy Wiedzy Specjalistycznej IT
 * Zawiera procedury diagnostyczne dla systemów medycznych: LIS, eKrew, PatExpert, Genetyka.
 */

(function() {
'use strict';

// Pomocnik XSS - pobiera z window.escapeHtml lub implementuje fallback
const escapeHtml = function(str) {
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

// Pomocnik powiadomień
const showToast = function(msg, type = 'info') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else {
        console.log(`[Toast ${type}] ${msg}`);
    }
};

/**
 * Baza wiedzy o systemach
 */
const SYSTEMS_KB = {
    lis: {
        name: 'LIS – Laboratorium',
        icon: '🧪',
        color: '#06d6a0',
        description: 'System Informatyczny Laboratorium (Laboratory Information System). Odpowiada za obieg zleceń i wyników z analizatorów.',
        scenarios: [
            {
                id: 'lis_1',
                title: 'Zablokowany bufor zleceń do analizatora (ASTM/HL7 ORM)',
                symptoms: ['Analizator nie odbiera nowych zleceń', 'Bufor ASTM zatrzymał się na N komunikatach', 'Log: "Connection timeout to analyzer port 1234"'],
                cause: 'Brak komunikacji na poziomie TCP/IP lub zawieszony proces demona komunikacyjnego.',
                steps: [
                    { action: 'Sprawdź stan portu MLLP/TCP', cmd: 'ss -tnp | grep 1234' },
                    { action: 'Zrestartuj daemon komunikacyjny LIS', cmd: 'systemctl restart lis-comm-daemon' },
                    { action: 'Sprawdź pliki logów', cmd: 'tail -f /var/log/lis/comm.log' }
                ],
                sqlQueries: [
                    { label: 'Oczekujące zlecenia (queue freeze check)', sql: 'SELECT id, nr_zlecenia, status_kom, data_wys FROM zlecenia_wych WHERE status_kom = \'OCZEKUJE\' ORDER BY data_wys ASC LIMIT 20', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_2',
                title: 'Timeout odpowiedzi analizatora (brak ACK)',
                symptoms: ['Po stronie LIS zlecenia wiszą', 'Brak komunikatu ACK w logach po wysłaniu komunikatu HL7/ASTM'],
                cause: 'Analizator odrzucił połączenie lub zapora sieciowa blokuje ruch przychodzący (np. zmienione reguły).',
                steps: [
                    { action: 'Ping na adres IP analizatora', cmd: 'ping <IP_ANALIZATORA>' },
                    { action: 'Sprawdź otwarty port z perspektywy serwera', cmd: 'nc -zv <IP_ANALIZATORA> <PORT>' },
                    { action: 'Zweryfikuj reguły zapory sieciowej (firewall)', cmd: 'iptables -L -n | grep <PORT>' }
                ],
                sqlQueries: [
                    { label: 'Konfiguracja analizatorów w bazie', sql: 'SELECT id, typ_anz, adres_ip, port, status FROM analizatory WHERE aktywny = 1', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_3',
                title: 'Wisząca sesja TCP do analizatora',
                symptoms: ['Nowe połączenie niemożliwe', 'Zajętość portu komunikacyjnego przez wiszący proces'],
                cause: 'Analizator przestał odpowiadać i nie zamknął sesji (half-open connection).',
                steps: [
                    { action: 'Znajdź wiszące połączenie', cmd: 'ss -tnp | grep <PORT>' },
                    { action: 'Wyświetl PID procesu blokującego', cmd: 'sudo fuser -n tcp <PORT>' },
                    { action: 'Zabij proces "zombie"', cmd: 'kill -9 <PID>' }
                ],
                sqlQueries: [
                    { label: 'Sprawdź stan sesji komunikacyjnych LIS', sql: 'SELECT id, pid_procesu, data_uruchomienia FROM sesje_kom WHERE status = \'WISZĄCA\'', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_4',
                title: 'Błąd parsowania wyniku ORU R01 (malformed HL7)',
                symptoms: ['Log: "HL7 parse error: unexpected segment"', 'Wynik nie pojawia się w systemie mimo poprawnej transmisji z analizatora'],
                cause: 'Zła struktura komunikatu HL7 przesłanego przez analizator (np. niedozwolone znaki w OBX).',
                steps: [
                    { action: 'Pobierz surowy komunikat HL7 z logu', cmd: 'grep "RAW MSG" /var/log/lis/hl7_in.log' },
                    { action: 'Sprawdź segment MSH-9 (typ komunikatu)', cmd: null },
                    { action: 'Przelicz i zweryfikuj liczbę segmentów OBX (wynikowych)', cmd: null }
                ],
                sqlQueries: [
                    { label: 'Lista komunikatów odrzuconych (błąd parsowania)', sql: 'SELECT id, raw_msg, data_odbioru, blad_parsowania FROM kom_przychodzace WHERE status = \'BLAD\' AND typ = \'ORU\' ORDER BY data_odbioru DESC LIMIT 10', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_5',
                title: 'Sprawdzenie statusu zlecenia po kodzie kreskowym',
                symptoms: ['Pacjent lub personel dopytuje o status wyniku', 'Brak wizualnego odzwierciedlenia w GUI laboratorium'],
                cause: 'Diagnostyka ad-hoc bazy danych.',
                steps: [],
                sqlQueries: [
                    { label: 'Weryfikacja danych zlecenia i pacjenta', sql: 'SELECT z.id, z.nr_zlecenia, z.status, z.data_rejestracji, p.pesel, p.imie, p.nazwisko FROM zlecenia z JOIN pacjenci p ON z.id_pacjenta = p.id WHERE z.kod_kreskowy = :kod', params: [':kod'] },
                    { label: 'Status pojedynczych pozycji zlecenia', sql: 'SELECT poz.id, b.nazwa_badania, poz.status, poz.wynik FROM pozycje_zlecen poz JOIN badania b ON poz.id_badania = b.id WHERE poz.id_zlecenia = :id_zlecenia', params: [':id_zlecenia'] },
                    { label: 'Stan próbki w kolejce laboratoryjnej', sql: 'SELECT * FROM kolejki_prob WHERE id_zlecenia = :id_zlecenia ORDER BY data_dodania DESC', params: [':id_zlecenia'] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_6',
                title: 'Blokada portu MLLP – proces nie nasłuchuje',
                symptoms: ['Mirth Connect lub natywny proces nie otwiera gniazda TCP na porcie 2575', 'Analizator zgłasza "Connection refused"'],
                cause: 'Awaria silnika integracyjnego, brak autostartu usługi lub konflikt portów.',
                steps: [
                    { action: 'Sprawdź co nasłuchuje na porcie 2575', cmd: 'sudo ss -tlnp | grep 2575' },
                    { action: 'Zweryfikuj stan demona (np. Mirth Connect)', cmd: 'sudo systemctl status mirth-connect' },
                    { action: 'Zajrzyj do dziennika systemowego', cmd: 'journalctl -u mirth-connect -n 50' }
                ],
                sqlQueries: [],
                safetyNote: 'ZAKAZ otwierania portu MLLP 2575 globalnie! Zawsze ogranicz do IP analizatora: ufw allow proto tcp from <IP> to any port 2575'
            },
            {
                id: 'lis_7',
                title: 'Kolejka próbek wisiała (STAT nie priorytetyzowany)',
                symptoms: ['Zlecenie STAT (CITO) czeka ponad 10 minut', 'Inne zlecenia rutynowe są przetwarzane normalnie'],
                cause: 'Błąd w procedurze kolejkowania bazy danych lub zablokowany bufor dla flagi priorytetowej.',
                steps: [],
                sqlQueries: [
                    { label: 'Znajdź wiszące zlecenia STAT (CITO)', sql: 'SELECT id, nr_zlecenia, priorytet, status, data_rejestracji FROM zlecenia WHERE priorytet = \'STAT\' AND status NOT IN (\'ZAKONCZONE\', \'ANULOWANE\') ORDER BY data_rejestracji ASC', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'lis_8',
                title: 'Brak wyników w systemie – wynik odebrany ale nie zapisany',
                symptoms: ['Komunikat HL7 odebrany prawidłowo przez kanał wejściowy, ale GUI nie pokazuje wyników dla zlecenia'],
                cause: 'Błąd mapowania kodów badań analizatora (np. LOINC) na słownik lokalny LIS.',
                steps: [],
                sqlQueries: [
                    { label: 'Odebrane, ale niezmapowane wyniki (orphany)', sql: 'SELECT id, raw_msg, blad_walidacji, data_odbioru FROM kom_przychodzace WHERE status = \'PRZETWORZONY\' AND id_wyniku IS NULL ORDER BY data_odbioru DESC LIMIT 20', params: [] }
                ],
                safetyNote: null
            }
        ]
    },
    ekrew: {
        name: 'eKrew – Bank Krwi',
        icon: '🩸',
        color: '#ef476f',
        description: 'System zarządzania gospodarką krwią i preparatami krwiopochodnymi z integracją CKiK.',
        scenarios: [
            {
                id: 'ekrew_1',
                title: 'Preparat krwi zablokowany w transakcji tymczasowej',
                symptoms: ['Preparat widoczny jako "zajęty" mimo braku aktywnego zamówienia', 'Nie można wydać preparatu na oddział'],
                cause: 'Przerwana transakcja (np. crash przeglądarki usera w trakcie rezerwacji) i brak zwolnienia locka na preparacie.',
                steps: [],
                sqlQueries: [
                    { label: 'Weryfikacja zawieszonych transakcji na preparatach', sql: 'SELECT p.id, p.nr_preparatu, p.status, t.id AS id_trans, t.data_utw, t.typ FROM preparaty p JOIN transakcje_temp t ON p.id = t.id_preparatu WHERE p.status = \'ZAREZERWOWANY\' AND t.data_utw < NOW() - INTERVAL \'2 hours\'', params: [] },
                    { label: 'Awaryjne zdjęcie blokady (WYMAGANA WERYFIKACJA!)', sql: '-- Po weryfikacji:\nBEGIN;\nUPDATE preparaty SET status = \'DOSTEPNY\' WHERE id = :id;\n-- ROLLBACK; (domyślnie!)', params: [':id'] }
                ],
                safetyNote: 'Przed ręczną zmianą statusu preparatu sprawdź u personelu banku krwi czy preparat faktycznie nie jest w użyciu!'
            },
            {
                id: 'ekrew_2',
                title: 'Błąd certyfikatu SSL do usług centralnych CKiK',
                symptoms: ['Log: "SSL certificate verify failed"', 'Brak synchronizacji z rejestrem dawców centralnym'],
                cause: 'Wygasły certyfikat klienta, brak CA (Certificate Authority) w store, lub zmiana serwera CKiK.',
                steps: [
                    { action: 'Sprawdź łańcuch certyfikatów serwera CKiK', cmd: 'openssl s_client -connect <HOST>:443 -showcerts 2>&1 | head -30' },
                    { action: 'Sprawdź datę ważności obecnego certyfikatu', cmd: 'openssl x509 -enddate -noout -in /etc/ssl/certs/ckik_client.pem' },
                    { action: 'Zweryfikuj zaufane CA', cmd: 'ls -la /etc/ssl/certs' },
                    { action: 'Odśwież zaufane certyfikaty systemowe', cmd: 'sudo update-ca-certificates' }
                ],
                sqlQueries: [],
                safetyNote: null
            },
            {
                id: 'ekrew_3',
                title: 'Timeout synchronizacji z centralnym rejestrem dawców',
                symptoms: ['Próba pobrania danych z centrali kończy się komunikatem o czasie oczekiwania'],
                cause: 'Problemy z routingiem sieci, zapora po stronie szpitala, lub awaria po stronie CKiK.',
                steps: [
                    { action: 'Ping na rejestr centralny', cmd: 'ping <HOST_REJESTRU>' },
                    { action: 'Sprawdź zapory dla ruchu wychodzącego HTTP/HTTPS', cmd: 'ufw status | grep 443' },
                    { action: 'Sprawdź ustawienia proxy serwera aplikacji', cmd: 'env | grep -i proxy' },
                    { action: 'Zweryfikuj poprawność URL w konfiguracji eKrew', cmd: 'cat /opt/ekrew/config/app.yml | grep service_url' }
                ],
                sqlQueries: [
                    { label: 'Logi błędów synchronizacji CKiK z bazy eKrew', sql: 'SELECT id, adres_url, ostatnia_synch, status_synch, blad FROM polaczenia_zewn WHERE typ = \'CKIK\' ORDER BY ostatnia_synch DESC LIMIT 5', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'ekrew_4',
                title: 'Błąd walidacji kodu ISBT 128',
                symptoms: ['Log: "Invalid ISBT 128 barcode format"', 'Preparat odrzucony przez system podczas skanowania'],
                cause: 'Uszkodzony kod kreskowy na worku z krwią, niekompatybilny skaner (np. obcina zera wiodące).',
                steps: [
                    { action: 'Zweryfikuj wymaganą 25-znakową strukturę (DataMatrix) ISBT 128', cmd: null },
                    { action: 'Sprawdź kod produktu (znaki 1-5)', cmd: null },
                    { action: 'Sprawdź identyfikator donacji (znaki 6-18) i check digit', cmd: null }
                ],
                sqlQueries: [
                    { label: 'Błędnie odczytane kody z ostatnich prób', sql: 'SELECT id, nr_preparatu, kod_isbt, blad_walidacji FROM preparaty WHERE blad_walidacji IS NOT NULL ORDER BY data_rejestracji DESC LIMIT 10', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'ekrew_5',
                title: 'Niespójność stanu preparatu (wydany ≠ rzeczywisty)',
                symptoms: ['W systemie preparat figuruje jako wydany (transfuzja rozpoczęta), fizycznie jest w lodówce'],
                cause: 'Błąd synchronizacji operacji lub cofnięcie transakcji bez pełnego zapisu (dirty read).',
                steps: [],
                sqlQueries: [
                    { label: 'Detekcja niespójnych statusów', sql: 'SELECT p.id, p.nr_preparatu, p.status AS status_db, w.status AS status_wydania, w.data_wydania FROM preparaty p LEFT JOIN wydania w ON p.id = w.id_preparatu WHERE p.status = \'DOSTEPNY\' AND w.status = \'WYDANY\'', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'ekrew_6',
                title: 'Wisząca prośba o krew – workflow bez odpowiedzi',
                symptoms: ['Zamówienie z oddziału czeka na status "Rozpatrywane" w nieskończoność'],
                cause: 'Pracownik banku krwi nie podjął akcji w GUI, lub powiadomienie do banku krwi zawiodło.',
                steps: [],
                sqlQueries: [
                    { label: 'Wyszukiwanie przeterminowanych zamówień', sql: 'SELECT z.id, z.nr_zamowienia, z.status, z.data_zamowienia, z.id_oddzialu FROM zamowienia_krwi z WHERE z.status = \'OCZEKUJE\' AND z.data_zamowienia < NOW() - INTERVAL \'30 minutes\' ORDER BY z.data_zamowienia ASC', params: [] }
                ],
                safetyNote: null
            }
        ]
    },
    patexpert: {
        name: 'PatExpert – Patomorfologia',
        icon: '🔬',
        color: '#8338ec',
        description: 'System dla zakładów patomorfologii wspierający diagnostykę skanów WSI (Whole Slide Imaging).',
        scenarios: [
            {
                id: 'patexpert_1',
                title: 'Timeout przesyłania skanu WSI na macierz NFS',
                symptoms: ['Skan preparatu histopatologicznego nie dotarł na serwer', 'Log: "NFS write timeout after 30s"'],
                cause: 'Przeciążenie sieci lokalnej, brak dostępu do punktu montowania NFS, lub macierz działa w trybie Read-Only.',
                steps: [
                    { action: 'Sprawdź miejsce na dysku pod montowaniem NFS', cmd: 'df -hT /mnt/pacs_storage' },
                    { action: 'Zweryfikuj aktywne punkty montowania', cmd: 'mount | grep nfs' },
                    { action: 'Sprawdź czy serwer NFS odpowiada po sieci', cmd: 'showmount -e <NFS_SERVER>' },
                    { action: 'Test przepustowości łącza (np. iperf3)', cmd: 'iperf3 -c <NFS_SERVER>' }
                ],
                sqlQueries: [
                    { label: 'Niedokończone uploady skanów WSI', sql: 'SELECT id, nr_badania, sciezka_pliku, rozmiar_mb, status_uploadu, blad FROM skany_wsi WHERE status_uploadu != \'UKONCZONE\' ORDER BY data_uploadu DESC LIMIT 10', params: [] }
                ],
                safetyNote: 'Pliki WSI (SVS, NDPI, MRXS) mogą mieć rozmiar 1-30 GB. Sprawdź wolne miejsce na macierzy przed ponowną próbą przesyłu!'
            },
            {
                id: 'patexpert_2',
                title: 'Brak spójności: numer badania ≠ plik obrazu',
                symptoms: ['Skaner wyświetla "Plik nie znaleziony" dla istniejącego badania', 'Brak podglądu preparatu na stacji diagnostycznej lekarza'],
                cause: 'Błąd ludzki (zły kod kreskowy na szkiełku) lub błąd skryptu sortującego Skanera.',
                steps: [],
                sqlQueries: [
                    { label: 'Znajdź badania bez powiązanego pliku WSI w ostatnich 7 dniach', sql: 'SELECT b.id, b.nr_badania, s.sciezka_pliku, s.status_uploadu FROM badania b LEFT JOIN skany_wsi s ON b.id = s.id_badania WHERE s.id IS NULL AND b.data_rejestracji > NOW() - INTERVAL \'7 days\'', params: [] },
                    { label: 'Sprawdź, czy fizyczny plik faktycznie nie istnieje w ścieżce (wymaga modułu pg_ls_dir)', sql: 'SELECT id, nr_badania, sciezka_pliku FROM skany_wsi WHERE sciezka_pliku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_ls_dir(split_part(sciezka_pliku, \'/\', -2)) WHERE pg_ls_dir = split_part(sciezka_pliku, \'/\', -1))', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'patexpert_3',
                title: 'Storage macierzy dyskowej pełny lub niedostępny',
                symptoms: ['Zablokowanie zapisów we wszystkich modułach PatExpert', 'Analizatory skanujące wchodzą w tryb oczekiwania/błędu'],
                cause: 'Koniec wolnej przestrzeni na dyskach NAS/SAN w serwerowni PACS.',
                steps: [
                    { action: 'Sprawdź statystyki zajętości', cmd: 'df -hT /mnt/pacs_storage' },
                    { action: 'Sprawdź, czy zasób działa poprawnie, wykonując listowanie (uwaga: operacja może się zawiesić jeśli dysk "wisi")', cmd: 'ls -la /mnt/pacs_storage' },
                    { action: 'Sprawdź błędy I/O w system logach', cmd: 'sudo dmesg | grep -i \'nfs\\|error\\|timeout\'' }
                ],
                sqlQueries: [],
                safetyNote: 'ZAKAZ usuwania plików WSI bez konsultacji z patologiem! Pliki skanów są dokumentacją medyczną!'
            },
            {
                id: 'patexpert_4',
                title: 'Błąd konwersji formatu obrazu (SVS/NDPI → DICOM SR)',
                symptoms: ['Log: "Conversion failed: unsupported pixel format"', 'Preparat dostępny w systemie tylko w formacie źródłowym (np. .svs), ale nie w przeglądarce uniwersalnej DICOM'],
                cause: 'Brak odpowiednich bibliotek konwertera OpenSlide dla nietypowej kompresji obrazu.',
                steps: [],
                sqlQueries: [
                    { label: 'Rejestr błędów konwertera obrazów WSI', sql: 'SELECT id, nr_badania, format_zrodlowy, blad_konwersji, data_konwersji FROM konwersje_obrazow WHERE status = \'BLAD\' ORDER BY data_konwersji DESC LIMIT 10', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'patexpert_5',
                title: 'Powolny podgląd skanu (problem z siecią / serwer obrazów)',
                symptoms: ['Wczytywanie warstw kafli "szachownica" na przybliżeniach trwa zbyt długo', 'Zacinająca się przeglądarka'],
                cause: 'Niewystarczająca wydajność serwera Image (braki RAM, I/O storage) lub ograniczenia przepustowości przeglądarki.',
                steps: [
                    { action: 'Sprawdź status serwera obrazów (IIS / nginx)', cmd: 'systemctl status nginx' },
                    { action: 'Zweryfikuj latencję do storage-u WSI', cmd: 'ping <IP_MACIERZY>' },
                    { action: 'Sprawdź konsumpcję RAM na serwerze web', cmd: 'htop' },
                    { action: 'Wyczyść lub zbadaj wielkość pamięci podręcznej (Tile Cache)', cmd: 'du -sh /var/cache/wsi_tiles' }
                ],
                sqlQueries: [
                    { label: 'Wykrywanie wolnych sesji z logów telemetrii', sql: 'SELECT id_sesji, id_badania, czas_ladowania_ms, rozmiar_kafla_kb, data_sesji FROM logi_przegladarki WHERE czas_ladowania_ms > 5000 ORDER BY data_sesji DESC LIMIT 20', params: [] }
                ],
                safetyNote: null
            }
        ]
    },
    genetyka: {
        name: 'Genetyka – Bioinformatyka',
        icon: '🧬',
        color: '#ffb703',
        description: 'System zarządzania i przetwarzania sekwencjonowania nowej generacji (NGS). Pipeline\'y bioinformatyczne.',
        scenarios: [
            {
                id: 'genetyka_1',
                title: 'Błąd parsowania pliku VCF (malformed header / invalid allele)',
                symptoms: ['Log: "VCF parse error at line N: REF allele does not match reference"', 'Pipeline (wariantowanie) zatrzymał się bez wyniku'],
                cause: 'Niezgodność wersji referencyjnego genomu (np. b37 vs hg38) lub źle uformowane wiersze pliku wynikowego z sekwenatora.',
                steps: [
                    { action: 'Podejrzyj nagłówek VCF w poszukiwaniu referencji (wiersze zaczynające się na ##)', cmd: 'head -50 <plik.vcf>' },
                    { action: 'Szybka walidacja bcftools-em', cmd: 'bcftools stats <plik.vcf> 2>&1 | head -20' },
                    { action: 'Upewnij się, że wersja genomu referencyjnego jest poprawna', cmd: null }
                ],
                sqlQueries: [
                    { label: 'Błędy parsowania VCF z bazy genetycznej', sql: 'SELECT id, nazwa_pliku, wersja_genomu, blad_parsowania, data_przesylania FROM pliki_sekwencjonowania WHERE status = \'BLAD_PARSOWANIA\' ORDER BY data_przesylania DESC LIMIT 10', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'genetyka_2',
                title: 'Timeout / OOM przy generowaniu raportu genetycznego',
                symptoms: ['Raport kliniczny (np. PDF z wariantami patogennymi) nie wygenerował się po >2h', 'Log: "java.lang.OutOfMemoryError: Java heap space"', 'Proces raportowania zabity przez systemowy OOM Killer'],
                cause: 'Brak pamięci przydzielonej do stosu Java (JVM heap) przy olbrzymim pliku adnotacji wariantów.',
                steps: [
                    { action: 'Znajdź ślady OOM Killera w logach jądra systemu', cmd: 'sudo dmesg -T | grep -i \'oom\\|killed\'' },
                    { action: 'Sprawdź bieżące obciążenie RAM', cmd: 'free -h' },
                    { action: 'Znajdź proces Java raportowania i jego parametry Xmx', cmd: 'ps aux | grep java' }
                ],
                sqlQueries: [],
                safetyNote: 'NIE zwiększaj Xmx powyżej 80% dostępnego RAM! Najpierw zwolnij RAM z innych procesów.'
            },
            {
                id: 'genetyka_3',
                title: 'Zatrzymany pipeline przetwarzania FASTQ',
                symptoms: ['Job na serwerze obliczeniowym nie postępuje ponad 60 minut', 'Brak aktualizacji pliku progress w katalogu pacjenta'],
                cause: 'Brak miejsca na dysku tymczasowym (scratch space) lub martwy proces subtasku.',
                steps: [
                    { action: 'Sprawdź stan menedżera pipeline (np. Snakemake lub Nextflow)', cmd: 'ps aux | grep -e snakemake -e nextflow' },
                    { action: 'W przypadku klastra SLURM sprawdź kolejkę', cmd: 'squeue -u $USER' },
                    { action: 'Sprawdź wolne miejsce na dysku /scratch (tymczasowe dla FASTQ)', cmd: 'df -h /scratch' }
                ],
                sqlQueries: [
                    { label: 'Szukanie aktywnych zadań, które przestały zgłaszać postęp', sql: 'SELECT id, nazwa_probki, etap_pipelinu, postep_proc, data_startu, pid FROM zadania_pipeline WHERE status = \'AKTYWNY\' AND data_ostatniej_aktualizacji < NOW() - INTERVAL \'1 hour\'', params: [] }
                ],
                safetyNote: null
            },
            {
                id: 'genetyka_4',
                title: 'Limit RAM / OOM Killer przy analizie WGS (whole genome sequencing)',
                symptoms: ['Analiza WGS nagle przerywa działanie', 'Ciężkie zadania takie jak "BWA mem" lub "GATK HaplotypeCaller" wysypują się bez jawnego błędu'],
                cause: 'Całkowite wyczerpanie RAM z uwagi na wysoką złożoność analizy całogenomowej.',
                steps: [
                    { action: 'Ocena ogólna RAM', cmd: 'free -h' },
                    { action: 'Weryfikacja OOM Killera', cmd: 'sudo dmesg -T | grep -iE \'oom|killed|out of memory\'' },
                    { action: 'Sprawdzenie RSS w użyciu (jeśli proces jeszcze działa)', cmd: 'cat /proc/<PID>/status | grep VmRSS' },
                    { action: 'Tymczasowe dodanie SWAP-a jako ostateczność przy brakach RAM', cmd: 'sudo fallocate -l 16G /swapfile_wgs && sudo chmod 600 /swapfile_wgs && sudo mkswap /swapfile_wgs && sudo swapon /swapfile_wgs' }
                ],
                sqlQueries: [],
                safetyNote: null
            },
            {
                id: 'genetyka_5',
                title: 'Job w kolejce obliczeniowej nie startuje',
                symptoms: ['Status PENDING (oczekujący) dla zadania utrzymuje się od >2h', 'Kolejka raportuje brak zasobów (Nodes required: ... ale ich nie dostaje)'],
                cause: 'Rozmiar żądań job-a (wymagany RAM/CPU) przewyższa możliwości jakiegokolwiek pojedynczego węzła (Node) na klastrze, lub wyczerpanie limitów grupy.',
                steps: [
                    { action: 'Sprawdź stan dostępnych zasobów na klastrze', cmd: 'sinfo' },
                    { action: 'Sprawdź powód statusu PENDING konkretnego zadania', cmd: 'scontrol show job <JOB_ID>' },
                    { action: 'Sprawdź wymagania zdefiniowane w pliku submission', cmd: 'cat job_submit.sh | grep SBATCH' }
                ],
                sqlQueries: [
                    { label: 'Analiza blokujących się zadań na poziomie metadanych własnej bazy', sql: 'SELECT id, nazwa_joba, status, priorytet, wymagana_ram_gb, wymagane_cpu, data_kolejkowania FROM zadania_obliczeniowe WHERE status = \'OCZEKUJE\' ORDER BY priorytet DESC, data_kolejkowania ASC LIMIT 20', params: [] }
                ],
                safetyNote: null
            }
        ]
    },
    ansible: {
        name: 'Ansible – Automatyzacja SRE',
        icon: '🤖',
        color: '#e63946',
        description: 'Automatyzacja infrastruktury szpitalnej, playbooki Ansible, weryfikacja dry-run (--check), samonaprawa usług i idempotencja.',
        scenarios: [
            {
                id: 'ansible_1',
                title: 'Nieudane wykonanie playbooka (fatal: FAILED! rc=1)',
                symptoms: [
                    'Zadanie playbooka zakończone błędem fatal: FAILED!',
                    'PLAY RECAP wskazuje failed=1',
                    'Przerwany proces wdrażania zmian na węźle szpitalnym (brak idempotencji lub błąd komendy)'
                ],
                cause: 'Błąd wykonania skryptu wewnętrznego, nieprawidłowy kod powrotu (rc!=0) lub niespełnione warunki wstępne na hoście.',
                steps: [
                    { action: 'Uruchom playbook z flagą szczegółowości -vvv dla pojedynczego hosta', cmd: 'ansible-playbook -i inventory/hosts site.yml --limit <HOST> -vvv' },
                    { action: 'Sprawdź stan usługi docelowej na hoście zdalnym', cmd: 'ansible <HOST> -m systemd -a "name=postgresql" --become' },
                    { action: 'Przetestuj wykonanie w trybie bezpiecznym dry-run (--check)', cmd: 'ansible-playbook -i inventory/hosts site.yml --check --diff' }
                ],
                sqlQueries: [
                    { label: 'Weryfikacja aktywnych połączeń bazy centrum (Zero-Connection Check)', sql: 'SELECT * FROM pg_stat_activity WHERE datname = \'centrum\';', params: [] }
                ],
                safetyNote: 'Nigdy nie ignoruj błędu poprzez ignore_errors: true na produkcji szpitalnej bez dokładnej analizy przyczyny źródłowej!'
            },
            {
                id: 'ansible_2',
                title: 'Błąd osiągalności hosta (fatal: UNREACHABLE! Permission denied)',
                symptoms: [
                    'Komunikat fatal: [host]: UNREACHABLE!',
                    'Permission denied (publickey,gssapi-keyex,password)',
                    'Brak możliwości zebrania faktów (setup module)'
                ],
                cause: 'Brak lub nieprawidłowy klucz SSH w ssh-agent, zmiana uprawnień do ~/.ssh/authorized_keys lub blokada portu 22 w firewallu.',
                steps: [
                    { action: 'Sprawdź łączność sieciową z portem SSH', cmd: 'nc -zv <HOST> 22' },
                    { action: 'Przetestuj logowanie SSH z jawnym kluczem prywatnym i trybem debugowania', cmd: 'ssh -vvv -i ~/.ssh/id_rsa_ansible deploy@<HOST>' },
                    { action: 'Wykonaj prosty ping modułowy Ansible z inventory', cmd: 'ansible <HOST> -i inventory/hosts -m ping' }
                ],
                sqlQueries: [],
                safetyNote: null
            },
            {
                id: 'ansible_3',
                title: 'Dry-run drift (--check) wykazuje niezamierzone modyfikacje',
                symptoms: [
                    'ansible-playbook --check raportuje changed > 0 dla stabilnych serwerów produkcyjnych',
                    'Pliki konfiguracyjne różnią się od szablonów Jinja2 w repozytorium'
                ],
                cause: 'Ręczna zmiana konfiguracji dokonana bezpośrednio na serwerze (configuration drift) lub brak idempotencji w zadaniu template/lineinfile.',
                steps: [
                    { action: 'Wyświetl dokładne różnice w plikach (--diff) w trybie symulacji', cmd: 'ansible-playbook -i inventory/hosts site.yml --check --diff' },
                    { action: 'Porównaj sumę kontrolną pliku produkcyjnego z repozytorium', cmd: 'ansible <HOST> -m stat -a "path=/etc/nginx/nginx.conf"' },
                    { action: 'Zabezpiecz lokalną kopię przed wdrożeniem', cmd: 'ansible <HOST> -m copy -a "src=/etc/nginx/nginx.conf dest=/etc/nginx/nginx.conf.bak remote_src=yes"' }
                ],
                sqlQueries: [],
                safetyNote: 'Zasada Safe by Default: Zawsze uruchamiaj playbook z flagami --check i --diff przed wdrożeniem zmian na produkcji szpitalnej!'
            },
            {
                id: 'ansible_4',
                title: 'Zablokowany menedżer pakietów apt/dpkg na serwerze',
                symptoms: [
                    'fatal: [host]: FAILED! => E: Could not get lock /var/lib/dpkg/lock-frontend',
                    'Inny proces blokuje instalację pakietów (np. unattended-upgrades)'
                ],
                cause: 'Automatyczny proces aktualizacji systemu w tle lub przerwany wcześniej proces apt.',
                steps: [
                    { action: 'Zidentyfikuj proces trzymający blokadę pliku lock', cmd: 'ansible <HOST> -m command -a "lsof /var/lib/dpkg/lock-frontend" --become' },
                    { action: 'Zweryfikuj stan usługi unattended-upgrades', cmd: 'ansible <HOST> -m systemd -a "name=unattended-upgrades" --become' },
                    { action: 'Dokończ przerwane konfiguracje po zwolnieniu procesu', cmd: 'ansible <HOST> -m command -a "dpkg --configure -a" --become' }
                ],
                sqlQueries: [],
                safetyNote: 'Nie usuwaj plików *.lock poleceniem rm na oślep! Upewnij się, że proces apt/dpkg rzeczywiście nie działa.'
            },
            {
                id: 'ansible_5',
                title: 'Timeout montażu macierzy NFS podczas playbooka backupu/PACS',
                symptoms: [
                    'Zadanie ansible.posix.mount zawiesza się na ponad 60 sekund',
                    'Błąd: Connection timed out lub mount.nfs: server not responding'
                ],
                cause: 'Niedostępność serwera NFS, problem z demonem rpcbind lub błąd w opcjach montowania (np. brak soft,timeo).',
                steps: [
                    { action: 'Sprawdź dostępność portmappera i usług RPC na serwerze NFS', cmd: 'rpcinfo -p <NFS_SERVER>' },
                    { action: 'Sprawdź wyeksportowane katalogi NFS', cmd: 'showmount -e <NFS_SERVER>' },
                    { action: 'Wymuś odmontowanie wiszącego zasobu lazy/force', cmd: 'sudo umount -l -f /mnt/pacs_storage' }
                ],
                sqlQueries: [
                    { label: 'Weryfikacja oczekujących zadań transferu WSI', sql: 'SELECT id, nr_badania, sciezka_pliku, status_uploadu FROM skany_wsi WHERE status_uploadu = \'OCZEKUJE\' LIMIT 10;', params: [] }
                ],
                safetyNote: 'W konfiguracji NFS dla systemów medycznych stosuj opcje: hard,intr,timeo=50 aby zapobiec twardym zawieszeniom jądra Linux.'
            },
            {
                id: 'ansible_6',
                title: 'Rollback po nieudanym wdrożeniu patcha aplikacyjnego',
                symptoms: [
                    'Sekcja block zakończyła się błędem',
                    'Uruchomienie sekcji rescue i przywracanie poprzedniej wersji artefaktu'
                ],
                cause: 'Błąd smoke testu nowej wersji aplikacji, nieuruchamiający się demon po podmianie binarnej.',
                steps: [
                    { action: 'Zweryfikuj stan przywróconej wersji w sekcji rescue', cmd: 'ansible <HOST> -m systemd -a "name=patexpert-core" --become' },
                    { action: 'Wykonaj test dymny (healthcheck) endpointu HTTP', cmd: 'curl -fsSL -m 5 http://<HOST>:8080/health || echo "HEALTHCHECK_FAILED"' },
                    { action: 'Zweryfikuj logi błędu z journalctl po incydencie', cmd: 'ansible <HOST> -m command -a "journalctl -u patexpert-core -n 50 --no-pager" --become' }
                ],
                sqlQueries: [],
                safetyNote: 'Każdy produkcyjny playbook wdrożeniowy w szpitalu musi posiadać strukturę block-rescue z automatycznym rollbackiem wersji!'
            }
        ]
    }
};

/**
 * Zwraca sformatowany tekst SQL, podświetlając główne słowa kluczowe.
 */
function _specHighlightSQL(sql) {
    if (!sql) return '';
    let highlighted = escapeHtml(sql);

    // Podświetlanie słów kluczowych (na niebiesko/cyjan)
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 
        'ORDER BY', 'ASC', 'DESC', 'LIMIT', 'AND', 'OR', 'ON', 'NOT IN', 'IN', 'IS NULL', 
        'IS NOT NULL', 'UPDATE', 'SET', 'BEGIN', 'ROLLBACK', 'COMMIT', 'AS', 'EXISTS'
    ];
    
    // Używamy precyzyjnych regexp-ów (słowo z obu stron wolne od liter/cyfr)
    keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        highlighted = highlighted.replace(regex, match => `<span style="color: var(--accent-cyan, #0ea5e9); font-weight: bold;">${match.toUpperCase()}</span>`);
    });

    // Podświetlanie ciągów znaków (np. 'OCZEKUJE') na żółto/bursztynowo
    highlighted = highlighted.replace(/'([^']*)'/g, `<span style="color: var(--accent-amber, #f59e0b);">'$1'</span>`);

    return highlighted;
}

/**
 * Kopiuje zawartość SQL / tekstu do schowka
 * @param {string} text - Tekst do skopiowania
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Skopiowano do schowka!', 'success');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Nie udało się skopiować.', 'error');
    }
}

/**
 * Publiczna funkcja: kopiuje SQL z określonego elementu ID (tzw. handler przycisku)
 */
function copySQLQuery(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        // pobieramy oryginalny tekst (bez tagów HTML)
        const textToCopy = el.textContent || el.innerText;
        copyToClipboard(textToCopy);
    }
}

/**
 * Generuje HTML pojedynczej karty scenariusza
 * @param {Object} scenario - Obiekt scenariusza z konfiguracji
 * @param {string} accentColor - Kolor motywu przewodniego dla systemu
 * @returns {string} - Kod HTML karty
 */
function renderScenarioCard(scenario, accentColor) {
    let symptomsHtml = '';
    if (scenario.symptoms && scenario.symptoms.length > 0) {
        symptomsHtml = `
            <div class="mb-3">
                <strong style="color: var(--text-primary); font-size: 0.9em; display:block; margin-bottom: 5px;">Objawy:</strong>
                <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                    ${scenario.symptoms.map(s => `<span style="background-color: var(--bg-input, #f1f5f9); color: var(--text-secondary, #475569); padding: 2px 8px; border-radius: var(--radius-sm, 4px); font-size: 0.85em; border: 1px solid var(--border-color, #e2e8f0);">${escapeHtml(s)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    let stepsHtml = '';
    if (scenario.steps && scenario.steps.length > 0) {
        stepsHtml = `
            <div class="mb-3">
                <strong style="color: var(--text-primary); font-size: 0.9em; display:block; margin-bottom: 5px;">Kroki diagnozy:</strong>
                <ol style="margin-left: 20px; color: var(--text-secondary); font-size: 0.95em;">
                    ${scenario.steps.map((step, idx) => {
                        let cmdBlock = '';
                        if (step.cmd) {
                            const cmdId = `cmd_${scenario.id}_${idx}`;
                            cmdBlock = `
                                <div style="display:flex; align-items:center; background-color: #1e1e1e; padding: 5px 10px; border-radius: var(--radius-sm, 4px); margin-top: 5px; margin-bottom: 8px;">
                                    <code id="${cmdId}" style="flex:1; font-family: var(--font-mono, monospace); color: #d4d4d4; font-size: 0.85em;">${escapeHtml(step.cmd)}</code>
                                    <button class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 0.7em; margin-left: 10px;" onclick="window.copyToClipboard(document.getElementById('${cmdId}').innerText)" title="Kopiuj polecenie">Kopiuj</button>
                                </div>
                            `;
                        }
                        return `<li style="margin-bottom: 5px;">${escapeHtml(step.action)}${cmdBlock}</li>`;
                    }).join('')}
                </ol>
            </div>
        `;
    }

    let sqlHtml = '';
    if (scenario.sqlQueries && scenario.sqlQueries.length > 0) {
        sqlHtml = `
            <div class="mb-3">
                <strong style="color: var(--text-primary); font-size: 0.9em; display:block; margin-bottom: 5px;">Zapytania SQL / Narzędzia Bazy Danych:</strong>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${scenario.sqlQueries.map((q, idx) => {
                        const sqlId = `sql_${scenario.id}_${idx}`;
                        return `
                            <div style="border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-sm, 4px); background-color: var(--bg-card, #ffffff);">
                                <div style="padding: 5px 10px; border-bottom: 1px solid var(--border-color, #e2e8f0); background-color: var(--bg-input, #f8fafc); display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.85em; font-weight: 600; color: var(--text-secondary);">${escapeHtml(q.label)}</span>
                                    <button class="btn btn-sm btn-primary" onclick="window.copySQLQuery('${sqlId}')" style="font-size: 0.75em; background-color: ${accentColor}; border-color: ${accentColor}; color: #fff;">Kopiuj SQL</button>
                                </div>
                                <div style="padding: 10px; background-color: #1e1e1e; overflow-x: auto; border-bottom-left-radius: var(--radius-sm, 4px); border-bottom-right-radius: var(--radius-sm, 4px);">
                                    <pre style="margin: 0;"><code id="${sqlId}" class="sql-block" style="font-family: var(--font-mono, monospace); font-size: 0.85em; color: #d4d4d4; white-space: pre-wrap;">${_specHighlightSQL(q.sql)}</code></pre>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    let safetyHtml = '';
    if (scenario.safetyNote) {
        safetyHtml = `
            <div style="margin-top: 15px; padding: 10px; border-left: 4px solid var(--accent-rose, #e11d48); background-color: rgba(225, 29, 72, 0.1); border-radius: 0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0;">
                <strong style="color: var(--accent-rose, #e11d48); font-size: 0.9em;">⚠️ UWAGA BEZPIECZEŃSTWA:</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: var(--text-secondary);">${escapeHtml(scenario.safetyNote)}</p>
            </div>
        `;
    }

    return `
        <details style="margin-bottom: 15px; background-color: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 8px); overflow: hidden;">
            <summary style="padding: 15px; cursor: pointer; font-weight: 600; font-size: 1.05em; color: var(--text-primary); outline: none; border-left: 4px solid ${accentColor}; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                <span>${escapeHtml(scenario.title)}</span>
                <span style="color: var(--text-muted, #94a3b8); font-size: 0.8em;">Rozwiń ↓</span>
            </summary>
            <div style="padding: 15px; border-top: 1px solid var(--border-color, #e2e8f0);">
                <p style="font-size: 0.95em; color: var(--text-secondary); margin-top: 0;"><strong>Przyczyna (Root-Cause):</strong> ${escapeHtml(scenario.cause || '')}</p>
                ${symptomsHtml}
                ${stepsHtml}
                ${sqlHtml}
                ${safetyHtml}
            </div>
        </details>
    `;
}

/**
 * Szybkie scenariusze szpitalne (Presety produkcyjne dla 4 systemów)
 */
const MEDICAL_PRESETS = {
    lis_astm: {
        system: 'lis',
        title: '🧪 [LIS: ASTM] Zablokowany bufor analizatora (Timeout port 1234)',
        log: 'ERROR [lis-comm-daemon] Connection timeout to analyzer port 1234; buffer queue frozen with 42 pending ASTM messages; TCP ACK not received within 15000ms.'
    },
    lis_mllp: {
        system: 'lis',
        title: '🔌 [LIS: MLLP] Port 2575 connection refused (Mirth)',
        log: 'Connection refused on MLLP port 2575 while transmitting HL7 ORM^O01 from HIS to LIS; mirth-connect.service active status unknown; socket not listening.'
    },
    lis_parse: {
        system: 'lis',
        title: '📄 [LIS: HL7] Błąd parsowania wyniku ORU R01 (malformed OBX)',
        log: 'HL7 parse error: unexpected segment in ORU^R01 message at line 14: OBX|3|NM|GLU||105|mg/dl|||||F; validation failed, result orphan.'
    },
    lis_stat: {
        system: 'lis',
        title: '🔍 [LIS: STAT] Kolejka próbek CITO nieprzetwarzana (>10 min)',
        log: 'ALERT [queue-manager] Priority STAT order #20240921-9981 waiting in processing queue for 14 minutes; routine orders passing but priority worker thread locked.'
    },

    ekrew_lock: {
        system: 'ekrew',
        title: '🩸 [eKrew: Blokada] Preparat w transakcje_temp (>2h) status ZAREZERWOWANY',
        log: 'WARN [ekrew-core] Blood unit KKCz #PL123456789012 locked with status ZAREZERWOWANY in transakcje_temp since 07:15:00 (>2 hours); cannot issue unit.'
    },
    ekrew_ssl: {
        system: 'ekrew',
        title: '🔐 [eKrew: SSL] Błąd certyfikatu CKiK (SSL verify failed)',
        log: 'SSL certificate verify failed for endpoint https://rejestr.ckik.gov.pl/api/v2/donors: unable to get local issuer certificate (x509: certificate signed by unknown authority).'
    },
    ekrew_isbt: {
        system: 'ekrew',
        title: '🏷️ [eKrew: ISBT] Błąd walidacji kodu ISBT 128',
        log: 'Invalid ISBT 128 barcode format: donation identifier checksum mismatch on scan =A99992012345600; validation rejected blood donation packet.'
    },
    ekrew_inconsistency: {
        system: 'ekrew',
        title: '📦 [eKrew: Magazyn] Niespójność stanu preparatu (wydany ≠ w bazie)',
        log: 'INCONSISTENCY: Preparat FFP #PL998877665544 status_db = DOSTEPNY but wydania status = WYDANY for oddział Anestezjologii i Intensywnej Terapii.'
    },

    patexpert_wsi: {
        system: 'patexpert',
        title: '🖼️ [PatExpert: WSI] Timeout zapisu skanu SVS 15GB na NFS',
        log: 'NFS write timeout after 30s while uploading histopathology whole slide scan /mnt/pacs_storage/wsi/2024_09_HP_1420.svs (file size 14.8 GB); nfs: server not responding.'
    },
    patexpert_tiles: {
        system: 'patexpert',
        title: '🧩 [PatExpert: Kafelki] Błąd serwera kafelków IIIF / powiększeń 40x',
        log: 'Tile server HTTP 504 Gateway Timeout on request /iiif/wsi/2024_09_HP_1420/12/34_56.jpg; OpenSlide failed to read tile buffer at magnification 40x.'
    },
    patexpert_id: {
        system: 'patexpert',
        title: '🔗 [PatExpert: ID] Niespójność numeru badania vs plik skanu',
        log: 'ERROR [wsi-matcher] Study identifier HP-2024-00912 found in database, but corresponding image file slide_HP_2024_00912.svs missing in storage directory.'
    },
    patexpert_storage: {
        system: 'patexpert',
        title: '💾 [PatExpert: Macierz] ENOSPC brak miejsca na macierzy WSI',
        log: 'dmesg: filesystem /mnt/patexpert full (ENOSPC: 0 blocks available, 100% inode usage); scanner Hamamatsu stopped transfer.'
    },

    genetyka_vcf: {
        system: 'genetyka',
        title: '🧬 [Genetyka: VCF] Contig mismatch hg19 vs GRCh38',
        log: 'bcftools: [W::vcf_parse] Contig mismatch: header contains chr1, chr2 (GRCh38 naming) but variant records use 1, 2 (GRCh37/hg19); pipeline terminated with exit code 1.'
    },
    genetyka_oom: {
        system: 'genetyka',
        title: '💥 [Genetyka: OOM] Kernel OOM Killer / JVM heap przy WGS',
        log: 'kernel: [18920.12] Out of memory: Killed process 8841 (java -Xmx32g -jar variant-reporter.jar) total-vm:48GB, anon-rss:32GB; java.lang.OutOfMemoryError: Java heap space.'
    },
    genetyka_snakemake: {
        system: 'genetyka',
        title: '🐍 [Genetyka: Pipeline] Zawieszony pipeline Snakemake',
        log: 'Directory cannot be locked: .snakemake/locks/0.output.lock exists. A previous run may have failed or another Snakemake process is running.'
    },
    genetyka_slurm: {
        system: 'genetyka',
        title: '📊 [Genetyka: SLURM] Zadanie bioinformatyczne zabite przez SLURM',
        log: 'slurmstepd: error: Detected 1 oom-kill event(s) in StepId=49812.0. Some of your processes may have been killed by the cgroup out-of-memory handler.'
    },

    ansible_failed: {
        system: 'ansible',
        title: '🤖 [Ansible: Błąd zadania] fatal: [his-db]: FAILED! rc=1',
        log: 'fatal: [his-db-master.med.local]: FAILED! => {"changed": false, "cmd": ["python3", "/usr/local/bin/sre_pg_pool_guard.py", "--threshold", "30"], "msg": "non-zero return code", "rc": 1, "stderr": "ConnectionRefusedError: [Errno 111] Connection refused on 127.0.0.1:5432"}'
    },
    ansible_unreachable: {
        system: 'ansible',
        title: '🔌 [Ansible: SSH] fatal: [lis-01]: UNREACHABLE! Permission denied',
        log: 'fatal: [lis-01.med.local]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Permission denied (publickey,gssapi-keyex,password).", "unreachable": true}'
    },
    ansible_drift: {
        system: 'ansible',
        title: '🔍 [Ansible: Check Mode] Drift konfiguracji eKrew (changed=4 w --check)',
        log: 'PLAY [eKrew SSL Certificate & Nginx Guard] ********************\nTASK [Wdróż szablon nginx.conf] **********************************\nchanged: [ekrew-node-01.med.local]\nTASK [Sprawdź ważność certyfikatu CKiK] **************************\nchanged: [ekrew-node-01.med.local]\nPLAY RECAP *******************************************************\nekrew-node-01.med.local : ok=6 changed=4 unreachable=0 failed=0 (DRY-RUN)'
    },
    ansible_nfs: {
        system: 'ansible',
        title: '💾 [Ansible: NFS Mount] Timeout montażu macierzy PatExpert PACS',
        log: 'fatal: [pacs-storage-01.med.local]: FAILED! => {"changed": false, "cmd": ["mount", "-t", "nfs", "192.168.10.50:/pacs_wsi", "/mnt/pacs_storage"], "msg": "mount.nfs: Connection timed out", "rc": 32}'
    },
    ansible_lock: {
        system: 'ansible',
        title: '🔒 [Ansible: Lock] E: Could not get lock /var/lib/dpkg/lock-frontend',
        log: 'fatal: [genetyka-compute-02.med.local]: FAILED! => {"changed": false, "msg": "Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 41029 (unattended-upgr)"}'
    }
};

let currentSpecialistSystem = 'auto'; // 'lis' | 'ekrew' | 'patexpert' | 'genetyka' | 'ansible' | 'auto'

/**
 * Wybór aktywnego systemu dla Agenta AI
 */
function setMedicalSelectedSystem(sysKey) {
    currentSpecialistSystem = sysKey;
    if (typeof window !== 'undefined' && window.appState) {
        window.appState.activeSpecialistSystem = sysKey;
    }

    // Aktualizacja wyglądu przycisków wyboru systemu
    document.querySelectorAll('.med-sys-pill').forEach(btn => {
        const isSelected = btn.dataset.sys === sysKey;
        const color = btn.dataset.color || 'var(--accent-teal)';
        btn.style.backgroundColor = isSelected ? color : 'transparent';
        btn.style.color = isSelected ? '#ffffff' : 'var(--text-secondary)';
        btn.style.borderColor = isSelected ? color : 'var(--border-color)';
    });

    // Aktualizacja etykiety przycisku uruchamiania Pilota AI
    const pilotBtn = document.getElementById('med-pilot-launch-btn');
    if (pilotBtn) {
        const sysName = sysKey === 'auto' ? 'Auto-Wykryj' : (SYSTEMS_KB[sysKey]?.name?.split('–')[0]?.trim() || sysKey.toUpperCase());
        pilotBtn.innerHTML = `🤖 Uruchom Pilota AI (${escapeHtml(sysName)}) (Ping-Pong / REPL)`;
    }

    // Odświeżenie paska presetów
    renderMedicalPresetsBar(sysKey);

    // Przełączenie dolnej encyklopedii scenariuszy jeśli wybrano konkretny system
    if (sysKey !== 'auto' && SYSTEMS_KB[sysKey]) {
        renderSystemTab(sysKey);
    }
}

/**
 * Renderuje pasek szybkich scenariuszy
 */
function renderMedicalPresetsBar(sysKey = 'auto') {
    const bar = document.getElementById('medical-preset-bar');
    if (!bar) return;

    let keys = Object.keys(MEDICAL_PRESETS);
    if (sysKey !== 'auto') {
        keys = keys.filter(k => MEDICAL_PRESETS[k].system === sysKey);
    }

    bar.innerHTML = keys.map(k => {
        const p = MEDICAL_PRESETS[k];
        return `
            <button class="btn btn-secondary btn-sm" onclick="window.loadMedicalPreset('${k}')" style="font-size: 0.78rem; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
                ${escapeHtml(p.title)}
            </button>
        `;
    }).join('');
}

/**
 * Ładuje wybrany scenariusz produkcyjny do pola logu
 */
function loadMedicalPreset(presetKey) {
    const preset = MEDICAL_PRESETS[presetKey];
    if (!preset) return;

    const input = document.getElementById('medical-pilot-log-input');
    if (input) {
        input.value = preset.log;
    }

    setMedicalSelectedSystem(preset.system);
    runMedicalOfflineDiagnostics();
    showToast(`Załadowano scenariusz: ${preset.title}`);
}

/**
 * Czyści pole wprowadzania logu
 */
function clearMedicalPilotInput() {
    const input = document.getElementById('medical-pilot-log-input');
    if (input) {
        input.value = "";
        input.focus();
    }
}

/**
 * Lokalna diagnostyka offline na podstawie bazy 24 scenariuszy
 */
function runMedicalOfflineDiagnostics() {
    const input = document.getElementById('medical-pilot-log-input');
    const output = document.getElementById('medical-diagnostics-output');
    if (!input || !output) return;

    const text = input.value.trim();
    if (!text) {
        output.innerHTML = `
            <div style="background: rgba(255, 183, 3, 0.1); border: 1px solid var(--accent-amber); border-radius: var(--radius-md); padding: 16px; color: var(--accent-amber);">
                Wpisz treść błędu, logu lub wybierz jeden ze scenariuszy powyżej, aby uruchomić diagnostykę.
            </div>
        `;
        return;
    }

    const activeSys = currentSpecialistSystem;
    const lowerText = text.toLowerCase();

    // Wyszukujemy najbardziej pasujący scenariusz w SYSTEMS_KB
    let matchedScenario = null;
    let matchedSysKey = null;

    const systemsToSearch = (activeSys !== 'auto' && SYSTEMS_KB[activeSys])
        ? [activeSys]
        : Object.keys(SYSTEMS_KB);

    let highestScore = 0;

    systemsToSearch.forEach(sKey => {
        const sys = SYSTEMS_KB[sKey];
        sys.scenarios.forEach(sc => {
            let score = 0;
            const titleWords = sc.title.toLowerCase().split(/\s+/);
            titleWords.forEach(w => {
                if (w.length > 3 && lowerText.includes(w)) score += 3;
            });
            sc.symptoms.forEach(sym => {
                const symWords = sym.toLowerCase().split(/\s+/);
                symWords.forEach(w => {
                    if (w.length > 3 && lowerText.includes(w)) score += 2;
                });
            });
            if (sc.cause && lowerText.includes(sc.cause.toLowerCase().slice(0, 15))) {
                score += 4;
            }

            if (score > highestScore) {
                highestScore = score;
                matchedScenario = sc;
                matchedSysKey = sKey;
            }
        });
    });

    if (matchedScenario && highestScore >= 3) {
        const sys = SYSTEMS_KB[matchedSysKey];
        output.innerHTML = `
            <div style="border: 2px solid ${sys.color}; background: var(--bg-card); border-radius: var(--radius-md); padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">${sys.icon}</span>
                        <div>
                            <span style="background: ${sys.color}; color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">
                                ${escapeHtml(sys.name)} • Dopasowano w Bazie Wiedzy
                            </span>
                            <h3 style="margin: 4px 0 0 0; color: var(--text-primary); font-size: 1.15rem;">
                                ${escapeHtml(matchedScenario.title)}
                            </h3>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="window.runMedicalPilotConsultation()" style="background: ${sys.color}; border-color: ${sys.color}; font-weight: 700;">
                        🤖 Uruchom Pilota AI dla tego problemu
                    </button>
                </div>

                <div style="margin-bottom: 14px; padding: 10px 14px; background: rgba(0,0,0,0.04); border-left: 3px solid ${sys.color}; border-radius: 4px;">
                    <strong style="color: var(--text-primary); font-size: 0.9rem;">💡 Przyczyna (Root-Cause):</strong>
                    <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 4px;">
                        ${escapeHtml(matchedScenario.cause)}
                    </div>
                </div>

                <!-- Karta Scenariusza -->
                ${renderScenarioCard(matchedScenario, sys.color)}
            </div>
        `;
    } else {
        output.innerHTML = `
            <div style="border: 1px solid var(--border-color); background: var(--bg-card); border-radius: var(--radius-md); padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <h4 style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                        <span>🔍</span> Wstępny Triage Diagnostyczny IT
                    </h4>
                    <button class="btn btn-primary btn-sm" onclick="window.runMedicalPilotConsultation()" style="background: var(--accent-teal); border-color: var(--accent-teal);">
                        🤖 Uruchom Pilota AI (Wieloturowa Diagnoza Ping-Pong)
                    </button>
                </div>
                <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
                    Nie znaleziono w 100% identycznego szablonu w statycznej bazie 24 scenariuszy. Zalecana procedura Zero-Risk:
                </p>
                <ol style="margin-left: 20px; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                    <li>Zweryfikuj stan usługi: <code>sudo systemctl status &lt;usługa&gt;</code></li>
                    <li>Sprawdź ostatnie błędy w journalu: <code>sudo journalctl -u &lt;usługa&gt; -n 50 --no-pager</code></li>
                    <li>Sprawdź nasłuch gniazd sieciowych: <code>ss -tlnp | grep -E '2575|4242|5432|8080'</code></li>
                    <li>Uruchom <strong>Pilota AI</strong> powyżej, aby asystent dobrał i przetestował komendy krok po kroku!</li>
                </ol>
            </div>
        `;
    }
}

/**
 * Dostępne modele Google Gemini API z rekomendacjami inżynierskimi
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
 * Generuje znaczniki <option> dla selecta wyboru modelu
 */
function renderMedicalModelSelectOptions(currentModel) {
    return GEMINI_MODELS.map(m => `
        <option value="${m.value}" ${currentModel === m.value ? 'selected' : ''}>
            ${escapeHtml(m.label)}
        </option>
    `).join('');
}

/**
 * Obsługa zmiany aktywnego modelu Gemini w zakładce specjalisty medycznego
 */
function onMedicalGeminiModelChange(modelName) {
    if (!modelName || !window.geminiService) return;
    window.geminiService.setModel(modelName);

    // Synchronizacja wszystkich kontrolek wyboru modelu w aplikacji
    const ids = ['med-gemini-model-select', 'med-gemini-config-model-select', 'med-pilot-inline-model-select', 'gemini-model-select'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== modelName) {
            el.value = modelName;
        }
    });

    updateMedicalGeminiStatusUI();
    if (typeof window.updateGeminiStatusUI === 'function') {
        window.updateGeminiStatusUI();
    }
    showToast(`Ustawiono aktywny model AI: ${modelName}`, 'success');
}

/**
 * Przełączanie widoczności panelu konfiguracji API w zakładce medycznej
 */
function toggleMedicalGeminiConfigUI() {
    const panel = document.getElementById('medical-gemini-config-section');
    if (!panel) return;

    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        renderMedicalGeminiConfigUI();
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        panel.style.display = 'none';
    }
}

/**
 * Renderuje panel konfiguracji klucza API i modelu w zakładce medycznej
 */
function renderMedicalGeminiConfigUI() {
    const panel = document.getElementById('medical-gemini-config-section');
    if (!panel || !window.geminiService) return;

    const currentKey = window.geminiService.getApiKey() || "";
    const currentModel = window.geminiService.getModel();
    const isConfigured = window.geminiService.hasApiKey();

    panel.innerHTML = `
        <div class="card" style="background: var(--bg-card); border: 2px solid #a855f7; padding: 20px; border-radius: var(--radius-md); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h4 style="color: #c084fc; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; margin: 0;">
                        🤖 Konfiguracja Google Gemini AI dla Systemów Medycznych
                    </h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0;">
                        Wybierz model i wprowadź klucz API. Konfiguracja obowiązuje dla wszystkich procedur Pilota REPL (LIS, eKrew, PatExpert, Genetyka).
                    </p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="window.toggleMedicalGeminiConfigUI()">✕ Zamknij</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: end; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                        Klucz Google Gemini API:
                    </label>
                    <input type="password" id="med-gemini-api-key-input" class="doc-input" style="font-family: var(--font-mono); font-size: 0.85rem;" placeholder="Wklej klucz API (np. AIzaSy...)" value="${escapeHtml(currentKey)}" />
                </div>
                <div>
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                        Wybór Modelu AI:
                    </label>
                    <select id="med-gemini-config-model-select" class="doc-input" style="font-size: 0.85rem;" onchange="window.onMedicalGeminiModelChange(this.value)">
                        ${renderMedicalModelSelectOptions(currentModel)}
                    </select>
                </div>
            </div>

            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" style="background: #9333ea; border-color: #9333ea;" onclick="window.saveMedicalGeminiApiKeyUI()">💾 Zapisz Konfigurację</button>
                ${isConfigured ? `<button class="btn btn-secondary btn-sm" onclick="window.testMedicalGeminiConnectionUI()">⚡ Testuj Połączenie (Ping)</button>` : ''}
                ${isConfigured ? `<button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.removeMedicalGeminiApiKeyUI()">🗑️ Usuń Klucz</button>` : ''}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; color: var(--accent-cyan); text-decoration: underline; margin-left: 6px;">
                    🔗 Wygeneruj darmowy klucz w Google AI Studio
                </a>
            </div>

            <div id="med-gemini-test-result" style="margin-top: 10px;"></div>
        </div>
    `;
}

/**
 * Aktualizuje stan przycisku konfiguracji Gemini w zakładce medycznej
 */
function updateMedicalGeminiStatusUI() {
    const btn = document.getElementById('med-gemini-status-btn');
    if (!btn || !window.geminiService) return;

    const currentModel = window.geminiService.getModel();
    if (window.geminiService.hasApiKey()) {
        btn.innerHTML = `🟢 Model: ${escapeHtml(currentModel)}`;
        btn.style.color = 'var(--accent-teal)';
        btn.style.borderColor = 'rgba(6, 214, 160, 0.4)';
    } else {
        btn.innerHTML = `⚙️ Skonfiguruj Klucz (${escapeHtml(currentModel)})`;
        btn.style.color = 'var(--accent-amber)';
        btn.style.borderColor = 'rgba(255, 183, 3, 0.3)';
    }

    const sel = document.getElementById('med-gemini-model-select');
    if (sel && sel.value !== currentModel) {
        sel.value = currentModel;
    }
}

/**
 * Zapisuje klucz i model w konfiguracji medycznej
 */
function saveMedicalGeminiApiKeyUI() {
    const keyInput = document.getElementById('med-gemini-api-key-input');
    const modelSelect = document.getElementById('med-gemini-config-model-select');
    if (!keyInput || !window.geminiService) return;

    const key = keyInput.value.trim();
    if (!key) {
        alert("Wpisz klucz API!");
        return;
    }

    window.geminiService.setApiKey(key);
    if (modelSelect && modelSelect.value) {
        window.geminiService.setModel(modelSelect.value);
    }

    updateMedicalGeminiStatusUI();
    if (typeof window.updateGeminiStatusUI === 'function') {
        window.updateGeminiStatusUI();
    }
    renderMedicalGeminiConfigUI();
    showToast(`Zapisano konfigurację Gemini API (${window.geminiService.getModel()})!`);
}

/**
 * Usuwa klucz API
 */
function removeMedicalGeminiApiKeyUI() {
    if (confirm("Czy na pewno chcesz usunąć klucz Gemini API z przeglądarki?")) {
        if (window.geminiService) {
            window.geminiService.removeApiKey();
            updateMedicalGeminiStatusUI();
            if (typeof window.updateGeminiStatusUI === 'function') {
                window.updateGeminiStatusUI();
            }
            renderMedicalGeminiConfigUI();
            showToast("Usunięto klucz Gemini API.");
        }
    }
}

/**
 * Testuje połączenie z Gemini API z poziomu zakładki medycznej
 */
async function testMedicalGeminiConnectionUI() {
    const resultDiv = document.getElementById('med-gemini-test-result');
    const modelSelect = document.getElementById('med-gemini-config-model-select');
    if (!resultDiv || !window.geminiService) return;

    if (modelSelect && modelSelect.value) {
        window.geminiService.setModel(modelSelect.value);
        updateMedicalGeminiStatusUI();
    }

    const activeModel = window.geminiService.getModel();
    resultDiv.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">⏳ Testowanie połączenia z modelem ${escapeHtml(activeModel)}...</span>`;

    try {
        const res = await window.geminiService.callGemini("Odpowiedz jednym zdaniem: Czy system diagnostyczny LIS/eKrew/PatExpert/Genetyka jest gotowy?");
        resultDiv.innerHTML = `
            <div style="background: rgba(6, 214, 160, 0.1); border: 1px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 10px; font-size: 0.82rem; color: var(--accent-teal);">
                ✅ <strong>Połączenie aktywne z modelem ${escapeHtml(activeModel)}!</strong><br/>Odpowiedź: "${escapeHtml(res.trim())}"
            </div>
        `;
        showToast(`Połączenie z ${activeModel} działa bezbłędnie!`);
    } catch (err) {
        resultDiv.innerHTML = `
            <div style="background: rgba(239, 71, 111, 0.1); border: 1px solid var(--accent-rose); border-radius: var(--radius-sm); padding: 12px; font-size: 0.82rem; color: var(--accent-rose);">
                ❌ <strong>Błąd połączenia (${escapeHtml(activeModel)}):</strong> ${escapeHtml(err.message)}
            </div>
        `;
    }
}

/**
 * Szybkie przełączenie modelu w razie przeciążenia i ponowienie procedury
 */
function quickSwitchMedicalModelAndRetry(newModel) {
    if (window.geminiService) {
        onMedicalGeminiModelChange(newModel);
        showToast(`Przełączono na ${newModel}. Ponawiam procedurę...`);
        runMedicalPilotConsultation();
    }
}

/**
 * Uruchamia sesję interaktywnego Pilota AI (Ping-Pong / REPL) dla wybranego systemu
 */
async function runMedicalPilotConsultation() {
    const input = document.getElementById('medical-pilot-log-input');
    const geminiOutput = document.getElementById('medical-gemini-output');
    if (!input || !geminiOutput) return;

    const rawLog = input.value.trim();
    if (!rawLog) {
        showToast("Wklej treść błędu lub wybierz scenariusz do zdiagnozowania!");
        return;
    }

    if (!window.geminiService || !window.geminiService.hasApiKey()) {
        if (typeof window.toggleMedicalGeminiConfigUI === 'function') {
            window.toggleMedicalGeminiConfigUI();
        } else if (typeof window.toggleGeminiConfigUI === 'function') {
            window.toggleGeminiConfigUI();
        }
        showToast("Najpierw podaj klucz Gemini API w konfiguracji!");
        return;
    }

    // Synchronizuj model z selektora jeśli istnieje
    const modelSelect = document.getElementById('med-gemini-model-select');
    if (modelSelect && modelSelect.value && window.geminiService) {
        window.geminiService.setModel(modelSelect.value);
        updateMedicalGeminiStatusUI();
    }

    const sysKey = currentSpecialistSystem;
    const session = window.geminiService.getMedicalPilotSession();

    geminiOutput.style.display = 'block';
    geminiOutput.innerHTML = `
        <div class="card" style="border: 2px solid #a855f7; background: var(--bg-card); padding: 20px; border-radius: var(--radius-md); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.1);">
            <div style="display: flex; align-items: center; gap: 10px; color: #c084fc; font-size: 1rem; font-weight: 700;">
                <span class="pulse-dot" style="display: inline-block; width: 10px; height: 10px; background: #a855f7; border-radius: 50%;"></span>
                Uruchamianie Agenta AI i Pilota Medycznego (${escapeHtml(session._getSystemDisplay(sysKey))} • ${escapeHtml(window.geminiService.getModel())})... Generowanie Kroku 1...
            </div>
        </div>
    `;
    geminiOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        await session.start(rawLog, {}, { systemType: sysKey });
        renderMedicalPilotUI();
        showToast(`Pilot ${session._getSystemDisplay(session.systemType)} (${window.geminiService.getModel()}) przygotował Krok 1!`);
    } catch (err) {
        const isHighDemand = err.message.toLowerCase().includes("high demand") || err.message.toLowerCase().includes("przeciążony");
        geminiOutput.innerHTML = `
            <div class="card" style="border: 2px solid var(--accent-rose); background: var(--bg-card); padding: 18px; border-radius: var(--radius-md);">
                <div style="color: var(--accent-rose); font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    ❌ Błąd uruchomienia Pilota Medycznego:
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
                    ${escapeHtml(err.message)}
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm" onclick="window.quickSwitchMedicalModelAndRetry('gemini-2.5-flash')">
                        ⭐ Przełącz na gemini-2.5-flash (Stabilny GA) i ponów
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.quickSwitchMedicalModelAndRetry('gemini-3.5-flash')">
                        ⚡ Przełącz na gemini-3.5-flash i ponów
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.toggleMedicalGeminiConfigUI()">
                        ⚙️ Zmień Konfigurację / Model AI
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * Renderuje interfejs interaktywnego Pilota AI (Ping-Pong / REPL) dla systemów medycznych
 */
function renderMedicalPilotUI() {
    const geminiOutput = document.getElementById('medical-gemini-output');
    const session = window.geminiService?.getMedicalPilotSession();
    if (!geminiOutput || !session) return;

    const currentModel = window.geminiService ? window.geminiService.getModel() : 'Gemini AI';
    const isResolved = session.isResolved;
    const sysDisplay = session._getSystemDisplay(session.systemType);

    // Wybór koloru akcentu
    let themeColor = '#a855f7';
    if (session.systemType === 'lis') themeColor = '#06d6a0';
    if (session.systemType === 'ekrew') themeColor = '#ef476f';
    if (session.systemType === 'patexpert') themeColor = '#8338ec';
    if (session.systemType === 'genetyka') themeColor = '#3b82f6';
    if (session.systemType === 'ansible') themeColor = '#e63946';

    const statusBadge = isResolved
        ? `<span style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-teal);">🟢 STAN: [AWARIA ROZWIĄZANA]</span>`
        : `<span style="background: rgba(255, 183, 3, 0.15); color: var(--accent-amber); font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-amber);">🟡 STAN: W trakcie procedury (Krok ${session.stepNumber})</span>`;

    geminiOutput.innerHTML = `
        <div class="card" style="border: 2px solid ${themeColor}; background: var(--bg-card); padding: 18px 20px; border-radius: var(--radius-md); box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            
            <!-- Pasek Pamięci Kontekstowej (Memory Header) -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                        <span style="background: ${themeColor}; color: #ffffff; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 12px;">
                            🤖 Pilot AI: ${escapeHtml(sysDisplay)}
                        </span>

                        <!-- Inline Model Selector -->
                        <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 0, 0, 0.08); border: 1px solid var(--border-color); border-radius: 12px; padding: 2px 8px;">
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700;">🧠 Model:</span>
                            <select id="med-pilot-inline-model-select" style="background: transparent; color: var(--text-primary); border: none; font-size: 0.75rem; font-weight: 600; cursor: pointer; outline: none; padding: 1px 4px; max-width: 220px;" onchange="window.onMedicalGeminiModelChange(this.value)">
                                ${renderMedicalModelSelectOptions(currentModel)}
                            </select>
                        </div>

                        ${statusBadge}
                        <span style="background: rgba(0, 180, 216, 0.12); color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(0, 180, 216, 0.3);">
                            📦 Moduł: <code>${escapeHtml(session.detectedService)}</code>
                        </span>
                    </div>
                    <div style="font-size: 0.84rem; color: var(--text-secondary);">
                        <strong style="color: ${themeColor};">💡 Bieżąca hipoteza:</strong> ${escapeHtml(session.hypothesis || 'Analiza logu błędu')}
                    </div>
                </div>

                <!-- Przyciski akcji w nagłówku -->
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.copyMedicalPilotScript()" title="Kopiuj wszystkie wygenerowane komendy i zapytania SQL">
                        📋 Kopiuj Procedurę
                    </button>
                    <button class="btn btn-primary btn-sm" style="background: ${themeColor}; border-color: ${themeColor}; font-size: 0.75rem; color: #fff;" onclick="window.saveMedicalPilotSessionAsRunbook()">
                        💾 Zapisz do Runbooka
                    </button>
                    <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.resetMedicalPilotSession()">
                        🔄 Resetuj Sesję
                    </button>
                    <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="window.closeMedicalPilotUI()">
                        ✕ Schowaj
                    </button>
                </div>
            </div>

            <!-- Zgłoszony log wyjściowy (Zwijany) -->
            <details style="margin-bottom: 14px; background: rgba(0, 0, 0, 0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
                <summary style="font-size: 0.78rem; color: var(--accent-cyan); cursor: pointer; font-weight: 700;">
                    📋 Zgłoszony log / błąd wejściowy (kliknij aby podejrzeć)
                </summary>
                <pre style="margin-top: 8px; padding: 6px; font-size: 0.76rem; background: var(--bg-card); max-height: 100px; overflow-y: auto;"><code>${escapeHtml(session.rawLog)}</code></pre>
            </details>

            <!-- Wątek Incydentu (Chat Stream) -->
            <div id="medical-pilot-thread" style="display: flex; flex-direction: column; gap: 14px; max-height: 440px; overflow-y: auto; padding-right: 6px; margin-bottom: 16px;">
                ${session.turns.map((t, idx) => {
                    if (t.type === 'agent') {
                        const p = t.parsed;
                        const isSqlCmd = p.isSQL || /^\s*(SELECT|SHOW|EXPLAIN|WITH)\b/i.test(p.command || '');
                        const cmdTypeLabel = isSqlCmd ? '🗄️ Zapytanie SQL (DBeaver / psql)' : '💻 Komenda Bash (Terminal)';
                        const cmdLang = isSqlCmd ? 'sql' : 'bash';

                        return `
                            <div style="background: var(--bg-card); border-left: 4px solid ${themeColor}; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 0.78rem; font-weight: 800; color: ${themeColor}; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 6px;">
                                        🤖 Pilot AI (${sysDisplay}) • Krok ${t.stepNumber}
                                    </span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.timestamp)}</span>
                                </div>

                                ${p.diagnosis ? `
                                    <div style="margin-bottom: 8px; font-size: 0.84rem; color: #a7f3d0; background: rgba(6, 214, 160, 0.08); padding: 6px 12px; border-radius: 4px; border-left: 2px solid var(--accent-teal);">
                                        <strong>💡 Diagnoza:</strong> ${escapeHtml(p.diagnosis)}
                                    </div>
                                ` : ''}

                                ${(!p.isResolved && p.goal) ? `
                                    <div style="font-size: 0.9rem; color: var(--text-primary); font-weight: 600; margin-bottom: 8px;">
                                        🎯 <strong>Cel:</strong> ${escapeHtml(p.goal)}
                                    </div>
                                ` : ''}

                                ${(!p.isResolved && p.command) ? `
                                    <div style="background: var(--bg-input, #0b1120); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px 12px; margin-bottom: 8px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">${cmdTypeLabel}:</span>
                                            <button class="btn btn-secondary btn-sm" style="padding: 1px 8px; font-size: 0.72rem;" onclick="window.copyToClipboard(document.getElementById('med-cmd-${t.stepNumber}').innerText)">📋 Kopiuj</button>
                                        </div>
                                        <pre style="margin: 0; padding: 4px 0; background: transparent;"><code id="med-cmd-${t.stepNumber}" style="color: #67e8f9; font-size: 0.88rem; font-family: var(--font-mono); white-space: pre-wrap;">${escapeHtml(p.command)}</code></pre>
                                    </div>
                                ` : ''}

                                ${(!p.isResolved && p.expectation) ? `
                                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                        <div style="font-size: 0.82rem; color: #fde047;">
                                            ❓ <strong>Oczekiwanie:</strong> ${escapeHtml(p.expectation)}
                                        </div>
                                        <button class="btn btn-secondary btn-sm" onclick="window.askMedicalStepFeedback(${t.stepNumber})" style="font-size: 0.72rem; padding: 2px 8px; color: ${themeColor}; border-color: var(--border-color);">
                                            💬 Problem z tym krokiem? (Zapytaj o korektę)
                                        </button>
                                    </div>
                                ` : ''}

                                ${p.isResolved ? `
                                    <div style="margin-top: 12px; background: rgba(6, 214, 160, 0.15); border: 2px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 12px; color: var(--accent-teal);">
                                        <h4 style="margin: 0 0 4px 0; font-size: 1rem;">🎉 [AWARIA ROZWIĄZANA]</h4>
                                        <p style="margin: 0 0 10px 0; font-size: 0.82rem; color: var(--text-primary);">
                                            Procedura zakończona sukcesem! Usługa medyczna i system szpitalny działają poprawnie.
                                        </p>
                                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                            <button class="btn btn-primary btn-sm" onclick="window.saveMedicalPilotSessionAsRunbook()">💾 Zapisz kompletny Runbook do bazy</button>
                                            <button class="btn btn-secondary btn-sm" onclick="window.resetMedicalPilotSession()">🔄 Rozpocznij nową sesję</button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    } else {
                        return `
                            <div style="background: rgba(15, 23, 42, 0.6); border-left: 4px solid var(--accent-cyan); border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <span style="font-size: 0.78rem; font-weight: 800; color: var(--accent-cyan);">
                                        💻 Inżynier (Wynik terminala / klienta SQL) • Krok ${t.stepNumber}
                                    </span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.timestamp)}</span>
                                </div>
                                <pre style="margin: 0; padding: 8px 10px; background: #0b1120; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.06); max-height: 160px; overflow-y: auto;"><code style="color: #4ade80; font-family: var(--font-mono); font-size: 0.82rem; white-space: pre-wrap;">${escapeHtml(t.text)}</code></pre>
                            </div>
                        `;
                    }
                }).join('')}
            </div>

            <!-- Dolny Pasek Wprowadzania Wyniku (Input Console) -->
            ${!isResolved ? `
                <div id="medical-pilot-input-box" style="background: var(--bg-card); border: 1.5px solid ${themeColor}; border-radius: var(--radius-sm); padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label for="medical-pilot-input" style="font-size: 0.82rem; font-weight: 700; color: ${themeColor};">
                            💬 Wklej wynik terminala lub klienta SQL dla Kroku ${session.stepNumber}:
                        </label>
                        <span style="font-size: 0.72rem; color: var(--text-muted);">Skrót: <strong>Ctrl + Enter</strong> aby wysłać</span>
                    </div>
                    <textarea id="medical-pilot-input" class="doc-textarea" style="min-height: 65px; font-family: var(--font-mono); font-size: 0.85rem; color: #fde047;" placeholder="Wklej tutaj to, co zwrócił terminal lub zapytanie SELECT... (lub kliknij przycisk poniżej jeśli komenda powiodła się bez wyjścia)"></textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
                        <button class="btn btn-primary btn-sm" id="medical-pilot-submit-btn" onclick="window.submitMedicalPilotInput()">
                            ⚡ Wyślij wynik do analizy (Ctrl+Enter)
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window.sendMedicalPilotQuickSuccess()">
                            ✅ Sukces (Brak błędów / Kod 0 / Zapytanie OK)
                        </button>
                        <button class="btn btn-secondary btn-sm" style="color: var(--accent-amber);" onclick="window.submitMedicalPilotInput('Błąd zapytania: relacja lub tabela nie istnieje w schemacie bazy danych')">
                            ⚠️ Brak tabeli w bazie
                        </button>
                        <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.submitMedicalPilotInput('Błąd uprawnień: Permission denied / dostęp zablokowany')">
                            🔒 Brak uprawnień
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window.submitMedicalPilotInput('Zapytanie SELECT zwróciło 0 wierszy (brak wyników dla podanego kryterium)')">
                            🔍 Pusty wynik (0 wierszy)
                        </button>
                    </div>
                    <div id="medical-pilot-loading" style="display: none; margin-top: 8px; font-size: 0.8rem; color: ${themeColor};">
                        <span class="pulse-dot" style="display: inline-block; width: 8px; height: 8px; background: ${themeColor}; border-radius: 50%; margin-right: 6px;"></span>
                        Pilot AI analizuje wynik i przygotowuje kolejną procedurę Zero-Risk...
                    </div>
                </div>
            ` : `
                <div style="background: rgba(6, 214, 160, 0.08); border: 1.5px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="font-size: 0.92rem; font-weight: 800; color: var(--accent-teal); display: flex; align-items: center; gap: 6px;">
                            <span>🎉</span> Awaria w systemie ${escapeHtml(sysDisplay)} została pomyślnie rozwiązana!
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                            Wprowadzanie wyników zostało zablokowane. Możesz zapisać pełny raport do Bazy Runbooków.
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm" style="background: var(--accent-teal); border-color: var(--accent-teal); font-weight: 700;" onclick="window.saveMedicalPilotSessionAsRunbook()">
                            💾 Zapisz post-mortem do Runbooka
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window.resetMedicalPilotSession()">
                            🔄 Rozpocznij nowy incydent
                        </button>
                    </div>
                </div>
            `}

        </div>
    `;

    // Auto-scroll i obsługa Ctrl+Enter
    setTimeout(() => {
        const thread = document.getElementById('medical-pilot-thread');
        if (thread) {
            thread.scrollTop = thread.scrollHeight;
        }
        const inputElem = document.getElementById('medical-pilot-input');
        if (inputElem) {
            inputElem.focus();
            inputElem.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    submitMedicalPilotInput();
                }
            });
        }
    }, 50);
}

/**
 * Przesyła kolejną turę inżyniera do Pilota AI
 */
async function submitMedicalPilotInput(overrideText) {
    const session = window.geminiService?.getMedicalPilotSession();
    if (!session) return;

    if (session.isResolved) {
        showToast("Awaria została już rozwiązana! Rozpocznij nową sesję lub zapisz runbook.");
        return;
    }

    const inputElem = document.getElementById('medical-pilot-input');
    const text = overrideText !== undefined ? overrideText : (inputElem ? inputElem.value : "");

    if (overrideText === undefined && (!text || !text.trim())) {
        showToast("Wklej wynik z terminala lub klienta SQL!");
        if (inputElem) inputElem.focus();
        return;
    }

    const submitBtn = document.getElementById('medical-pilot-submit-btn');
    const loadingDiv = document.getElementById('medical-pilot-loading');
    if (submitBtn) submitBtn.disabled = true;
    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        await session.sendUserTurn(text);
        renderMedicalPilotUI();
        showToast(`Pilot przygotował Krok ${session.stepNumber}!`);
    } catch (err) {
        showToast(`Błąd pilota: ${err.message}`);
        if (loadingDiv) {
            loadingDiv.innerHTML = `<span style="color: var(--accent-rose);">❌ ${escapeHtml(err.message)}</span>`;
        }
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Szybkie potwierdzenie sukcesu dla Pilota AI
 */
function sendMedicalPilotQuickSuccess() {
    submitMedicalPilotInput("[Polecenie/zapytanie wykonało się pomyślnie (exit code 0 / brak błędu / potwierdzone)]");
}

/**
 * Step Feedback Engine: pyta o problem z danym krokiem i wysyła do Pilota
 */
function askMedicalStepFeedback(stepNumber) {
    const defaultText = `Krok ${stepNumber}: Wystąpił problem przy wykonaniu tego kroku (błąd uprawnień / brak tabeli / nieoczekiwany wynik). Zaproponuj alternatywną, bezpieczną komendę lub zapytanie weryfikujące.`;
    const userFeedback = prompt(`Podaj informację zwrotną dla Kroku ${stepNumber} (lub wklej treść błędu):`, defaultText);
    if (userFeedback && userFeedback.trim()) {
        submitMedicalPilotInput(userFeedback.trim());
    }
}

/**
 * Zapisuje sesję pilota medycznego jako rekord do bazy Runbooków
 */
function saveMedicalPilotSessionAsRunbook() {
    const session = window.geminiService?.getMedicalPilotSession();
    if (!session || session.turns.length === 0) {
        showToast("Brak historii sesji pilota do zapisania.");
        return;
    }

    const record = session.toRunbookRecord();
    if (window.appState && typeof window.appState.saveIncidentRunbook === 'function') {
        window.appState.saveIncidentRunbook(record);
        if (typeof window.renderRunbooksArchiveUI === 'function') {
            window.renderRunbooksArchiveUI();
        }
        showToast(`Zapisano sesję Pilota (${record.system}) do Twojej Bazy Runbooków!`, 'success');
    }
}

/**
 * Kopiuje całą procedurę wygenerowaną przez Pilota jako skrypt Bash/SQL
 */
function copyMedicalPilotScript() {
    const session = window.geminiService?.getMedicalPilotSession();
    if (!session) return;
    const cmds = session.getAllCommands();
    if (cmds.length === 0) {
        showToast("Brak wygenerowanych komend lub zapytań.");
        return;
    }

    const sysDisplay = session._getSystemDisplay(session.systemType);
    let script = `# ==========================================================================\n`;
    script += `# Procedura Naprawcza IT: ${sysDisplay}\n`;
    script += `# Data: ${new Date().toLocaleString('pl-PL')}\n`;
    script += `# Moduł: ${session.detectedService}\n`;
    script += `# Hipoteza: ${session.hypothesis}\n`;
    script += `# ==========================================================================\n\n`;

    session.turns.forEach(t => {
        if (t.type === 'agent' && t.parsed && t.parsed.command) {
            const label = t.parsed.goal || `Krok ${t.stepNumber}`;
            script += `\n# --- Krok ${t.stepNumber}: ${label} ---\n`;
            script += `${t.parsed.command}\n`;
        }
    });

    copyToClipboard(script);
}

/**
 * Resetuje sesję pilota medycznego
 */
function resetMedicalPilotSession() {
    if (confirm("Czy na pewno chcesz zresetować bieżącą sesję pilota i rozpocząć od nowa?")) {
        const session = window.geminiService?.getMedicalPilotSession();
        if (session) {
            session.reset();
        }
        runMedicalPilotConsultation();
    }
}

/**
 * Ukrywa okno pilota medycznego
 */
function closeMedicalPilotUI() {
    const geminiOutput = document.getElementById('medical-gemini-output');
    if (geminiOutput) geminiOutput.style.display = 'none';
}

/**
 * Renderuje zawartość wybranej zakładki (systemu) w encyklopedii
 * @param {string} systemKey - Klucz z obiektu SYSTEMS_KB
 */
function renderSystemTab(systemKey) {
    const container = document.getElementById('specialist-tab-content');
    if (!container) return;
    
    const system = SYSTEMS_KB[systemKey];
    if (!system) return;

    if (window.appState) {
        window.appState.activeSpecialistTab = systemKey;
    }
    try {
        localStorage.setItem('healthtech_specialist_tab', systemKey);
    } catch(e) {}

    // Aktualizacja wizualna menu zakładek
    document.querySelectorAll('.specialist-tab-btn').forEach(btn => {
        if (btn.dataset.system === systemKey) {
            btn.style.backgroundColor = system.color;
            btn.style.color = '#ffffff';
            btn.style.borderColor = system.color;
        } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderColor = 'var(--border-color)';
        }
    });

    // Render zawartości tab'a
    let contentHtml = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: var(--text-primary); display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="font-size: 1.2em;">${system.icon}</span> 
                ${escapeHtml(system.name)}
            </h3>
            <p style="color: var(--text-muted); font-size: 0.95em;">${escapeHtml(system.description)}</p>
        </div>
        
        <div>
            <h4 style="color: var(--text-primary); margin-bottom: 15px; font-size: 1.1em;">Baza Scenariuszy Diagnostycznych</h4>
            ${system.scenarios.map(s => renderScenarioCard(s, system.color)).join('')}
        </div>
    `;

    container.innerHTML = contentHtml;
}

/**
 * Główna funkcja renderująca moduł bazy wiedzy i Agenta AI
 */
function renderSystemsSpecialistModule() {
    const rootContainer = document.getElementById('systems-specialist-container');
    if (!rootContainer) {
        console.error('Brak elementu #systems-specialist-container w DOM!');
        return;
    }

    let initialTab = 'lis';
    try {
        const savedTab = localStorage.getItem('healthtech_specialist_tab');
        if (savedTab && SYSTEMS_KB[savedTab]) {
            initialTab = savedTab;
        }
    } catch(e) {}

    const systemsKeys = Object.keys(SYSTEMS_KB);
    const currentModel = window.geminiService ? window.geminiService.getModel() : 'gemini-3.5-flash';

    let html = `
        <div class="systems-specialist-wrapper" style="background: var(--bg-card, #ffffff); border-radius: var(--radius-md, 8px); border: 1px solid var(--border-color, #e2e8f0); padding: 20px;">
            
            <!-- Konsola Diagnostyczna Agenta AI & Pilota REPL -->
            <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid var(--border-color, #e2e8f0);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">
                                🛡️ Zero-Risk Hospital Policy
                            </span>
                            <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">
                                🤖 Ping-Pong / REPL Pilot
                            </span>
                        </div>
                        <h2 style="color: var(--text-primary); margin: 0; font-size: 1.35rem;">
                            🏥 Agent AI & Pilot Diagnostyczny IT (LIS / eKrew / PatExpert / Genetyka / Ansible)
                        </h2>
                        <p style="color: var(--text-secondary); font-size: 0.88rem; margin: 4px 0 0 0;">
                            Wybierz środowisko szpitalne, wklej fragment logu lub kliknij scenariusz awarii. Agent prowadzi interaktywną procedurę krok po kroku z weryfikacją komend Bash, zapytań SELECT oraz playbooków Ansible.
                        </p>
                    </div>
                </div>

                <!-- Przełącznik Systemów (Pill Selector) -->
                <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="lis" data-color="#06d6a0" onclick="window.setMedicalSelectedSystem('lis')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🧪 LIS (Laboratorium)
                    </button>
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="ekrew" data-color="#ef476f" onclick="window.setMedicalSelectedSystem('ekrew')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🩸 eKrew (Bank Krwi)
                    </button>
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="patexpert" data-color="#8338ec" onclick="window.setMedicalSelectedSystem('patexpert')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🔬 PatExpert (Patomorfologia)
                    </button>
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="genetyka" data-color="#3b82f6" onclick="window.setMedicalSelectedSystem('genetyka')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🧬 Genetyka (NGS / WGS)
                    </button>
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="ansible" data-color="#e63946" onclick="window.setMedicalSelectedSystem('ansible')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🤖 Ansible (SRE)
                    </button>
                    <button class="med-sys-pill btn btn-secondary btn-sm" data-sys="auto" data-color="#00b4d8" onclick="window.setMedicalSelectedSystem('auto')" style="font-weight: 600; padding: 6px 14px; border-radius: 20px;">
                        🤖 Auto-Wykryj z logu
                    </button>
                </div>

                <!-- Pasek Szybkich Scenariuszy Produkcyjnych -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ⚡ Szybkie Scenariusze Szpitalne (1-Click Presets):
                    </div>
                    <div id="medical-preset-bar" style="display: flex; gap: 8px; flex-wrap: wrap; overflow-x: auto; padding-bottom: 4px;">
                        <!-- Ładowane dynamicznie przez renderMedicalPresetsBar -->
                    </div>
                </div>

                <!-- Pole Wprowadzania Logu -->
                <div style="margin-bottom: 14px;">
                    <textarea id="medical-pilot-log-input" class="hl7-raw-input" style="min-height: 95px; width: 100%; color: #67e8f9; font-family: var(--font-mono); font-size: 0.85rem; padding: 10px 12px; background: #0f172a; border: 1px solid var(--border-color); border-radius: var(--radius-sm);" placeholder="Wklej tutaj treść błędu z logu analizatora, eKrew, PatExpert, pipeline genetycznego, zadania Ansible lub klienta SQL...">${escapeHtml(MEDICAL_PRESETS.lis_astm.log)}</textarea>
                </div>

                <!-- Przyciski Akcji i Wybór Modelu AI -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <button class="btn btn-primary" onclick="window.runMedicalOfflineDiagnostics()" style="font-weight: 600;">
                            ⚡ Zdiagnozuj (Lokalna Baza Scenariuszy)
                        </button>
                        <button id="med-pilot-launch-btn" class="btn btn-secondary" onclick="window.runMedicalPilotConsultation()" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border-color: rgba(168, 85, 247, 0.4); font-weight: 700;">
                            🤖 Uruchom Pilota AI (LIS) (Ping-Pong / REPL)
                        </button>
                        <button class="btn btn-secondary" onclick="window.clearMedicalPilotInput()">
                            🧹 Wyczyść
                        </button>
                        <a href="#specialist-kb-section" class="btn btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center;">
                            📖 Pełna Baza Wiedzy (30 scenariuszy) ↓
                        </a>
                    </div>

                    <!-- Panel Wyboru Modelu AI w Zakładce Medycznej -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: rgba(0, 0, 0, 0.05); padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <label for="med-gemini-model-select" style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; margin: 0;">
                            <span>🧠 Model AI:</span>
                        </label>
                        <select id="med-gemini-model-select" class="doc-input" style="font-size: 0.8rem; padding: 4px 8px; height: auto; max-width: 290px;" onchange="window.onMedicalGeminiModelChange(this.value)">
                            ${renderMedicalModelSelectOptions(currentModel)}
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="window.toggleMedicalGeminiConfigUI()" id="med-gemini-status-btn" style="font-size: 0.75rem; padding: 5px 10px;">
                            ⚙️ Konfiguracja Klucza
                        </button>
                    </div>
                </div>

                <!-- Rozwijany Panel Konfiguracji Gemini API dla Systemów Medycznych -->
                <div id="medical-gemini-config-section" style="display: none; margin-top: 14px;"></div>
            </div>

            <!-- Kontener Wyjściowy Pilota AI Gemini (Ping-Pong / REPL) -->
            <div id="medical-gemini-output" style="display: none; margin-bottom: 24px;"></div>

            <!-- Kontener Wyjściowy Diagnozy Lokalnej Offline -->
            <div id="medical-diagnostics-output" style="margin-bottom: 24px;"></div>

            <!-- Sekcja Bazy Wiedzy (30 Scenariuszy) -->
            <div id="specialist-kb-section" style="margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="color: var(--text-primary); margin: 0; font-size: 1.15rem;">
                            📚 Encyklopedia Scenariuszy Diagnostycznych, SQL i Ansible
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 2px 0 0 0;">
                            Wybierz system, aby przeglądać gotowe szablony procedur, objawy, root-cause, zapytania SQL oraz playbooki Ansible.
                        </p>
                    </div>
                </div>

                <!-- Pasek zakładek bazy wiedzy -->
                <div style="display: flex; gap: 10px; border-bottom: 2px solid var(--border-color, #e2e8f0); padding-bottom: 15px; margin-bottom: 20px; overflow-x: auto;">
                    ${systemsKeys.map(k => {
                        const sys = SYSTEMS_KB[k];
                        return `
                            <button 
                                class="specialist-tab-btn btn btn-secondary" 
                                data-system="${k}"
                                onclick="window.renderSystemTab('${k}')"
                                style="
                                    white-space: nowrap; 
                                    font-weight: 500; 
                                    transition: all 0.2s ease;
                                    padding: 8px 16px;
                                    border-radius: var(--radius-sm, 4px);
                                    cursor: pointer;
                                ">
                                ${sys.icon} ${escapeHtml(sys.name)}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Kontener na zawartość aktywnej zakładki bazy wiedzy -->
                <div id="specialist-tab-content" style="min-height: 400px;">
                    <!-- Treść ładuje się tutaj poprzez renderSystemTab -->
                </div>
            </div>

        </div>
    `;

    rootContainer.innerHTML = html;

    // Inicjalizacja domyślnego systemu i lokalnej analizy
    setMedicalSelectedSystem(initialTab);
    runMedicalOfflineDiagnostics();
    updateMedicalGeminiStatusUI();
}

// Eksport globalny
if (typeof window !== 'undefined') {
    window.SYSTEMS_KB = SYSTEMS_KB;
    window.MEDICAL_PRESETS = MEDICAL_PRESETS;
    window.GEMINI_MODELS = GEMINI_MODELS;
    window.renderSystemsSpecialistModule = renderSystemsSpecialistModule;
    window.renderSystemTab = renderSystemTab;
    window.setMedicalSelectedSystem = setMedicalSelectedSystem;
    window.loadMedicalPreset = loadMedicalPreset;
    window.clearMedicalPilotInput = clearMedicalPilotInput;
    window.runMedicalOfflineDiagnostics = runMedicalOfflineDiagnostics;
    window.runMedicalPilotConsultation = runMedicalPilotConsultation;
    window.renderMedicalPilotUI = renderMedicalPilotUI;
    window.submitMedicalPilotInput = submitMedicalPilotInput;
    window.sendMedicalPilotQuickSuccess = sendMedicalPilotQuickSuccess;
    window.askMedicalStepFeedback = askMedicalStepFeedback;
    window.saveMedicalPilotSessionAsRunbook = saveMedicalPilotSessionAsRunbook;
    window.copyMedicalPilotScript = copyMedicalPilotScript;
    window.resetMedicalPilotSession = resetMedicalPilotSession;
    window.closeMedicalPilotUI = closeMedicalPilotUI;
    window.copySQLQuery = copySQLQuery;
    window.copyToClipboard = copyToClipboard;
    window.onMedicalGeminiModelChange = onMedicalGeminiModelChange;
    window.toggleMedicalGeminiConfigUI = toggleMedicalGeminiConfigUI;
    window.renderMedicalGeminiConfigUI = renderMedicalGeminiConfigUI;
    window.updateMedicalGeminiStatusUI = updateMedicalGeminiStatusUI;
    window.saveMedicalGeminiApiKeyUI = saveMedicalGeminiApiKeyUI;
    window.removeMedicalGeminiApiKeyUI = removeMedicalGeminiApiKeyUI;
    window.testMedicalGeminiConnectionUI = testMedicalGeminiConnectionUI;
    window.quickSwitchMedicalModelAndRetry = quickSwitchMedicalModelAndRetry;
}

})();
