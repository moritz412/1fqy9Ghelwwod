# NEXUS SCHROTTBERG – Ein Kern in fünf Millionen Teilen

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

## 7. Fahrplan
| Version | Inhalt                                                                  |
|---------|-------------------------------------------------------------------------|
| 0.2 ✅  | Hangardeck, 5 Mio. Teile, Nexus-Bot, Greifen, Funde, Markt, Upgrades, Helfer, Speichern, Modus Pur |
| 0.3 ✅  | Einführung in Sprechblasen, schnellerer Start, Zoom-Schutz für iOS       |
| 0.4 ✅  | Schrottformen, Staub, Credit-Anzeigen, Frachtkapseln, 16 Erfolge, 6 Bot-Skins, Musik/Motor/Stationsbrummen |
| 0.5 ✅  | Ereignisse (Meteoritenschauer, Glückswelle), Turbo, Decks mit Sternen (Eiswrack, Goldmine, Alienschrott), Tagesbonus, mitlaufende Kamera |
| 0.6     | PC-Modelle (Bot, Schrott, Funde), Bestenliste, Koop-Versuch              |
| 0.5     | PC-Assets (Modelle, Texturen), Sound, Modi Pur und Schnellkrater        |
| 0.6     | Koop-Versuch                                                            |
