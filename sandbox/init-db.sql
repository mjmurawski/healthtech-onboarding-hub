-- ====================================================================
-- Inicjalizacja bazy 'centrum' dla piaskownicy testowej (HealthTech SRE)
-- ====================================================================

-- 1. Utworzenie użytkownika lab z uprawnieniami superusera
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lab') THEN
      CREATE ROLE lab LOGIN SUPERUSER PASSWORD 'lab';
   END IF;
END
$do$;

-- 2. Tabela wersja (kluczowa dla LIS Marcel)
CREATE TABLE IF NOT EXISTS wersja (
    id SERIAL PRIMARY KEY,
    nr_wersji VARCHAR(20) NOT NULL UNIQUE,
    data TIMESTAMP DEFAULT NOW(),
    komentarz TEXT
);

-- Wpisanie obecnej wersji przed aktualizacją
INSERT INTO wersja (nr_wersji, komentarz) VALUES 
('5.0.0', 'Wdrożenie bazowe Marcel LIS'),
('5.1.0', 'Aktualizacja słowników ICD-10 i NFZ'),
('5.2.0', 'Bieżąca wersja produkcyjna przed oknem serwisowym');

-- 3. Przykładowe tabele laboratoryjne (dla testów zapytań i blokad)
CREATE TABLE IF NOT EXISTS pacjenci (
    id SERIAL PRIMARY KEY,
    pesel VARCHAR(11) UNIQUE,
    imie VARCHAR(50),
    nazwisko VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS zlecenia (
    id SERIAL PRIMARY KEY,
    nr_zlecenia VARCHAR(30) UNIQUE,
    id_pacjenta INT REFERENCES pacjenci(id),
    status VARCHAR(20) DEFAULT 'NOWE',
    data_rejestracji TIMESTAMP DEFAULT NOW()
);

-- Dane testowe
INSERT INTO pacjenci (pesel, imie, nazwisko) VALUES 
('90010112345', 'Jan', 'Kowalski'),
('85020223456', 'Anna', 'Nowak');

INSERT INTO zlecenia (nr_zlecenia, id_pacjenta, status) VALUES 
('ZL/2026/001', 1, 'ZAKONCZONE'),
('ZL/2026/002', 2, 'W_TRAKCIE');
