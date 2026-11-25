# NEXUS CORE – Die Jagd nach dem Kern

*Konzept v1. Ein 3D-Sammel- und Aufräum-Simulator für iPad, Handy und Browser, spielbar über GitHub Pages.*

> Die erste Version „Tiefenzeit“ (Graben in Schichten) ist nach `docs/KONZEPT-v0-grabung.md` umgezogen.
> Dieses Konzept ersetzt sie: Gewünscht ist die Mechanik von Needle-in-a-Haystack-Spielen.

---

## 1. Analyse der Vorlage

Grundlage ist das, was öffentlich über *Needle In A Haystack Simulator* (Studio Bitdot) bekannt ist.
Die Steam-Seite selbst war aus der Entwicklungsumgebung nicht erreichbar.

| Element           | Vorlage (öffentlich beschrieben)                                     |
|-------------------|----------------------------------------------------------------------|
| Grundidee         | 1 Nadel in **5.000.000** einzelnen Heuhalmen                         |
| Perspektive       | Ego-Perspektive, man steht am/im Heuhaufen                           |
| Kernaktion        | Heu **von Hand** herausziehen                                        |
| Belohnung         | Im Heu sind **Wertsachen** versteckt                                 |
| Wirtschaft        | Wertsachen **verkaufen**, dann **Werkzeuge** kaufen, die mehr Heu auf einmal bewegen |
| Spätes Spiel      | **Automatisierung**: Maschinen verarbeiten den Haufen selbstständig  |
| Modi              | Modus **ohne Upgrades** (das echte Nadel-Erlebnis), **Mehrspieler**  |
| Reiz              | Satire auf „granulare“ Simulatoren: absurd große Zahl, befriedigendes Abtragen, Zahl sinkt sichtbar |

**Warum das funktioniert (Spielgefühl):**
1. **Absurdes Ziel mit klarer Zahl:** Der Zähler „4.999.873 übrig“ motiviert ständig.
2. **Inkrementelle Schleife:** Erst mühsam per Hand, dann schneller, dann automatisch. Jedes Upgrade fühlt sich riesig an.
3. **Zufallsfunde:** Kleine Glücksmomente zwischendurch halten bei Laune.
4. **Das große Finale:** Die Nadel kann jederzeit auftauchen, vielleicht beim ersten Griff, vielleicht beim letzten.

Für unser Spiel übernehmen wir **die Mechanik** (Genre-Schleife). Name, Grafik, Figuren und Setting sind eigen.

---

## 2. Unser Setting: die Nexus-Raumstation

> Ursprünglich war ein Mondkrater geplant. Weil *Moon Sweepers* (DragDrop Games, 2026) schon
> „Mondstaub putzen und Werkzeuge kaufen“ macht, spielt das Spiel jetzt **auf der Nexus-Raumstation**.

Ein Frachter hat auf **Hangardeck 7** der Nexus-Raumstation **5.000.000 Teile Weltraumschrott** abgeladen.
Darin ist der **Nexus-Kern** verschwunden, das leuchtende Herz der Station.

- **Spielfigur: der Nexus-Bot** (Vorlage: `assets/ref/nexus-bot.png`). Weißer, runder Körper, Bildschirmgesicht mit
  türkisen Augen, türkise Ohren und Hände, graue Raupen und ein Leuchtstreifen. Das Gesicht zeigt Gefühle:
  blinzeln, freuen, Herzchen in Kern-Nähe, traurig bei vollem Laderaum.
- **Ort:** ein offenes, rundes Hangardeck unter einer Glaskuppel. Darüber dreht sich der Stationsring, am Horizont steht ein Gasriese.
- **Nexus-Markt:** eine Andockstation am Rand des Decks. Dort verkaufst du Funde und rüstest auf.
- **Niedrige Schwerkraft:** Weggeworfene Teile fliegen in hohem, langsamem Bogen.
- **Funde:** Kupferspule, Eiskristall, Sondenteil, Platin-Nugget, Pilotenabzeichen und das sehr seltene Alien-Artefakt.

