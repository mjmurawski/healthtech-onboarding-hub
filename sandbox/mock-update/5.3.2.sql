INSERT INTO wersja (nr_wersji, komentarz) VALUES ('5.3.2', 'Wydanie docelowe 5.3.2');
ALTER TABLE zlecenia ADD COLUMN IF NOT EXISTS oddzial_zlecajacy VARCHAR(60) DEFAULT 'ODDZIAL_WEWNETRZNY';
