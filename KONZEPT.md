# Wo ist's? – Konzept für eine private Lager-App für zu Hause

## 1. Problem und Ziel

Dinge, die man selten braucht (Saisonkleidung, Deko, Campingzeug, Babysachen), verschwinden in Schränken und Kartons. Monate später weiß niemand mehr, wo sie sind.

**Ziel:** In wenigen Sekunden die Antwort auf „Wo ist X?“ bekommen – und das Einlagern so einfach machen, dass man es wirklich tut.

**Leitprinzipien**

1. **Finden vor Verwalten** – die Suche ist der Startbildschirm, nicht eine Inventarliste.
2. **Einlagern in Sekunden** – ein Name genügt; Tags kommen automatisch.
3. **Privat by Design** – alle Daten bleiben auf dem eigenen Gerät.

## 2. Marktüberblick

| App | Stärken | Schwächen für unseren Zweck |
|---|---|---|
| **Sortly** | Ordnerstruktur mit Fotos, QR-/Barcode-Etiketten, ausgereifte Apps | Für Firmen gebaut; Gratis-Stufe laut Vergleichsseiten auf ca. 100 Einträge begrenzt, sonst Abo; Daten in der Cloud |
| **Homebox** (Open Source) | Kostenlos, Orte + Labels, QR-Etiketten, Garantien/Belege | Braucht einen eigenen Server – für Laien zu aufwendig; keine native App |
| **Encircle, Under My Roof u. ä.** | Dokumentation für Versicherungen (Werte, Belege) | Anderer Zweck: „Was besitze ich?“ statt „Wo liegt es?“ |
| **Karton-Apps** (Everspruce, SmartBox, BinsAndBoxes …) | Genau unser Anwendungsfall: Karton fotografieren, Etikett scannen | Häufige Kritik in Rezensionen: Abo-Modelle, verwirrende Ort/Karton-Hierarchie („Karton im Karton“), vereinzelt Datenverlust |
| **Grocy** | Vorräte, Einkauf, Haushalt | Auf Verbrauchsgüter ausgelegt, eigener Server nötig |

Stand: kurze Web-Recherche (November 2026), überwiegend Vergleichsseiten und App-Store-Rezensionen; Preise/Limits vor einer Kaufentscheidung selbst prüfen.

### Was wir uns abschauen

- **Verschachtelte Orte** mit Foto (Sortly, Homebox)
- **Kurze Codes/Etiketten am Karton** (alle Karton-Apps)
- **Foto statt Tipparbeit** als schnellster Weg, Inhalt festzuhalten
- **Ganzen Karton umziehen**, ohne jeden Gegenstand anzufassen

### Was wir besser machen

| Schwäche am Markt | Unsere Antwort |
|---|---|
| Cloud-Zwang, Konto, Abo | Keine Cloud, kein Konto, keine Kosten – Daten nur lokal |
| Server-Betrieb (Homebox) | Läuft als Web-App direkt im Browser, auch offline |
| Suche findet nur exakte Wörter | Suche versteht Oberbegriffe, verwandte Begriffe und Tippfehler |
| Tags muss man selbst pflegen | Tags werden automatisch aus dem Namen abgeleitet |
| Nur Einzelstücke mit Seriennummer | Auch Sammelbegriffe wie „Sommerkleider“ sind vollwertige Einträge |
| Starre oder verwirrende Hierarchie | Vier klare Ortstypen, frei verschachtelbar |
| Etikett verrät den Inhalt | Etikett zeigt nur Code und Namen – Inhalt steht nur in der App |
| Datenverlust | Sicherungsdatei per Knopfdruck, optional verschlüsselt |

## 3. Das Konzept

### 3.1 Orte

Vier Ortstypen, beliebig ineinander verschachtelbar:

**🏠 Raum › 🗄️ Schrank/Regal › 🗂️ Fach/Schublade › 📦 Karton/Kiste**

- Keine Ebene ist Pflicht: Ein Karton darf direkt im Raum stehen, ein Gegenstand direkt im Regal liegen.
- Jeder Ort kann ein Foto und eine Notiz haben.
- Kartons erhalten automatisch einen kurzen Code (`K-001`, `K-002` …), den man aufs Etikett schreibt oder druckt.
- Verschiebt man einen Ort, ziehen alle Inhalte mit.