### Der Nexus-Bot wird aufgerüstet (sichtbar am Modell)
| Upgrade      | Stufen                                                   | Sichtbar am Bot                         |
|--------------|----------------------------------------------------------|-----------------------------------------|
| Greifhände   | 1 → 5 → 25 → 120 → 600 → 3.000 Teile/Griff               | Hände werden größer und ändern die Farbe |
| Greiftempo   | 2 → 9 Griffe/s                                           | –                                       |
| Antrieb      | Raupen → Ionen-Gleiter                                   | Raupenfarbe, Schwebe-Leuchten           |
| Laderaum     | 20 → 40.000 Funde                                        | Rucksack wächst                         |
| Kern-Scanner | Glitzerfilter → Resonanz (heiß/kalt) → Tiefe             | Antenne, Schüssel                       |
| Nexus-Link   | Funde werden direkt zur Station gebeamt                  | Leuchtfarbe wird violett                |

### Helfer (Automatisierung)
Mini-Nexus (2/s), Staubdrohne (15/s), Förderband (80/s), Kraterfräse (500/s), Orbit-Kran (3.000/s).
Jeder Kauf macht den nächsten um 15 % teurer. Die Helfer arbeiten auch offline, bis zu 2 Stunden.

## 3. Spielschleife

```
Steine wegräumen ──> Funde einsammeln ──> an MAUS verkaufen ──> Credits
       ▲                                                          │
       └──────── stärkere Werkzeuge / Maschinen kaufen <──────────┘
                                   │
                    irgendwann: ✨ Ring gefunden ✨
```

### 3.1 Wegräumen
- Der Krater ist ein Haufen aus Zellen (z. B. 64 × 64 Säulen). Jede Säule enthält eine Anzahl Steine, insgesamt 5.000.000.
- Sichtbar ist nur die **oberste Schicht** als echte 3D-Steine. Darunter steckt nur noch eine Zahl, das hält es aufs iPad-tauglich.
- **Tippen oder Halten** auf den Haufen greift Steine an dieser Stelle. Die Steine fliegen in Mondphysik davon, die Säule sinkt, der Zähler fällt.
- Jeder entfernte Stein hat eine kleine Chance, ein **Fund** zu sein, und genau einer ist der **Ring**.

### 3.2 Werkzeuge (aktiv, man bedient sie selbst)
| # | Werkzeug              | Steine pro Griff | Preis      | Besonderheit                         |
|---|-----------------------|------------------|------------|--------------------------------------|
| 1 | Handschuh             | 1                | –          | Start                                |
| 2 | Kralle                | 5                | 50         |                                      |
| 3 | Mondschaufel          | 25               | 400        |                                      |
| 4 | Schubrover            | 120              | 3.000      | Fläche statt Punkt                   |
| 5 | Schwerkraft-Greifer   | 600              | 25.000     | zieht einen Kegel hoch, sehr spektakulär |
| 6 | Grav-Bagger           | 3.000            | 200.000    |                                      |

### 3.3 Maschinen (Automatisierung, laufen auch nebenbei)
| Maschine              | Leistung        | Preis      | Funktion                                          |
|-----------------------|-----------------|------------|---------------------------------------------------|
| Staubsauger-Drohne    | 2 Steine/s      | 200        | fliegt über den Haufen, saugt zufällig            |
| Sieb-Station          | 15 Steine/s     | 2.500      | sammelt Funde automatisch ein                     |
| Förderband-Rampe      | 80 Steine/s     | 20.000     | schießt Steine ins All                            |
| Krater-Fräse          | 500 Steine/s    | 150.000    | großer Bohrer, frisst sich durch                  |
| Orbit-Kran            | 3.000 Steine/s  | 1.000.000  | Riesenkrallen aus dem Orbit                       |

Maschinen kann man mehrfach kaufen und upgraden. **Wichtig:** Den Ring findet nur, wer selbst greift oder eine
Sieb-Station hat. Sonst sortiert die Maschine ihn mit aus, und er landet in der „Fundkiste“ (Benachrichtigung).

### 3.4 Funde und Verkauf
| Fund                  | Häufigkeit       | Wert     |
|-----------------------|------------------|----------|
| Meteoritensplitter    | 1 : 40           | 2        |
| Eiskristall           | 1 : 200          | 10       |
| Sondenteil            | 1 : 1.500        | 60       |
| Verlorenes Werkzeug   | 1 : 8.000        | 300      |
| Raumfahrer-Abzeichen  | 1 : 40.000       | 1.500    |
| Alien-Fossil          | 1 : 400.000      | 20.000   |
| **Der Ring**          | **1 : 5.000.000**| Ende 🎉  |

