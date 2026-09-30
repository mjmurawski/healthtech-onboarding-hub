/**
 * HealthTech Onboarding Hub - Inspektor i Parser HL7 v2 (hl7-inspector.js)
 * Rozbija ramki na segmenty, pola, komponenty, weryfikuje poprawność i generuje odpowiedź ACK
 */

const HL7_FIELD_NAMES = {
  MSH: {
    1: "Field Separator (Separator pól)",
    2: "Encoding Characters (Separatory komponentów ^~\\&)",
    3: "Sending Application (Aplikacja nadawcy, np. HIS_SZPITAL)",
    4: "Sending Facility (Placówka/Oddział nadawcy)",
    5: "Receiving Application (Aplikacja odbiorcy, np. LAB_LIS)",
    6: "Receiving Facility (Placówka odbiorcy)",
    7: "Date/Time Of Message (Data i czas komunikatu YYYYMMDDHHMMSS)",
    8: "Security (Opcjonalne tokeny zabezpieczeń)",
    9: "Message Type (Typ komunikatu: Kod^Zdarzenie, np. ORU^R01)",
    10: "Message Control ID (Unikalny identyfikator wiadomości)",
    11: "Processing ID (Środowisko: P=Produkcja, T=Test, D=Debug)",
    12: "Version ID (Wersja standardu HL7, np. 2.3, 2.4, 2.5)"
  },
  PID: {
    1: "Set ID - PID (Licznik porządkowy)",
    2: "Patient ID External (Zewnętrzny ID pacjenta)",
    3: "Patient Identifier List (Kluczowy identyfikator: PESEL lub ID szpitalne)",
    5: "Patient Name (Nazwisko^Imię^^^Prefiks)",
    7: "Date/Time of Birth (Data urodzenia YYYYMMDD)",
    8: "Administrative Sex (Płeć: M=Mężczyzna, F=Kobieta, U=Nieznana)",
    11: "Patient Address (Adres zamieszkania: Ulica^^Miasto^^Kod^Kraj)",
    13: "Phone Number - Home (Numer telefonu pacjenta)",
    19: "SSN Number - Patient (W Polsce często dodatkowe pole na PESEL)"
  },
  PV1: {
    1: "Set ID - PV1 (Licznik)",
    2: "Patient Class (Klasa pacjenta: I=Inpatient/Szpital, O=Outpatient/Poradnia, E=Emergency/SOR)",
    3: "Assigned Patient Location (Lokalizacja: Oddział^Sala^Łóżko)",
    7: "Attending Doctor (Lekarz prowadzący: ID^Nazwisko^Imię)",
    8: "Referring Doctor (Lekarz kierujący)",
    19: "Visit Number (Numer pobytu / Księgi Głównej w szpitalu)",
    44: "Admit Date/Time (Data i godzina przyjęcia na oddział)"
  },
  ORC: {
    1: "Order Control (Kod kontrolny: NW=Nowe zlecenie, CA=Anulowanie, SC=Aktualizacja statusu)",
    2: "Placer Order Number (Numer zlecenia nadany przez HIS)",
    3: "Filler Order Number (Numer zlecenia nadany przez LIS/RIS)",
    5: "Order Status (Status: IP=W trakcie, CM=Zakończone, CA=Anulowane)",
    9: "Date/Time of Transaction (Data i czas operacji)",
    12: "Ordering Provider (Lekarz zlecający badanie)"
  },
  OBR: {
    1: "Set ID - OBR (Licznik zleconego badania)",
    2: "Placer Order Number (Numer zlecenia HIS)",
    3: "Filler Order Number (Numer zlecenia LIS/RIS)",
    4: "Universal Service Identifier (Kod i nazwa badania: Kod^Nazwa^Słownik np. LOINC)",
    7: "Observation Date/Time (Data i godzina pobrania materiału/rozpoczęcia badania)",
    16: "Ordering Provider (Lekarz zlecający)",
    25: "Result Status (Status wyniku: F=Finalny, P=Wstępny, C=Korekta)"
  },
  OBX: {
    1: "Set ID - OBX (Licznik parametru)",
    2: "Value Type (Typ danych: NM=Numeryczny, ST=Ciąg tekstowy, TX=Tekst wielolinijkowy, CE=Kod)",
    3: "Observation Identifier (Identyfikator parametru: Kod LOINC^Nazwa parametru^Słownik)",
    5: "Observation Value (Rzeczywista wartość zmierzona lub opis badania)",
    6: "Units (Jednostka miary, np. g/dL, 10*3/uL, mmol/L)",
    7: "References Range (Zakres referencyjny / normy, np. 4.0-10.0)",
    8: "Abnormal Flags (Flagi odchylenia od normy: L=Poniżej, H=Powyżej, N=W normie)",
    11: "Observation Result Status (Status: F=Zatwierdzony, P=Cząstkowy)",
    14: "Date/Time of Observation (Data i czas wykonania pomiaru)"
  },
  MSA: {
    1: "Acknowledgment Code (Kod potwierdzenia: AA=Akceptacja, AE=Błąd aplikacji, AR=Odrzucenie)",
    2: "Message Control ID (Identyfikator komunikatu, do którego odnosi się potwierdzenie)",
    3: "Text Message (Komunikat błędu lub opis statusu)"
  }
};

