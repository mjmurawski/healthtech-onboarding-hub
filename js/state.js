/**
 * HealthTech Onboarding Hub - Zarządzanie Stanem (state.js)
 * Obsługa localStorage, reaktywności ocen 1-5, postępów i notatek
 */

const STORAGE_KEY = 'healthtech_onboarding_hub_v1';

class AppState {
  constructor() {
    this.data = this.loadState();
    this.listeners = [];
  }

  // Ładowanie stanu z localStorage lub inicjalizacja domyślnymi danymi
  loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          skills: { ...HEALTHTECH_DATA.defaultSkills, ...(parsed.skills || {}) },
          studyPlanTasks: parsed.studyPlanTasks || {},
          checklistTasks: parsed.checklistTasks || {},
          questionsState: parsed.questionsState || {},
          notes: parsed.notes || {},
          docFormData: parsed.docFormData || {},
          incidentRunbooks: parsed.incidentRunbooks || [],
          theme: parsed.theme || 'dark'
        };
      } catch (e) {
        console.error("Błąd parsowania stanu z localStorage, przywracanie domyślnych:", e);
      }
    }

    return {
      skills: { ...HEALTHTECH_DATA.defaultSkills },
      studyPlanTasks: {},
      checklistTasks: {},
      questionsState: {},
      notes: {
        quickNote: "Moje pierwsze notatki ze spotkań wdrożeniowych:\n- Pamiętać o zapytaniu o Z-segmenty w komunikacji z LIS\n- Sprawdzić wersję silnika Mirth Connect\n- Skonfigurować lokalnego dockera z PostgreSQL 15"
      },
      docFormData: {},
      incidentRunbooks: [],
      theme: 'dark'
    };
  }

  // Zapis stanu do localStorage
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notifyListeners();
    } catch (e) {
      console.error("Błąd zapisu stanu do localStorage:", e);
    }
  }

  // Rejestracja nasłuchiwaczy zmian stanu
  subscribe(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.data);
    }
  }

  // Aktualizacja oceny pojedynczej umiejętności (1-5)
  setSkillLevel(skillKey, level) {
    const numLevel = Math.max(1, Math.min(5, parseInt(level, 10) || 1));
    this.data.skills[skillKey] = numLevel;
    this.saveState();
  }

  // Przełącznik stanu zadania z planu nauki
  toggleStudyPlanTask(taskId) {
    this.data.studyPlanTasks[taskId] = !this.data.studyPlanTasks[taskId];
    this.saveState();
  }

  // Przełącznik zadania z checklisty pierwszego tygodnia
  toggleChecklistTask(taskId) {
    this.data.checklistTasks[taskId] = !this.data.checklistTasks[taskId];
    this.saveState();
  }

  // Zapis notatki do zadania z checklisty
  setChecklistTaskNote(taskId, note) {
    if (!this.data.checklistTasksNotes) {
      this.data.checklistTasksNotes = {};
    }
    this.data.checklistTasksNotes[taskId] = note;
    this.saveState();
  }

  // Przełącznik stanu pytania orientacyjnego
  toggleQuestionAsked(questionId) {
    if (!this.data.questionsState[questionId]) {
      this.data.questionsState[questionId] = { asked: false, note: "" };
    }
    this.data.questionsState[questionId].asked = !this.data.questionsState[questionId].asked;
    this.saveState();
  }

  // Zapis odpowiedzi/notatki do pytania orientacyjnego
  setQuestionNote(questionId, note) {
    if (!this.data.questionsState[questionId]) {
      this.data.questionsState[questionId] = { asked: false, note: "" };
    }
    this.data.questionsState[questionId].note = note;
    this.saveState();
  }

  // Aktualizacja szybkiej notatki
  setQuickNote(text) {
    this.data.notes.quickNote = text;
    this.saveState();
  }

  // Zapis formularza szablonu dokumentacji
  setDocFormField(fieldId, value) {
    this.data.docFormData[fieldId] = value;
    this.saveState();
  }

  // Zapis incydentu do bazy Runbooków / Post-Mortem (rozszerzony o tagi, system i słowa kluczowe)
  saveIncidentRunbook(runbook) {
    if (!this.data.incidentRunbooks) {
      this.data.incidentRunbooks = [];
    }
    const record = {
      id: runbook.id || `runbook_${Date.now()}`,
      date: runbook.date || new Date().toLocaleString('pl-PL'),
      timestamp: Date.now(),
      title: runbook.title || "Rozwiązany Incydent",
      category: runbook.category || "Infrastruktura",
      level: runbook.level || "Diagnostyka",
      // Nowe pola: system, tagi, słowa kluczowe
      system: runbook.system || "",           // LIS | eKrew | PatExpert | Genetyka | Linux | SQL
      tags: runbook.tags || [],               // tablica tagów ['OOM', 'postgresql', ...]
      keywords: runbook.keywords || "",       // string do wyszukiwania pełnotekstowego
      errorLog: runbook.errorLog || "",
      detectedPath: runbook.detectedPath || "",
      resolvedSteps: runbook.resolvedSteps || [],
      postMortemNotes: runbook.postMortemNotes || ""
    };

    // Automatyczne generowanie indeksu słów kluczowych z treści
    if (!record.keywords) {
      record.keywords = [
        record.title,
        record.category,
        record.system,
        record.tags.join(' '),
        record.errorLog.substring(0, 500),
        record.postMortemNotes.substring(0, 500)
      ].join(' ').toLowerCase();
    }

    // Dodaj na początek listy
    this.data.incidentRunbooks.unshift(record);

    // Limit do 100 najnowszych runbooków (zwiększony z 50)
    if (this.data.incidentRunbooks.length > 100) {
      this.data.incidentRunbooks = this.data.incidentRunbooks.slice(0, 100);
    }

    this.saveState();
    return record;
  }

  // Pobranie listy runbooków
  getIncidentRunbooks() {
    return this.data.incidentRunbooks || [];
  }

  // Wyszukiwanie pełnotekstowe w bazie runbooków
  searchRunbooks(query) {
    if (!query || !query.trim()) return this.getIncidentRunbooks();
    const terms = query.trim().toLowerCase().split(/\s+/);
    return (this.data.incidentRunbooks || []).filter(rb => {
      const haystack = [
        rb.title,
        rb.category,
        rb.system,
        (rb.tags || []).join(' '),
        rb.keywords || '',
        rb.errorLog || '',
        rb.postMortemNotes || ''
      ].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  // Filtrowanie runbooków po systemie (LIS / eKrew / PatExpert / Genetyka / Linux / SQL)
  filterRunbooksBySystem(system) {
    if (!system || system === 'ALL') return this.getIncidentRunbooks();
    return (this.data.incidentRunbooks || []).filter(rb =>
      (rb.system || '').toLowerCase() === system.toLowerCase()
    );
  }

  // Aktualizacja tagów i systemu na istniejącym runbooku
  updateRunbookTags(runbookId, tags, system) {
    const rb = (this.data.incidentRunbooks || []).find(r => r.id === runbookId);
    if (!rb) return;
    rb.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    rb.system = system || rb.system;
    // Przebuduj indeks słów kluczowych
    rb.keywords = [
      rb.title, rb.category, rb.system, rb.tags.join(' '),
      (rb.errorLog || '').substring(0, 500),
      (rb.postMortemNotes || '').substring(0, 500)
    ].join(' ').toLowerCase();
    this.saveState();
  }

  // Usunięcie wpisu runbooka
  deleteIncidentRunbook(id) {
    if (!this.data.incidentRunbooks) return;
    this.data.incidentRunbooks = this.data.incidentRunbooks.filter(r => r.id !== id);
    this.saveState();
  }

  // Przełączenie motywu ciemny / jasny
  setTheme(theme) {
    this.data.theme = theme;
    this.saveState();
  }

  // Reset danych do ustawień początkowych
  resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = this.loadState();
    this.saveState();
  }

  // Eksport całego stanu do pliku JSON
  exportJSON() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthtech-onboarding-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import stanu z pliku JSON
  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.data = {
          ...this.data,
          ...parsed
        };
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error("Błąd importu pliku JSON:", e);
      return false;
    }
    return false;
  }

  // Obliczenie wskaźnika gotowości (HealthTech Readiness Score 0 - 100%)
  getReadinessMetrics() {
    const { checklistTasks } = this.data;

    // Postęp checklisty pierwszego tygodnia
    let totalChecklistItems = 0;
    let completedChecklistItems = 0;
    if (typeof HEALTHTECH_DATA !== 'undefined' && Array.isArray(HEALTHTECH_DATA.firstWeekChecklist)) {
      HEALTHTECH_DATA.firstWeekChecklist.forEach(day => {
        if (Array.isArray(day.items)) {
          day.items.forEach(item => {
            totalChecklistItems++;
            if (checklistTasks && checklistTasks[item.id]) completedChecklistItems++;
          });
        }
      });
    }
    const checklistPercent = totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 0;

    // Całkowity wynik gotowości operacyjnej (bazuje na checkliście wdrożeniowej)
    const overallReadiness = checklistPercent;

    return {
      skillsAvgPercent: 100,
      studyPlanPercent: 100,
      checklistPercent,
      overallReadiness,
      completedStudyTasks: 0,
      totalStudyTasks: 0,
      completedChecklistItems,
      totalChecklistItems
    };
  }
}

// Inicjalizacja instancji stanu w oknie przeglądarki
if (typeof window !== 'undefined') {
  window.appState = new AppState();
}