Funde landen im Rucksack (begrenzte Plätze, ein Upgrade erweitert ihn). Verkauft wird bei MAUS: Rucksack leeren gibt Credits.

### 3.5 Ring-Hilfen (eigene Idee, optional)
- **Glitzer:** Liegt der Ring nahe der Oberfläche, blitzt er im Sonnenlicht kurz auf.
- **Ring-Scanner** (teures Upgrade): halbiert die Suchfläche, also welche Kraterhälfte.
- Im Hardcore-Modus sind alle Hilfen aus.

---

## 4. Modi
| Modus            | Beschreibung                                                      |
|------------------|-------------------------------------------------------------------|
| **Karriere**     | Volle Schleife mit Shop, Maschinen und Funden. Speichert automatisch. |
| **Pur**          | Keine Upgrades: 5.000.000 Steine, nur Handschuh. Für Wahnsinnige. |
| **Schnellkrater**| 50.000 Steine, 10 Minuten, Bestenliste lokal.                     |
| **Koop** (später)| 2–4 Leute im selben Krater (WebRTC, Raum-Code).                   |

---

## 5. Steuerung
| Gerät      | Bewegen                     | Umsehen                   | Greifen                      |
|------------|-----------------------------|---------------------------|------------------------------|
| iPad/Handy | linker virtueller Stick     | rechts ziehen             | Greif-Button halten oder auf Haufen tippen |
| PC         | WASD                        | Maus                      | Linksklick halten            |

Die Perspektive ist Ego-Sicht wie in der Vorlage. Optional gibt es eine Schulterkamera, die auf kleinen Handys übersichtlicher ist.

---

## 6. Technik (warum 5 Millionen im Browser gehen)
- **Daten:** `Uint32Array` mit Stein-Anzahl pro Säule. Der Haufen ist eine Höhenkarte, die mit jedem Griff sinkt.
- **Grafik:** Nur die obersten Steine werden als `InstancedMesh` gezeichnet (etwa 20.000 Instanzen, 4–6 Steinformen). Die Oberfläche darunter ist ein verformbares Gelände-Mesh mit Steintextur.
- **Physik:** Nur die gerade geworfenen Steine fliegen, mit einfacher Ballistik und Mondschwerkraft, ohne Physik-Engine.
- **Funde:** Sie werden beim Entfernen gewürfelt (Seed). Die Ringposition wird beim Start festgelegt (Säule + Tiefe).
- **Maschinen:** Sie laufen pro Frame als Tick und auch offline (Zeitdifferenz beim Wiederkommen, gedeckelt).
- **Speichern:** `localStorage`, Autosave alle 10 s.
- **Ressourcen vom PC:** Steinformen, Fundstücke, Maschinen und MAUS als `.glb` (TRELLIS), Mondtexturen und Himmel (FLUX). Siehe `tools/ASSETS.md`.

---

## 6b. Progression: warum es nicht abflacht

| Ebene | Was passiert | Warum man dranbleibt |
|---|---|---|
| **Minuten** | Greifen, Kombo, Funde, Kapseln, Ereignisse | ständig kleine Belohnungen, Ziel-Anzeige fürs nächste Upgrade |
| **Stunde** | Upgrades, Werkzeuge, Fahrwerke, Module, Bau-System mit Produktionskette | Bot und Basis werden sichtbar stärker |
| **Deck** | Jedes Deck hat eine **eigene Mechanik** und **3 Sterne** | Kern finden · Kern in Zielzeit · Deck-Aufgabe |
| **Kampagne** | Decks werden größer (+50 % Schrott), reicher (+40 % Fundwert) und ereignisreicher | Endlos-Decks („Eiswrack II“ …) mit steigenden Zielen |
| **Meta** | Jeder Stern = dauerhaft +25 % Fundwert, Level, Erfolge, Skins | Decks erneut spielen, um fehlende Sterne zu holen |

**Deck-Mechaniken**

| Deck | Ereignis | Deck-Aufgabe |
|---|---|---|
| Schrotthalde | (Übungsdeck) | 250.000 Teile sortieren |
| Eiswrack | 🌨️ Schneesturm: kaum Sicht, seltene Funde ×2,5 | 150 Eiskristalle |
| Goldmine | 💰 Goldrausch: alle Funde doppelt wert | 25 Platin-Nuggets |
| Alienschrott | 👽 Alien-Schwarm: Aliens fangen gibt Artefakte/Datenkerne | 12 Aliens fangen |

