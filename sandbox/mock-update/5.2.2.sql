INSERT INTO wersja (nr_wersji, komentarz) VALUES ('5.2.2', 'Optymalizacja indeksów zapytań');
CREATE INDEX IF NOT EXISTS idx_zlecenia_status ON zlecenia(status);
