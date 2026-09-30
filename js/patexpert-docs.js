/**
 * HealthTech Onboarding Hub - Moduł Tworzenia Dokumentacji i Weryfikacji Powdrożeniowej dla PatExpert (patexpert-docs.js)
 * 
 * Dedykowany Agent AI wyspecjalizowany w:
 * - Testach funkcjonalnych (Test Case)
 * - Weryfikacji powdrożeniowej (Post-release QA)
 * - Testach regresji w pracowni histopatologicznej
 * - Dokumentacji technicznej dla I linii wsparcia (problem -> diagnoza -> rozwiązanie)
 * - Sugerowaniu testów dymnych (Smoke Test 5-10 min) dla ścieżek krytycznych
 * - Pełnej integracji z Google Gemini API z wyborem 11 modeli i trybem offline fallback
 */

(function () {
    'use strict';

    // Pomocnik bezpiecznego kodowania HTML
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Pomocnik powiadomień Toast
    function showToast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[Toast ${type || 'info'}]: ${msg}`);
        }
    }

    /**
     * Dostępne modele Google Gemini API
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
     * Presety zmian wdrożeniowych dla systemu PatExpert
     */
    const PATEXPERT_DOC_PRESETS = {
        pdf_hang: {
            id: 'pdf_hang',
            title: 'Zawieszanie się aplikacji podczas generowania raportów histopatologicznych do pliku PDF',
            module: 'Moduł Raportowania i Eksportu Dokumentacji (PDF Engine)',
            env: 'Produkcja',
            badge: '🔥 Główny Scenariusz Sesji',
            badgeColor: '#ef476f',
            isCriticalPath: false,
            desc: `Zespół programistów wdrożył na środowisku produkcyjnym poprawkę do systemu PatExpert, która rozwiązuje problem z zawieszaniem się aplikacji podczas generowania raportów histopatologicznych do pliku PDF.
Błąd występował szczególnie w badaniach z dużą liczbą dołączonych zdjęć makrofotograficznych o wysokiej rozdzielczości (formaty JPG/TIFF z aparatu sekcyjnego) oraz rozbudowanymi tabelami barwień immunohistochemicznych (IHC). 
Wprowadzona poprawka zastępuje dotychczasowy synchroniczny bufor pamięciowy mechanizmem strumieniowania dokumentu PDF (iText / PDFBox) z automatyczną kompresją obrazów w locie (do 300 DPI) oraz asynchronicznym procesem w tle zapobiegającym blokowaniu interfejsu użytkownika.`,
            offlinePackage: {
                testCase: {
                    id: 'TC-PX-2026-PDF01',
                    title: 'Weryfikacja stabilności generowania raportu PDF z makrofotografiami wysokiej rozdzielczości i tabelami IHC',
                    module: 'Moduł Raportowania i Eksportu Dokumentacji (PDF Engine)',
                    preconditions: [
                        'Konto w PatExpert z uprawnieniami lekarza patologa lub technika sekcyjnego (profil: Lekarz / Autoryzacja)',
                        'Przynajmniej jedno badanie histopatologiczne ze statusem "W TRAKCIE OPISU" lub "ZAAKCEPTOWANE" zawierające co najmniej 4 zdjęcia makro (rozmiar każdego > 5 MB) oraz minimum 3 pozycje w tabeli barwień IHC',
                        'Dostęp do stacji roboczej z zainstalowaną zaktualizowaną wersją klienta PatExpert oraz przeglądarką PDF'
                    ],
                    steps: [
                        'Zaloguj się do aplikacji PatExpert na stacji testowej z profilem diagnostycznym.',
                        'W menu głównym przejdź do "Pracownia Histopatologiczna" -> "Lista Badań w Toku".',
                        'Wyszukaj przygotowane badanie testowe zawierające zdjęcia makrofotograficzne (np. nr badania HP/2026/TEST01).',
                        'Otwórz formularz opisu badania i przejdź do zakładki "Dokumentacja i Raporty".',
                        'Kliknij przycisk "Generuj Raport PDF (Zatwierdzony Wzór Szpitalny)".',
                        'Obserwuj zachowanie interfejsu aplikacji: pasek postępu generowania, brak komunikatu "Brak odpowiedzi" systemu Windows oraz czas ukończenia operacji.',
                        'Po wygenerowaniu pliku otwórz raport PDF i zweryfikuj czytelność tekstu, poprawność tabeli barwień IHC oraz jakość załączonych zdjęć makro.'
                    ],
                    expectedResult: 'Raport PDF generuje się bez zawieszenia interfejsu PatExpert w czasie poniżej 5 sekund. Pasek postępu działa płynnie. Wygenerowany plik PDF otwiera się poprawnie, zawiera wszystkie strony, zdjęcia makroskopowe są skompresowane i czytelne, a tabele barwień IHC posiadają nienaruszony układ graficzny.'
                },
                regressionTest: {
                    module: 'Moduł Druku Etykiet i Archiwizacji Dokumentacji Zlecenia',
                    reason: 'Biblioteka generatora PDF i bufor wydruku są współdzielone z modułem eksportu kart informacyjnych pacjenta i podglądu bloczków parafinowych. Zmiana kompresji w locie mogła wpłynąć na inne szablony wydruku.',
                    steps: [
                        'W otwartym badaniu wybierz opcję "Drukuj Kartę Obiegu Materiału Tkankowego (PDF)".',
                        'Zweryfikuj czy kod kreskowy 2D/DataMatrix oraz nagłówek z danymi pacjenta generują się prawidłowo bez przesunięć marginesów.',
                        'Wykonaj eksport skróconego wyniku histopatologicznego do formatu PDF i upewnij się, że podpis elektroniczny patologa jest poprawnie osadzony.'
                    ],
                    expectedResult: 'Wszystkie pozostałe szablony dokumentów PDF generują się prawidłowo, kody kreskowe zachowują ostre krawędzie niezbędne dla skanerów laboratoryjnych, a pozycjonowanie elementów graficznych jest nienaruszone.'
                },
                knowledgeBase: {
                    title: 'Procedura postępowania w przypadku błędu generowania raportu PDF w PatExpert',
                    problem: 'Użytkownik zgłasza, że podczas próby wygenerowania lub wydruku raportu z badania histopatologicznego aplikacja PatExpert zawiesza się ("Brak odpowiedzi"), a plik PDF nie zostaje utworzony.',
                    diagnosis: 'Problem wynikał z przepełnienia bufora pamięci RAM procesu podczas przetwarzania nieskompresowanych zdjęć makrofotograficznych o bardzo wysokiej rozdzielczości dołączonych do opisu badania.',
                    solutionSteps: [
                        'Upewnij się, że na stacji użytkownika zainstalowano najnowszą wersję klienta PatExpert (z poprawką silnika PDF Streamer).',
                        'Jeśli aplikacja jest zawieszona, zakończ proces PatExpert.exe w Menedżerze Zadań (Ctrl+Shift+Esc).',
                        'Uruchom ponownie PatExpert i zweryfikuj rozmiar zdjęć w badaniu: jeśli pojedyncze zdjęcie przekracza 15 MB, poproś użytkownika o użycie wbudowanego narzędzia "Optymalizuj zdjęcia przed eksportem".',
                        'Wyczyść lokalny katalog tymczasowy bufora wydruku: C:\\Users\\[Użytkownik]\\AppData\\Local\\Temp\\PatExpert\\PDF_Cache.',
                        'Ponów próbę wygenerowania raportu — dokument powinien utworzyć się w ciągu kilku sekund. W razie powtórzenia błędu przekaż zgłoszenie do II linii z logiem z pliku %APPDATA%\\PatExpert\\logs\\pdf_engine.log.'
                    ]
                }
            }
        },
        order_lock: {
            id: 'order_lock',
            title: 'Błąd zapisu zlecenia histopatologicznego i blokada numeracji kasetek parafinowych',
            module: 'Rejestracja Zleceń i Pracownia Kasetek Parafinowych',
            env: 'Produkcja',
            badge: '⚠️ Ścieżka Krytyczna (Smoke Test)',
            badgeColor: '#ffb703',
            isCriticalPath: true,
            desc: `Wdrożono hotfix na produkcji usuwający błąd współbieżności (deadlock) w generatorze numeracji kasetek parafinowych (sekwencer badania HP).
Błąd objawiał się blokadą tabeli 'zlecenia_hp' i błędem transakcji przy jednoczesnej rejestracji zleceń cito przez wielu techników z różnych stacji.`,
            offlinePackage: {
                hasSmokeTest: true,
                smokeTest: {
                    reason: 'Modyfikacja dotyczy ścieżki krytycznej rejestracji zlecenia i alokacji numerów identyfikacyjnych kasetek parafinowych. Awaria tego modułu paraliżuje przyjęcie materiału tkankowego z bloków operacyjnych szpitala.',
                    steps: [
                        'Zaloguj się na dwóch niezależnych stacjach roboczych do PatExpert.',
                        'Na obu stacjach rozpocznij jednoczesną rejestrację nowego zlecenia histopatologicznego dla materiału tkankowego.',
                        'Zweryfikuj pobranie unikalnego numeru badania z sekwencera (brak komunikatu o zablokowanym rekordzie).',
                        'Wygeneruj 3 kasetki parafinowe (A1, A2, A3) i zapisz zlecenie.',
                        'Upewnij się, że oba zlecenia zapisały się w bazie z kolejnymi, unikalnymi identyfikatorami.'
                    ]
                },
                testCase: {
                    id: 'TC-PX-2026-REG02',
                    title: 'Weryfikacja braku deadlocka przy współbieżnej rejestracji zleceń i automatycznej numeracji kasetek',
                    module: 'Rejestracja Zleceń i Pracownia Kasetek Parafinowych',
                    preconditions: [
                        'Dwa aktywne konta techników histopatologii na dwóch oddzielnych sesjach/komputerach',
                        'Dostępna pula danych testowych pacjentów w bazie PatExpert',
                        'Podłączona lub skonfigurowana drukarka kasetek (np. Primera / Leica)'
                    ],
                    steps: [
                        'Otwórz moduł "Rejestracja Materiału Tkankowego" na Stacji A i Stacji B.',
                        'Wprowadź dane pacjentów testowych i w tym samym momencie kliknij "Generuj Numery Kasetek (Cito)".',
                        'Zatwierdź zapis zlecenia na obu stacjach w odstępie mniejszym niż 2 sekundy.',
                        'Zweryfikuj czy oba formularze zamknęły się bez błędu ORA-00054 / Deadlock Detected.',
                        'Przejdź do modułu "Wycinki i Kasetki" i upewnij się, że numery kasetek nie zawierają duplikatów ani luk w sekwencji.'
                    ],
                    expectedResult: 'Zlecenia na obu stacjach zapisują się pomyślnie. Numery kasetek dla obu zleceń zostają przydzielone ściśle unikalnie, bez opóźnień i bez blokowania tabeli transakcyjnej.'
                },
                regressionTest: {
                    module: 'Moduł Procesorów Tkankowych i Wydawania Preparatów',
                    reason: 'Numer kasetki jest unikalnym kluczem obcym przekazywanym do protokołów procesorów tkankowych i barwiarek automatycznych.',
                    steps: [
                        'Otwórz nowo zarejestrowane zlecenie w module "Zarządzanie Koszykami Procesora".',
                        'Dodaj utworzone kasetki do protokołu odwadniania tkanki.',
                        'Sprawdź czy skaner kodów 2D odczytuje identyfikator kasetki bez błędu parsowania.'
                    ],
                    expectedResult: 'Kasetki są prawidłowo przypisywane do koszyków procesora, a identyfikatory są w 100% zgodne ze specyfikacją protokołu.'
                },
                knowledgeBase: {
                    title: 'Procedura postępowania w przypadku błędu blokady zapisu zlecenia w PatExpert',
                    problem: 'Użytkownik widzi błąd: "Rekord jest zablokowany przez innego użytkownika" lub "Timeout oczekiwania na numer kasetki" podczas próby zapisu nowego badania.',
                    diagnosis: 'Sytuacja występuje, gdy poprzednia transakcja rejestracji nie została prawidłowo zatwierdzona w bazie lub stacja sieciowa utraciła połączenie w trakcie pobierania sekwencji.',
                    solutionSteps: [
                        'Poproś użytkownika o odczekanie 30 sekund na automatyczne wycofanie wiszącej transakcji przez mechanizm lock-manager.',
                        'Jeśli problem nadal występuje, zamknij okno rejestracji zlecenia (bez zapisywania) i otwórz je ponownie.',
                        'Sprawdź, czy na innej stacji w pracowni nie pozostało otwarte w trybie edycji to samo badanie.',
                        'Jeśli błąd występuje u wszystkich techników, skontaktuj się z administratorem bazy danych w celu zweryfikowania blokad na tabeli zlecenia_hp.'
                    ]
                }
            }
        },
        wsi_preview: {
            id: 'wsi_preview',
            title: 'Brak podglądu skanów Whole Slide Imaging (WSI/SVS) z macierzy NFS w mikroskopie wirtualnym',
            module: 'Mikroskopia Wirtualna i Integracja Storage PACS/WSI',
            env: 'Produkcja',
            badge: '🔬 Moduł Cyfrowej Patologii',
            badgeColor: '#8338ec',
            isCriticalPath: false,
            desc: `Poprawka biblioteki OpenSlide / serwera kafelkowania (IIIF Tile Server). Rozwiązuje problem braku podglądu ciężkich preparatów histopatologicznych (pliki SVS i NDPI powyżej 5 GB) przechowywanych na macierzy sieciowej NFS po stronie klienta PatExpert.`,
            offlinePackage: {
                testCase: {
                    id: 'TC-PX-2026-WSI03',
                    title: 'Weryfikacja płynności ładowania kafelków obrazu WSI > 5 GB w oknie mikroskopu wirtualnego',
                    module: 'Mikroskopia Wirtualna i Integracja Storage PACS/WSI',
                    preconditions: [
                        'Konto patologa z uprawnieniem do przeglądania skanów cyfrowych WSI',
                        'Dostępny skan preparatu testowego w formacie .svs o rozmiarze min. 5 GB na zasobie NFS /mnt/pacs_storage/wsi',
                        'Stacja robocza podłączona do sieci szpitalnej z przepustowością min. 1 Gbps'
                    ],
                    steps: [
                        'Zaloguj się do PatExpert i wyszukaj badanie z dołączonym skanem WSI.',
                        'Kliknij ikonę mikroskopu wirtualnego "Podgląd WSI".',
                        'Wykonaj operacje powiększania (zoom 4x -> 10x -> 20x -> 40x) oraz przesuwania pola widzenia (panoramic pan).',
                        'Upewnij się, że poszczególne kafelki (tiles) doładowują się w czasie poniżej 1 sekundy bez czarnych pól.',
                        'Zweryfikuj działanie paska minimapy preparatu w rogu ekranu.'
                    ],
                    expectedResult: 'Mikroskop wirtualny otwiera preparat płynnie. Kafelki obrazu przy powiększeniu do 40x wczytują się dynamicznie w czasie < 1s. Nie występują błędy timeoutu montażu NFS ani czarne artefakty graficzne.'
                },
                regressionTest: {
                    module: 'Moduł Adnotacji i Pomiarów Mikrometrycznych',
                    reason: 'Układ współrzędnych i kalibracja mikrometrów bazują na nagłówku piramidy obrazu WSI przetwarzanym przez serwer kafelków.',
                    steps: [
                        'W oknie mikroskopu wirtualnego wybierz narzędzie "Linijka / Pomiar wielkości nacieku (μm)".',
                        'Zmierz wybraną strukturę tkankową i zapisz adnotację do badania.',
                        'Zamknij i otwórz ponownie podgląd, sprawdzając trwałość naniesionej adnotacji.'
                    ],
                    expectedResult: 'Narzędzie pomiarowe wskazuje prawidłową skalę w mikrometrach, a naniesiona adnotacja jest trwale powiązana z badaniem.'
                },
                knowledgeBase: {
                    title: 'Procedura postępowania w przypadku czarnego ekranu w podglądzie skanu WSI w PatExpert',
                    problem: 'Patolog zgłasza, że po kliknięciu ikony mikroskopu okno podglądu preparatu jest czarne lub wyświetla komunikat "Timeout ładowania obrazu".',
                    diagnosis: 'Komunikat oznacza brak dostępu stacji roboczej lub serwera kafelków do macierzy sieciowej NFS ze skanami WSI bądź przeciążenie łącza sieciowego.',
                    solutionSteps: [
                        'Zweryfikuj czy stacja lekarza ma stabilne połączenie z siecią przewodową szpitala (Wi-Fi może nie udźwignąć strumieniowania skanów WSI).',
                        'Poproś lekarza o odświeżenie okna podglądu (przycisk F5 w oknie mikroskopu).',
                        'Sprawdź, czy inne badania otwierają się poprawnie (jeśli tylko jedno badanie ma problem, plik skanu mógł nie ukończyć przesyłania ze skanera Aperio/Hamamatsu).',
                        'Jeśli błąd występuje dla wszystkich preparatów, zgłoś do administratora sieci weryfikację montażu NFS na serwerze PatExpert.'
                    ]
                }
            }
        },
        his_export: {
            id: 'his_export',
            title: 'Błąd eksportu wyniku HL7 ORU R01 do szpitalnego systemu HIS po autoryzacji przez patologa',
            module: 'Integracja Szpitalna (HL7 v2 MLLP / HIS Interface)',
            env: 'Produkcja',
            badge: '🏥 Integracja Szpitalna HIS',
            badgeColor: '#06d6a0',
            isCriticalPath: false,
            desc: `Poprawka kodowania znaków UTF-8 i formatowania strukturalnego segmentów OBX-5 w komunikatach HL7 ORU^R01 wysyłanych do centralnego szpitalnego systemu HIS (np. Asseco AMMS / CGM Clininet / Kamsoft) po ostatecznym zatwierdzeniu wyniku przez patologa.`,
            offlinePackage: {
                testCase: {
                    id: 'TC-PX-2026-HL704',
                    title: 'Weryfikacja poprawności generowania ramki HL7 ORU R01 z polskimi znakami diakrytycznymi po autoryzacji badania',
                    module: 'Integracja Szpitalna (HL7 v2 MLLP / HIS Interface)',
                    preconditions: [
                        'Konto patologa z uprawnieniem do ostatecznej autoryzacji wyników',
                        'Skonfigurowany port MLLP do testowego nasłuchu HL7 (lub symulatora Mirth Connect)',
                        'Badanie histopatologiczne zawierające w rozpoznaniu pełny zestaw polskich znaków (np. "Guz pęcherza moczowego, naciekający mięśniówkę")'
                    ],
                    steps: [
                        'Otwórz przygotowane badanie w PatExpert.',
                        'Wprowadź ostateczne rozpoznanie histopatologiczne i kliknij "Autoryzuj Wynik (Zakończ Badanie)".',
                        'Sprawdź w logu integracyjnym PatExpert wygenerowany komunikat HL7 ORU^R01.',
                        'Zweryfikuj w segmencie MSH-18 poprawność deklaracji strony kodowej (UTF-8).',
                        'W segmencie OBX-5 sprawdź, czy polskie znaki (ą, ę, ś, ć, ż, ź, ó, ł, ń) nie uległy zniekształceniu (krzaczki).'
                    ],
                    expectedResult: 'Komunikat HL7 ORU^R01 zostaje wygenerowany natychmiast po autoryzacji. System HIS odsyła potwierdzenie MSA|AA. Wszystkie polskie znaki są zachowane, a struktura segmentów spełnia wymagania specyfikacji HL7.'
                },
                regressionTest: {
                    module: 'Moduł Zmiany Statusu Zlecenia w Rejestracji',
                    reason: 'Wysłanie komunikatu HL7 ORU wyzwala w PatExpert zmianę statusu zlecenia na "WYSŁANE DO HIS".',
                    steps: [
                        'Wróć do listy badań ogólnych i odśwież widok.',
                        'Sprawdź, czy status autoryzowanego badania zmienił się na "ZAKOŃCZONE - PRZEKAZANO DO HIS".'
                    ],
                    expectedResult: 'Status badania w PatExpert jest spójny ze statusem w centralnym systemie szpitalnym.'
                },
                knowledgeBase: {
                    title: 'Procedura postępowania w przypadku błędu eksportu wyniku do HIS w PatExpert',
                    problem: 'Lekarz oddziałowy zgłasza, że w systemie HIS nie widzi wyniku histopatologicznego, mimo że patolog potwierdził zakończenie badania.',
                    diagnosis: 'Komunikat HL7 mógł zostać odrzucony przez bramkę integracyjną HIS z powodu błędu walidacji znaków lub przerwy w komunikacji na porcie MLLP.',
                    solutionSteps: [
                        'W PatExpert przejdź do "Narzędzia Administracyjne" -> "Monitor Kolejki HL7".',
                        'Wyszukaj zlecenie po numerze badania lub PESEL pacjenta i sprawdź status ramki.',
                        'Jeśli status to "BŁĄD WYSYŁANIA", kliknij przycisk "Pokaż błąd ACK" aby sprawdzić przyczynę odrzucenia przez HIS.',
                        'Kliknij "Ponów wysyłkę (Retry)", aby wymusić ponowne wysłanie komunikatu.',
                        'Jeśli komunikat ponownie nie dotrze, przekaż treść błędu do zespołu integracji szpitalnej.'
                    ]
                }
            }
        },
        incomplete_info: {
            id: 'incomplete_info',
            title: 'Zgłoszenie niepełne: Poprawka w module badań',
            module: 'Nieokreślony',
            env: 'Staging',
            badge: '❓ Test Wykrywania Braków',
            badgeColor: '#3a86ff',
            isCriticalPath: false,
            desc: `Poprawiono błąd w badaniach.`,
            offlinePackage: {
                isClarificationNeeded: true,
                clarificationQuestions: [
                    'Którego konkretnie modułu lub podmodułu dotyczy zmiana (np. rejestracja zlecenia, opis mikroskopowy, preparatyka kasetek, eksport PDF czy integracja HL7)?',
                    'Jakie konkretne działanie użytkownika lub wywołanie systemowe wywoływało opisywany błąd?',
                    'Jaki był dokładny objaw błędu (np. komunikat o błędzie, zawieszenie aplikacji, niepoprawne dane w bazie)?',
                    'Czy zmiana dotyka ścieżki krytycznej (np. procesu rejestracji zlecenia, zapisu do bazy lub logowania)?'
                ],
                testCase: null,
                regressionTest: null,
                knowledgeBase: null
            }
        }
    };

    /**
     * Główny stan modułu dokumentacji PatExpert
     */
    let docState = {
        activePreset: 'pdf_hang',
        isGenerating: false,
        lastResult: null,
        chatHistory: []
    };

    /**
     * Generuje opcje dla listy rozwijanej modeli Gemini
     */
    function renderDocModelSelectOptions(currentModel) {
        return GEMINI_MODELS.map(m => `
            <option value="${m.value}" ${currentModel === m.value ? 'selected' : ''}>
                ${escapeHtml(m.label)}
            </option>
        `).join('');
    }

    /**
     * Obsługa zmiany modelu Gemini w module dokumentacji
     */
    function onDocGeminiModelChange(modelName) {
        if (!modelName || !window.geminiService) return;
        window.geminiService.setModel(modelName);

        // Synchronizacja wszystkich kontrolek w aplikacji
        const ids = [
            'doc-gemini-model-select',
            'doc-gemini-config-model-select',
            'med-gemini-model-select',
            'med-gemini-config-model-select',
            'med-pilot-inline-model-select',
            'gemini-model-select'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value !== modelName) {
                el.value = modelName;
            }
        });

        updateDocGeminiStatusUI();
        if (typeof window.updateGeminiStatusUI === 'function') {
            window.updateGeminiStatusUI();
        }
        if (typeof window.updateMedicalGeminiStatusUI === 'function') {
            window.updateMedicalGeminiStatusUI();
        }
        showToast(`Ustawiono aktywny model AI: ${modelName}`, 'success');
    }

    /**
     * Aktualizacja wskaźnika statusu API w module dokumentacji
     */
    function updateDocGeminiStatusUI() {
        const btn = document.getElementById('doc-gemini-status-btn');
        if (!btn || !window.geminiService) return;

        const hasKey = window.geminiService.hasApiKey();
        const currentModel = window.geminiService.getModel();

        if (hasKey) {
            btn.innerHTML = `🟢 Gemini API: <strong>${escapeHtml(currentModel)}</strong>`;
            btn.style.borderColor = 'var(--accent-teal, #06d6a0)';
            btn.style.color = 'var(--accent-teal, #06d6a0)';
            btn.title = `Połączono z Google Gemini API (Model: ${currentModel}). Kliknij aby zarządzać.`;
        } else {
            btn.innerHTML = `🟡 Tryb Offline / Brak Klucza API`;
            btn.style.borderColor = 'var(--accent-amber, #ffb703)';
            btn.style.color = 'var(--accent-amber, #ffb703)';
            btn.title = `Brak klucza API Gemini. Kliknij aby wprowadzić klucz lub korzystaj z wbudowanych pakietów offline.`;
        }

        const modelSelect = document.getElementById('doc-gemini-model-select');
        if (modelSelect && modelSelect.value !== currentModel) {
            modelSelect.value = currentModel;
        }
    }

    /**
     * Otwiera / zamyka rozwijany panel konfiguracji API
     */
    function toggleDocGeminiConfigUI() {
        const panel = document.getElementById('doc-gemini-config-section');
        if (!panel) return;
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'block';
            renderDocGeminiConfigUI();
        } else {
            panel.style.display = 'none';
        }
    }

    /**
     * Renderuje zawartość panelu konfiguracji API
     */
    function renderDocGeminiConfigUI() {
        const panel = document.getElementById('doc-gemini-config-section');
        if (!panel || !window.geminiService) return;

        const hasKey = window.geminiService.hasApiKey();
        const currentKey = window.geminiService.getApiKey();
        const currentModel = window.geminiService.getModel();
        const maskedKey = currentKey ? `${currentKey.substring(0, 6)}...${currentKey.substring(currentKey.length - 4)}` : '';

        panel.innerHTML = `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                        <span>⚙️ Konfiguracja Google Gemini API (PatExpert QA Agent)</span>
                    </h4>
                    <button class="btn btn-secondary btn-sm" onclick="window.toggleDocGeminiConfigUI()">✕ Zamknij</button>
                </div>
                <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 16px;">
                    Model Gemini zasila Agenta AI w automatycznym tworzeniu scenariuszy testowych, analizy regresji i wpisów do bazy wiedzy. 
                    Klucz API jest przechowywany wyłącznie w Twojej przeglądarce (Bring Your Own Key).
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Klucz Google Gemini API:</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="password" id="doc-gemini-key-input" class="form-control" style="flex: 1; font-family: monospace;" 
                                   placeholder="AIzaSy..." value="${escapeHtml(currentKey || '')}">
                            <button class="btn btn-primary btn-sm" onclick="window.saveDocGeminiApiKeyUI()">💾 Zapisz</button>
                            ${hasKey ? `<button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.removeDocGeminiApiKeyUI()">🗑️</button>` : ''}
                        </div>
                        ${hasKey ? `<div style="font-size: 0.75rem; color: var(--accent-teal); margin-top: 4px;">Aktywny klucz: ${maskedKey}</div>` : ''}
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Wybierz Model Gemini dla QA i Dokumentacji:</label>
                        <select id="doc-gemini-config-model-select" class="form-control" onchange="window.onDocGeminiModelChange(this.value)">
                            ${renderDocModelSelectOptions(currentModel)}
                        </select>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                            Rekomendowany: <strong>gemini-3.5-flash</strong> (maksymalna precyzja, determinizm procedur).
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.testDocGeminiConnectionUI()">
                        🧪 Przetestuj połączenie z modelem
                    </button>
                    <span id="doc-gemini-test-result" style="font-size: 0.85rem;"></span>
                </div>
            </div>
        `;
    }

    /**
     * Zapis klucza API z formularza dokumentacji
     */
    function saveDocGeminiApiKeyUI() {
        const input = document.getElementById('doc-gemini-key-input');
        if (!input || !window.geminiService) return;
        const key = input.value.trim();
        if (!key) {
            showToast("Wprowadź prawidłowy klucz API.", "warning");
            return;
        }
        window.geminiService.setApiKey(key);
        renderDocGeminiConfigUI();
        updateDocGeminiStatusUI();
        if (typeof window.updateGeminiStatusUI === 'function') {
            window.updateGeminiStatusUI();
        }
        showToast("Klucz Gemini API został pomyślnie zapisany!", "success");
    }

    /**
     * Usunięcie klucza API
     */
    function removeDocGeminiApiKeyUI() {
        if (!confirm("Czy na pewno chcesz usunąć klucz Gemini API z pamięci przeglądarki?")) return;
        if (!window.geminiService) return;
        window.geminiService.removeApiKey();
        renderDocGeminiConfigUI();
        updateDocGeminiStatusUI();
        if (typeof window.updateGeminiStatusUI === 'function') {
            window.updateGeminiStatusUI();
        }
        showToast("Klucz API został usunięty. Aktywowano tryb Offline.", "info");
    }

    /**
     * Test połączenia z modelem Gemini
     */
    async function testDocGeminiConnectionUI() {
        const resEl = document.getElementById('doc-gemini-test-result');
        if (!resEl || !window.geminiService) return;

        resEl.innerHTML = `<span style="color: var(--accent-cyan);">⏳ Testowanie połączenia z ${window.geminiService.getModel()}...</span>`;

        try {
            const reply = await window.geminiService.testConnection();
            resEl.innerHTML = `<span style="color: var(--accent-teal);">✅ Połączenie udane! Odpowiedź: "${escapeHtml(reply)}"</span>`;
            showToast("Test połączenia z modelem Gemini zakończony sukcesem!", "success");
        } catch (err) {
            resEl.innerHTML = `<span style="color: var(--accent-rose);">❌ Błąd połączenia: ${escapeHtml(err.message)}</span>`;
            showToast(`Błąd testu API: ${err.message}`, "error");
        }
    }

    /**
     * Ładuje wybrany preset zmiany wdrożeniowej do formularza
     */
    function loadPatExpertDocPreset(presetKey) {
        const preset = PATEXPERT_DOC_PRESETS[presetKey];
        if (!preset) return;

        docState.activePreset = presetKey;

        const titleEl = document.getElementById('doc-change-title');
        const moduleEl = document.getElementById('doc-change-module');
        const envEl = document.getElementById('doc-change-env');
        const descEl = document.getElementById('doc-change-desc');

        if (titleEl) titleEl.value = preset.title;
        if (moduleEl) moduleEl.value = preset.module;
        if (envEl) envEl.value = preset.env;
        if (descEl) descEl.value = preset.desc;

        // Aktualizacja podświetlenia przycisków presetów
        document.querySelectorAll('.doc-preset-btn').forEach(b => {
            if (b.getAttribute('data-preset') === presetKey) {
                b.style.borderColor = 'var(--accent-teal)';
                b.style.background = 'rgba(6, 214, 160, 0.12)';
            } else {
                b.style.borderColor = 'var(--border-color)';
                b.style.background = 'transparent';
            }
        });

        showToast(`Załadowano preset: ${preset.title}`, 'info');

        // Automatyczne załadowanie pakietu offline dla szybkiego podglądu
        if (preset.offlinePackage) {
            docState.lastResult = {
                rawMarkdown: generateMarkdownFromPackage(preset.offlinePackage, preset),
                parsed: preset.offlinePackage
            };
            renderDocPackageResult(docState.lastResult);
        }
    }

    /**
     * Czyści formularz wprowadzania zmiany
     */
    function clearDocForm() {
        const titleEl = document.getElementById('doc-change-title');
        const moduleEl = document.getElementById('doc-change-module');
        const descEl = document.getElementById('doc-change-desc');
        if (titleEl) titleEl.value = '';
        if (moduleEl) moduleEl.value = 'Moduł Raportowania i Eksportu Dokumentacji';
        if (descEl) descEl.value = '';

        document.querySelectorAll('.doc-preset-btn').forEach(b => {
            b.style.borderColor = 'var(--border-color)';
            b.style.background = 'transparent';
        });

        const outputContainer = document.getElementById('doc-result-container');
        if (outputContainer) {
            outputContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <div style="font-size: 2.2rem; margin-bottom: 12px;">📝</div>
                    <h4>Czekam na dane wdrożenia PatExpert</h4>
                    <p style="max-width: 500px; margin: 0 auto; font-size: 0.88rem;">
                        Wybierz jeden z powyższych gotowych presetów produkcyjnych lub opisz zgłoszoną poprawkę ręcznie, a następnie kliknij 
                        <strong>Generuj Pakiet Weryfikacyjny</strong>.
                    </p>
                </div>
            `;
        }
        showToast("Wyczyszczono formularz.", "info");
    }

    /**
     * Konwertuje obiekt pakietu do sformatowanego Markdownu
     */
    function generateMarkdownFromPackage(pkg, meta = {}) {
        let md = '';

        if (pkg.isClarificationNeeded && pkg.clarificationQuestions) {
            md += `### ⚠️ Brakujące Informacje / Wymagane Szczegóły\n`;
            pkg.clarificationQuestions.forEach(q => {
                md += `- ${q}\n`;
            });
            md += `\n`;
            return md;
        }

        if (pkg.hasSmokeTest && pkg.smokeTest) {
            md += `### 💨 Sugerowany Test Dymny (Smoke Test 5–10 min)\n`;
            md += `**Uzasadnienie testu dymnego:** ${pkg.smokeTest.reason}\n`;
            pkg.smokeTest.steps.forEach((s, idx) => {
                md += `${idx + 1}. ${s}\n`;
            });
            md += `\n`;
        }

        if (pkg.testCase) {
            md += `### 🧪 1. Scenariusz Testowy (Test Case)\n`;
            md += `**Moduł:** ${pkg.testCase.module || meta.module || 'PatExpert'}\n`;
            md += `**ID Testu:** ${pkg.testCase.id || 'TC-PX-2026-01'}\n`;
            md += `**Tytuł:** ${pkg.testCase.title || meta.title || 'Weryfikacja poprawki'}\n`;
            md += `#### Warunki Wstępne:\n`;
            (pkg.testCase.preconditions || []).forEach(p => {
                md += `- ${p}\n`;
            });
            md += `#### Kroki Wykonania:\n`;
            (pkg.testCase.steps || []).forEach((s, idx) => {
                md += `${idx + 1}. ${s}\n`;
            });
            md += `#### Oczekiwany Rezultat:\n${pkg.testCase.expectedResult}\n\n`;
        }

        if (pkg.regressionTest) {
            md += `### 🔄 2. Test Regresji\n`;
            md += `**Powiązana Funkcja / Moduł:** ${pkg.regressionTest.module}\n`;
            md += `**Uzasadnienie Powiązania:** ${pkg.regressionTest.reason}\n`;
            md += `#### Kroki Weryfikacji Regresji:\n`;
            (pkg.regressionTest.steps || []).forEach((s, idx) => {
                md += `${idx + 1}. ${s}\n`;
            });
            md += `**Oczekiwany Rezultat Regresji:** ${pkg.regressionTest.expectedResult || 'Brak negatywnego wpływu na funkcję.'}\n\n`;
        }

        if (pkg.knowledgeBase) {
            md += `### 📚 3. Wpis do Bazy Wiedzy (I Linia Wsparcia)\n`;
            md += `**Tytuł:** ${pkg.knowledgeBase.title}\n`;
            md += `#### Problem:\n${pkg.knowledgeBase.problem}\n`;
            md += `#### Diagnoza:\n${pkg.knowledgeBase.diagnosis}\n`;
            md += `#### Rozwiązanie Krok po Kroku:\n`;
            (pkg.knowledgeBase.solutionSteps || []).forEach((s, idx) => {
                md += `${idx + 1}. ${s}\n`;
            });
            md += `\n`;
        }

        return md;
    }

    /**
     * Główna funkcja wyzwalająca generowanie pakietu (AI lub Offline)
     */
    async function runDocGeneration(forceOffline = false) {
        const title = document.getElementById('doc-change-title')?.value.trim() || '';
        const moduleName = document.getElementById('doc-change-module')?.value.trim() || '';
        const env = document.getElementById('doc-change-env')?.value.trim() || 'Produkcja';
        const desc = document.getElementById('doc-change-desc')?.value.trim() || '';

        if (!desc && !title) {
            showToast("Wprowadź opis lub tytuł zgłoszonej poprawki.", "warning");
            return;
        }

        const fullDescription = `Tytuł zmiany: ${title}\nModuł: ${moduleName}\nŚrodowisko: ${env}\nSzczegóły: ${desc}`;

        const outputContainer = document.getElementById('doc-result-container');
        if (outputContainer) {
            outputContainer.innerHTML = `
                <div style="text-align: center; padding: 50px 20px;">
                    <div style="font-size: 2rem; animation: pulse 1.5s infinite;">🧠</div>
                    <h4 style="margin-top: 12px;">Agent AI PatExpert analizuje zmianę...</h4>
                    <p style="color: var(--text-secondary); font-size: 0.88rem;">
                        Strukturalizowanie Test Case, mapowanie powiązań regresyjnych i przygotowywanie instrukcji dla I linii...
                    </p>
                </div>
            `;
        }

        const hasKey = window.geminiService && window.geminiService.hasApiKey();

        if (hasKey && !forceOffline) {
            try {
                const res = await window.geminiService.generatePatExpertDocPackage(fullDescription);
                docState.lastResult = res;
                renderDocPackageResult(res);
                showToast("Agent AI pomyślnie wygenerował pakiet weryfikacyjny PatExpert!", "success");
                return;
            } catch (err) {
                console.warn("Błąd wywołania Gemini API, przejście do silnika offline:", err);
                showToast(`API: ${err.message}. Uruchomiono silnik offline.`, "warning");
            }
        }

        // Generator Offline Fallback
        const offlinePkg = generateOfflinePackage(title, moduleName, desc);
        docState.lastResult = {
            rawMarkdown: generateMarkdownFromPackage(offlinePkg, { title, module: moduleName }),
            parsed: offlinePkg
        };
        renderDocPackageResult(docState.lastResult);
        showToast("Wygenerowano pakiet weryfikacyjny (Silnik Szablonów Offline)!", "info");
    }

    /**
     * Silnik regułowy offline do tworzenia kompletnych pakietów bez zewnętrznego API
     */
    function generateOfflinePackage(title, moduleName, desc) {
        const full = `${title} ${moduleName} ${desc}`.toLowerCase();

        // 1. Sprawdź czy to niepełny opis
        if (desc.length < 35 && !full.includes('pdf') && !full.includes('wsi') && !full.includes('kasetk') && !full.includes('hl7')) {
            return {
                isClarificationNeeded: true,
                clarificationQuestions: [
                    'Którego konkretnie modułu lub formularza w PatExpert dotyczy zgłoszona zmiana?',
                    'Jakie konkretne kroki wykonywał użytkownik, które wywoływały błąd?',
                    'Jaki był dokładny objaw (treść komunikatu błędu, zawieszenie, niespójność danych)?',
                    'Czy poprawka modyfikuje bazę danych lub procesy autoryzacji?'
                ],
                testCase: null,
                regressionTest: null,
                knowledgeBase: null
            };
        }

        // 2. Detekcja ścieżki krytycznej
        const isCritical = full.includes('zapis') || full.includes('rejestracj') || full.includes('logowan') ||
                           full.includes('baza danych') || full.includes('deadlock') || full.includes('sekwenc') ||
                           full.includes('kasetk');

        let smokeTest = null;
        if (isCritical) {
            smokeTest = {
                reason: 'Wdrożenie modyfikuje kluczowy element ścieżki krytycznej (zapis zlecenia / integralność bazy PatExpert). Niezbędny jest szybki test dymny.',
                steps: [
                    'Zaloguj się do aplikacji PatExpert na dwóch niezależnych stacjach techników.',
                    'Wykonaj próbne przyjęcie zlecenia z automatycznym nadaniem numeru badania.',
                    'Zweryfikuj poprawność wygenerowania rekordów kasetek w bazie.',
                    'Upewnij się, że nie występuje blokada tabeli zlecenia_hp.'
                ]
            };
        }

        // 3. Sprawdź czy to problem z PDF
        if (full.includes('pdf') || full.includes('raport') || full.includes('wydruk') || full.includes('zawiesz')) {
            return PATEXPERT_DOC_PRESETS.pdf_hang.offlinePackage;
        }

        // 4. Sprawdź czy to problem z WSI
        if (full.includes('wsi') || full.includes('skan') || full.includes('svs') || full.includes('nfs') || full.includes('kafelk')) {
            return PATEXPERT_DOC_PRESETS.wsi_preview.offlinePackage;
        }

        // 5. Sprawdź czy to HL7
        if (full.includes('hl7') || full.includes('his') || full.includes('oru') || full.includes('mllp')) {
            return PATEXPERT_DOC_PRESETS.his_export.offlinePackage;
        }

        // Ogólny pakiet domyślny
        return {
            hasSmokeTest: isCritical,
            smokeTest: smokeTest,
            testCase: {
                id: `TC-PX-2026-GEN01`,
                title: `Weryfikacja poprawki: ${title || 'Modyfikacja modułu ' + moduleName}`,
                module: moduleName || 'Pracownia Histopatologiczna',
                preconditions: [
                    'Dostęp do stacji testowej z zaktualizowanym oprogramowaniem PatExpert',
                    'Aktywne konto użytkownika o uprawnieniach odpowiadających testowanemu modułowi',
                    'Zestaw danych testowych odzwierciedlający przypadek brzegowy'
                ],
                steps: [
                    'Uruchom aplikację PatExpert i zaloguj się na konto testowe.',
                    `Otwórz moduł: ${moduleName || 'Pracownia Histopatologiczna'}.`,
                    'Wykonaj akcję wywołującą uprzednio błąd zgodnie z opisem zgłoszenia.',
                    'Zweryfikuj brak wystąpienia błędu oraz poprawność zapisu danych.'
                ],
                expectedResult: 'Operacja kończy się sukcesem bez błędów systemowych i bez opóźnień interfejsu.'
            },
            regressionTest: {
                module: 'Powiązane formularze przeglądania badań i eksportu danych',
                reason: 'Współdzielenie komponentów dostępu do bazy i wspólnego modelu encji badania.',
                steps: [
                    'Otwórz listę archiwalnych badań histopatologicznych.',
                    'Sprawdź poprawność wyświetlania i filtrowania listy.'
                ],
                expectedResult: 'Archiwum badań działa płynnie, filtrowanie zwraca prawidłowe rekordy.'
            },
            knowledgeBase: {
                title: `Procedura postępowania w przypadku problemów w module ${moduleName || 'PatExpert'}`,
                problem: `Użytkownik zgłasza niepoprawne działanie funkcji: ${title || 'operacja w module'}.`,
                diagnosis: `Błąd powiązany z przetwarzaniem danych w module ${moduleName}. Wdrożono stosowną poprawkę w najnowszym patchu.`,
                solutionSteps: [
                    'Upewnij się, że stacja robocza posiada zainstalowane najnowsze pliki aktualizacyjne.',
                    'W razie potrzeby zrestartuj aplikację PatExpert.',
                    'Jeśli problem występuje nadal, zweryfikuj czy dane wejściowe spełniają kryteria walidacji.',
                    'W razie powtórzenia błędu przekaż zgłoszenie z plikiem logów do II linii wsparcia.'
                ]
            }
        };
    }

    /**
     * Renderuje wynikowy pakiet weryfikacyjny do widoku
     */
    function renderDocPackageResult(resultData) {
        const container = document.getElementById('doc-result-container');
        if (!container) return;

        const pkg = resultData.parsed;
        const rawMd = resultData.rawMarkdown;

        // Jeśli wymagane są wyjaśnienia / doprecyzowanie
        if (pkg.isClarificationNeeded && pkg.clarificationQuestions && pkg.clarificationQuestions.length > 0) {
            container.innerHTML = `
                <div style="background: rgba(255, 183, 3, 0.1); border: 2px solid var(--accent-amber, #ffb703); border-radius: var(--radius-md); padding: 22px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <span style="font-size: 1.8rem;">⚠️</span>
                        <div>
                            <h4 style="margin: 0; color: var(--accent-amber);">Zgłoszenie wymaga doprecyzowania</h4>
                            <p style="margin: 2px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                                Agent wykrył zbyt lakoniczny opis. Zgodnie z procedurą weryfikacji powdrożeniowej, należy uzupełnić poniższe parametry przed utworzeniem scenariusza testowego:
                            </p>
                        </div>
                    </div>

                    <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 14px; margin-top: 14px;">
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 8px;">Brakujące Informacje:</strong>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.88rem; color: var(--text-primary); line-height: 1.6;">
                            ${pkg.clarificationQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
                        </ul>
                    </div>

                    <div style="margin-top: 16px; display: flex; gap: 10px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.loadPatExpertDocPreset('pdf_hang')">
                            🔄 Załaduj pełny przykład (Raporty PDF)
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="document.getElementById('doc-change-desc').focus()">
                            ✏️ Uzupełnij opis w formularzu
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // Renderowanie kompletnego pakietu
        let html = `
            <!-- Górny pasek akcji pakietu -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">📦</span>
                    <strong style="font-size: 1.05rem;">Kompletny Pakiet Weryfikacyjny PatExpert</strong>
                    <span class="badge" style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); border: 1px solid var(--accent-teal);">
                        Gotowy do Weryfikacji
                    </span>
                    ${pkg.hasSmokeTest ? `
                        <span class="badge" style="background: rgba(255, 183, 3, 0.15); color: var(--accent-amber); border: 1px solid var(--accent-amber);">
                            ⚡ Wymaga Smoke Testu
                        </span>
                    ` : ''}
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.copyDocPackageMarkdown()" title="Kopiuj całość do schowka">
                        📋 Kopiuj Pakiet (Markdown)
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.copyDocTestCaseMarkdown()" title="Kopiuj tylko Test Case">
                        🧪 Kopiuj Test Case
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.copyDocKBMmarkdown()" title="Kopiuj wpis do Bazy Wiedzy">
                        📚 Kopiuj Bazę Wiedzy
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="window.saveDocPackageAsRunbook()" title="Zapisz wpis w Runbookach Hubu">
                        💾 Zapisz do Bazy Runbooków
                    </button>
                </div>
            </div>
        `;

        // 1. Jeśli jest Test Dymny (Smoke Test)
        if (pkg.hasSmokeTest && pkg.smokeTest) {
            html += `
                <div style="background: rgba(255, 183, 3, 0.08); border-left: 4px solid var(--accent-amber); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0; color: var(--accent-amber); display: flex; align-items: center; gap: 8px;">
                            <span>💨 Sugerowany Test Dymny (Smoke Test: 5–10 minut)</span>
                        </h4>
                        <span style="font-size: 0.75rem; background: var(--accent-amber); color: #000; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                            KRYTYCZNA ŚCIEŻKA
                        </span>
                    </div>
                    <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 12px;">
                        <strong>Uzasadnienie:</strong> ${escapeHtml(pkg.smokeTest.reason)}
                    </p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 0.88rem; line-height: 1.6;">
                        ${pkg.smokeTest.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ol>
                </div>
            `;
        }

        // 2. Karta: Scenariusz Testowy (Test Case)
        if (pkg.testCase) {
            html += `
                <div class="card" style="margin-bottom: 20px; border-top: 3px solid var(--accent-teal);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div>
                            <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--accent-teal); letter-spacing: 0.05em;">
                                🧪 Część 1: Scenariusz Testowy (Test Case)
                            </div>
                            <h3 style="margin: 4px 0 0; font-size: 1.15rem;">
                                ${escapeHtml(pkg.testCase.title)}
                            </h3>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge" style="background: var(--bg-hover); border: 1px solid var(--border-color); font-family: monospace;">
                                ${escapeHtml(pkg.testCase.id || 'TC-PX-2026')}
                            </span>
                            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">
                                Moduł: <strong>${escapeHtml(pkg.testCase.module)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Warunki wstępne -->
                    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px;">
                        <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 8px;">
                            📋 Warunki Wstępne (Preconditions):
                        </strong>
                        <ul style="margin: 0; padding-left: 20px; font-size: 0.88rem; line-height: 1.6;">
                            ${(pkg.testCase.preconditions || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                        </ul>
                    </div>

                    <!-- Kroki wykonania -->
                    <div style="margin-bottom: 16px;">
                        <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 10px;">
                            👣 Kroki Wykonania (Step-by-Step Execution):
                        </strong>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${(pkg.testCase.steps || []).map((step, idx) => `
                                <div style="display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                    <span style="background: var(--accent-teal); color: #000; font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; flex-shrink: 0; margin-top: 1px;">
                                        ${idx + 1}
                                    </span>
                                    <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-primary);">
                                        ${escapeHtml(step)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Oczekiwany rezultat -->
                    <div style="background: rgba(6, 214, 160, 0.08); border-left: 4px solid var(--accent-teal); padding: 14px; border-radius: var(--radius-sm);">
                        <strong style="font-size: 0.84rem; color: var(--accent-teal); text-transform: uppercase; display: block; margin-bottom: 4px;">
                            🎯 Oczekiwany Rezultat (Expected Result):
                        </strong>
                        <div style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary);">
                            ${escapeHtml(pkg.testCase.expectedResult)}
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. Karta: Test Regresji
        if (pkg.regressionTest) {
            html += `
                <div class="card" style="margin-bottom: 20px; border-top: 3px solid var(--accent-cyan, #00b4d8);">
                    <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--accent-cyan); letter-spacing: 0.05em; margin-bottom: 4px;">
                        🔄 Część 2: Test Regresji (Obszar Powiązany)
                    </div>
                    <h3 style="margin: 0 0 12px; font-size: 1.15rem;">
                        Weryfikacja Modułu: ${escapeHtml(pkg.regressionTest.module)}
                    </h3>

                    <div style="background: var(--bg-card); border-left: 3px solid var(--accent-cyan); padding: 12px 16px; margin-bottom: 14px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
                        <strong style="font-size: 0.84rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">
                            💡 Uzasadnienie Logicznego Powiązania:
                        </strong>
                        <div style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.5;">
                            ${escapeHtml(pkg.regressionTest.reason)}
                        </div>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 8px;">
                            Kroki Weryfikacji Regresyjnej:
                        </strong>
                        <ol style="margin: 0; padding-left: 20px; font-size: 0.88rem; line-height: 1.6;">
                            ${(pkg.regressionTest.steps || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                        </ol>
                    </div>

                    ${pkg.regressionTest.expectedResult ? `
                        <div style="font-size: 0.86rem; color: var(--text-secondary); background: var(--bg-hover); padding: 8px 12px; border-radius: var(--radius-sm);">
                            <strong>Kryterium braku regresji:</strong> ${escapeHtml(pkg.regressionTest.expectedResult)}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 4. Karta: Wpis do Bazy Wiedzy (I Linia Wsparcia)
        if (pkg.knowledgeBase) {
            html += `
                <div class="card" style="margin-bottom: 24px; border-top: 3px solid var(--accent-purple, #8338ec);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--accent-purple); letter-spacing: 0.05em;">
                                📚 Część 3: Baza Wiedzy (Instrukcja dla I Linii Wsparcia)
                            </div>
                            <h3 style="margin: 4px 0 0; font-size: 1.15rem;">
                                ${escapeHtml(pkg.knowledgeBase.title)}
                            </h3>
                        </div>
                        <span class="badge" style="background: rgba(131, 56, 236, 0.15); color: var(--accent-purple); border: 1px solid var(--accent-purple);">
                            Level 1 Ready
                        </span>
                    </div>

                    <!-- Problem -->
                    <div style="margin-bottom: 14px;">
                        <strong style="font-size: 0.84rem; color: var(--accent-rose); text-transform: uppercase; display: block; margin-bottom: 4px;">
                            🔴 Zgłaszany Problem (Objawy użytkownika):
                        </strong>
                        <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-primary); background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-rose);">
                            ${escapeHtml(pkg.knowledgeBase.problem)}
                        </div>
                    </div>

                    <!-- Diagnoza -->
                    <div style="margin-bottom: 14px;">
                        <strong style="font-size: 0.84rem; color: var(--accent-amber); text-transform: uppercase; display: block; margin-bottom: 4px;">
                            💡 Diagnoza (Wyjaśnienie dla konsultanta):
                        </strong>
                        <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-primary); background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-amber);">
                            ${escapeHtml(pkg.knowledgeBase.diagnosis)}
                        </div>
                    </div>

                    <!-- Rozwiązanie krok po kroku -->
                    <div>
                        <strong style="font-size: 0.84rem; color: var(--accent-teal); text-transform: uppercase; display: block; margin-bottom: 8px;">
                            ✅ Rozwiązanie Krok po Kroku (Procedura I Linii):
                        </strong>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${(pkg.knowledgeBase.solutionSteps || []).map((step, idx) => `
                                <div style="display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px; background: var(--bg-card); border-radius: var(--radius-sm);">
                                    <span style="font-weight: 700; color: var(--accent-teal); font-size: 0.88rem; flex-shrink: 0;">
                                        ${idx + 1}.
                                    </span>
                                    <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-primary);">
                                        ${escapeHtml(step)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // 5. Interaktywny Podgląd Raw Markdown i Konsultant AI
        html += `
            <div class="card" style="margin-top: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                        <span>💬 Konsultacja i Doprecyzowanie Pakietu (PatExpert QA Copilot)</span>
                    </h4>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">
                        Zadaj pytanie lub poproś o dodatkowy wariant testu
                    </span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">
                    Potrzebujesz dodatkowego przypadku brzegowego, zapytania SQL do weryfikacji bazy PatExpert lub wariantu dla środowiska Linux? Wpisz polecenie poniżej:
                </p>

                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <input type="text" id="doc-followup-input" class="form-control" style="flex: 1;" 
                           placeholder="np. Dodaj wariant testu dla badania z 10 zdjęciami makro lub podaj zapytanie weryfikujące status w bazie...">
                    <button class="btn btn-primary" onclick="window.submitDocFollowUp()">Zapytaj Agenta</button>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.setDocFollowUpText('Dodaj wariant testowy dla raportu z 10 zdjęciami makro i tabelą IHC powyżej 20 pozycji')">
                        ➕ Wariant: 10 zdjęć makro + duża tabela IHC
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.setDocFollowUpText('Podaj bezpieczne zapytanie SELECT weryfikujące status badania w bazie PatExpert')">
                        🔍 Podaj zapytanie SQL weryfikujące
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.setDocFollowUpText('Jakie logi w systemie Linux/PostgreSQL sprawdzić jeśli raport nadal się zawiesza?')">
                        🐧 Diagnostyka logów Linux/PostgreSQL
                    </button>
                </div>

                <div id="doc-followup-response" style="margin-top: 14px; display: none;"></div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Ustawia tekst w polu podczatu
     */
    function setDocFollowUpText(text) {
        const input = document.getElementById('doc-followup-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    }

    /**
     * Obsługa pytania uzupełniającego do Agenta AI
     */
    async function submitDocFollowUp() {
        const input = document.getElementById('doc-followup-input');
        const resBox = document.getElementById('doc-followup-response');
        if (!input || !resBox) return;

        const text = input.value.trim();
        if (!text) return;

        resBox.style.display = 'block';
        resBox.innerHTML = `<span style="color: var(--accent-cyan);">⏳ Konsultowanie z Agentem PatExpert...</span>`;

        const hasKey = window.geminiService && window.geminiService.hasApiKey();

        if (hasKey) {
            try {
                const history = [
                    {
                        role: "user",
                        parts: [{ text: `Dotychczas wygenerowany pakiet weryfikacyjny PatExpert:\n\n${docState.lastResult?.rawMarkdown || ''}\n\nPytanie użytkownika / prośba o doprecyzowanie:\n${text}` }]
                    }
                ];

                const reply = await window.geminiService.callGemini(history, {
                    systemInstruction: window.geminiService.getPatExpertDocAgentInstruction(),
                    temperature: 0.1,
                    topP: 0.8
                });

                resBox.innerHTML = `
                    <div style="background: var(--bg-card); border-left: 3px solid var(--accent-teal); padding: 14px; border-radius: var(--radius-sm); margin-top: 10px;">
                        <strong style="color: var(--accent-teal); display: block; margin-bottom: 6px;">Odpowiedź Agenta QA:</strong>
                        <div style="font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(reply)}</div>
                    </div>
                `;
                input.value = '';
                showToast("Otrzymano odpowiedź Agenta QA!", "success");
                return;
            } catch (err) {
                console.warn("Błąd konsultacji AI:", err);
            }
        }

        // Fallback odpowiedzi offline
        let offlineAnswer = '';
        if (text.toLowerCase().includes('sql') || text.toLowerCase().includes('bazy') || text.toLowerCase().includes('status')) {
            offlineAnswer = `Diagnostyczne zapytanie SELECT do weryfikacji stanu badania i wygenerowanego raportu w bazie PatExpert:\n\n` +
                `SELECT b.id, b.nr_badania, b.status, b.data_opisu, l.nazwisko AS lekarz_patolog,\n` +
                `       (SELECT count(*) FROM zdjecia_makro z WHERE z.id_badania = b.id) AS liczba_zdjec,\n` +
                `       (SELECT count(*) FROM barwienia_ihc ihc WHERE ihc.id_badania = b.id) AS liczba_ihc\n` +
                `FROM badania_hp b\n` +
                `JOIN lekarze l ON b.id_lekarza = l.id\n` +
                `WHERE b.nr_badania = 'HP/2026/TEST01';`;
        } else if (text.toLowerCase().includes('zdjęc') || text.toLowerCase().includes('makro') || text.toLowerCase().includes('10')) {
            offlineAnswer = `Wariant testu dla badania ze skrajnym obciążeniem (10 zdjęć makro):\n` +
                `1. Wgraj 10 zdjęć w formacie TIFF (łączny rozmiar ~120 MB).\n` +
                `2. Sprawdź czy silnik strumieniowania kompresuje obrazy bez przekroczenia limitu 512 MB pamięci stacji roboczej.\n` +
                `3. Czas generowania nie powinien przekroczyć 12 sekund na stacji roboczej z procesorem Core i5 / 8 GB RAM.`;
        } else {
            offlineAnswer = `Wskazówka diagnostyczna dla środowiska produkcyjnego PatExpert:\n` +
                `- Sprawdź logi klienta: %APPDATA%\\PatExpert\\logs\\patexpert.log\n` +
                `- Sprawdź logi serwera wydruków PDF: /var/log/patexpert/pdf-generator.log\n` +
                `- W przypadku PostgreSQL sprawdź czy zapytanie pobierające bloby zdjęć nie powoduje zrzutu na dysk (temp_file_limit).`;
        }

        resBox.innerHTML = `
            <div style="background: var(--bg-card); border-left: 3px solid var(--accent-cyan); padding: 14px; border-radius: var(--radius-sm); margin-top: 10px;">
                <strong style="color: var(--accent-cyan); display: block; margin-bottom: 6px;">Odpowiedź Bazy Wiedzy (Tryb Offline):</strong>
                <div style="font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(offlineAnswer)}</div>
            </div>
        `;
        input.value = '';
    }

    /**
     * Kopiuje cały pakiet jako Markdown do schowka
     */
    function copyDocPackageMarkdown() {
        if (!docState.lastResult || !docState.lastResult.rawMarkdown) {
            showToast("Brak wygenerowanego pakietu do skopiowania.", "warning");
            return;
        }
        navigator.clipboard.writeText(docState.lastResult.rawMarkdown)
            .then(() => showToast("Skopiowano cały pakiet weryfikacyjny (Markdown) do schowka!", "success"))
            .catch(() => showToast("Błąd kopiowania do schowka.", "error"));
    }

    /**
     * Kopiuje tylko Scenariusz Testowy
     */
    function copyDocTestCaseMarkdown() {
        const pkg = docState.lastResult?.parsed;
        if (!pkg || !pkg.testCase) {
            showToast("Brak Test Case do skopiowania.", "warning");
            return;
        }

        let md = `### 🧪 Scenariusz Testowy: ${pkg.testCase.title}\n`;
        md += `**ID:** ${pkg.testCase.id} | **Moduł:** ${pkg.testCase.module}\n\n`;
        md += `#### Warunki Wstępne:\n${(pkg.testCase.preconditions || []).map(p => `- ${p}`).join('\n')}\n\n`;
        md += `#### Kroki Wykonania:\n${(pkg.testCase.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        md += `#### Oczekiwany Rezultat:\n${pkg.testCase.expectedResult}\n`;

        navigator.clipboard.writeText(md)
            .then(() => showToast("Skopiowano Scenariusz Testowy (Test Case) do schowka!", "success"))
            .catch(() => showToast("Błąd kopiowania do schowka.", "error"));
    }

    /**
     * Kopiuje tylko wpis do Bazy Wiedzy
     */
    function copyDocKBMmarkdown() {
        const pkg = docState.lastResult?.parsed;
        if (!pkg || !pkg.knowledgeBase) {
            showToast("Brak wpisu Bazy Wiedzy do skopiowania.", "warning");
            return;
        }

        let md = `### 📚 Baza Wiedzy I Linii: ${pkg.knowledgeBase.title}\n\n`;
        md += `**Problem:**\n${pkg.knowledgeBase.problem}\n\n`;
        md += `**Diagnoza:**\n${pkg.knowledgeBase.diagnosis}\n\n`;
        md += `**Rozwiązanie krok po kroku:**\n${(pkg.knowledgeBase.solutionSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`;

        navigator.clipboard.writeText(md)
            .then(() => showToast("Skopiowano instrukcję dla I Linii Wsparcia do schowka!", "success"))
            .catch(() => showToast("Błąd kopiowania do schowka.", "error"));
    }

    /**
     * Zapisuje pakiet jako rekord w Bazie Runbooków Hubu
     */
    function saveDocPackageAsRunbook() {
        const pkg = docState.lastResult?.parsed;
        if (!pkg || !pkg.testCase) {
            showToast("Brak wygenerowanego pakietu do zapisania.", "warning");
            return;
        }

        const title = pkg.testCase.title || 'Weryfikacja powdrożeniowa PatExpert';
        const kb = pkg.knowledgeBase || {};

        let summaryNotes = `## Pakiet Weryfikacji Powdrożeniowej i Baza Wiedzy (PatExpert)\n\n`;
        summaryNotes += `- **System:** PatExpert (Pracownia Histopatologiczna)\n`;
        summaryNotes += `- **ID Test Case:** \`${pkg.testCase.id || 'TC-PX'}\`\n`;
        summaryNotes += `- **Moduł:** \`${pkg.testCase.module || 'PatExpert'}\`\n\n`;

        if (pkg.hasSmokeTest && pkg.smokeTest) {
            summaryNotes += `### 💨 Test Dymny (Smoke Test)\n`;
            summaryNotes += `*Uzasadnienie:* ${pkg.smokeTest.reason}\n`;
            (pkg.smokeTest.steps || []).forEach((s, i) => {
                summaryNotes += `${i + 1}. ${s}\n`;
            });
            summaryNotes += `\n`;
        }

        summaryNotes += `### 🧪 Scenariusz Testowy (Test Case)\n`;
        summaryNotes += `**Kroki wykonania:**\n`;
        (pkg.testCase.steps || []).forEach((s, i) => {
            summaryNotes += `${i + 1}. ${s}\n`;
        });
        summaryNotes += `\n**Oczekiwany rezultat:** ${pkg.testCase.expectedResult}\n\n`;

        if (pkg.regressionTest) {
            summaryNotes += `### 🔄 Test Regresji\n`;
            summaryNotes += `- **Moduł powiązany:** ${pkg.regressionTest.module}\n`;
            summaryNotes += `- **Uzasadnienie:** ${pkg.regressionTest.reason}\n\n`;
        }

        if (kb.title) {
            summaryNotes += `### 📚 Instrukcja I Linii Wsparcia\n`;
            summaryNotes += `**Tytuł:** ${kb.title}\n`;
            summaryNotes += `**Problem:** ${kb.problem}\n`;
            summaryNotes += `**Diagnoza:** ${kb.diagnosis}\n`;
            summaryNotes += `**Rozwiązanie:**\n`;
            (kb.solutionSteps || []).forEach((s, i) => {
                summaryNotes += `${i + 1}. ${s}\n`;
            });
        }

        const runbookRecord = {
            id: `runbook_patexpert_${Date.now()}`,
            date: new Date().toLocaleString('pl-PL'),
            title: `[PatExpert QA] ${title}`,
            system: 'PatExpert',
            category: 'Weryfikacja Powdrożeniowa / QA',
            level: 'POST_RELEASE_QA',
            tags: ['patexpert', 'qa-doc', 'test-case', 'histopatologia'],
            errorLog: docState.lastResult?.rawMarkdown || 'Brak surowego logu',
            detectedPath: pkg.testCase.module || 'PatExpert Module',
            resolvedSteps: [
                {
                    step: `Test Case: ${pkg.testCase.title}`,
                    commands: (pkg.testCase.steps || []).slice(0, 3)
                }
            ],
            postMortemNotes: summaryNotes
        };

        if (window.appState && typeof window.appState.saveIncidentRunbook === 'function') {
            window.appState.saveIncidentRunbook(runbookRecord);
            if (typeof window.renderRunbooksArchiveUI === 'function') {
                window.renderRunbooksArchiveUI();
            }
            showToast(`Zapisano pakiet PatExpert QA do Twojej Bazy Runbooków!`, 'success');
        } else {
            showToast("Błąd zapisu do stanu aplikacji.", "error");
        }
    }

    /**
     * Renderuje cały moduł wewnątrz kontenera na stronie
     */
    function renderPatExpertDocsModule() {
        const rootContainer = document.getElementById('patexpert-docs-container');
        if (!rootContainer) return;

        const currentModel = window.geminiService ? window.geminiService.getModel() : 'gemini-3.5-flash';

        const html = `
            <!-- Górny pasek narzędziowy modelu AI -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.3rem;">🧠</span>
                        <label for="doc-gemini-model-select" style="font-weight: 600; font-size: 0.88rem; margin: 0;">Model Gemini AI:</label>
                        <select id="doc-gemini-model-select" class="form-control" style="width: auto; min-width: 280px; font-weight: 500;" onchange="window.onDocGeminiModelChange(this.value)">
                            ${renderDocModelSelectOptions(currentModel)}
                        </select>
                    </div>

                    <button id="doc-gemini-status-btn" class="btn btn-secondary btn-sm" onclick="window.toggleDocGeminiConfigUI()" style="border-width: 1px; border-style: solid; font-size: 0.82rem;">
                        <!-- Treść generowana przez updateDocGeminiStatusUI -->
                    </button>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.toggleDocGeminiConfigUI()">
                        ⚙️ Konfiguracja API
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.clearDocForm()">
                        🧹 Nowe Zgłoszenie
                    </button>
                </div>
            </div>

            <!-- Rozwijany panel konfiguracji Gemini API -->
            <div id="doc-gemini-config-section" style="display: none;"></div>

            <!-- Pasek Szybkich Presetów Produkcyjnych -->
            <div style="margin-bottom: 22px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size: 0.82rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.06em;">
                        ⚡ Szybkie Scenariusze Zmian Wdrożeniowych PatExpert:
                    </strong>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">
                        Kliknij preset, aby natychmiast załadować dane i wygenerować pakiet
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                    ${Object.keys(PATEXPERT_DOC_PRESETS).map(key => {
                        const p = PATEXPERT_DOC_PRESETS[key];
                        return `
                            <button class="doc-preset-btn" data-preset="${p.id}" onclick="window.loadPatExpertDocPreset('${p.id}')"
                                    style="background: transparent; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; text-align: left; cursor: pointer; transition: all 0.2s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 0.72rem; font-weight: 700; color: ${p.badgeColor};">
                                        ${escapeHtml(p.badge)}
                                    </span>
                                    <span style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(p.env)}</span>
                                </div>
                                <div style="font-weight: 600; font-size: 0.84rem; line-height: 1.3; color: var(--text-primary); margin-bottom: 4px;">
                                    ${escapeHtml(p.title)}
                                </div>
                                <div style="font-size: 0.74rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${escapeHtml(p.module)}
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Formularz Wprowadzania Zmiany Wdrożeniowej -->
            <div class="card" style="margin-bottom: 24px;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <span>📋 Zgłoszenie Wdrożeniowe do Weryfikacji (Release Note / Patch Info)</span>
                    </h3>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">
                        Przekształcane na: Test Case + Test Regresji + Baza Wiedzy I Linii
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: 14px; margin-bottom: 14px;">
                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Tytuł zmiany / patcha:</label>
                        <input type="text" id="doc-change-title" class="form-control" 
                               value="Zawieszanie się aplikacji podczas generowania raportów histopatologicznych do pliku PDF">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Moduł PatExpert:</label>
                        <input type="text" id="doc-change-module" class="form-control" 
                               value="Moduł Raportowania i Eksportu Dokumentacji (PDF Engine)">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">Środowisko:</label>
                        <select id="doc-change-env" class="form-control">
                            <option value="Produkcja" selected>Produkcja</option>
                            <option value="Staging / Pre-Prod">Staging / Pre-Prod</option>
                            <option value="UAT (Testy Klienta)">UAT (Testy Klienta)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px;">
                        Szczegółowy opis zmiany wdrożeniowej (informacja od programistów / konsultantów):
                    </label>
                    <textarea id="doc-change-desc" class="form-control" rows="4" style="font-size: 0.9rem; line-height: 1.5;"
                              placeholder="Opisz czego dotyczy poprawka, jakie moduły modyfikuje, w jakich warunkach występował błąd...">${escapeHtml(PATEXPERT_DOC_PRESETS.pdf_hang.desc)}</textarea>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" onclick="window.runDocGeneration(false)">
                            🤖 Generuj Pakiet Weryfikacyjny (AI Agent)
                        </button>
                        <button class="btn btn-secondary" onclick="window.runDocGeneration(true)">
                            ⚡ Szybki Szablon Offline
                        </button>
                    </div>

                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        💡 Zmiany krytyczne automatycznie generują propozycję 5-10 min Smoke Testu
                    </div>
                </div>
            </div>

            <!-- Kontener na wygenerowany pakiet weryfikacyjny -->
            <div id="doc-result-container"></div>
        `;

        rootContainer.innerHTML = html;

        // Inicjalizacja domyślnego presetu
        loadPatExpertDocPreset('pdf_hang');
        updateDocGeminiStatusUI();
    }

    // Eksport globalny do window
    if (typeof window !== 'undefined') {
        window.PATEXPERT_DOC_PRESETS = PATEXPERT_DOC_PRESETS;
        window.renderPatExpertDocsModule = renderPatExpertDocsModule;
        window.loadPatExpertDocPreset = loadPatExpertDocPreset;
        window.clearDocForm = clearDocForm;
        window.runDocGeneration = runDocGeneration;
        window.onDocGeminiModelChange = onDocGeminiModelChange;
        window.updateDocGeminiStatusUI = updateDocGeminiStatusUI;
        window.toggleDocGeminiConfigUI = toggleDocGeminiConfigUI;
        window.saveDocGeminiApiKeyUI = saveDocGeminiApiKeyUI;
        window.removeDocGeminiApiKeyUI = removeDocGeminiApiKeyUI;
        window.testDocGeminiConnectionUI = testDocGeminiConnectionUI;
        window.copyDocPackageMarkdown = copyDocPackageMarkdown;
        window.copyDocTestCaseMarkdown = copyDocTestCaseMarkdown;
        window.copyDocKBMmarkdown = copyDocKBMmarkdown;
        window.saveDocPackageAsRunbook = saveDocPackageAsRunbook;
        window.submitDocFollowUp = submitDocFollowUp;
        window.setDocFollowUpText = setDocFollowUpText;
    }

})();
