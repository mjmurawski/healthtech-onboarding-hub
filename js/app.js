/**
 * HealthTech Onboarding Hub - Główna Logika Interfejsu (app.js)
 * Obsługa modułów, renderowania, zakładek, wyszukiwania i interakcji
 */

function initApp() {
  // Inicjalizacja motywu
  initTheme();

  // Inicjalizacja nawigacji i zakładek
  initNavigation();

  // Renderowanie poszczególnych modułów
  renderDashboard();
  renderMigrationCheatSheet();
  renderHL7FhirModule();
  renderDocTemplateModule();
  renderOrientationQuestions();
  renderFirstWeekChecklist();
  renderHL7InspectorModule();
  renderLinuxAssistantModule();
  initQuickNotes();

  // Nowe moduły specjalistyczne
  if (typeof window.renderSystemsSpecialistModule === 'function') {
    window.renderSystemsSpecialistModule();
  }
  if (typeof window.renderStackDecoderModule === 'function') {
    window.renderStackDecoderModule();
  }
  if (typeof window.renderSQLGeneratorModule === 'function') {
    window.renderSQLGeneratorModule();
  }
  if (typeof window.renderPatExpertDocsModule === 'function') {
    window.renderPatExpertDocsModule();
  }
  if (typeof window.renderQuickConsultantModule === 'function') {
    window.renderQuickConsultantModule();
  }
  if (typeof window.renderAnsibleSREModule === 'function') {
    window.renderAnsibleSREModule();
  }
  if (typeof window.renderPgUpdateSopModule === 'function') {
    window.renderPgUpdateSopModule();
  }

  // Subskrypcja zmian stanu
  if (window.appState && typeof window.appState.subscribe === 'function') {
    window.appState.subscribe(() => {
      updateGlobalMetrics();
      updateChecklistTasksUI();
    });
  }

  // Pierwsze odświeżenie metryk
  updateGlobalMetrics();
}

// Bezpieczne wywołanie — niezależnie czy DOMContentLoaded już wystąpił
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/* ==========================================================================
   Motyw (Dark / Light Mode)
   ========================================================================== */
function initTheme() {
  const currentTheme = window.appState.data.theme || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonUI(currentTheme);

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme');
      const next = active === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.appState.setTheme(next);
      updateThemeButtonUI(next);
      showToast(`Przełączono motyw na: ${next === 'dark' ? 'Ciemny' : 'Jasny'}`);
    });
  }
}

function updateThemeButtonUI(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny');
  }
}

/* ==========================================================================
   Nawigacja i Zakładki
   ========================================================================== */
function initNavigation() {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Bezpośrednie podpięcie pod elementy menu
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
      if (sidebar) sidebar.classList.remove('mobile-open');
    });
  });

  // Globalna delegacja zdarzeń dla nawigacji (sidebar oraz kafelki dashboardu)
  document.addEventListener('click', (e) => {
    // Kafelki z data-switch-tab (np. na pulpicie)
    const linkBtn = e.target.closest('[data-switch-tab]');
    if (linkBtn) {
      const targetTab = linkBtn.getAttribute('data-switch-tab');
      if (targetTab) switchTab(targetTab);
      return;
    }

    // Elementy menu bocznego (na wypadek dynamicznego kliknięcia)
    const navItem = e.target.closest('.nav-item[data-tab]');
    if (navItem) {
      const tabId = navItem.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
        if (sidebar) sidebar.classList.remove('mobile-open');
      }
    }
  });
}

