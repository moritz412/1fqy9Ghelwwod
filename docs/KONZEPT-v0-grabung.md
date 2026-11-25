# TIEFENZEIT – Die Suche nach dem Zeitkristall

*Ein 3D-Grabungsspiel für iPad, Handy und Browser – spielbar direkt über GitHub Pages.*

---

## 1. Idee in einem Satz

Du bist Archäolog:in in der Wüste **Ar-Ruhal**. Unter den Dünen liegen die Schichten
untergegangener Epochen, und irgendwo in jedem Grabungsfeld steckt ein winziger
**Zeitkristall**. Du hast nur begrenzte Ausdauer. Finde die Nadel im Heuhaufen,
bevor dir die Kraft ausgeht, und grabe dabei so tief wie möglich.

Das Spiel verbindet drei bekannte Spielgefühle zu einem eigenen Thema:

| Spielgefühl                      | Umsetzung in Tiefenzeit                                   |
|----------------------------------|-----------------------------------------------------------|
| Nadel im Heuhaufen               | Ein versteckter Zeitkristall pro Feld, Resonanz-Detektor  |
| Jedes Sandkorn wegräumen         | Modus „Wüstenwind“: das ganze Feld freilegen              |
| So tief wie möglich graben       | Tiefenrekord, Epochen-Schichten, immer härteres Gestein   |

---

## 2. Thema und Welt

**Ar-Ruhal** ist eine erfundene Wüste, unter der sich Zivilisationen übereinander
gestapelt haben. Jede Bodenschicht ist eine Epoche:

| Tiefe  | Schicht           | Härte | Farbe        | Besonderes                         |
|--------|-------------------|-------|--------------|------------------------------------|
| 0–3    | Dünensand         | 1     | Goldgelb     | schnell weg                        |
| 4–9    | Karawanen-Lehm    | 2     | Ocker        | Münzen der Händler                 |
| 10–17  | Bronze-Ruinen     | 3     | Terrakotta   | Relikte (Punkte)                   |
| 18–27  | Urstein           | 4     | Grau-Blau    | Fossilien (geben Ausdauer zurück)  |
| 28+    | Glutbasalt        | 6     | Dunkelrot    | sehr hart, Kristalle liegen tiefer |

Die Grenzen zwischen den Schichten sind wellig (Rauschfunktion), so sieht jedes
Feld anders aus. Die Seitenwände des Grabungsblocks zeigen die Schichten wie im
Querschnitt eines Museumsdioramas.

**Look:** Low-Poly-Voxel, warme Wüstenfarben, weiches Licht, Staubpartikel beim Graben.
Später sollen Texturen und 3D-Fundstücke auf dem PC erzeugt werden (siehe Abschnitt 7).

---

## 3. Kern-Spielmechanik

1. **Graben:** Tippe auf einen Block, der an Luft grenzt. Jeder Tipp kostet 1 Ausdauer
   und richtet Schaden in Höhe der Werkzeugstärke an. Harte Blöcke brauchen mehrere Tipps
   und zeigen dabei Risse (werden dunkler).
2. **Resonanz-Detektor (der Nadel-Mechanismus):** Nach jedem Schlag misst der Detektor
   die Entfernung zum Kristall. Die Anzeige geht von *kalt* (blau) bis *glühend* (rot),
   und ein Ton wird höher, je näher du kommst. Du suchst also nicht blind, sondern
   kreist den Kristall wie bei „Heiß und Kalt“ ein.
3. **Funde:** Verborgene Objekte sieht man erst, wenn ein Nachbarblock freigelegt ist.
   - Münze: +25 Punkte
   - Relikt: +100 Punkte
   - Fossil: +8 Ausdauer, +50 Punkte
   - **Zeitkristall:** Feld geschafft
4. **Werkzeuge:**
   - Schaufel (unbegrenzt, Stärke 1)
   - Spitzhacke (Stärke 3, kostet 2 Ausdauer pro Schlag)
   - Sprengladung (wenige pro Feld, zerstört eine 3×3×3-Zone, kostet 4 Ausdauer)
5. **Schnittansicht:** Weil eine tiefe Grube von oben schwer zu sehen ist, blendet das
   Spiel Schichten oberhalb der aktuellen Arbeitsebene aus (Buttons ▲/▼, folgt automatisch).
6. **Ende eines Felds:**
   - Kristall gefunden: Bonus = Restausdauer × 10 + Tiefe × 20, weiter zum nächsten,
     größeren und tieferen Feld.
   - Ausdauer leer: Expedition vorbei, Punkte und Tiefenrekord werden gespeichert.

---

## 4. Spielmodi

