/**
 * Testy jednostkowe i integracyjne dla Modułu Szybkiego Konsultanta IT (quick-consultant.js & gemini-service.js)
 * 
 * Zakres weryfikacji:
 * 1. Presety i Baza Wiedzy Offline (CONSULTANT_PRESETS)
 * 2. System Prompt i reguły zwięzłości (getQuickConsultantInstruction)
 * 3. Błyskawiczne zapytania i formatowanie odpowiedzi (askQuickConsultant)
 * 4. Renderowanie interfejsu i obsługa zdarzeń UI
 * 5. Zapis do Szybkich Notatek i Bazy Runbooków
 * 6. Synchronizacja modeli Gemini w aplikacji
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
            notes: { quickNote: 'Notatki początkowe' }
        },
        savedRunbooks: [],
        saveState: function() {},
        saveIncidentRunbook: function(record) {
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
                focus: () => {},
                scrollIntoView: () => {}
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

// Załaduj dane i stan aplikacji (data.js & state.js)
const dataCode = fs.readFileSync(path.join(__dirname, 'js', 'data.js'), 'utf8');
eval(dataCode);
global.HEALTHTECH_DATA = window.HEALTHTECH_DATA;
const stateCode = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
eval(stateCode);
global.runHL7Inspection = () => {};
window.runHL7Inspection = () => {};

(async function runTests() {
    console.log('=== TEST 1: Weryfikacja Bazy Wiedzy Offline i Presetów Konsultanta IT ===');
    
    // Załaduj plik modułu
    const consultantCode = fs.readFileSync(path.join(__dirname, 'js', 'quick-consultant.js'), 'utf8');
    eval(consultantCode);

    const presets = window.CONSULTANT_PRESETS;
    assert(Array.isArray(presets), 'CONSULTANT_PRESETS powinno być tablicą');
    assert(presets.length >= 12, `Oczekiwano co najmniej 12 presetów, znaleziono: ${presets.length}`);
    console.log(`- Liczba zdefiniowanych presetów: ${presets.length}`);

    // Sprawdź domeny
    const categories = ['programming', 'databases', 'medical'];
    categories.forEach(cat => {
        const inCat = presets.filter(p => p.category === cat);
        assert(inCat.length >= 3, `Kategoria ${cat} powinna mieć co najmniej 3 presety, ma: ${inCat.length}`);
        console.log(`  ✓ Kategoria '${cat}': ${inCat.length} presetów`);
    });

    // Sprawdź kompletność pól
    presets.forEach(p => {
        assert(p.id && typeof p.id === 'string', `Preset ${p.id} musi mieć poprawne ID`);
        assert(p.title && typeof p.title === 'string', `Preset ${p.id} musi mieć tytuł`);
        assert(p.question && typeof p.question === 'string', `Preset ${p.id} musi mieć pytanie`);
        assert(p.offlineAnswer && typeof p.offlineAnswer === 'string', `Preset ${p.id} musi mieć odpowiedź offline`);
        assert(p.offlineAnswer.includes('```'), `Odpowiedź offline dla ${p.id} musi zawierać blok kodu`);
    });
    console.log('✅ PRESETS: Wszystkie presety posiadają kompletne dane, kod i zwięzłe punkty diagnostyczne');

    console.log('\n=== TEST 2: Weryfikacja System Promptu Agenta (gemini-service.js) ===');
    const geminiServiceCode = fs.readFileSync(path.join(__dirname, 'js', 'gemini-service.js'), 'utf8');
    eval(geminiServiceCode);

    const service = window.geminiService;
    assert(service, 'window.geminiService powinien istnieć');
    assert(typeof service.getQuickConsultantInstruction === 'function', 'GeminiService musi posiadać metodę getQuickConsultantInstruction');
    assert(typeof service.askQuickConsultant === 'function', 'GeminiService musi posiadać metodę askQuickConsultant');

    const instruction = service.getQuickConsultantInstruction();
    assert(instruction.includes('Błyskawicznym Konsultantem IT'), 'System prompt powinien definiować rolę Błyskawicznego Konsultanta IT');
    assert(instruction.includes('ZERO LANIA WODY'), 'System prompt musi nakazywać eliminację lania wody');
    assert(instruction.includes('KOD / KOMENDA / ZAPYTANIE NA PIERWSZYM MIEJSCU'), 'System prompt musi wymagać kodu na 1. miejscu');
    assert(instruction.includes('Programowanie'), 'System prompt musi pokrywać programowanie');
    assert(instruction.includes('Bazy Danych'), 'System prompt musi pokrywać bazy danych');
    assert(instruction.includes('Systemy Medyczne'), 'System prompt musi pokrywać systemy medyczne');
    console.log('✅ PROMPT: System prompt spełnia rygorystyczne kryteria zwięzłości i pokrycia domen');

    console.log('\n=== TEST 3: Weryfikacja askQuickConsultant z modelem Gemini ===');
    // Mockujemy callGemini
    service.callGemini = async (prompt, opts) => {
        assert(opts.systemInstruction.includes('Błyskawicznym Konsultantem IT'), 'callGemini powinno otrzymać właściwy systemInstruction');
        assert.strictEqual(opts.temperature, 0.1, 'Temperatura powinna wynosić 0.1');
        assert.strictEqual(opts.topP, 0.8, 'TopP powinno wynosić 0.8');
        return "```sql\nSELECT * FROM pg_locks;\n```\n- Blokady aktywne";
    };

    const consultResult = await service.askQuickConsultant('Postgres locks', {
        contextDomain: 'databases',
        model: 'gemini-3.5-flash'
    });

    assert(consultResult.text.includes('SELECT * FROM pg_locks'), 'Odpowiedź musi zawierać zwrócony tekst');
    assert(typeof consultResult.elapsedMs === 'number', 'Wynik musi mierzyć czas odpowiedzi elapsedMs');
    assert.strictEqual(consultResult.model, 'gemini-3.5-flash', 'Zwrócony model musi być zgodny');
    console.log(`- Zmierzony czas odpowiedzi mock: ${consultResult.elapsedMs}ms`);
    console.log('✅ KONSULTACJA AI: askQuickConsultant poprawnie parsuje parametry i zwraca metadane');

    console.log('\n=== TEST 4: Weryfikacja Renderowania Modułu UI (quick-consultant.js) ===');
    window.geminiService = service;
    
    // Przygotuj kontener główny
    const container = document.getElementById('quick-consultant-container');
    window.renderQuickConsultantModule();

    assert(container.innerHTML.includes('consultant-prompt-input'), 'Moduł powinien renderować textarea na pytanie');
    assert(container.innerHTML.includes('consultant-submit-btn'), 'Moduł powinien renderować przycisk wysłania zapytania');
    assert(container.innerHTML.includes('consultant-presets-grid'), 'Moduł powinien renderować siatkę presetów');
    assert(container.innerHTML.includes('consultant-gemini-model-select'), 'Moduł powinien renderować selektor modeli');
    assert(container.innerHTML.includes('consultant-gemini-status-btn'), 'Moduł powinien renderować status API');
    console.log('✅ UI: Wszystkie elementy interfejsu (nagłówek, presety, textarea, przyciski) zostały poprawnie wygenerowane');

    console.log('\n=== TEST 5: Weryfikacja Trybu Offline i Bazy Wiedzy w UI ===');
    // Test zapytania offline z presetem
    const pyPreset = presets.find(p => p.id === 'py_firebird');
    await window.askQuickConsultantUI(pyPreset.question, pyPreset);

    const activeResp = document.getElementById('consultant-active-response-container');
    assert(activeResp.innerHTML.includes('fdb.connect'), 'Karta odpowiedzi offline powinna zawierać kod fdb.connect z presetu');
    assert(activeResp.innerHTML.includes('Baza Wiedzy Offline'), 'Karta odpowiedzi powinna wskazywać źródło Offline KB');
    console.log('✅ OFFLINE KB: Błyskawiczny fallback offline działa natychmiast bez klucza API');

    console.log('\n=== TEST 6: Weryfikacja Akcji 1-Click (Kopiowanie, Notatki, Runbooki) ===');
    // 1. Zapis do Szybkich Notatek
    window.saveToQuickNotes('qa_' + Date.now()); // pobierze najnowszy z historii
    assert(window.appState.data.notes.quickNote.includes('Konsultant IT'), 'Notatka powinna zostać dopisana do Szybkich Notatek');
    console.log('  ✓ Zapis do Szybkich Notatek zakończony sukcesem');

    // 2. Zapis do Bazy Runbooków
    window.saveToRunbooks('qa_' + Date.now());
    const runbooks = window.appState.getIncidentRunbooks();
    assert(runbooks && runbooks.length > 0, 'Runbook powinien zostać dodany do stanu');
    assert(runbooks[0].tags.includes('KONSULTANT_IT'), 'Runbook musi posiadać tag KONSULTANT_IT');
    console.log('  ✓ Eksport procedury do Bazy Runbooków zakończony sukcesem');

    console.log('\n=== TEST 7: Weryfikacja Synchronizacji Modeli (js/app.js) ===');
    global.runLinuxTroubleshooter = () => {};
    window.runLinuxTroubleshooter = () => {};
    const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
    eval(appCode);

    // Zmiana modelu w aplikacji
    window.onGeminiModelChange('gemini-3.8-flash-high');
    assert.strictEqual(window.geminiService.getModel(), 'gemini-3.8-flash-high', 'Model w serwisie powinien wynosić gemini-3.8-flash-high');

    const consultantModelSelect = document.getElementById('consultant-gemini-model-select');
    assert.strictEqual(consultantModelSelect.value, 'gemini-3.8-flash-high', 'Selektor modelu w Konsultancie IT musi być zsynchronizowany');
    console.log('✅ SYNCHRONIZACJA: Zmiana modelu natychmiast synchronizuje selektor Szybkiego Konsultanta');

    console.log('\n🎉 WSZYSTKIE 7 TESTÓW SZYBKIEGO KONSULTANTA IT ZALICZONE Z SUKCESEM (100%)!');
})();
