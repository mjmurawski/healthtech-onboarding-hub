/**
 * Testy jednostkowe i integracyjne dla Modułu Tworzenia Dokumentacji i Weryfikacji Powdrożeniowej dla PatExpert (patexpert-docs.js)
 * 
 * Zakres weryfikacji:
 * 1. Presety zmian wdrożeniowych (PATEXPERT_DOC_PRESETS)
 * 2. System Prompt i reguły inżynierii QA dla PatExpert
 * 3. Parser pakietów weryfikacyjnych (parsePatExpertDocPackage)
 * 4. Scenariusz PDF Hang (Test Case, Regresja, Baza Wiedzy I Linii)
 * 5. Detekcja ścieżki krytycznej i warunkowy Test Dymny (Smoke Test 5-10 min)
 * 6. Obsługa niepełnych informacji (Pytania doprecyzowujące)
 * 7. Wybór modeli Gemini i synchronizacja z Hubem
 * 8. Eksport pakietu weryfikacyjnego do Bazy Runbooków
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
        savedRunbooks: [],
        saveIncidentRunbook: function (record) {
            this.savedRunbooks.push(record);
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
                value: '',
                innerHTML: '',
                style: {},
                disabled: false,
                focus: () => {}
            };
        }
        return mockElements[id];
    },
    querySelectorAll: (selector) => []
};

// 1. Załaduj gemini-service.js
const geminiCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
eval(geminiCode);
const geminiService = window.geminiService;
assert(geminiService, 'window.geminiService powinien istnieć');

// 2. Załaduj patexpert-docs.js
const docsCode = fs.readFileSync(path.join(__dirname, 'js', 'patexpert-docs.js'), 'utf8');
eval(docsCode);

console.log('=== TEST 1: Weryfikacja Presetów Zmian Wdrożeniowych PatExpert ===');
const PRESETS = window.PATEXPERT_DOC_PRESETS;
assert(typeof PRESETS === 'object', 'PATEXPERT_DOC_PRESETS powinno być obiektem');
assert(PRESETS.pdf_hang, 'Brak presetu pdf_hang');
assert(PRESETS.order_lock, 'Brak presetu order_lock');
assert(PRESETS.wsi_preview, 'Brak presetu wsi_preview');
assert(PRESETS.his_export, 'Brak presetu his_export');
assert(PRESETS.incomplete_info, 'Brak presetu incomplete_info');

console.log(`- Liczba zdefiniowanych presetów: ${Object.keys(PRESETS).length}`);
assert.strictEqual(Object.keys(PRESETS).length, 5, 'Powinno być dokładnie 5 presetów');
console.log('✅ PRESETS: Wszystkie 5 presetów PatExpert są poprawnie zdefiniowane');

console.log('\n=== TEST 2: Weryfikacja System Promptu Agenta QA & Dokumentacji PatExpert ===');
const instruction = geminiService.getPatExpertDocAgentInstruction();
assert.ok(instruction.includes('PatExpert'), 'Musi zawierać nazwę PatExpert');
assert.ok(instruction.includes('histopatolog'), 'Musi zawierać domenę histopatologii');
assert.ok(instruction.includes('Scenariusz testowy (Test Case)'), 'Musi definiować Test Case');
assert.ok(instruction.includes('Warunki wstępne'), 'Musi wymagać warunków wstępnych');
assert.ok(instruction.includes('Kroki wykonania'), 'Musi wymagać kroków wykonania');
assert.ok(instruction.includes('Oczekiwany rezultat'), 'Musi wymagać oczekiwanego rezultatu');
assert.ok(instruction.includes('Test regresji'), 'Musi wymagać testu regresji');
assert.ok(instruction.includes('Wpis do bazy wiedzy'), 'Musi wymagać wpisu do bazy wiedzy');
assert.ok(instruction.includes('I linia wsparcia') || instruction.includes('I linii'), 'Musi być zorientowany na I linię wsparcia');
assert.ok(instruction.includes('Smoke Test') || instruction.includes('test dymny'), 'Musi definiować kryteria testu dymnego');
assert.ok(instruction.includes('krytycznej ścieżki'), 'Musi wskazywać ścieżkę krytyczną dla testu dymnego');
assert.ok(instruction.includes('Brakujące Informacje'), 'Musi zawierać instrukcję dla niepełnych opisów');
console.log('✅ System Prompt Agenta PatExpert spełnia wszystkie kryteria merytoryczne i formalne');

console.log('\n=== TEST 3: Weryfikacja Scenariusza Raportów PDF (Główny Przypadek Sesji) ===');
const pdfPreset = PRESETS.pdf_hang;
assert(pdfPreset.offlinePackage, 'Preset pdf_hang musi posiadać offlinePackage');
const tc = pdfPreset.offlinePackage.testCase;
assert.strictEqual(tc.id, 'TC-PX-2026-PDF01');
assert.ok(tc.title.includes('PDF'), 'Tytuł testu musi dotyczyć PDF');
assert.ok(Array.isArray(tc.preconditions) && tc.preconditions.length >= 3, 'Musi zawierać min. 3 warunki wstępne');
assert.ok(Array.isArray(tc.steps) && tc.steps.length >= 5, 'Musi zawierać min. 5 kroków wykonania');
assert.ok(tc.expectedResult.includes('poniżej 5 sekund') || tc.expectedResult.includes('nie ulega zawieszeniu') || tc.expectedResult.includes('bez zawieszenia'), 'Musi weryfikować brak zawieszenia');

const reg = pdfPreset.offlinePackage.regressionTest;
assert.ok(reg.module.includes('Druku') || reg.module.includes('Archiwizacji'), 'Moduł regresji musi być powiązany');
assert.ok(reg.reason.length > 20, 'Uzasadnienie regresji musi być wyczerpujące');
assert.ok(Array.isArray(reg.steps) && reg.steps.length >= 2, 'Musi zawierać kroki weryfikacji regresji');

const kb = pdfPreset.offlinePackage.knowledgeBase;
assert.ok(kb.title.includes('Procedura postępowania w przypadku błędu generowania raportu PDF'), 'Tytuł bazy wiedzy musi być dokładny');
assert.ok(kb.problem.length > 20, 'Opis problemu musi być obecny');
assert.ok(kb.diagnosis.length > 20, 'Diagnoza musi być obecna');
assert.ok(Array.isArray(kb.solutionSteps) && kb.solutionSteps.length >= 4, 'Procedura I linii musi zawierać kroki');
console.log('✅ Scenariusz PDF Hang: Test Case, Regresja i Baza Wiedzy I Linii są w 100% kompletne');

console.log('\n=== TEST 4: Weryfikacja Detekcji Ścieżki Krytycznej i Testu Dymnego (Smoke Test) ===');
const orderPreset = PRESETS.order_lock;
assert.strictEqual(orderPreset.isCriticalPath, true, 'order_lock powinien być oznaczony jako ścieżka krytyczna');
assert.strictEqual(orderPreset.offlinePackage.hasSmokeTest, true, 'order_lock musi generować hasSmokeTest = true');
assert.ok(orderPreset.offlinePackage.smokeTest.reason.includes('ścieżki krytycznej'), 'Smoke test musi uzasadniać potrzebę');
assert.ok(orderPreset.offlinePackage.smokeTest.steps.length >= 3, 'Smoke test musi zawierać min. 3 kroki');

// Zmiana PDF nie jest ścieżką krytyczną i NIE powinna wymuszać testu dymnego
assert.strictEqual(pdfPreset.isCriticalPath, false, 'pdf_hang nie powinien być ścieżką krytyczną');
assert.strictEqual(pdfPreset.offlinePackage.hasSmokeTest, undefined, 'pdf_hang nie powinien zawierać hasSmokeTest');
console.log('✅ Detekcja Ścieżki Krytycznej: Test Dymny generowany wyłącznie dla operacji krytycznych');

console.log('\n=== TEST 5: Weryfikacja Obsługi Niepełnych Informacji (Pytania Doprecyzowujące) ===');
const incPreset = PRESETS.incomplete_info;
assert.strictEqual(incPreset.offlinePackage.isClarificationNeeded, true, 'Niepełny opis musi wyzwalać isClarificationNeeded');
assert.ok(Array.isArray(incPreset.offlinePackage.clarificationQuestions), 'Musi zwrócić listę pytań');
assert.ok(incPreset.offlinePackage.clarificationQuestions.length >= 3, 'Musi zadać min. 3 pytania doprecyzowujące');
console.log(`- Liczba pytań doprecyzowujących: ${incPreset.offlinePackage.clarificationQuestions.length}`);
console.log('✅ Obsługa Niepełnych Informacji: Agent natychmiast pyta o brakujące szczegóły');

console.log('\n=== TEST 6: Weryfikacja Parsowania Odpowiedzi Markdown z Gemini API ===');
const sampleAiMarkdown = `
### 💨 Sugerowany Test Dymny (Smoke Test 5–10 min)
**Uzasadnienie testu dymnego:** Zmiana modyfikuje bazowy sterownik połączenia z bazą PostgreSQL.
1. Zaloguj się do PatExpert.
2. Otwórz rejestrację zlecenia.
3. Sprawdź czy pobiera się lista lekarzy.

### 🧪 1. Scenariusz Testowy (Test Case)
**Moduł:** Moduł Raportowania i Eksportu Dokumentacji
**ID Testu:** TC-PX-20260923-01
**Tytuł:** Weryfikacja generowania PDF po optymalizacji pamięci
#### Warunki Wstępne:
- Zainstalowana poprawka v2.4.1
- Dostępne badanie ze zdjęciem makro 20MB
#### Kroki Wykonania:
1. Otwórz badanie HP/TEST/01.
2. Kliknij Generuj PDF.
3. Zweryfikuj czas odpowiedzi.
#### Oczekiwany Rezultat:
Raport PDF generuje się bez błędu w czasie poniżej 3 sekund.

### 🔄 2. Test Regresji
**Powiązana Funkcja / Moduł:** Moduł Archiwizacji Dokumentacji
**Uzasadnienie Powiązania:** Współdzielenie biblioteki eksportu dokumentów.
#### Kroki Weryfikacji Regresji:
1. Sprawdź eksport pliku RTF.
2. Sprawdź wysyłkę e-mailem.
**Oczekiwany Rezultat Regresji:** Wszystkie pozostałe formaty eksportu działają stabilnie.

### 📚 3. Wpis do Bazy Wiedzy (I Linia Wsparcia)
**Tytuł:** Procedura postępowania w przypadku błędu generowania raportu PDF w PatExpert
#### Problem:
Aplikacja PatExpert przestaje odpowiadać przy próbie generowania raportu PDF.
#### Diagnoza:
Niewystarczająca pamięć podręczna procesu dla nieskompresowanych zdjęć makroskopowych.
#### Rozwiązanie Krok po Kroku:
1. Zrestartuj proces PatExpert.
2. Sprawdź czy stacja posiada zainstalowaną poprawkę PDF Streamer.
3. Wyczyść folder tymczasowy Temp\\PatExpert.
`;

const parsed = geminiService.parsePatExpertDocPackage(sampleAiMarkdown);
assert.strictEqual(parsed.hasSmokeTest, true, 'Parser powinien wykryć sekcję Smoke Test');
assert.strictEqual(parsed.testCase.id, 'TC-PX-20260923-01', 'Parser powinien wyciągnąć ID Testu');
assert.strictEqual(parsed.testCase.preconditions.length, 2, 'Powinny być 2 warunki wstępne');
assert.strictEqual(parsed.testCase.steps.length, 3, 'Powinny być 3 kroki wykonania');
assert.ok(parsed.testCase.expectedResult.includes('poniżej 3 sekund'), 'Oczekiwany rezultat poprawnie wyodrębniony');
assert.strictEqual(parsed.regressionTest.module, 'Moduł Archiwizacji Dokumentacji', 'Moduł regresji poprawnie wyodrębniony');
assert.strictEqual(parsed.knowledgeBase.solutionSteps.length, 3, 'Baza wiedzy powinna mieć 3 kroki rozwiązania');
console.log('✅ Parser Markdownu: Pomyślnie przetłumaczono tekst modelu na ustrukturyzowane obiekty');

console.log('\n=== TEST 7: Weryfikacja Wyboru i Synchronizacji Modeli Gemini ===');
// Zmiana modelu w module dokumentacji
window.onDocGeminiModelChange('gemini-3.7-flash');
assert.strictEqual(geminiService.getModel(), 'gemini-3.7-flash', 'Model w geminiService powinien zmienić się na gemini-3.7-flash');
assert.strictEqual(localStorage.getItem('healthtech_gemini_model'), 'gemini-3.7-flash', 'Model w localStorage powinien być zaktualizowany');

// Przywrócenie domyślnego gemini-3.5-flash
window.onDocGeminiModelChange('gemini-3.5-flash');
assert.strictEqual(geminiService.getModel(), 'gemini-3.5-flash', 'Model powinien powrócić do gemini-3.5-flash');
console.log('✅ Synchronizacja Modeli Gemini: Przełącznik modeli działa prawidłowo we wszystkich komponentach');

console.log('\n=== TEST 8: Weryfikacja Eksportu do Bazy Runbooków ===');
window.loadPatExpertDocPreset('pdf_hang');
window.saveDocPackageAsRunbook();

assert.strictEqual(window.appState.savedRunbooks.length, 1, 'Powinien zostać zapisany 1 rekord Runbooka');
const savedRecord = window.appState.savedRunbooks[0];
assert.strictEqual(savedRecord.system, 'PatExpert', 'System w Runbooku powinien wynosić PatExpert');
assert.strictEqual(savedRecord.category, 'Weryfikacja Powdrożeniowa / QA', 'Kategoria Runbooka powinna być poprawna');
assert.ok(savedRecord.tags.includes('patexpert'), 'Tagi powinny zawierać patexpert');
assert.ok(savedRecord.tags.includes('qa-doc'), 'Tagi powinny zawierać qa-doc');
assert.ok(savedRecord.postMortemNotes.includes('TC-PX-2026-PDF01'), 'Notatki powinny zawierać numer ID Test Case');
assert.ok(savedRecord.postMortemNotes.includes('Procedura postępowania w przypadku błędu generowania raportu PDF'), 'Notatki powinny zawierać wpis bazy wiedzy');
console.log('✅ Eksport do Runbooków: Pomyślnie utworzono i zindeksowano rekord w Bazie Runbooków Hubu');

console.log('\n🎉 WSZYSTKIE 8 TESTÓW AGENTA DOKUMENTACJI PATEXPERT ZALICZONE Z SUKCESEM (100%)!');