## 6c. Nexus Prime – die eigene Raumstation (Langzeitziel)

Aller weggeräumte Schrott wird zu **Baumaterial** (1 t je 1.000 Teile). Damit baust du über dem Hangar deine eigene Station
**Nexus Prime** – Modul für Modul, sichtbar am Himmel. Module geben **dauerhafte Boni über alle Decks** und ersetzen einen
klassischen Forschungsbaum: Bauen *ist* Forschen/Freischalten.

| Rang | ab Modulen | schaltet frei |
|---|---|---|
| Außenposten | 0 | Verbindungsgang, Raffinerie, Wohnring, Solarflügel |
| Station | 5 | Frachtdock, Drohnenwerft, Observatorium |
| Zitadelle | 11 | Forschungsdeck, Teleport-Relais |
| Megastation | 18 | Gravitationskern |

Module haben bis zu 3 Stufen; seltene Module brauchen zusätzlich seltene Funde aus dem Lager.

## 7. Fahrplan
| Version | Inhalt                                                                  |
|---------|-------------------------------------------------------------------------|
| 0.2 ✅  | Hangardeck, 5 Mio. Teile, Nexus-Bot, Greifen, Funde, Markt, Upgrades, Helfer, Speichern, Modus Pur |
| 0.3 ✅  | Einführung in Sprechblasen, schnellerer Start, Zoom-Schutz für iOS       |
| 0.4 ✅  | Schrottformen, Staub, Credit-Anzeigen, Frachtkapseln, 16 Erfolge, 6 Bot-Skins, Musik/Motor/Stationsbrummen |
| 0.5 ✅  | Ereignisse (Meteoritenschauer, Glückswelle), Turbo, Decks mit Sternen (Eiswrack, Goldmine, Alienschrott), Tagesbonus, mitlaufende Kamera |
| 0.6 ✅  | Nexus-Ablage (Verkauf) und Nexus-Shop (Werkstatt) getrennt, Archiv, Fahrwerke (Raupen, Räder, Laufbeine, Spinnenbeine), 8 Module mit Slots, Atomar-Drohnen mit Atomar-Kern, 2 neue Funde, 5 neue Erfolge |
| 0.7 ✅  | Nexus-Level (XP), Lager mit „behalten“, Fabrikator mit 5 Verbrauchsgegenständen und Schnellleiste, Aufträge, Kombo-Serie, Ziel-Anzeige, 6 neue Erfolge |
| 0.8 ✅  | Teilen-Button, Grafik (Detail-Textur, Nebel, Sonne, Staub), Deck-Kulissen (Eiswrack, Goldmine, Alienschrott) mit eigenen Fundboni, sichtbare Atomar-Drohnen (max. 6), Nexus-Link 350.000 ⬡ mit 25 % Gebühr |
| 0.9 ✅  | Name „NEXUS CORE“, Intro-Film, Shuttle-Zwischensequenz beim Deckwechsel, neues Startmenü mit Deck-Übersicht und Bestwerten, Außenposten auf dem Deck, Werkzeuge (Greifkran, Staubsauger, Bohrer), Quadrokopter-Drohnen |
| 1.0 ✅  | Mondlandefähre mit Landeplatz, Intro mit Ton, Bloom und Reflexionen, Bau-System (13 Bauplätze, 8 Anlagen, Strom, Produktionskette, Förderband) |
| 1.1 ✅  | Ruhigeres Bild, Deck-Mechaniken (Schneesturm, Goldrausch, Alien-Schwarm), 3 Sterne je Deck, Decks erneut spielen, Deck-Skalierung, Endlos-Decks |
| 1.2 ✅  | Nexus Prime (modulare eigene Raumstation, Ränge, Meta-Boni), Detail-Texturen (Panele, Nieten, Warnstreifen) |
| 1.3     | Nexus-Evolution Mk I–V (sichtbare Bot-Stufen), Bosse/Spezial-Decks, Online-Bestenliste |
| 0.5     | PC-Assets (Modelle, Texturen), Sound, Modi Pur und Schnellkrater        |
| 0.6     | Koop-Versuch                                                            |