class HL7Inspector {
  constructor() {
    this.fieldSep = '|';
    this.compSep = '^';
    this.repSep = '~';
    this.escapeSep = '\\';
    this.subCompSep = '&';
  }

  // Oczyszczenie surowego wejścia z ewentualnych bajtów MLLP
  cleanMessage(raw) {
    if (!raw) return "";
    return raw
      .replace(/^\x0B+/, '') // Usuń początkowy bajt VT MLLP
      .replace(/[\x1C\x0D]+$/, '') // Usuń końcowe bajty FS CR MLLP
      .trim();
  }

  // Parsowanie wiadomości do ustrukturyzowanego drzewa obiektów
  parse(rawMessage) {
    const cleaned = this.cleanMessage(rawMessage);
    if (!cleaned) {
      return { success: false, error: "Komunikat HL7 jest pusty." };
    }

    // Rozbicie na wiersze/segmenty (obsługa \r, \n, \r\n)
    const rawLines = cleaned.split(/[\r\n]+/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) {
      return { success: false, error: "Brak wykrytych linii w komunikacie." };
    }

    const firstLine = rawLines[0].trim();
    if (!firstLine.startsWith("MSH")) {
      return {
        success: false,
        error: "Niepoprawny komunikat HL7: Pierwszy segment musi zaczynać się od 'MSH' (Message Header)."
      };
    }

    this.fieldSep = firstLine[3] || '|';
    const encodingChars = firstLine.slice(4, 8);
    if (encodingChars.length >= 4) {
      this.compSep = encodingChars[0] || '^';
      this.repSep = encodingChars[1] || '~';
      this.escapeSep = encodingChars[2] || '\\';
      this.subCompSep = encodingChars[3] || '&';
    }

    const segments = [];
    const warnings = [];
    let messageType = "UNKNOWN";
    let messageControlId = "UNKNOWN";
    let hl7Version = "UNKNOWN";
    let patientName = "Nie podano";
    let patientId = "Nie podano";

    rawLines.forEach((line, lineIdx) => {
      const segName = line.substring(0, 3).toUpperCase();
      let rawFields;

      if (segName === "MSH") {
        // W MSH pole 1 to sam separator |
        const rest = line.substring(4);
        rawFields = [segName, this.fieldSep, ...rest.split(this.fieldSep)];
      } else {
        rawFields = line.split(this.fieldSep);
      }

      const fields = [];
      rawFields.forEach((rawVal, fIdx) => {
        if (fIdx === 0) return; // Pomijamy nazwę segmentu jako pole 0

        // Rozbijamy na komponenty
        const components = rawVal.split(this.compSep);
        const fieldNameDef = HL7_FIELD_NAMES[segName] && HL7_FIELD_NAMES[segName][fIdx] 
          ? HL7_FIELD_NAMES[segName][fIdx] 
          : `Pole ${fIdx}`;

        fields.push({
          index: fIdx,
          name: fieldNameDef,
          value: rawVal,
          components: components.length > 1 ? components : null
        });
      });

      // Ekstrakcja kluczowych metadanych
      if (segName === "MSH") {
        messageType = rawFields[9] || "UNKNOWN";
        messageControlId = rawFields[10] || "UNKNOWN";
        hl7Version = rawFields[12] || "UNKNOWN";

        if (!rawFields[9]) warnings.push("Brak typu komunikatu w MSH-9 (np. ADT^A01, ORM^O01, ORU^R01)");
        if (!rawFields[10]) warnings.push("Brak Message Control ID w MSH-10");
        if (!rawFields[12]) warnings.push("Brak wersji HL7 w MSH-12 (zalecane: 2.3 lub 2.5)");
      }

      if (segName === "PID") {
        patientId = rawFields[3] || "Brak ID";
        const rawName = rawFields[5] || "";
        if (rawName) {
          const parts = rawName.split(this.compSep);
          patientName = `${parts[0] || ""} ${parts[1] || ""}`.trim();
        }
      }

      segments.push({
        segmentName: segName,
        lineIndex: lineIdx + 1,
        rawText: line,
        fields: fields
      });
    });

    return {
      success: true,
      rawMessage: cleaned,
      metadata: {
        messageType,
        messageControlId,
        hl7Version,
        patientName,
        patientId,
        segmentCount: segments.length,
        separators: {
          field: this.fieldSep,
          component: this.compSep,
          repetition: this.repSep,
          escape: this.escapeSep,
          subComponent: this.subCompSep
        }
      },
      warnings,
      segments
    };
  }