| Modus             | Ziel                                                   | Status      |
|-------------------|--------------------------------------------------------|-------------|
| **Expedition**    | Kristall finden, Feld um Feld, immer tiefer            | ✅ Version 0.1 |
| **Tiefenrekord**  | Endlos-Schacht, so tief wie möglich, Ausdauer-Funde    | geplant     |
| **Wüstenwind**    | Gegen die Zeit jedes Sandkorn eines Feldes wegräumen   | geplant     |
| **Tagesgrabung**  | Gleiches Feld (Seed = Datum) für alle, Bestenliste     | geplant     |

---

## 5. Bedienung (Touch-first)

| Geste                    | Aktion                    |
|--------------------------|---------------------------|
| Kurz tippen              | Graben                    |
| Ein Finger ziehen        | Kamera drehen             |
| Zwei Finger kneifen      | Zoomen                    |
| Zwei Finger ziehen       | Kamera verschieben        |
| Buttons unten            | Werkzeug wählen           |
| Buttons rechts ▲/▼       | Schnittebene              |

Am PC: Maus (Linksklick graben/drehen, Rad zoomen, Rechtsklick verschieben).

Die Oberfläche ist für Hoch- und Querformat ausgelegt. Buttons sind mindestens 48 px
groß, die sicheren Bereiche (Notch, Home-Indikator) werden beachtet. Auf dem iPad kann
das Spiel über „Zum Home-Bildschirm“ als Vollbild-App gestartet werden.

---

## 6. Technik

- **Three.js 0.170** (lokal in `vendor/` abgelegt, also kein Build-Schritt und keine Abhängigkeit
  von einem CDN), reines HTML/CSS/JavaScript-Modul.
- **Voxel-Welt** als 1D-Array, gerendert mit einem einzigen `InstancedMesh`. Gezeichnet werden nur
  Blöcke mit freier Seite, also wenige tausend Instanzen. Das läuft flüssig auf iPad und Handy.
- **Raycasting** auf das InstancedMesh, um den angetippten Block zu finden.
- **Prozedurale Generierung** mit Seed (Value-Noise) für Schichten und Fundstücke.
- **WebAudio** synthetisiert die Geräusche (kein Audio-Download nötig), Vibration auf Android.
- **localStorage** für Highscore und Tiefenrekord.
- **GitHub Pages** über einen GitHub-Actions-Workflow (`.github/workflows/pages.yml`).
- **PWA-Manifest** für den Vollbildmodus auf dem iPad.

### Dateistruktur

```
index.html            Einstieg, HUD, Menüs
css/style.css         Layout, Touch-UI
js/main.js            Spielablauf, Eingabe, Kamera, HUD
js/world.js           Voxel-Daten, Generierung, Sichtbarkeit
js/audio.js           Synthetische Sounds
js/noise.js           Seed-Zufall und Value-Noise
vendor/               three.module.min.js, OrbitControls.js
assets/               (später) Texturen und Modelle vom PC
tools/                Anleitung für die Asset-Erzeugung auf dem PC
```

---

## 7. Den PC für Ressourcen nutzen

Der PC (GPU) kann Ressourcen vorberechnen, die das Spiel dann nur noch lädt:

1. **Texturen** (FLUX / Bildmodell): nahtlose 256×256-Kacheln pro Schicht, also Sand, Lehm,
   Ruine, Stein und Basalt. Danach Export als komprimiertes WebP oder KTX2.
2. **Fundstücke als 3D-Modelle** (TRELLIS o. ä.): Zeitkristall, Münze, Amphore,
   Ammonit-Fossil. Danach Dezimierung auf maximal 2.000 Dreiecke und Export als `.glb`.
3. **Vorberechnete Felder:** große Welten oder Tagesgrabungen als Seeds bzw. komprimierte
   Arrays erzeugen.
4. **Icons und Titelbild** für Home-Bildschirm und Startseite.

Details stehen in `tools/ASSETS.md`. Bis die Assets da sind, nutzt das Spiel prozedurale Farben,
es ist also auch ohne PC sofort spielbar.

---

## 8. Fahrplan

| Version | Inhalt                                                                  |
|---------|-------------------------------------------------------------------------|
| 0.1     | Expedition-Modus, Schichten, Detektor, Werkzeuge, Funde, Highscore      |
| 0.2     | Texturen vom PC, 3D-Kristall, bessere Partikel, Musik                   |
| 0.3     | Modus Tiefenrekord (endloser Schacht), nachrutschender Sand             |
| 0.4     | Modus Wüstenwind, Tagesgrabung mit Seed                                 |
| 0.5     | Upgrades zwischen Feldern (Ausdauer, Detektor-Reichweite)               |