function switchTab(tabId) {
  const targetPane = document.getElementById(tabId);
  if (!targetPane) {
    console.warn('Nie znaleziono zakładki o ID:', tabId);
    return;
  }

  // Ukryj wszystkie panele
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  // Zdejmij active z nav-item
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

  // Aktywuj wybrany panel i nav-item
  targetPane.classList.add('active');
  const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Zaktualizuj breadcrumb
  const crumbActive = document.querySelector('.navbar-breadcrumbs .crumb-active');
  if (crumbActive && activeNav) {
    const title = activeNav.querySelector('span:not(.nav-icon):not(.nav-badge)')?.textContent || 'Moduł';
    crumbActive.textContent = title;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Eksport globalny switchTab
window.switchTab = switchTab;

/* ==========================================================================
   Metryki Globalne i Wskaźnik Gotowości
   ========================================================================== */
function updateGlobalMetrics() {
  const metrics = window.appState.getReadinessMetrics();

  // Wskaźnik w Dashboard
  const valElem = document.getElementById('readiness-score-val');
  if (valElem) valElem.textContent = `${metrics.overallReadiness}%`;

  const circleRing = document.getElementById('readiness-progress-ring');
  if (circleRing) {
    // Obwód okręgu: 2 * PI * 60 ~= 377
    const circumference = 377;
    const offset = circumference - (metrics.overallReadiness / 100) * circumference;
    circleRing.style.strokeDashoffset = offset;
  }

  // Pasek postępu checklisty w Dashboard
  setBarFill('metric-checklist-fill', metrics.checklistPercent);
  setText('metric-checklist-label', `${metrics.completedChecklistItems} / ${metrics.totalChecklistItems} (${metrics.checklistPercent}%)`);

  // Odznaka w menu bocznym
  setText('badge-checklist', `${metrics.completedChecklistItems}/${metrics.totalChecklistItems}`);
}

function setBarFill(id, percent) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${percent}%`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ==========================================================================
   Moduł 0: Dashboard Główny
   ========================================================================== */
function renderDashboard() {
  const container = document.getElementById('dash-quick-actions');
  if (!container) return;

  container.innerHTML = `
    <div class="grid-3" style="margin-top: 20px;">
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-migration">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">🔄</div>
        <h4>Firebird ➔ PostgreSQL</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Ściągawka migracji baz danych, mapowanie typów, pułapki transakcyjne i gotowy ETL w Pythonie.
        </p>
      </div>
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-hl7-fhir">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">🏥</div>
        <h4>Przewodnik HL7 v2 &amp; FHIR</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Struktura ADT/ORM/ORU, zasoby JSON, słownik żargonu „Mów jak zespół" i przykłady kodu.
        </p>
      </div>
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-hl7-inspector">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">🔬</div>
        <h4>Inspektor HL7 &amp; Symulator ACK</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Wklej komunikat HL7, zobacz dekompozycję pól i wygeneruj odpowiedź potwierdzającą ACK w ułamku sekundy.
        </p>
      </div>
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-linux-assistant">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">🐧</div>
        <h4>Asystent Konsoli Linux</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Wklej kod błędu lub problem – asystent natychmiast wygeneruje polecenia Bash i bezpieczną procedurę naprawczą.
        </p>
      </div>
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-checklist">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">✅</div>
        <h4>Checklist Pierwszego Tygodnia</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Działania krok po kroku na pierwsze 5 dni w pracy: formalności, środowisko, pierwszy ticket.
        </p>
      </div>
      <div class="card" style="cursor: pointer;" data-switch-tab="tab-doc-template">
        <div style="font-size: 1.8rem; margin-bottom: 10px;">📝</div>
        <h4>Szablon Dokumentacji</h4>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
          Generator dokumentacji zmian i wdrożeń integracyjnych zgodny ze standardami inżynierii medycznej.
        </p>
      </div>
    </div>

    <!-- Nowe narzędzia specjalistyczne -->
    <div style="margin-top: 24px;">
      <div style="font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px;">
        🆕 Narzędzia Specjalistyczne (LIS / eKrew / PatExpert / Genetyka)
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        <div class="card" style="cursor: pointer; border-color: #06d6a0; border-width: 1px; border-style: solid;" data-switch-tab="tab-systems-specialist">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">🏥</div>
          <h4 style="color: #06d6a0;">Specjalista Systemów Medycznych</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Interaktywna baza wiedzy dla LIS, eKrew, PatExpert i Genetyki. Scenariusze diagnostyczne + gotowe zapytania SQL po kodzie kreskowym.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: #ef476f; border-width: 1px; border-style: solid;" data-switch-tab="tab-stack-decoder">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">🔍</div>
          <h4 style="color: #ef476f;">Dekoder Stack Trace'ów</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Wklej wyjątek Java, .NET lub Delphi – natychmiastowa analiza offline + gotowy SELECT diagnostyczny.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: #3a86ff; border-width: 1px; border-style: solid;" data-switch-tab="tab-sql-generator">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">🗄️</div>
          <h4 style="color: #3a86ff;">Generator SQL Diagnostyczny</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Szybkie SELECT-y z szablonów, bezpieczny UPDATE w transakcji testowej (domyślnie ROLLBACK) + tryb AI.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: #ffb703; border-width: 1px; border-style: solid;" data-switch-tab="tab-patexpert-docs">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">📝</div>
          <h4 style="color: #ffb703;">Tworzenie Dokumentacji (PatExpert)</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Agent AI do weryfikacji powdrożeniowej, generowania Test Case, testów regresji i instrukcji I linii wsparcia dla pracowni histopatologicznej.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: var(--accent-cyan); border-width: 1px; border-style: solid;" data-switch-tab="tab-quick-consultant">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">⚡</div>
          <h4 style="color: var(--accent-cyan);">Szybki Konsultant IT (Dev & Med)</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Błyskawiczny agent AI: Programowanie, Bazy Danych i Systemy Medyczne. Same konkrety, gotowy kod i zero lania wody.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: #8338ec; border-width: 1px; border-style: solid;" data-switch-tab="tab-ansible-sre">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">🤖</div>
          <h4 style="color: #8338ec;">Automatyzacja SRE & Ansible</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Katalog idempotentnych playbooków SRE, role, inventory, hybrydowe skrypty Python + Bash, parser wyników PLAY RECAP i generator automatyzacji.
          </p>
        </div>
        <div class="card" style="cursor: pointer; border-color: #00b4d8; border-width: 1px; border-style: solid;" data-switch-tab="tab-pg-update-sop">
          <div style="font-size: 1.8rem; margin-bottom: 10px;">🐘</div>
          <h4 style="color: #00b4d8;">Aktualizacja PostgreSQL (SOP)</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
            Produkcyjna procedura aktualizacji bazy i binariów: weryfikacja sesji (0 rows), OpenRC/Gentoo, trik tabeli wersja, kgp.exe Wine, satelity RDP/CZA i ściągawka komend.
          </p>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Moduły Wycofane: Ocena & Suwaki 1-5 oraz 7-Dniowy Plan Nauki
   (Zachowane bezpieczne atrapy funkcji dla zachowania wstecznej kompatybilności)
   ========================================================================== */
function renderAssessmentModule() {}
function renderStudyPlanModule() {}
window.toggleDayCollapse = function() {};
window.toggleStudyTask = function() {};
function updateStudyPlanTasksUI() {}

/* ==========================================================================
   Moduł 3: Cheat-sheet: Migracja Firebird -> PostgreSQL
   ========================================================================== */
function renderMigrationCheatSheet() {
  const container = document.getElementById('migration-content-pane');
  if (!container) return;

  const data = HEALTHTECH_DATA.migrationCheatSheet;

  container.innerHTML = `
    <div class="card" style="margin-bottom: 20px;">
      <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">
        ${data.overview}
      </p>
    </div>

    <div class="subtabs-bar">
      <button class="subtab-btn active" onclick="switchSubTab(this, 'subtab-pitfalls')">⚠️ Pułapki i Różnice</button>
      <button class="subtab-btn" onclick="switchSubTab(this, 'subtab-types')">📊 Mapowanie Typów</button>
      <button class="subtab-btn" onclick="switchSubTab(this, 'subtab-sql')">📝 Wzorce SQL & Sekwencje</button>
      <button class="subtab-btn" onclick="switchSubTab(this, 'subtab-etl')">🐍 Skrypt Python ETL (Partiami)</button>
      <button class="subtab-btn" onclick="switchSubTab(this, 'subtab-troubleshoot')">🛠️ Troubleshooting & Naprawa</button>
    </div>

    <!-- Podzakładka 1: Pułapki -->
    <div class="subtab-content" id="subtab-pitfalls">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${data.pitfalls.map(p => `
          <div class="card" style="border-left: 4px solid var(--accent-amber);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 1.05rem;">${p.title}</h4>
              <span style="background: rgba(255, 183, 3, 0.15); color: var(--accent-amber); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 10px;">${p.severity}</span>
            </div>
            <div class="grid-2" style="margin: 12px 0;">
              <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="font-weight: 700; font-size: 0.78rem; color: var(--accent-rose); margin-bottom: 4px;">FIREBIRD (Źródło):</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${p.firebird}</div>
              </div>
              <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="font-weight: 700; font-size: 0.78rem; color: var(--accent-teal); margin-bottom: 4px;">POSTGRESQL (Cel):</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${p.postgres}</div>
              </div>
            </div>
            <div style="background: rgba(0, 180, 216, 0.08); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan); font-size: 0.85rem;">
              <strong style="color: var(--accent-cyan);">Rekomendowane rozwiązanie:</strong> ${p.solution}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Podzakładka 2: Typy danych -->
    <div class="subtab-content" id="subtab-types" style="display: none;">
      <div class="tech-table-wrapper">
        <table class="tech-table">
          <thead>
            <tr>
              <th>Typ w Firebird</th>
              <th>Odpowiednik w PostgreSQL</th>
              <th>Uwagi architektoniczne i medyczne</th>
            </tr>
          </thead>
          <tbody>
            ${data.typeMapping.map(m => `
              <tr>
                <td><code>${m.firebird}</code></td>
                <td><code style="color: var(--accent-teal);">${m.postgres}</code></td>
                <td>${m.note}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Podzakładka 3: Wzorce SQL -->
    <div class="subtab-content" id="subtab-sql" style="display: none;">
      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${data.sqlPatterns.map(sp => `
          <div class="card">
            <h4 style="margin-bottom: 12px;">${sp.title}</h4>
            <div class="grid-2">
              <div>
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">FIREBIRD:</div>
                <pre><code>${escapeHtml(sp.firebirdSql)}</code></pre>
              </div>
              <div>
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-teal); margin-bottom: 6px;">POSTGRESQL:</div>
                <pre><code>${escapeHtml(sp.postgresSql)}</code></pre>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Podzakładka 4: Skrypt Python ETL -->
    <div class="subtab-content" id="subtab-etl" style="display: none;">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h4>Skrypt Produkcyjnego ETL: Firebird ➔ PostgreSQL</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Bezpieczna migracja partiami (batching), konwersja kodowania WIN1250 -> UTF8, obsługa boolean i aktualizacja sekwencji.
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="copySnippetToClipboard('python-etl-code')">📋 Kopiuj Skrypt</button>
        </div>
        <pre><code id="python-etl-code">${escapeHtml(data.pythonEtlSnippet)}</code></pre>
      </div>
    </div>

    <!-- Podzakładka 5: Troubleshooting -->
    <div class="subtab-content" id="subtab-troubleshoot" style="display: none;">
      <div class="grid-2">
        <div class="card">
          <h4 style="color: var(--accent-rose); margin-bottom: 8px;">Uszkodzona baza Firebird (.fdb)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
            Gdy serwer bazy został nagle wyłączony (np. zanik zasilania w szpitalu) i pojawia się błąd "internal gds software consistency check":
          </p>
          <pre><code># 1. Sprawdzenie integralności (tylko odczyt)
gfix -v -full /var/db/szpital.fdb -user SYSDBA -password masterkey

# 2. Oznaczenie uszkodzonych stron
gfix -mend -full -ignore /var/db/szpital.fdb -user SYSDBA -password masterkey

# 3. Wykonanie pełnego backupu pomijającego błędy
gbak -b -v -g -i /var/db/szpital.fdb /var/db/szpital_backup.fbk -user SYSDBA -password masterkey

# 4. Przywrócenie czystej nowej bazy
gbak -c -v /var/db/szpital_backup.fbk /var/db/szpital_repaired.fdb -user SYSDBA -password masterkey</code></pre>
        </div>

        <div class="card">
          <h4 style="color: var(--accent-amber); margin-bottom: 8px;">Kolejność ładowania tabel (Klucze obce)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
            Najczęstszy błąd podczas migracji to naruszenie ograniczeń klucza obcego (Foreign Key Violation).
          </p>
          <pre><code>-- Opcja A (Zalecana): Tymczasowe wyłączenie triggerów FK w Postgres
SET session_replication_role = 'replica';

-- [TUTAJ ŁADUJEMY WSZYSTKIE TABELE PARTIAMI]

-- Przywrócenie rygorystycznej kontroli kluczy
SET session_replication_role = 'origin';

-- Weryfikacja spójności po załadowaniu
SELECT conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f' AND NOT convalidated;</code></pre>
        </div>
      </div>
    </div>
  `;
}

window.switchSubTab = function(btnElem, targetContentId) {
  const bar = btnElem.closest('.subtabs-bar');
  if (!bar) return;
  bar.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
  btnElem.classList.add('active');

  const parent = bar.parentElement;
  parent.querySelectorAll('.subtab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById(targetContentId);
  if (target) target.style.display = 'block';
};

/* ==========================================================================
   Moduł 4: Przewodnik HL7 v2 & FHIR
   ========================================================================== */
function renderHL7FhirModule() {
  const container = document.getElementById('hl7-fhir-content');
  if (!container) return;

  const data = HEALTHTECH_DATA.hl7FhirGuide;

  container.innerHTML = `
    <!-- Karty porównawcze v2 vs FHIR -->
    <div class="grid-2" style="margin-bottom: 24px;">
      <div class="card">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 1.5rem;">📟</span>
          <h3 style="color: var(--accent-cyan);">HL7 v2.x (Standard Szpitalny)</h3>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
          Rządzi w komunikacji wewnątrzszpitalnej: podłączenia analizatorów krwi, aparatów RTG/TK, wysyłanie zleceń i wyników.
        </p>
        <ul style="font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; list-style-position: inside;">
          <li><strong>Format:</strong> ${data.comparison.hl7v2.format}</li>
          <li><strong>Transport:</strong> ${data.comparison.hl7v2.transport}</li>
          <li><strong>Filozofia:</strong> ${data.comparison.hl7v2.architektura}</li>
          <li><strong>Zasięg:</strong> ${data.comparison.hl7v2.status}</li>
        </ul>
      </div>

      <div class="card">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 1.5rem;">🔥</span>
          <h3 style="color: var(--accent-teal);">HL7 FHIR (Nowoczesny MedTech)</h3>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
          Standard webowy dla nowoczesnych aplikacji pacjenta, wymiany między szpitalami i integracji chmurowych.
        </p>
        <ul style="font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; list-style-position: inside;">
          <li><strong>Format:</strong> ${data.comparison.fhir.format}</li>
          <li><strong>Transport:</strong> ${data.comparison.fhir.transport}</li>
          <li><strong>Filozofia:</strong> ${data.comparison.fhir.architektura}</li>
          <li><strong>Zasięg:</strong> ${data.comparison.fhir.status}</li>
        </ul>
      </div>
    </div>

    <!-- Najważniejsze komunikaty -->
    <div class="card" style="margin-bottom: 24px;">
      <h3 style="margin-bottom: 14px;">Kluczowe Komunikaty w Obiegu Szpitalnym</h3>
      <div class="tech-table-wrapper">
        <table class="tech-table">
          <thead>
            <tr>
              <th>Kod wiadomości</th>
              <th>Nazwa i Przeznaczenie</th>
              <th>Przepływ danych</th>
              <th>Kluczowe segmenty</th>
            </tr>
          </thead>
          <tbody>
            ${data.commonMessages.map(m => `
              <tr>
                <td><code style="color: var(--accent-cyan);">${m.code}</code></td>
                <td>
                  <strong>${m.name}</strong>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${m.description}</div>
                </td>
                <td><span style="background: var(--bg-card); padding: 4px 8px; border-radius: 4px; font-size: 0.78rem;">${m.flow}</span></td>
                <td>${m.segments.map(s => `<code>${s}</code>`).join(' ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sekcja "Mów jak zespół" (Słownik żargonu z wyszukiwarką) -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <h3>🗣️ Słownik „Mów jak zespół” (Healthcare IT Slang & Concepts)</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Pojęcia, skróty i zwroty używane na co dzień przez architektów, wdrożeniowców i serwisantów systemów szpitalnych.
          </p>
        </div>
      </div>

      <div class="search-filter-bar">
        <input type="text" id="jargon-search-input" class="search-input" placeholder="🔍 Szukaj pojęcia (np. MLLP, ACK, Z-segment, PACS, LOINC, RODO)..." oninput="filterJargonDictionary()">
      </div>

      <div class="jargon-grid" id="jargon-cards-grid">
        ${data.jargonDictionary.map(item => `
          <div class="jargon-card" data-term="${item.term.toLowerCase()}" data-meaning="${item.meaning.toLowerCase()}">
            <div class="jargon-term">${item.term}</div>
            <div class="jargon-meaning">${item.meaning}</div>
            <div class="jargon-context">
              <strong>W zespole usłyszysz:</strong> "${item.context}"
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.filterJargonDictionary = function() {
  const query = (document.getElementById('jargon-search-input')?.value || '').toLowerCase();
  const cards = document.querySelectorAll('#jargon-cards-grid .jargon-card');
  cards.forEach(c => {
    const term = c.getAttribute('data-term') || '';
    const meaning = c.getAttribute('data-meaning') || '';
    if (!query || term.includes(query) || meaning.includes(query)) {
      c.style.display = 'flex';
    } else {
      c.style.display = 'none';
    }
  });
};

/* ==========================================================================
   Moduł 5: Szablon Dokumentacji Projektowej
   ========================================================================== */
function renderDocTemplateModule() {
  const container = document.getElementById('doc-template-form-container');
  if (!container) return;

  const tpl = HEALTHTECH_DATA.documentationTemplate;
  const savedForm = window.appState.data.docFormData;

  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h3>${tpl.title}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Wypełnij poniższe pola. Generator w czasie rzeczywistym tworzy profesjonalny plik Markdown gotowy do załączenia do repozytorium lub Confluence/Jira.
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="copyMarkdownDoc()">📋 Kopiuj Markdown</button>
          <button class="btn btn-primary btn-sm" onclick="downloadMarkdownDoc()">💾 Pobierz plik .md</button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${tpl.sections.map(sec => {
          const val = savedForm[sec.id] || "";
          return `
            <div class="doc-form-group">
              <label for="doc-field-${sec.id}">${sec.title}</label>
              <textarea 
                id="doc-field-${sec.id}" 
                class="doc-textarea" 
                placeholder="${sec.placeholder}" 
                oninput="onDocFieldChange('${sec.id}', this.value)"
              >${val}</textarea>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.onDocFieldChange = function(fieldId, value) {
  window.appState.setDocFormField(fieldId, value);
};

function generateFullMarkdownDoc() {
  const tpl = HEALTHTECH_DATA.documentationTemplate;
  const savedForm = window.appState.data.docFormData;

  let md = `# ${tpl.title}\n\n`;
  md += `*Wygenerowano: ${new Date().toLocaleString('pl-PL')} za pomocą HealthTech Onboarding Hub*\n\n---\n\n`;

  tpl.sections.forEach(sec => {
    const val = savedForm[sec.id] || `*[Do uzupełnienia: ${sec.placeholder}]*`;
    md += `## ${sec.title}\n\n${val}\n\n---\n\n`;
  });

  return md;
}

window.copyMarkdownDoc = function() {
  const md = generateFullMarkdownDoc();
  navigator.clipboard.writeText(md).then(() => {
    showToast("Skopiowano kompletną dokumentację w formacie Markdown!");
  }).catch(() => {
    showToast("Błąd kopiowania do schowka.");
  });
};

window.downloadMarkdownDoc = function() {
  const md = generateFullMarkdownDoc();
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dokumentacja-integracji-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Pobrano plik dokumentacji!");
};

/* ==========================================================================
   Moduł 6: Pytania Orientacyjne
   ========================================================================== */
function renderOrientationQuestions() {
  const container = document.getElementById('orientation-questions-container');
  if (!container) return;

  const questions = HEALTHTECH_DATA.orientationQuestions;
  const qState = window.appState.data.questionsState;

  // Pogrupowanie pytań po kategoriach
  const groups = {};
  questions.forEach(q => {
    if (!groups[q.category]) groups[q.category] = [];
    groups[q.category].push(q);
  });

  container.innerHTML = Object.keys(groups).map(cat => {
    return `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 1.15rem; color: var(--accent-cyan); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          📁 ${cat}
        </h3>
        <div>
          ${groups[cat].map(q => {
            const state = qState[q.id] || { asked: false, note: "" };
            const isChecked = state.asked ? 'checked' : '';
            return `
              <div class="question-card" id="q-card-${q.id}">
                <div class="question-header">
                  <input type="checkbox" ${isChecked} onchange="toggleQuestion('${q.id}')" style="margin-top: 3px; width: 18px; height: 18px; accent-color: var(--accent-teal); cursor: pointer;">
                  <div style="flex: 1;">
                    <div class="question-title">${q.question}</div>
                    <div class="question-why" style="margin-top: 6px;">💡 Dlaczego to kluczowe: ${q.whyImportant}</div>
                  </div>
                </div>
                <textarea 
                  class="question-note-area" 
                  placeholder="Zanotuj odpowiedź od zespołu lub osoby kontaktowe..." 
                  oninput="onQuestionNoteChange('${q.id}', this.value)"
                >${state.note || ""}</textarea>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleQuestion = function(questionId) {
  window.appState.toggleQuestionAsked(questionId);
  showToast("Zaktualizowano status pytania");
};

window.onQuestionNoteChange = function(questionId, note) {
  window.appState.setQuestionNote(questionId, note);
};

/* ==========================================================================
   Moduł 7: Checklist Pierwszego Tygodnia (Dni 1-5)
   ========================================================================== */
function renderFirstWeekChecklist() {
  const container = document.getElementById('first-week-checklist-container');
  if (!container) return;

  const checklist = HEALTHTECH_DATA.firstWeekChecklist;
  const savedTasks = window.appState.data.checklistTasks;
  const savedNotes = window.appState.data.checklistTasksNotes || {};

  container.innerHTML = checklist.map((dayGroup, gIdx) => {
    return `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h3>📅 ${dayGroup.day}</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${dayGroup.items.map(item => {
            const isChecked = savedTasks[item.id] ? 'checked' : '';
            const userNote = savedNotes[item.id] || "";
            return `
              <div class="task-item ${isChecked ? 'done' : ''}" style="flex-direction: column; gap: 8px;" id="cw-item-${item.id}">
                <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                  <input type="checkbox" ${isChecked} onchange="toggleChecklistItem('${item.id}')">
                  <div style="flex: 1;">
                    <strong style="font-size: 0.92rem;">${item.task}</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
                      <span style="font-size: 0.75rem; background: var(--bg-card); padding: 2px 8px; border-radius: 4px; color: var(--accent-cyan); border: 1px solid var(--border-color);">
                        👤 Kontakt: <strong>${item.contact}</strong>
                      </span>
                      <span style="font-size: 0.75rem; background: var(--bg-card); padding: 2px 8px; border-radius: 4px; color: var(--accent-amber); border: 1px solid var(--border-color);">
                        📖 Co przeczytać: <strong>${item.reading}</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <input 
                  type="text" 
                  style="width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; color: var(--text-primary); font-size: 0.8rem; margin-top: 4px;"
                  placeholder="Twoja notatka do tego zadania (np. login VPN, nazwa brancha, kontakt)..."
                  value="${escapeHtml(userNote)}"
                  oninput="onChecklistNoteChange('${item.id}', this.value)"
                >
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.toggleChecklistItem = function(itemId) {
  window.appState.toggleChecklistTask(itemId);
  const el = document.getElementById(`cw-item-${itemId}`);
  if (el) {
    if (window.appState.data.checklistTasks[itemId]) {
      el.classList.add('done');
    } else {
      el.classList.remove('done');
    }
  }
};

window.onChecklistNoteChange = function(itemId, note) {
  window.appState.setChecklistTaskNote(itemId, note);
};

function updateChecklistTasksUI() {
  // Aktualizacja metryk jest wyzwalana automatycznie z updateGlobalMetrics
}

/* ==========================================================================
   Narzędzie: Inspektor Komunikatów HL7 v2
   ========================================================================== */
function renderHL7InspectorModule() {
  const container = document.getElementById('hl7-inspector-container');
  if (!container) return;

  const defaultMsg = HEALTHTECH_DATA.hl7FhirGuide.sampleMessage.raw;

  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3>🔬 Interaktywny Parser & Analizator HL7 v2</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Wklej dowolny komunikat HL7 lub wybierz szablon. Narzędzie zdekoduje segmenty, wskaże błędy i wygeneruje poprawną ramkę ACK.
          </p>
        </div>
        <div class="inspector-preset-bar">
          <button class="btn btn-secondary btn-sm" onclick="loadInspectorPreset('oru_lab')">🧪 Wynik LIS (ORU^R01)</button>
          <button class="btn btn-secondary btn-sm" onclick="loadInspectorPreset('adt_adm')">🏥 Przyjęcie (ADT^A01)</button>
          <button class="btn btn-secondary btn-sm" onclick="loadInspectorPreset('orm_order')">📋 Zlecenie (ORM^O01)</button>
        </div>
      </div>

      <textarea id="hl7-inspector-input" class="hl7-raw-input">${escapeHtml(defaultMsg)}</textarea>

      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button class="btn btn-primary" onclick="runHL7Inspection()">⚡ Parsuj i Analizuj Komunikat</button>
        <button class="btn btn-secondary" onclick="generateAndShowACK()">✉️ Wygeneruj Odpowiedź ACK</button>
      </div>

      <!-- Wyniki inspekcji -->
      <div id="inspector-output-area"></div>
    </div>
  `;

  // Pierwsze automatyczne parsowanie
  runHL7Inspection();
}

window.loadInspectorPreset = function(type) {
  const textarea = document.getElementById('hl7-inspector-input');
  if (!textarea) return;

  if (type === 'oru_lab') {
    textarea.value = HEALTHTECH_DATA.hl7FhirGuide.sampleMessage.raw;
  } else if (type === 'adt_adm') {
    textarea.value = "MSH|^~\\&|HIS_SZPITAL|IZBA_PRZYJEC|PACS_ARCHIVE|RADIOLOGIA|20260912110000||ADT^A01|MSG_ADT_99812|P|2.3\r" +
      "PID|1||85021209876^^^SZPITAL_ID^PI||NOWAK^ANNA^^^PANI||19850212|F|||UL. LIPOWA 5^^KRAKOW^^30-001^POL||601999888\r" +
      "PV1|1|I|CHIR^SALA_03^LOZKO_1||||98765^ZIELINSKI^MAREK^^^DR MED||||||||||10099887^^^NR_POBYTU";
  } else if (type === 'orm_order') {
    textarea.value = "MSH|^~\\&|HIS_SZPITAL|ODDZIAL_CHIR|LAB_LIS|CENTRALNE_LAB|20260912111500||ORM^O01|ORD_MSG_00451|P|2.3\r" +
      "PID|1||90010112345^^^SZPITAL_ID^PI||WISNIEWSKI^PIOTR||19900101|M|||UL. POLNA 1^^POZNAN\r" +
      "ORC|NW|ORD1234567|||IP||^^^20260912111500|||12345^NOWAK^PIOTR\r" +
      "OBR|1|ORD1234567||GLU^GLUKOZA WE KRWI^LN|||20260912110000";
  }

  runHL7Inspection();
  showToast("Załadowano przykładowy komunikat");
};

window.runHL7Inspection = function() {
  const textarea = document.getElementById('hl7-inspector-input');
  const output = document.getElementById('inspector-output-area');
  if (!textarea || !output) return;

  const raw = textarea.value;
  const result = window.hl7Inspector.parse(raw);

  if (!result.success) {
    output.innerHTML = `
      <div style="background: rgba(239, 71, 111, 0.12); border: 1px solid var(--accent-rose); border-radius: var(--radius-md); padding: 16px; color: var(--accent-rose);">
        <strong>Błąd parsowania komunikatu:</strong> ${result.error}
      </div>
    `;
    return;
  }

  const meta = result.metadata;
  let warningsHtml = "";
  if (result.warnings && result.warnings.length > 0) {
    warningsHtml = `
      <div style="background: rgba(255, 183, 3, 0.12); border: 1px solid var(--accent-amber); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; color: var(--accent-amber); font-size: 0.85rem;">
        <strong>⚠️ Ostrzeżenia walidacji:</strong>
        <ul style="margin-left: 18px; margin-top: 4px;">
          ${result.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  output.innerHTML = `
    ${warningsHtml}
    <!-- Pigułki metadanych -->
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
      <span style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
        Typ komunikatu: <strong style="color: var(--accent-cyan);">${meta.messageType}</strong>
      </span>
      <span style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
        Control ID: <strong style="color: var(--accent-teal);">${meta.messageControlId}</strong>
      </span>
      <span style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
        Wersja HL7: <strong>${meta.hl7Version}</strong>
      </span>
      <span style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
        Pacjent: <strong>${meta.patientName}</strong>
      </span>
      <span style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem;">
        Segmenty: <strong>${meta.segmentCount}</strong>
      </span>
    </div>

    <!-- Lista segmentów i pól -->
    <div>
      ${result.segments.map(seg => `
        <div class="segment-item-box">
          <div class="segment-header-pill">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="seg-badge">${seg.segmentName}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Linia #${seg.lineIndex}</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono);">${seg.fields.length} pól</span>
          </div>
          <div class="field-breakdown-list">
            ${seg.fields.filter(f => f.value.trim().length > 0).map(f => `
              <div class="field-line">
                <div class="field-coord">${seg.segmentName}-${f.index}</div>
                <div class="field-label">${f.name}</div>
                <div class="field-content">
                  ${escapeHtml(f.value)}
                  ${f.components ? `<div style="font-size: 0.72rem; color: var(--accent-teal); margin-top: 2px;">Komponenty: ${f.components.map(c => escapeHtml(c)).join(' | ')}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

window.generateAndShowACK = function() {
  const textarea = document.getElementById('hl7-inspector-input');
  if (!textarea) return;

  const result = window.hl7Inspector.parse(textarea.value);
  if (!result.success) {
    showToast("Najpierw wklej poprawny komunikat HL7!");
    return;
  }

  const ack = window.hl7Inspector.generateAck(result, "AA", "Message received successfully");

  // Wyświetl w ładnym boxie pod spodem
  const output = document.getElementById('inspector-output-area');
  const ackContainer = document.createElement('div');
  ackContainer.className = "card";
  ackContainer.style.borderColor = "var(--accent-teal)";
  ackContainer.style.marginTop = "20px";
  ackContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h4 style="color: var(--accent-teal);">Wygenerowana odpowiedź ACK (Application Accept):</h4>
      <button class="btn btn-secondary btn-sm" onclick="copySnippetToClipboard('ack-result-text')">📋 Kopiuj ACK</button>
    </div>
    <pre><code id="ack-result-text">${escapeHtml(ack)}</code></pre>
  `;

  output.prepend(ackContainer);
  showToast("Wygenerowano odpowiedź ACK!");
};

/* ==========================================================================
   Szybkie Notatki (Quick Notes Drawer)
   ========================================================================== */
function initQuickNotes() {
  const toggleBtn = document.getElementById('quick-notes-toggle');
  const drawer = document.getElementById('quick-notes-drawer');
  const closeBtn = document.getElementById('close-notes-drawer');
  const textarea = document.getElementById('quick-notes-textarea');

  if (!toggleBtn || !drawer || !textarea) return;

  textarea.value = window.appState.data.notes.quickNote || "";

  toggleBtn.addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  }

  textarea.addEventListener('input', (e) => {
    window.appState.setQuickNote(e.target.value);
  });
}

/* ==========================================================================
   Narzędzie: Asystent Konsoli Linux & Generator Rozwiązań v3.0
   ========================================================================== */
function renderLinuxAssistantModule() {
  const container = document.getElementById('linux-assistant-container');
  if (!container) return;

  const defaultSample = "Port MLLP 2575 nie odpowiada przy próbie wysłania zlecenia ORM^O01 z HIS do laboratorium LIS (Connection refused).";

  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3>🐧 Generator Procedury & Komend Linux (Error-First)</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Opisz problem swoimi słowami, wklej fragment logu lub kliknij jeden z gotowych scenariuszy medycznych.
          </p>
        </div>
        <div class="inspector-preset-bar">
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l2_ipc')">🔒 [L2: IPC] Firebird semop / Lock Table</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l3_mtu')">⚡ [L3: MTU] DICOM / PACS Connection Reset</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l1_ram')">🔥 [L1: RAM] JVM OOM Killer</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l1_disk')">💾 [L1: Dysk] Postgres ENOSPC</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l2_perm')">🔒 [L2: Prawa] Socket Permission Denied</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l2_nfs')">📦 [L2: Storage] PACS NFS Timeout</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l3_mllp')">🌐 [L3: Sieć] Port MLLP Refused + IP Firewall</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l3_bind')">⚡ [L3: Port] Address in use (Bind)</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l4_crash')">💀 [L4: Cykl] Usługa padła (status=1)</button>
          <button class="btn btn-secondary btn-sm" onclick="loadTroubleshooterPreset('l5_sql')">🐘 [L5: SQL] PostgreSQL Too Many Conns</button>
        </div>
      </div>

      <textarea id="linux-troubleshoot-input" class="hl7-raw-input" style="min-height: 90px; color: #a7f3d0;" placeholder="Wklej tutaj treść błędu z konsoli, loga systemd lub opisz problem...">${escapeHtml(defaultSample)}</textarea>

      <div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-primary" onclick="runLinuxTroubleshooter()">⚡ Zdiagnozuj (Error-First) i Wygeneruj Komendy</button>
        <button class="btn btn-secondary" style="background: rgba(147, 51, 234, 0.15); color: #c084fc; border-color: rgba(147, 51, 234, 0.35); font-weight: 700;" onclick="runGeminiIncidentConsultation()">🤖 Interaktywny Pilot Gemini (Ping-Pong / REPL)</button>
        <button class="btn btn-secondary" onclick="clearLinuxTroubleshooterInput()">🧹 Wyczyść</button>
        <button class="btn btn-secondary" onclick="toggleKBManagerUI()">📖 Baza Reguł (KB JSON v2.0.0)</button>
        <button class="btn btn-secondary" onclick="toggleGeminiConfigUI()" id="gemini-status-btn">⚙️ Gemini AI (Konfiguracja)</button>
      </div>

      <!-- Panel Konfiguracji Gemini API -->
      <div id="linux-gemini-config-section" style="display: none; margin-bottom: 24px;"></div>

      <!-- Panel Bazy Wiedzy KB JSON v2.0.0 -->
      <div id="linux-kb-manager-section" style="display: none; margin-bottom: 24px;"></div>

      <!-- Wyniki Analizy Gemini AI (Druga Opinia / Głęboka Diagnoza) -->
      <div id="linux-gemini-output" style="display: none; margin-bottom: 24px;"></div>

      <!-- Wyniki bieżącej analizy lokalnej -->
      <div id="linux-troubleshoot-output"></div>

      <!-- Baza Rozwiązanych Incydentów (Runbooki & Post-Mortem) -->
      <div id="linux-runbooks-archive-section" style="margin-top: 30px;"></div>
    </div>
  `;

  runLinuxTroubleshooter();
  updateGeminiStatusUI();
}

window.loadTroubleshooterPreset = function(presetKey) {
  const input = document.getElementById('linux-troubleshoot-input');
  if (!input) return;

  const presets = {
    l2_ipc: "Operating system directive semop failed; Lock manager error: active processes exist on lock table; cannot attach to password database",
    l3_mtu: "DICOM C-STORE failed: connection reset by peer while transmitting 240000 bytes; association aborted on port 104",
    l1_ram: "kernel: [14201.55] Out of memory: Killed process 4120 (java -jar mirth) total-vm:16GB, anon-rss:8GB; java.lang.OutOfMemoryError: Java heap space",
    l1_disk: "PostgreSQL PANIC: could not write to file 'pg_wal/xlog': No space left on device; Main process exited, code=exited, status=1/FAILURE",
    l2_perm: "PostgreSQL: could not create socket file \"/var/run/postgresql/.s.PGSQL.5432\": Permission denied (EACCES)",
    l2_nfs: "dmesg: nfs: server 192.168.10.50 not responding, still trying; PACS storage mount timeout on /mnt/pacs_storage",
    l3_mllp: "Port MLLP 2575 connection refused przy próbie wysłania zlecenia ORM^O01 z analizatora LIS",
    l3_bind: "Błąd startu usługi integracyjnej: java.net.BindException: Address already in use: bind (port 2575 zajęty)",
    l4_crash: "Service medical-integration.service failed to start, code=exited, status=1/FAILURE; Main process exited",
    l5_sql: "PostgreSQL: FATAL: remaining connection slots are reserved for non-replication superuser connections"
  };

  input.value = presets[presetKey] || "";
  runLinuxTroubleshooter();
  showToast("Załadowano scenariusz diagnostyczny");
};

window.clearLinuxTroubleshooterInput = function() {
  const input = document.getElementById('linux-troubleshoot-input');
  if (input) {
    input.value = "";
    input.focus();
  }
};

window.runLinuxTroubleshooter = function() {
  const input = document.getElementById('linux-troubleshoot-input');
  const output = document.getElementById('linux-troubleshoot-output');
  if (!input || !output) return;

  const text = input.value;
  if (!text || !text.trim()) {
    output.innerHTML = `
      <div style="background: rgba(255, 183, 3, 0.1); border: 1px solid var(--accent-amber); border-radius: var(--radius-md); padding: 16px; color: var(--accent-amber);">
        Wpisz opis problemu, wklej fragment logu błędu lub wybierz jeden ze scenariuszy powyżej.
      </div>
    `;
    renderRunbooksArchiveUI();
    return;
  }

  const analysis = window.linuxTroubleshooter.analyze(text);
  if (!analysis || !analysis.incident) {
    output.innerHTML = `<div>Brak wyników analizy.</div>`;
    renderRunbooksArchiveUI();
    return;
  }

  // Zapisz ostatnią analizę w pamięci sesji UI
  window._lastIncidentAnalysis = analysis;

  const inc = analysis.incident;

  // Zbuduj wszystkie komendy do jednego bufora (dla przycisku kopiuj wszystko)
  let allCommandsText = `#!/bin/bash\n# Klasyfikacja: ${inc.level.name}\n# Procedura: ${inc.title}\n# Diagnoza: ${inc.diagnosis}\n\n`;
  inc.procedure.forEach(p => {
    allCommandsText += `\n# --- ${p.step} ---\n`;
    p.commands.forEach(c => {
      allCommandsText += `${c.cmd}  # ${c.desc}\n`;
    });
  });

  const stateBadgeHtml = inc.isDeadProcess
    ? `<span style="background: rgba(239, 71, 111, 0.18); color: var(--accent-rose); font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-rose);">🛑 STAN: PROCES ZATRZYMANY (Zapytania aplikacyjne L7 zablokowane)</span>`
    : `<span style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-teal);">🟢 STAN: PROCES AKTYWNY (Dopuszczalna diagnostyka administracyjna)</span>`;

  const pathBadgeHtml = analysis.extractedPaths && analysis.extractedPaths.detected
    ? `<div style="margin-top: 12px; background: rgba(0, 180, 216, 0.08); border: 1px solid var(--accent-cyan); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.82rem;">
        <span style="color: var(--accent-cyan); font-weight: 700;">🔍 Wykryto ścieżkę z Twojego logu:</span> 
        <code style="color: var(--text-primary); font-size: 0.85rem;">${escapeHtml(analysis.extractedPaths.fullPath)}</code> 
        <span style="color: var(--text-muted); font-size: 0.78rem;">(Katalog: <code>${escapeHtml(analysis.extractedPaths.parentDir)}</code> — parametry komend poniżej zostały automatycznie podstawione!)</span>
      </div>`
    : '';

  const ruleIdBadge = inc.ruleId
    ? `<span style="background: rgba(255, 183, 3, 0.15); color: var(--accent-amber); font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255, 183, 3, 0.3);">
        Reguła KB: ${escapeHtml(inc.ruleId)} (Priorytet: ${inc.rawRule?.priority || '100'})
      </span>`
    : '';

  output.innerHTML = `
    <!-- Karta diagnozy -->
    <div class="card" style="border-left: 5px solid ${inc.level.color}; background: var(--bg-card); margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="background: rgba(0, 180, 216, 0.15); color: var(--accent-cyan); font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 12px;">
            ${inc.level.name}
          </span>
          ${ruleIdBadge}
          ${stateBadgeHtml}
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="copyAllTroubleshooterCommands()">📋 Kopiuj Wszystkie Komendy</button>
          <button class="btn btn-primary btn-sm" onclick="saveCurrentIncidentAsRunbook()">💾 Zapisz do Bazy Runbooków</button>
          <button class="btn btn-secondary btn-sm" onclick="saveProcedureToQuickNotes()">✏️ Szybkie Notatki</button>
        </div>
      </div>

      <h3 style="font-size: 1.3rem; margin-bottom: 8px; color: var(--text-primary);">${inc.title}</h3>
      <p style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6;">
        ${inc.diagnosis}
      </p>
      ${pathBadgeHtml}
    </div>

    <!-- Ukryty textarea ze wszystkimi komendami do kopiowania -->
    <textarea id="hidden-all-bash-commands" style="display: none;">${escapeHtml(allCommandsText)}</textarea>

    <!-- Kroki postępowania z interaktywnym podczatem -->
    <div style="display: flex; flex-direction: column; gap: 18px; margin-bottom: 24px;">
      ${inc.procedure.map((stepItem, sIdx) => `
        <div class="card" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 18px;" id="step-card-${sIdx}">
          <h4 style="font-size: 1rem; color: var(--accent-cyan); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            ${stepItem.step}
          </h4>
          ${stepItem.verify ? `
            <div style="margin-bottom: 12px; font-size: 0.8rem; color: var(--text-muted); background: rgba(0, 180, 216, 0.05); padding: 6px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan);">
              <strong style="color: var(--accent-cyan);">🔎 Weryfikacja:</strong> ${escapeHtml(stepItem.verify)}
            </div>
          ` : ''}
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${stepItem.commands.map((c, cIdx) => {
              const cmdId = `cmd_${sIdx}_${cIdx}`;
              const threadId = `thread_${sIdx}_${cIdx}`;
              return `
                <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                      💡 ${c.desc}
                    </span>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="copyRawCommand('${cmdId}')">
                        📋 Kopiuj
                      </button>
                      <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: rgba(255, 183, 3, 0.08); border-color: rgba(255, 183, 3, 0.3); color: var(--accent-amber);" onclick="toggleStepFeedbackThread('${threadId}')">
                        ⚠️ Komenda zwróciła błąd / Wynik
                      </button>
                    </div>
                  </div>

                  <pre style="margin: 0; padding: 8px 12px; background: transparent; border: none;"><code id="${cmdId}" style="color: #67e8f9; font-size: 0.88rem;">${escapeHtml(c.cmd)}</code></pre>

                  <!-- Rozwijany Podczat Incydentu dla tego kroku -->
                  <div id="box-${threadId}" style="display: none; margin-top: 12px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">
                      💬 Podczat Kroku: Wklej wynik terminala dla tej komendy
                    </div>
                    <textarea id="input-${threadId}" class="doc-textarea" style="min-height: 60px; font-size: 0.82rem; font-family: var(--font-mono); color: #fde047;" placeholder="Wklej co dokładnie zwrócił terminal (np. 'bash: fuser: command not found', 'Permission denied', 'Device or resource busy', 'Connection refused')..."></textarea>
                    
                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                      <button class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="submitStepFeedback(${sIdx}, ${cIdx}, '${threadId}')">
                        💡 Rozwiąż błąd tego kroku (Mikro-poprawka)
                      </button>
                      <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; background: rgba(147, 51, 234, 0.15); color: #c084fc; border-color: rgba(147, 51, 234, 0.35); font-weight: 700;" onclick="submitStepGeminiFeedback(${sIdx}, ${cIdx}, '${threadId}')">
                        🤖 Analizuj przez Gemini AI
                      </button>
                      <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="toggleStepFeedbackThread('${threadId}')">
                        ✕ Schowaj
                      </button>
                    </div>

                    <!-- Wynik mikro-poprawki -->
                    <div id="output-${threadId}" style="margin-top: 10px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Ostrzeżenia Bezpieczeństwa -->
    <div style="background: rgba(239, 71, 111, 0.08); border: 1px solid var(--accent-rose); border-radius: var(--radius-md); padding: 16px 20px;">
      <h4 style="color: var(--accent-rose); font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
        ⚠️ Zasady Bezpieczeństwa w Szpitalu (Production Caution):
      </h4>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
        ${inc.safetyTips}
      </p>
    </div>
  `;

  renderRunbooksArchiveUI();
};

window.toggleStepFeedbackThread = function(threadId) {
  const box = document.getElementById(`box-${threadId}`);
  if (!box) return;
  if (box.style.display === 'none' || !box.style.display) {
    box.style.display = 'block';
    const textarea = document.getElementById(`input-${threadId}`);
    if (textarea) textarea.focus();
  } else {
    box.style.display = 'none';
  }
};

window.submitStepFeedback = function(stepIdx, cmdIdx, arg3, arg4) {
  // Elastyczna obsługa parametrów (stepIdx, cmdIdx, threadId) lub starych (stepIdx, cmdIdx, originalCmd, threadId)
  let threadId = `thread_${stepIdx}_${cmdIdx}`;
  let passedCmd = "";

  if (typeof arg3 === 'string' && (arg3.startsWith('thread_') || arg3.startsWith('gemini_thread_'))) {
    threadId = arg3;
  } else if (typeof arg4 === 'string' && (arg4.startsWith('thread_') || arg4.startsWith('gemini_thread_'))) {
    threadId = arg4;
    passedCmd = typeof arg3 === 'string' ? arg3 : "";
  }

  const isGeminiThread = threadId.startsWith('gemini_');

  const textarea = document.getElementById(`input-${threadId}`);
  const output = document.getElementById(`output-${threadId}`);
  if (!textarea || !output) return;

  const termOutput = textarea.value;
  if (!termOutput || !termOutput.trim()) {
    showToast("Wklej treść błędu z terminala!");
    return;
  }

  // Bezpieczne pobranie oryginalnej komendy bez psucia składni HTML
  let originalCmd = passedCmd;
  if (!originalCmd) {
    const cmdElemId = isGeminiThread ? `gemini_cmd_${stepIdx}_${cmdIdx}` : `cmd_${stepIdx}_${cmdIdx}`;
    const cmdElem = document.getElementById(cmdElemId);
    if (cmdElem) {
      originalCmd = cmdElem.textContent || cmdElem.innerText || "";
    }
  }
  if (!originalCmd) {
    if (isGeminiThread && window._lastGeminiIncident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
      originalCmd = window._lastGeminiIncident.procedure[stepIdx].commands[cmdIdx].cmd || "";
    } else if (window._lastIncidentAnalysis?.incident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
      originalCmd = window._lastIncidentAnalysis.incident.procedure[stepIdx].commands[cmdIdx].cmd || "";
    }
  }

  const currentIncident = (isGeminiThread && window._lastGeminiIncident)
    ? window._lastGeminiIncident
    : (window._lastIncidentAnalysis ? window._lastIncidentAnalysis.incident : null);

  const fixResult = window.linuxTroubleshooter.analyzeStepError(stepIdx, originalCmd, termOutput, currentIncident);

  window._lastStepFixResult = fixResult;

  const dangerousAlertHtml = fixResult.dangerousTruncate ? `
    <div style="background: rgba(255, 183, 3, 0.12); border: 1px solid var(--accent-amber); border-radius: var(--radius-sm); padding: 12px; margin-top: 10px;">
      <div style="color: var(--accent-amber); font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
        ⚠️ KOREKTA BEZPIECZEŃSTWA (Production Safety Guard):
      </div>
      <p style="font-size: 0.82rem; color: var(--text-primary); margin: 6px 0;">
        System plików jest już w trybie zapisu (rw). Zamiast zerować plik konfiguracyjny <code>${escapeHtml(fixResult.dangerousTruncate.fileName)}</code> (co zniszczyłoby konfigurację usługi!), zwolnij miejsce czyszcząc logi:
      </p>
      <pre style="margin: 6px 0; padding: 6px 10px; background: var(--bg-input); border: 1px solid var(--border-color);"><code id="safe-cmd-${threadId}" style="color: #67e8f9; font-size: 0.85rem;">${escapeHtml(fixResult.dangerousTruncate.correctedCmd)}</code></pre>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="applyCorrectedStepCommand(${stepIdx}, ${cmdIdx}, '${threadId}')">
          🔄 Podmień komendę w Kroku ${stepIdx + 1} na bezpieczną
        </button>
      </div>
    </div>
  ` : '';

  output.innerHTML = `
    <div style="background: rgba(6, 214, 160, 0.08); border-left: 3px solid var(--accent-teal); padding: 12px; border-radius: var(--radius-sm); margin-top: 8px;">
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-teal); margin-bottom: 4px;">
        🎯 Diagnoza problemu w tym kroku: ${escapeHtml(fixResult.diagnosis)}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
        Wykonaj poniższą mikro-poprawkę (zasada niepowtarzania błędu zachowana):
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${fixResult.fixCommands.map((fc, fcIdx) => {
          const fcId = `fix_${threadId}_${fcIdx}`;
          return `
            <div style="background: var(--bg-input); padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <code id="${fcId}" style="color: #a7f3d0; font-size: 0.85rem;">${escapeHtml(fc.cmd)}</code>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(fc.desc)}</div>
              </div>
              <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="copyRawCommand('${fcId}')">
                📋 Kopiuj
              </button>
            </div>
          `;
        }).join('')}
      </div>
      ${dangerousAlertHtml}
      <div style="margin-top: 10px; font-size: 0.82rem; color: var(--accent-cyan); font-weight: 600;">
        ${escapeHtml(fixResult.targetGoalMessage)}
      </div>
      <div style="margin-top: 10px;">
        <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem;" onclick="recordStepFixToRunbook(${stepIdx})">
          💾 Zapisz mikro-poprawkę do Runbooka
        </button>
      </div>
    </div>
  `;

  showToast("Przygotowano celowaną mikro-poprawkę!");
};

window.applyCorrectedStepCommand = function(stepIdx, cmdIdx, threadId) {
  const safeElem = document.getElementById(`safe-cmd-${threadId}`);
  const isGemini = threadId && threadId.startsWith('gemini_');
  const targetCmdElemId = isGemini ? `gemini_cmd_${stepIdx}_${cmdIdx}` : `cmd_${stepIdx}_${cmdIdx}`;
  const targetCmdElem = document.getElementById(targetCmdElemId);
  if (!safeElem || !targetCmdElem) return;

  const safeCmdText = safeElem.textContent || safeElem.innerText;
  targetCmdElem.textContent = safeCmdText;

  if (isGemini && window._lastGeminiIncident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
    window._lastGeminiIncident.procedure[stepIdx].commands[cmdIdx].cmd = safeCmdText;
  } else if (window._lastIncidentAnalysis?.incident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
    window._lastIncidentAnalysis.incident.procedure[stepIdx].commands[cmdIdx].cmd = safeCmdText;
  }

  showToast(`Zaktualizowano Krok ${stepIdx + 1} na bezpieczne polecenie!`);
};

window.saveCurrentIncidentAsRunbook = function() {
  const analysis = window._lastIncidentAnalysis;
  if (!analysis || !analysis.incident) {
    showToast("Brak incydentu do zapisania.");
    return;
  }

  const inc = analysis.incident;
  const path = analysis.extractedPaths && analysis.extractedPaths.detected ? analysis.extractedPaths.fullPath : "";

  const record = {
    id: `runbook_${Date.now()}`,
    date: new Date().toLocaleString('pl-PL'),
    title: inc.title,
    category: inc.level.name,
    level: inc.level.id,
    errorLog: analysis.userInput,
    detectedPath: path,
    resolvedSteps: inc.procedure.map(p => ({
      step: p.step,
      commands: p.commands.map(c => c.cmd)
    })),
    postMortemNotes: `Diagnoza: ${inc.diagnosis}\nBezpieczeństwo: ${inc.safetyTips}`
  };

  window.appState.saveIncidentRunbook(record);
  renderRunbooksArchiveUI();
  showToast("Zapisano incydent w Twojej Bazie Runbooków!");
};

window.recordStepFixToRunbook = function(stepIdx, diagnosisNote) {
  const diag = diagnosisNote || window._lastStepFixResult?.diagnosis || `Rozwiązanie kroku ${stepIdx + 1}`;
  saveCurrentIncidentAsRunbook();
  showToast(`Zanotowano rozwiązanie Kroku ${stepIdx + 1} w Runbooku!`);
};

// Aktywny filtr i fraza wyszukiwania (stan lokalny)
let _runbookSearchQuery = '';
let _runbookSystemFilter = 'ALL';

function renderRunbooksArchiveUI() {
  const container = document.getElementById('linux-runbooks-archive-section');
  if (!container) return;

  const allRunbooks = window.appState.getIncidentRunbooks();

  // Zastosuj filtry
  let filtered = allRunbooks;
  if (_runbookSystemFilter && _runbookSystemFilter !== 'ALL') {
    filtered = window.appState.filterRunbooksBySystem(_runbookSystemFilter);
  }
  if (_runbookSearchQuery) {
    const terms = _runbookSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = filtered.filter(rb => {
      const hay = [rb.title, rb.category, rb.system, (rb.tags||[]).join(' '), rb.errorLog||'', rb.postMortemNotes||''].join(' ').toLowerCase();
      return terms.every(t => hay.includes(t));
    });
  }

  const SYSTEMS = ['ALL', 'LIS', 'eKrew', 'PatExpert', 'Genetyka', 'Linux', 'SQL'];
  const SYSTEM_COLORS = { LIS: '#06d6a0', eKrew: '#ef476f', PatExpert: '#8338ec', Genetyka: '#ffb703', Linux: '#00b4d8', SQL: '#3a86ff', '': '#64748b' };

  function systemBadge(system) {
    if (!system) return '';
    const color = SYSTEM_COLORS[system] || '#64748b';
    return `<span style="font-size: 0.7rem; background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 4px; border: 1px solid ${color}55; font-weight: 700;">${escapeHtml(system)}</span>`;
  }

  function highlightQuery(text, query) {
    if (!query || !text) return escapeHtml(text || '');
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let result = escapeHtml(text);
    terms.forEach(term => {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '<mark style="background: rgba(255,183,3,0.35); border-radius: 2px; padding: 0 2px;">$1</mark>');
    });
    return result;
  }

  function tagsList(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(t => `<span style="font-size: 0.68rem; background: var(--bg-card); color: var(--text-muted); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-color);">#${escapeHtml(t)}</span>`).join(' ');
  }

  const filterChips = SYSTEMS.map(sys => {
    const active = _runbookSystemFilter === sys;
    const color = sys === 'ALL' ? 'var(--accent-cyan)' : (SYSTEM_COLORS[sys] || 'var(--text-muted)');
    return `<button onclick="setRunbookFilter('${sys}')" style="
      padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
      border: 1px solid ${active ? color : 'var(--border-color)'};
      background: ${active ? `${color}22` : 'var(--bg-input)'};
      color: ${active ? color : 'var(--text-muted)'};
      transition: all 0.15s;
    ">${sys === 'ALL' ? '📋 Wszystkie' : sys}</button>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="background: var(--bg-card);">
      <!-- Nagłówek -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3>📚 Baza Rozwiązanych Incydentów (Runbooki &amp; Post-Mortem)</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Łącznie: <strong>${allRunbooks.length}</strong> runbooków &nbsp;·&nbsp; Wyświetlane: <strong>${filtered.length}</strong>
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="toggleQuickSaveModal()" style="border-color: var(--accent-teal); color: var(--accent-teal);">
          ➕ Szybki Zapis Incydentu
        </button>
      </div>

      <!-- Pasek wyszukiwania -->
      <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: center;">
        <div style="flex: 1; position: relative;">
          <input type="text" id="runbook-search-input"
            placeholder="🔍 Szukaj: np. eKrew timeout, NullPointerException, OOM, kod kreskowy..."
            value="${escapeHtml(_runbookSearchQuery)}"
            oninput="onRunbookSearch(this.value)"
            style="width: 100%; padding: 8px 12px; border-radius: var(--radius-sm);
                   border: 1px solid var(--border-focus); background: var(--bg-input);
                   color: var(--text-primary); font-size: 0.85rem; outline: none;"
          >
        </div>
        ${_runbookSearchQuery ? `<button class="btn btn-secondary btn-sm" onclick="clearRunbookSearch()">✕ Wyczyść</button>` : ''}
      </div>

      <!-- Filtry systemu -->
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
        ${filterChips}
      </div>

      <!-- Formularz Quick Save (ukryty domyślnie) -->
      <div id="quick-save-modal" style="display: none; background: var(--bg-input); border: 1px solid var(--accent-teal); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
        <h4 style="color: var(--accent-teal); margin-bottom: 12px;">➕ Szybki Zapis Incydentu</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
          <div>
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">System *</label>
            <select id="qs-system" style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
              <option value="">-- wybierz --</option>
              <option value="LIS">LIS – Laboratorium</option>
              <option value="eKrew">eKrew – Bank Krwi</option>
              <option value="PatExpert">PatExpert – Patomorfologia</option>
              <option value="Genetyka">Genetyka</option>
              <option value="Linux">Linux / System</option>
              <option value="SQL">SQL / Baza Danych</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Tytuł incydentu *</label>
            <input type="text" id="qs-title" placeholder="np. Zablokowany bufor zleceń LIS"
              style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>
        <div style="margin-bottom: 10px;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Komunikat błędu / fragment logu</label>
          <textarea id="qs-error-log" rows="2" placeholder="Wklej kluczowy fragment błędu z logów..."
            style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.82rem; font-family: var(--font-mono); resize: vertical;"></textarea>
        </div>
        <div style="margin-bottom: 10px;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Zastosowane rozwiązanie *</label>
          <textarea id="qs-solution" rows="3" placeholder="Opisz co zrobiłeś krok po kroku..."
            style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.82rem; resize: vertical;"></textarea>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Słowa kluczowe / tagi (oddzielone przecinkami)</label>
          <input type="text" id="qs-tags" placeholder="np. timeout, analizator, ASTM, restart"
            style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" style="background: var(--accent-teal); border-color: var(--accent-teal);" onclick="submitQuickSave()">💾 Zapisz Runbooka</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleQuickSaveModal()">✕ Anuluj</button>
        </div>
      </div>

      <!-- Lista runbooków -->
      ${filtered.length === 0 ? `
        <div style="text-align: center; padding: 32px; color: var(--text-muted);">
          ${allRunbooks.length === 0
            ? '📭 Brak zapisanych runbooków. Rozwiąż incydent przez Asystenta Linux lub kliknij „Szybki Zapis".'
            : '🔍 Brak wyników dla podanych filtrów. Spróbuj zmienić wyszukiwaną frazę lub system.'}
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${filtered.map(rb => `
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 0.72rem; background: var(--bg-card); color: var(--accent-cyan); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-color);">
                      📅 ${escapeHtml(rb.date)}
                    </span>
                    ${rb.system ? systemBadge(rb.system) : ''}
                    <span style="font-size: 0.72rem; background: var(--bg-card); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-color);">
                      ${escapeHtml(rb.category)}
                    </span>
                  </div>
                  <h4 style="font-size: 1.02rem; color: var(--text-primary); margin-bottom: 4px;">
                    ${highlightQuery(rb.title, _runbookSearchQuery)}
                  </h4>
                  ${rb.detectedPath ? `<div style="font-size: 0.78rem; color: var(--text-muted);">Ścieżka: <code>${escapeHtml(rb.detectedPath)}</code></div>` : ''}
                  ${(rb.tags && rb.tags.length > 0) ? `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${tagsList(rb.tags)}</div>` : ''}
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button class="btn btn-secondary btn-sm" onclick="copyRunbookMarkdown('${rb.id}')">📋 Kopiuj MD</button>
                  <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="deleteRunbookEntry('${rb.id}')">🗑️ Usuń</button>
                </div>
              </div>

              <details style="margin-top: 8px;">
                <summary style="font-size: 0.8rem; color: var(--accent-cyan); cursor: pointer; font-weight: 600;">
                  Pokaż szczegóły logu błędu i procedurę naprawczą
                </summary>
                <div style="margin-top: 10px; font-size: 0.82rem; color: var(--text-secondary);">
                  ${rb.errorLog ? `
                    <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-muted);">Pierwotny komunikat błędu:</div>
                    <pre style="padding: 8px; background: var(--bg-card); margin-bottom: 10px; overflow-x: auto; white-space: pre-wrap;"><code>${highlightQuery(rb.errorLog, _runbookSearchQuery)}</code></pre>
                  ` : ''}
                  <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-muted);">Zapisana procedura naprawcza:</div>
                  <pre style="padding: 8px; background: var(--bg-card); overflow-x: auto; white-space: pre-wrap;"><code>${highlightQuery(rb.postMortemNotes, _runbookSearchQuery)}</code></pre>
                </div>
              </details>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

window.setRunbookFilter = function(system) {
  _runbookSystemFilter = system;
  renderRunbooksArchiveUI();
};

window.onRunbookSearch = function(query) {
  _runbookSearchQuery = query;
  renderRunbooksArchiveUI();
};

window.clearRunbookSearch = function() {
  _runbookSearchQuery = '';
  renderRunbooksArchiveUI();
};

window.toggleQuickSaveModal = function() {
  const modal = document.getElementById('quick-save-modal');
  if (!modal) return;
  const isVisible = modal.style.display !== 'none';
  modal.style.display = isVisible ? 'none' : 'block';
};

window.submitQuickSave = function() {
  const system = document.getElementById('qs-system')?.value || '';
  const title = document.getElementById('qs-title')?.value?.trim() || '';
  const errorLog = document.getElementById('qs-error-log')?.value?.trim() || '';
  const solution = document.getElementById('qs-solution')?.value?.trim() || '';
  const tagsRaw = document.getElementById('qs-tags')?.value?.trim() || '';

  if (!title) { showToast('⚠️ Podaj tytuł incydentu!'); return; }
  if (!solution) { showToast('⚠️ Podaj zastosowane rozwiązanie!'); return; }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  window.appState.saveIncidentRunbook({
    title,
    system,
    category: system || 'Ręczny wpis',
    level: 'Manual',
    errorLog,
    postMortemNotes: solution,
    tags,
    resolvedSteps: []
  });

  // Wyczyść formularz i ukryj
  ['qs-system', 'qs-title', 'qs-error-log', 'qs-solution', 'qs-tags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const modal = document.getElementById('quick-save-modal');
  if (modal) modal.style.display = 'none';

  renderRunbooksArchiveUI();
  showToast('✅ Runbook zapisany w Bazie Wiedzy!');
};

window.deleteRunbookEntry = function(runbookId) {
  if (confirm("Czy na pewno chcesz usunąć ten wpis z bazy runbooków?")) {
    window.appState.deleteIncidentRunbook(runbookId);
    renderRunbooksArchiveUI();
    showToast("Usunięto wpis z bazy.");
  }
};

window.copyRawCommand = function(cmdElementId) {
  const el = document.getElementById(cmdElementId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText || el.textContent).then(() => {
    showToast("Skopiowano komendę!");
  }).catch(() => {
    showToast("Błąd kopiowania.");
  });
};

window.copyAllTroubleshooterCommands = function() {
  const el = document.getElementById('hidden-all-bash-commands');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    showToast("Skopiowano kompletny skrypt procedury Bash!");
  }).catch(() => {
    showToast("Błąd kopiowania.");
  });
};

window.saveProcedureToQuickNotes = function(procedureTitle) {
  const el = document.getElementById('hidden-all-bash-commands');
  if (!el) return;
  const currentNote = window.appState.data.notes.quickNote || "";
  const newNote = currentNote + `\n\n--- [Zapisana Procedura: ${procedureTitle} - ${new Date().toLocaleDateString('pl-PL')}] ---\n` + el.value;
  window.appState.setQuickNote(newNote);

  const notesTextarea = document.getElementById('quick-notes-textarea');
  if (notesTextarea) notesTextarea.value = newNote;

  showToast("Dodano procedurę do Twoich Szybkich Notatek!");
};

/* ==========================================================================
   Funkcje Pomocnicze & Eksport / Toast
   ========================================================================== */
window.copySnippetToClipboard = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText || el.textContent).then(() => {
    showToast("Skopiowano do schowka!");
  }).catch(() => {
    showToast("Błąd kopiowania.");
  });
};

window.exportHubData = function() {
  window.appState.exportJSON();
  showToast("Wyeksportowano kopię zapasową!");
};

window.importHubData = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const ok = window.appState.importJSON(event.target.result);
      if (ok) {
        showToast("Zaimportowano dane! Przeładowuję widok...");
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast("Błąd: Nieprawidłowy plik JSON.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>ℹ️</span> <div>${escapeHtml(message)}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Zarządzanie Bazą Wiedzy Reguł (KB JSON v2.0.0)
   ========================================================================== */
window.toggleKBManagerUI = function() {
  const panel = document.getElementById('linux-kb-manager-section');
  if (!panel) return;

  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderKBManagerUI();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    panel.style.display = 'none';
  }
};

window.renderKBManagerUI = function() {
  const panel = document.getElementById('linux-kb-manager-section');
  if (!panel) return;

  const currentKB = window.linuxTroubleshooter ? window.linuxTroubleshooter.kb : window.DEFAULT_KB;
  const kbJsonStr = JSON.stringify(currentKB, null, 2);

  panel.innerHTML = `
    <div class="card" style="background: var(--bg-card); border: 2px solid var(--accent-cyan); padding: 20px; border-radius: var(--radius-md);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h4 style="color: var(--accent-cyan); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            📖 Baza Wiedzy Reguł Diagnostycznych (Format JSON v2.0.0)
          </h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            Wszystkie reguły posiadają ściśle zdefiniowane priorytety, triggery, procedury ze znacznikami {{TAG}} oraz dedykowane fallbacki podczatu. Możesz edytować JSON w locie lub pobrać kopię.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="downloadKBJsonUI()">💾 Pobierz JSON</button>
          <button class="btn btn-secondary btn-sm" style="color: var(--accent-amber);" onclick="resetKBToDefaultUI()">🔄 Przywróć Domyślne</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleKBManagerUI()">✕ Zamknij</button>
        </div>
      </div>

      <!-- Szybki spis aktywnych reguł -->
      <div style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;">
        ${currentKB.rules.map(r => `
          <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.78rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: var(--accent-cyan);">${escapeHtml(r.id)}</strong>
              <span style="background: rgba(0, 180, 216, 0.15); color: var(--accent-cyan); font-weight: 700; padding: 1px 6px; border-radius: 6px;">Prio: ${r.priority}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(r.title || r.id)}">
              ${escapeHtml(r.title || r.id)}
            </div>
            <div style="color: var(--text-muted); font-size: 0.7rem; margin-top: 2px;">
              Warstwa: <code>${escapeHtml(r.layer)}</code> | Status: <code>${escapeHtml(r.service_status)}</code>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Edytor JSON -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
          Edytor JSON Bazy Wiedzy:
        </label>
        <textarea id="kb-json-editor-textarea" class="hl7-raw-input" style="min-height: 240px; font-family: var(--font-mono); font-size: 0.8rem; color: #a7f3d0;">${escapeHtml(kbJsonStr)}</textarea>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-primary btn-sm" onclick="saveCustomKBFromUI()">💾 Zapisz i Zastosuj Reguły</button>
        <span style="font-size: 0.78rem; color: var(--text-muted);">
          * Zmiany zostaną natychmiast zapisane w Twojej przeglądarce i zastosowane przy kolejnej diagnozie logu.
        </span>
      </div>
    </div>
  `;
};

window.saveCustomKBFromUI = function() {
  const textarea = document.getElementById('kb-json-editor-textarea');
  if (!textarea) return;

  try {
    const parsed = JSON.parse(textarea.value);
    if (!parsed || !Array.isArray(parsed.rules)) {
      throw new Error("JSON musi zawierać obiekt główny z tablicą 'rules'");
    }

    if (window.linuxTroubleshooter) {
      window.linuxTroubleshooter.saveKB(parsed);
      renderKBManagerUI();
      runLinuxTroubleshooter();
      showToast("Pomyślnie zaktualizowano Bazę Wiedzy (KB JSON v2.0.0)!");
    }
  } catch (err) {
    alert("Błąd walidacji JSON:\n" + err.message);
  }
};

window.resetKBToDefaultUI = function() {
  if (confirm("Czy na pewno chcesz przywrócić fabryczną Bazę Wiedzy v2.0.0? Wszelkie niestandardowe reguły zostaną nadpisane.")) {
    if (window.linuxTroubleshooter) {
      window.linuxTroubleshooter.resetKB();
      renderKBManagerUI();
      runLinuxTroubleshooter();
      showToast("Przywrócono domyślną Bazę Wiedzy v2.0.0");
    }
  }
};

window.downloadKBJsonUI = function() {
  const currentKB = window.linuxTroubleshooter ? window.linuxTroubleshooter.kb : window.DEFAULT_KB;
  const jsonStr = JSON.stringify(currentKB, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `healthtech_kb_v${currentKB.version || '2.0.0'}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Pobrano plik Bazy Wiedzy JSON!");
};

/* ==========================================================================
   Integracja z Google Gemini API (BYOK & Asystent AI)
   ========================================================================== */
function updateGeminiStatusUI() {
  const btn = document.getElementById('gemini-status-btn');
  if (btn && window.geminiService) {
    if (window.geminiService.hasApiKey()) {
      btn.innerHTML = `🟢 Gemini AI: Gotowy (${window.geminiService.getModel()})`;
      btn.style.color = 'var(--accent-teal)';
      btn.style.borderColor = 'rgba(6, 214, 160, 0.4)';
    } else {
      btn.innerHTML = `⚙️ Gemini AI: Skonfiguruj Klucz`;
      btn.style.color = 'var(--accent-amber)';
      btn.style.borderColor = 'rgba(255, 183, 3, 0.3)';
    }
  }

  if (typeof window.updateMedicalGeminiStatusUI === 'function') {
    window.updateMedicalGeminiStatusUI();
  }
  if (typeof window.updateDocGeminiStatusUI === 'function') {
    window.updateDocGeminiStatusUI();
  }
  if (typeof window.updateDecoderGeminiStatusUI === 'function') {
    window.updateDecoderGeminiStatusUI();
  }
  if (typeof window.updateSqlGenGeminiStatusUI === 'function') {
    window.updateSqlGenGeminiStatusUI();
  }
  if (typeof window.updateConsultantGeminiStatusUI === 'function') {
    window.updateConsultantGeminiStatusUI();
  }
}

window.toggleGeminiConfigUI = function() {
  const panel = document.getElementById('linux-gemini-config-section');
  if (!panel) return;

  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    renderGeminiConfigUI();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    panel.style.display = 'none';
  }
};

window.renderGeminiConfigUI = function() {
  const panel = document.getElementById('linux-gemini-config-section');
  if (!panel || !window.geminiService) return;

  const currentKey = window.geminiService.getApiKey() || "";
  const currentModel = window.geminiService.getModel();
  const isConfigured = window.geminiService.hasApiKey();

  panel.innerHTML = `
    <div class="card" style="background: var(--bg-card); border: 2px solid #a855f7; padding: 20px; border-radius: var(--radius-md);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h4 style="color: #c084fc; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            🤖 Konfiguracja Google Gemini API (Bring Your Own Key)
          </h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            Model Gemini wspiera Asystenta w rzadkich, nietypowych błędach i potrafi uczyć lokalną bazę wiedzy nowych reguł. Klucz jest zapisywany wyłącznie lokalnie w Twojej przeglądarce (localStorage).
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="toggleGeminiConfigUI()">✕ Zamknij</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; margin-bottom: 14px;">
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
            Klucz Google Gemini API:
          </label>
          <input type="password" id="gemini-api-key-input" class="doc-input" style="font-family: var(--font-mono); font-size: 0.85rem;" placeholder="Wklej klucz API (np. AIzaSy...)" value="${escapeHtml(currentKey)}" />
        </div>
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
            Model:
          </label>
          <select id="gemini-model-select" class="doc-input" style="font-size: 0.85rem;" onchange="onGeminiModelChange(this.value)">
            <option value="gemini-3.5-flash" ${currentModel === 'gemini-3.5-flash' ? 'selected' : ''}>⭐ gemini-3.5-flash (Domyślny – temp:0.1, topP:0.8, determinizm bez lania wody)</option>
            <option value="gemini-2.5-flash" ${currentModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash (Stabilny GA)</option>
            <option value="gemini-3.7-flash" ${currentModel === 'gemini-3.7-flash' ? 'selected' : ''}>🚀 gemini-3.7-flash (Najnowszy – Agentic coding)</option>
            <option value="gemini-3.8-flash-high" ${currentModel === 'gemini-3.8-flash-high' ? 'selected' : ''}>🔬 gemini-3.8-flash-high (Najinteligentniejszy Flash – Głębokie wnioskowanie SRE)</option>
            <option value="gemini-3.1-pro-preview" ${currentModel === 'gemini-3.1-pro-preview' ? 'selected' : ''}>🧠 gemini-3.1-pro-preview (Flagowy model Pro – Złożona dedukcja)</option>
            <option value="gemini-3.5-flash-high" ${currentModel === 'gemini-3.5-flash-high' ? 'selected' : ''}>⚡ gemini-3.5-flash-high (Wysoki budżet myślenia)</option>
            <option value="gemini-3.6-flash" ${currentModel === 'gemini-3.6-flash' ? 'selected' : ''}>gemini-3.6-flash (Zrównoważony Flash 3.6)</option>
            <option value="gemini-3.5-flash-lite" ${currentModel === 'gemini-3.5-flash-lite' ? 'selected' : ''}>🚀 gemini-3.5-flash-lite (Ultra-szybki, najniższy koszt)</option>
            <option value="gemini-3.1-flash-lite" ${currentModel === 'gemini-3.1-flash-lite' ? 'selected' : ''}>gemini-3.1-flash-lite (Lekki i oszczędny)</option>
            <option value="gemini-2.5-pro" ${currentModel === 'gemini-2.5-pro' ? 'selected' : ''}>gemini-2.5-pro (Stabilny Pro generacji 2.5)</option>
            <option value="gemini-2.0-flash-001" ${currentModel === 'gemini-2.0-flash-001' ? 'selected' : ''}>gemini-2.0-flash-001 (Wersja bazowa 2.0)</option>
          </select>
        </div>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-primary btn-sm" style="background: #9333ea; border-color: #9333ea;" onclick="saveGeminiApiKeyUI()">💾 Zapisz Konfigurację</button>
        ${isConfigured ? `<button class="btn btn-secondary btn-sm" onclick="testGeminiConnectionUI()">⚡ Testuj Połączenie (Ping)</button>` : ''}
        ${isConfigured ? `<button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="removeGeminiApiKeyUI()">🗑️ Usuń Klucz</button>` : ''}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; color: var(--accent-cyan); text-decoration: underline; margin-left: 6px;">
          🔗 Wygeneruj darmowy klucz w Google AI Studio
        </a>
      </div>

      <div id="gemini-test-result" style="margin-top: 10px;"></div>
    </div>
  `;
};

const ALL_SYNC_MODEL_SELECT_IDS = [
  'med-gemini-model-select',
  'med-gemini-config-model-select',
  'med-pilot-inline-model-select',
  'doc-gemini-model-select',
  'doc-gemini-config-model-select',
  'decoder-gemini-model-select',
  'decoder-gemini-config-model-select',
  'decoder-pilot-inline-model-select',
  'sqlgen-gemini-model-select',
  'sqlgen-gemini-config-model-select',
  'sqlgen-pilot-inline-model-select',
  'consultant-gemini-model-select',
  'ansible-gemini-model-select',
  'gemini-model-select'
];

window.onGeminiModelChange = function(modelName) {
  if (window.geminiService && modelName) {
    window.geminiService.setModel(modelName);
    updateGeminiStatusUI();
    ALL_SYNC_MODEL_SELECT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== modelName) {
        el.value = modelName;
      }
    });
    showToast(`Zmieniono aktywny model na: ${modelName}`);
  }
};

window.quickSwitchModelAndRetry = function(newModel) {
  if (window.geminiService) {
    window.geminiService.setModel(newModel);
    updateGeminiStatusUI();
    ALL_SYNC_MODEL_SELECT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = newModel;
    });
    showToast(`Przełączono na ${newModel}. Ponawiam konsultację...`);
    runGeminiIncidentConsultation();
  }
};

window.quickSwitchModelAndTest = function(newModel) {
  if (window.geminiService) {
    window.geminiService.setModel(newModel);
    updateGeminiStatusUI();
    ALL_SYNC_MODEL_SELECT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = newModel;
    });
    showToast(`Przełączono na ${newModel}. Testuję...`);
    testGeminiConnectionUI();
  }
};

window.saveGeminiApiKeyUI = function() {
  const keyInput = document.getElementById('gemini-api-key-input');
  const modelSelect = document.getElementById('gemini-model-select');
  if (!keyInput || !window.geminiService) return;

  const key = keyInput.value.trim();
  if (!key) {
    alert("Wpisz klucz API!");
    return;
  }

  window.geminiService.setApiKey(key);
  if (modelSelect) {
    window.geminiService.setModel(modelSelect.value);
  }

  updateGeminiStatusUI();
  renderGeminiConfigUI();
  showToast(`Zapisano konfigurację Gemini API (${window.geminiService.getModel()})!`);
};

window.removeGeminiApiKeyUI = function() {
  if (confirm("Czy na pewno chcesz usunąć klucz Gemini API z przeglądarki?")) {
    if (window.geminiService) {
      window.geminiService.removeApiKey();
      updateGeminiStatusUI();
      renderGeminiConfigUI();
      showToast("Usunięto klucz Gemini API.");
    }
  }
};

window.testGeminiConnectionUI = async function() {
  const resultDiv = document.getElementById('gemini-test-result');
  const modelSelect = document.getElementById('gemini-model-select');
  if (!resultDiv || !window.geminiService) return;

  if (modelSelect && modelSelect.value) {
    window.geminiService.setModel(modelSelect.value);
    updateGeminiStatusUI();
  }

  const activeModel = window.geminiService.getModel();
  resultDiv.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">⏳ Testowanie połączenia z Gemini API (${activeModel})...</span>`;

  try {
    const res = await window.geminiService.callGemini("Odpowiedz w jednym zdaniu: Czy jesteś gotowy do pomocy administratorowi szpitala?");
    resultDiv.innerHTML = `
      <div style="background: rgba(6, 214, 160, 0.1); border: 1px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 10px; font-size: 0.82rem; color: var(--accent-teal);">
        ✅ <strong>Połączenie aktywne z modelem ${escapeHtml(activeModel)}!</strong><br/>Odpowiedź: "${escapeHtml(res.trim())}"
      </div>
    `;
    showToast(`Połączenie z ${activeModel} działa bezbłędnie!`);
  } catch (err) {
    const isHighDemand = err.message.toLowerCase().includes("high demand") || err.message.toLowerCase().includes("przeciążony");
    resultDiv.innerHTML = `
      <div style="background: rgba(239, 71, 111, 0.1); border: 1px solid var(--accent-rose); border-radius: var(--radius-sm); padding: 12px; font-size: 0.82rem; color: var(--accent-rose);">
        ❌ <strong>Błąd połączenia (${escapeHtml(activeModel)}):</strong> ${escapeHtml(err.message)}
        ${isHighDemand ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(239, 71, 111, 0.2); color: var(--text-primary);">
            💡 Serwery Google dla tego modelu mają chwilowy szczyt ruchu. Kliknij poniżej, aby przełączyć na sprawdzony model produkcyjny:
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <button class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="quickSwitchModelAndTest('gemini-2.5-flash')">
                ⚡ Testuj na stabilnym gemini-2.5-flash
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
};

window.runGeminiIncidentConsultation = async function() {
  const input = document.getElementById('linux-troubleshoot-input');
  const geminiOutput = document.getElementById('linux-gemini-output');
  const modelSelect = document.getElementById('gemini-model-select');
  if (!input || !geminiOutput || !window.geminiService) return;

  if (modelSelect && modelSelect.value) {
    window.geminiService.setModel(modelSelect.value);
    updateGeminiStatusUI();
  }

  const rawLog = input.value.trim();
  if (!rawLog) {
    showToast("Wklej treść błędu lub logu do zdiagnozowania!");
    return;
  }

  if (!window.geminiService.hasApiKey()) {
    toggleGeminiConfigUI();
    showToast("Najpierw podaj swój klucz Gemini API!");
    return;
  }

  geminiOutput.style.display = 'block';
  geminiOutput.innerHTML = `
    <div class="card" style="border: 2px solid #a855f7; background: var(--bg-card); padding: 20px; border-radius: var(--radius-md);">
      <div style="display: flex; align-items: center; gap: 10px; color: #c084fc; font-size: 1rem; font-weight: 700;">
        <span class="pulse-dot" style="display: inline-block; width: 10px; height: 10px; background: #a855f7; border-radius: 50%;"></span>
        Uruchamianie Interaktywnego Pilota SRE (${window.geminiService.getModel()})... Analiza logu i generowanie Kroku 1...
      </div>
    </div>
  `;
  geminiOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const analysis = window._lastIncidentAnalysis || {};
    const context = {
      targetPath: analysis.extractedPaths?.fullPath,
      isDead: analysis.isDead,
      entityContext: analysis.entityContext
    };

    await window.geminiService.pilotSession.start(rawLog, context);
    renderGeminiPilotUI();
    showToast("Pilot SRE przygotował Krok 1!");
  } catch (err) {
    const isHighDemand = err.message.toLowerCase().includes("high demand") || err.message.toLowerCase().includes("przeciążony");
    geminiOutput.innerHTML = `
      <div class="card" style="border: 2px solid var(--accent-rose); background: var(--bg-card); padding: 18px; border-radius: var(--radius-md);">
        <div style="color: var(--accent-rose); font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
          ❌ Błąd uruchomienia Pilota Gemini AI:
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
          ${escapeHtml(err.message)}
        </div>
        ${isHighDemand ? `
          <div style="margin-top: 12px; padding: 12px; background: rgba(255, 183, 3, 0.08); border: 1px solid var(--accent-amber); border-radius: var(--radius-sm);">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-amber); margin-bottom: 4px;">
              ⚡ Rozwiązanie przeciążenia serwerów Google (High Demand):
            </div>
            <p style="font-size: 0.8rem; color: var(--text-primary); margin: 4px 0 10px 0;">
              Przełącz jednym kliknięciem na model o wysokiej dostępności:
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" onclick="quickSwitchModelAndRetry('gemini-2.5-flash')">
                ⭐ Przełącz na gemini-2.5-flash (Stabilny) i ponów
              </button>
              <button class="btn btn-secondary btn-sm" onclick="quickSwitchModelAndRetry('gemini-3.5-flash')">
                ⚡ Przełącz na gemini-3.5-flash i ponów
              </button>
            </div>
          </div>
        ` : ''}
        <button class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="toggleGeminiConfigUI()">
          ⚙️ Sprawdź Konfigurację Klucza API
        </button>
      </div>
    `;
  }
};

function renderGeminiPilotUI() {
  const geminiOutput = document.getElementById('linux-gemini-output');
  const session = window.geminiService?.pilotSession;
  if (!geminiOutput || !session) return;

  const currentModel = window.geminiService ? window.geminiService.getModel() : 'Gemini AI';
  const isResolved = session.isResolved;

  const statusBadge = isResolved
    ? `<span style="background: rgba(6, 214, 160, 0.15); color: var(--accent-teal); font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-teal);">🟢 STAN: [AWARIA ROZWIĄZANA]</span>`
    : `<span style="background: rgba(255, 183, 3, 0.15); color: var(--accent-amber); font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--accent-amber);">🟡 STAN: W trakcie diagnostyki (Krok ${session.stepNumber})</span>`;

  geminiOutput.innerHTML = `
    <!-- Konsola Interaktywnego Pilota SRE (Ping-Pong / REPL) -->
    <div class="card" style="border: 2px solid #a855f7; background: var(--bg-card); padding: 18px 20px; border-radius: var(--radius-md); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.1);">
      
      <!-- Pasek Pamięci Kontekstowej (Memory Header) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(168, 85, 247, 0.25);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
            <span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.4);">
              🤖 Pilot SRE (${escapeHtml(currentModel)})
            </span>
            ${statusBadge}
            <span style="background: rgba(0, 180, 216, 0.12); color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(0, 180, 216, 0.3);">
              📦 Usługa: <code>${escapeHtml(session.detectedService)}</code>
            </span>
          </div>
          <div style="font-size: 0.84rem; color: var(--text-secondary);">
            <strong style="color: #c084fc;">💡 Bieżąca hipoteza:</strong> ${escapeHtml(session.hypothesis || 'Analiza logu błędu')}
          </div>
        </div>

        <!-- Akcje Pilota -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="copyPilotScript()" title="Kopiuj wszystkie wygenerowane komendy Bash jako skrypt">
            📋 Kopiuj Skrypt Bash
          </button>
          <button class="btn btn-primary btn-sm" style="background: #9333ea; border-color: #9333ea; font-size: 0.75rem;" onclick="savePilotSessionAsRunbook()">
            💾 Zapisz do Runbooka
          </button>
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="resetGeminiPilotSession()">
            🔄 Resetuj Sesję
          </button>
          <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;" onclick="closeGeminiPilotUI()">
            ✕ Schowaj
          </button>
        </div>
      </div>

      <!-- Zgłoszony log wejściowy (Zwijany) -->
      <details style="margin-bottom: 14px; background: rgba(0, 0, 0, 0.15); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
        <summary style="font-size: 0.78rem; color: var(--accent-cyan); cursor: pointer; font-weight: 700;">
          📋 Wyjściowy komunikat błędu / Log awarii (kliknij aby podejrzeć)
        </summary>
        <pre style="margin-top: 8px; padding: 6px; font-size: 0.76rem; background: var(--bg-card); max-height: 100px; overflow-y: auto;"><code>${escapeHtml(session.rawLog)}</code></pre>
      </details>

      <!-- Wątek Incydentu (Chat Stream) -->
      <div id="gemini-pilot-thread" style="display: flex; flex-direction: column; gap: 14px; max-height: 440px; overflow-y: auto; padding-right: 6px; margin-bottom: 16px;">
        ${session.turns.map((t, idx) => {
          if (t.type === 'agent') {
            const p = t.parsed;
            return `
              <div style="background: var(--bg-card); border-left: 4px solid #a855f7; border-top: 1px solid rgba(168, 85, 247, 0.2); border-right: 1px solid rgba(168, 85, 247, 0.2); border-bottom: 1px solid rgba(168, 85, 247, 0.2); border-radius: var(--radius-sm); padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.78rem; font-weight: 800; color: #c084fc; background: rgba(168, 85, 247, 0.15); padding: 2px 8px; border-radius: 6px;">
                    🤖 Pilot Gemini SRE • Krok ${t.stepNumber}
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
                  <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">💻 Komenda Bash do wykonania:</span>
                      <button class="btn btn-secondary btn-sm" style="padding: 1px 8px; font-size: 0.72rem;" onclick="copyRawCommand('pilot-cmd-${t.stepNumber}')">📋 Kopiuj</button>
                    </div>
                    <pre style="margin: 0; padding: 4px 0; background: transparent;"><code id="pilot-cmd-${t.stepNumber}" style="color: #67e8f9; font-size: 0.88rem;">${escapeHtml(p.command)}</code></pre>
                  </div>
                ` : ''}

                ${(!p.isResolved && p.expectation) ? `
                  <div style="font-size: 0.82rem; color: #fde047;">
                    ❓ <strong>Oczekiwanie:</strong> ${escapeHtml(p.expectation)}
                  </div>
                ` : ''}

                ${p.isResolved ? `
                  <div style="margin-top: 12px; background: rgba(6, 214, 160, 0.15); border: 2px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 12px; color: var(--accent-teal);">
                    <h4 style="margin: 0 0 4px 0; font-size: 1rem;">🎉 [AWARIA ROZWIĄZANA]</h4>
                    <p style="margin: 0 0 10px 0; font-size: 0.82rem; color: var(--text-primary);">
                      Procedura zakończona sukcesem! Usługa szpitalna działa poprawnie.
                    </p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="btn btn-primary btn-sm" onclick="savePilotSessionAsRunbook()">💾 Zapisz kompletny Runbook do bazy</button>
                      <button class="btn btn-secondary btn-sm" onclick="resetGeminiPilotSession()">🔄 Rozpocznij nową sesję</button>
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
                    💻 Inżynier (Wynik terminala) • Krok ${t.stepNumber}
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
        <div id="gemini-pilot-input-box" style="background: var(--bg-card); border: 1.5px solid #a855f7; border-radius: var(--radius-sm); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label for="gemini-pilot-input" style="font-size: 0.82rem; font-weight: 700; color: #c084fc;">
              💬 Wklej wynik terminala dla Kroku ${session.stepNumber}:
            </label>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Skrót: <strong>Ctrl + Enter</strong> aby wysłać</span>
          </div>
          <textarea id="gemini-pilot-input" class="doc-textarea" style="min-height: 65px; font-family: var(--font-mono); font-size: 0.85rem; color: #fde047;" placeholder="Wklej tutaj to, co zwrócił terminal... (lub kliknij przycisk poniżej jeśli komenda wykonała się bez wyjścia)"></textarea>
          <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-primary btn-sm" id="gemini-pilot-submit-btn" onclick="submitPilotInput()">
              ⚡ Wyślij wynik do analizy (Ctrl+Enter)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="sendPilotQuickSuccess()">
              ✅ Sukces (Brak błędów / Kod 0)
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--accent-amber);" onclick="submitPilotInput('Błąd: polecenie nie powiodło się (Permission denied / brak uprawnień)')">
              ⚠️ Błąd uprawnień
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="submitPilotInput('Błąd: command not found (brak narzędzia w systemie)')">
              ❌ Brak narzędzia
            </button>
          </div>
          <div id="gemini-pilot-loading" style="display: none; margin-top: 8px; font-size: 0.8rem; color: #c084fc;">
            <span class="pulse-dot" style="display: inline-block; width: 8px; height: 8px; background: #a855f7; border-radius: 50%; margin-right: 6px;"></span>
            Pilot Gemini SRE analizuje wynik terminala i dobiera kolejną komendę...
          </div>
        </div>
      ` : `
        <div id="gemini-pilot-resolved-bar" style="background: rgba(6, 214, 160, 0.08); border: 1.5px solid var(--accent-teal); border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 0.92rem; font-weight: 800; color: var(--accent-teal); display: flex; align-items: center; gap: 6px;">
              <span>🎉</span> Awaria została pomyślnie rozwiązana!
            </div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              Wprowadzanie wyników z terminala zostało zablokowane. Możesz zapisać pełny raport post-mortem do Bazy Runbooków.
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" style="background: var(--accent-teal); border-color: var(--accent-teal); font-weight: 700;" onclick="savePilotSessionAsRunbook()">
              💾 Zapisz post-mortem do Runbooka
            </button>
            <button class="btn btn-secondary btn-sm" onclick="resetGeminiPilotSession()">
              🔄 Rozpocznij nowy incydent
            </button>
          </div>
        </div>
      `}

    </div>
  `;

  // Auto-scroll i podpięcie skrótu Ctrl+Enter
  setTimeout(() => {
    const thread = document.getElementById('gemini-pilot-thread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
    const inputElem = document.getElementById('gemini-pilot-input');
    if (inputElem) {
      inputElem.focus();
      inputElem.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitPilotInput();
        }
      });
    }
  }, 50);
}

window.submitPilotInput = async function(overrideText) {
  const session = window.geminiService?.pilotSession;
  if (!session) return;

  if (session.isResolved) {
    showToast("Awaria została już rozwiązana! Rozpocznij nowy incydent lub zapisz runbook.");
    return;
  }

  const inputElem = document.getElementById('gemini-pilot-input');
  const text = overrideText !== undefined ? overrideText : (inputElem ? inputElem.value : "");

  if (overrideText === undefined && (!text || !text.trim())) {
    showToast("Wklej wynik z terminala lub kliknij przycisk Sukces!");
    if (inputElem) inputElem.focus();
    return;
  }

  const submitBtn = document.getElementById('gemini-pilot-submit-btn');
  const loadingDiv = document.getElementById('gemini-pilot-loading');
  if (submitBtn) submitBtn.disabled = true;
  if (loadingDiv) loadingDiv.style.display = 'block';

  try {
    await session.sendUserTurn(text);
    renderGeminiPilotUI();
    showToast(`Pilot przygotował Krok ${session.stepNumber}!`);
  } catch (err) {
    showToast(`Błąd pilota Gemini: ${err.message}`);
    if (loadingDiv) {
      loadingDiv.innerHTML = `<span style="color: var(--accent-rose);">❌ ${escapeHtml(err.message)}</span>`;
    }
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.sendPilotQuickSuccess = function() {
  submitPilotInput("[Komenda wykonała się pomyślnie (exit code 0 / brak wyjścia)]");
};

window.savePilotSessionAsRunbook = function() {
  const session = window.geminiService?.pilotSession;
  if (!session || session.turns.length === 0) {
    showToast("Brak historii sesji pilota do zapisania.");
    return;
  }

  const record = session.toRunbookRecord();
  window.appState.saveIncidentRunbook(record);
  renderRunbooksArchiveUI();
  showToast("Zapisano całą sesję pilota w Twojej Bazie Runbooków!");
};

window.copyPilotScript = function() {
  const session = window.geminiService?.pilotSession;
  if (!session) return;
  const cmds = session.getAllCommands();
  if (cmds.length === 0) {
    showToast("Brak wygenerowanych komend.");
    return;
  }

  let script = `#!/bin/bash\n# Sesja Pilota SRE Gemini (${new Date().toLocaleString('pl-PL')})\n# Usługa: ${session.detectedService}\n# Hipoteza: ${session.hypothesis}\n\n`;
  cmds.forEach((cmd, idx) => {
    script += `# Krok ${idx + 1}\n${cmd}\n\n`;
  });

  navigator.clipboard.writeText(script).then(() => {
    showToast("Skopiowano skrypt Bash ze wszystkich kroków pilota!");
  }).catch(() => {
    showToast("Błąd kopiowania.");
  });
};

window.resetGeminiPilotSession = function() {
  if (confirm("Czy na pewno chcesz zresetować bieżącą sesję pilota i rozpocząć od nowa?")) {
    if (window.geminiService?.pilotSession) {
      window.geminiService.pilotSession.reset();
    }
    runGeminiIncidentConsultation();
  }
};

window.closeGeminiPilotUI = function() {
  const geminiOutput = document.getElementById('linux-gemini-output');
  if (geminiOutput) geminiOutput.style.display = 'none';
};

window.saveGeminiResultAsKBRule = async function() {
  if (!window._lastGeminiResponse || !window.geminiService || !window.linuxTroubleshooter) {
    showToast("Brak wyników konsultacji Gemini do zapisu.");
    return;
  }

  showToast("⏳ Gemini AI przekształca diagnozę w regułę JSON v2.0.0...");

  try {
    const newRule = await window.geminiService.convertToKBRule(
      window._lastGeminiResponse.rawLog,
      window._lastGeminiResponse.aiText
    );

    if (!newRule || !newRule.id || !Array.isArray(newRule.steps)) {
      throw new Error("Wygenerowana reguła nie spełnia formatu KB v2.0.0");
    }

    // Dołącz do aktywnej bazy KB
    const currentKB = window.linuxTroubleshooter.kb;
    // Sprawdź czy reguła o tym ID już istnieje, jeśli tak zastąp, w przeciwnym razie wstaw na początek
    const existingIdx = currentKB.rules.findIndex(r => r.id === newRule.id);
    if (existingIdx >= 0) {
      currentKB.rules[existingIdx] = newRule;
    } else {
      currentKB.rules.unshift(newRule);
    }

    // Zapisz bazę w localStorage
    window.linuxTroubleshooter.saveKB(currentKB);
    if (typeof renderKBManagerUI === 'function') renderKBManagerUI();

    alert(`🎉 Sukces! Gemini AI wygenerowało nową regułę "${newRule.id}" (${newRule.title}), która została trwale dodana do Twojej lokalnej Bazy Wiedzy JSON v2.0.0!`);
    showToast(`Dodano regułę ${newRule.id} do lokalnej bazy!`);
  } catch (err) {
    alert("Nie udało się przekonwertować na regułę JSON:\n" + err.message);
  }
};

window.submitStepGeminiFeedback = async function(stepIdx, cmdIdx, threadId) {
  const textarea = document.getElementById(`input-${threadId}`);
  const output = document.getElementById(`output-${threadId}`);
  if (!textarea || !output || !window.geminiService) return;

  const termOutput = textarea.value.trim();
  if (!termOutput) {
    showToast("Wklej treść błędu z terminala!");
    return;
  }

  const modelSelect = document.getElementById('gemini-model-select');
  if (modelSelect && window.geminiService && modelSelect.value) {
    window.geminiService.setModel(modelSelect.value);
    updateGeminiStatusUI();
  }

  if (!window.geminiService.hasApiKey()) {
    toggleGeminiConfigUI();
    showToast("Podaj klucz Gemini API, aby korzystać z konsultacji AI w krokach!");
    return;
  }

  // Pobierz oryginalną komendę
  let originalCmd = "";
  const isGemini = threadId && threadId.startsWith('gemini_');
  const cmdElemId = isGemini ? `gemini_cmd_${stepIdx}_${cmdIdx}` : `cmd_${stepIdx}_${cmdIdx}`;
  const cmdElem = document.getElementById(cmdElemId);
  if (cmdElem) originalCmd = cmdElem.textContent || cmdElem.innerText || "";
  if (!originalCmd) {
    if (isGemini && window._lastGeminiIncident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
      originalCmd = window._lastGeminiIncident.procedure[stepIdx].commands[cmdIdx].cmd || "";
    } else if (window._lastIncidentAnalysis?.incident?.procedure?.[stepIdx]?.commands?.[cmdIdx]) {
      originalCmd = window._lastIncidentAnalysis.incident.procedure[stepIdx].commands[cmdIdx].cmd || "";
    }
  }

  const currentIncident = (isGemini && window._lastGeminiIncident)
    ? window._lastGeminiIncident
    : (window._lastIncidentAnalysis?.incident || {});

  output.innerHTML = `
    <div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #a855f7; padding: 12px; border-radius: var(--radius-sm); margin-top: 8px;">
      <div style="font-size: 0.85rem; font-weight: 700; color: #c084fc;">
        ⏳ Gemini AI analizuje błąd tego kroku z zachowaniem rygoru szpitalnego...
      </div>
    </div>
  `;

  try {
    const aiFix = await window.geminiService.diagnoseStepError(stepIdx, originalCmd, termOutput, currentIncident);

    output.innerHTML = `
      <div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #a855f7; padding: 14px; border-radius: var(--radius-sm); margin-top: 8px;">
        <div style="font-size: 0.85rem; font-weight: 700; color: #c084fc; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          🤖 Rekomendacja Gemini AI dla Kroku ${stepIdx + 1}:
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; font-family: var(--font-sans);">
${escapeHtml(aiFix)}
        </div>
        <div style="margin-top: 10px;">
          <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem;" onclick="recordStepFixToRunbook(${stepIdx}, 'Konsultacja Gemini AI')">
            💾 Zapisz mikro-poprawkę do Runbooka
          </button>
        </div>
      </div>
    `;

    showToast("Gemini AI przygotowało mikro-poprawkę dla tego kroku!");
  } catch (err) {
    output.innerHTML = `
      <div style="background: rgba(239, 71, 111, 0.08); border-left: 3px solid var(--accent-rose); padding: 12px; border-radius: var(--radius-sm); margin-top: 8px;">
        <div style="font-size: 0.82rem; color: var(--accent-rose);">
          ❌ Błąd konsultacji Gemini AI: ${escapeHtml(err.message)}
        </div>
      </div>
    `;
  }
};