  // Generowanie automatycznego komunikatu potwierdzającego ACK
  generateAck(parsedResult, ackCode = "AA", errorMessage = "") {
    if (!parsedResult || !parsedResult.success) {
      return "BŁĄD: Nie można wygenerować ACK dla niepoprawnego komunikatu.";
    }

    const meta = parsedResult.metadata;
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    const ackControlId = `ACK${Date.now().toString().slice(-6)}`;
    const version = meta.hl7Version !== "UNKNOWN" ? meta.hl7Version : "2.3";

    // Zamiana nadawcy i odbiorcy z oryginalnego MSH
    const mshSeg = parsedResult.segments.find(s => s.segmentName === "MSH");
    let origSender = "ORIG_SENDER";
    let origFacility = "FACILITY";
    let origReceiver = "ORIG_RECEIVER";
    let origRecFacility = "FACILITY";

    if (mshSeg && mshSeg.fields) {
      const f3 = mshSeg.fields.find(f => f.index === 3);
      const f4 = mshSeg.fields.find(f => f.index === 4);
      const f5 = mshSeg.fields.find(f => f.index === 5);
      const f6 = mshSeg.fields.find(f => f.index === 6);
      if (f3) origSender = f3.value;
      if (f4) origFacility = f4.value;
      if (f5) origReceiver = f5.value;
      if (f6) origRecFacility = f6.value;
    }

    const ackMsh = `MSH|^~\\&|${origReceiver}|${origRecFacility}|${origSender}|${origFacility}|${timestamp}||ACK|${ackControlId}|P|${version}`;
    const ackMsa = `MSA|${ackCode}|${meta.messageControlId}${errorMessage ? '|' + errorMessage : ''}`;

    return `${ackMsh}\r\n${ackMsa}`;
  }
}

// Inicjalizacja instancji inspektora
if (typeof window !== 'undefined') {
  window.hl7Inspector = new HL7Inspector();
}