### 3.2 Gegenstände

- **Einzelstück** („Bohrmaschine Bosch“) oder **Sammlung/Gruppe** („Sommerkleider“), optional mit Menge.
- Beliebig viele Fotos, Notiz, Tags.
- Status **herausgenommen**: Man sieht, dass etwas gerade nicht an seinem Platz ist, ohne den Lagerort zu verlieren.

### 3.3 Automatische Tags und Umschreibungen

Ein eingebautes deutsches Begriffs-Lexikon ordnet Wörter Themen und Oberbegriffen zu – ohne Internet.

- Eingabe „Sommerkleider“ → Tags *Kleider, Kleidung, Sommerkleidung, Sommer, Saisonal*
- Erkennt zusammengesetzte Wörter („Schlitt**schuh**e“, „**Weihnacht**sdeko“).
- Vorschläge erscheinen beim Tippen, lassen sich einzeln entfernen und um eigene Tags ergänzen.

### 3.4 Suche

Die Suche durchsucht Name, Tags, Notiz, Ort und Karton-Code und zeigt zu jedem Treffer sofort den vollständigen Pfad.

| Sucheingabe | findet | warum |
|---|---|---|
| `Kleidung` | Sommerkleider, Parka, Sandalen … | Oberbegriff über Auto-Tags |
| `Winterjacke` | Parka | verwandter Begriff aus dem Lexikon |
| `Bormaschine` | Bohrmaschine | Tippfehler-Toleranz |
| `K-002` | Karton und kompletter Inhalt | Karton-Code |

Direkte Treffer stehen oben, „Verwandte Treffer“ getrennt darunter.

### 3.5 Privatsphäre

- **Lokal:** Alle Daten liegen im Speicher des Browsers auf dem Gerät. Kein Server, kein Konto, kein Tracking, keine Fremd-Bibliotheken.
- **Technisch abgesichert:** Eine Sicherheitsrichtlinie (CSP) in der App verbietet dem Browser Verbindungen zu fremden Servern.
- **Fotos:** werden verkleinert und neu kodiert – Standort- und Kameradaten (EXIF) werden dabei entfernt.
- **Auto-Tags:** entstehen durch das lokale Lexikon, nicht durch einen KI-Dienst.
- **Sicherung:** Export als Datei, optional mit Passwort verschlüsselt (AES-256-GCM).
- **Etiketten:** zeigen bewusst keinen Inhalt.

**Bewusster Kompromiss:** Ohne Cloud gibt es keine automatische Synchronisation zwischen Geräten und keine automatische Bilderkennung. Die Sicherung liegt in der eigenen Verantwortung.

## 4. Umfang der ersten Version

Enthalten:

- Orte anlegen, bearbeiten, verschieben, löschen (vier Typen, frei verschachtelt)
- Gegenstände als Einzelstück oder Sammlung, mit Menge, Notiz, Fotos
- Automatische Tags + eigene Tags
- Suche mit Oberbegriffen, verwandten Begriffen, Tippfehler-Toleranz
- „Speichern & nächster“ für schnelles Befüllen eines Kartons
- Karton-Codes und druckbare Etiketten
- Status „herausgenommen“
- Sicherung speichern/einspielen, optional verschlüsselt
- Offline-fähig, installierbar auf dem Home-Bildschirm, heller und dunkler Modus
- Beispieldaten zum Ausprobieren

## 5. Mögliche nächste Schritte

1. **QR-Codes** auf den Etiketten und Scannen mit der Kamera
2. **Spracheingabe** beim Einlagern („Sommerkleider in Karton 3“)
3. **Lokale Bilderkennung** für Tag-Vorschläge aus Fotos (Modell läuft auf dem Gerät)
4. **Abgleich zwischen Geräten** im Haushalt – Ende-zu-Ende-verschlüsselt oder nur im eigenen WLAN
5. **Erinnerungen** („Winterreifen im Oktober“) und Leih-Vermerk („an Anna verliehen“)
6. Lexikon erweiterbar machen (eigene Synonyme pflegen)
