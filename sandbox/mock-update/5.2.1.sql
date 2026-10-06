INSERT INTO wersja (nr_wersji, komentarz) VALUES ('5.2.1', 'Aktualizacja modułu badań');
ALTER TABLE pacjenci ADD COLUMN IF NOT EXISTS pesel_zweryfikowany BOOLEAN DEFAULT FALSE;
