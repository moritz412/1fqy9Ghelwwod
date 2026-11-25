# Sternsplitter – Spielentwurf

## 1. Idee in einem Satz
Ein 3D-Grabespiel im Stil eines Dioramas: Ein Stern ist über der Wüste von **Qarum** zersprungen –
du gräbst dich durch Sand, Erde, Lehm und Gestein, folgst der **Wärmeanzeige** und legst den
leuchtenden **Sternsplitter** frei. Klassisches „Nadel im Heuhaufen“ + „Sandkörner wegräumen“ +
„möglichst tief buddeln“ – zusammengeführt in einem eigenen Thema.

## 2. Zielplattformen
- **iPad** (Hauptziel, quer und hoch), **iPhone/Android-Handy** (hoch), Desktop-Browser.
- Läuft direkt im Browser über **GitHub Pages** – keine Installation, kein Build-Schritt.
- Über „Zum Home-Bildschirm“ als Vollbild-App startbar (Web-App-Manifest).

## 3. Spielmodi
| Modus | Ziel | Ende |
|---|---|---|
| **Sternsuche** (20 Level) | Den Sternsplitter freilegen (eine Seite des Splitters muss frei sein) | Gewonnen bei Fund, verloren bei 0 Energie |
| **Tiefenrausch** (Endlos-Säule, 128 m) | So tief wie möglich graben, Edelsteine füllen Energie auf | Energie leer → Tiefenrekord wird gespeichert |
| *Sandsturm* (geplant) | In begrenzten Zügen möglichst alle Sandkörner einer Düne abtragen | Prozentwertung |

## 4. Kernmechaniken
- **Voxel-Welt** (1 Block = 1 m), Schichten nach Tiefe: Sand → Erde → Lehm → Stein → Basalt → Grundgestein.
- **Härte**: Werkzeuge haben Kraft. Ist das Material härter, bekommt es Risse (dunkler) und bricht beim nächsten Schlag.
- **Rieselnder Sand**: Sand fällt nach und rutscht seitlich ab (Schüttwinkel) – tiefe Löcher im Sand laufen wieder zu.
  Strategie: breit graben oder schnell mit dem Bohrer durch.
- **Wärmeanzeige** (Heiß/Kalt) nach jedem Graben: Entfernung vom Grabungsort zum Splitter.
- **Sonar** (3 Energie): ungenauer Kugel-Puls um die Position des Splitters.
- **Funde**: 💎 Edelstein (+3 Energie), 🦴 Fossil (+100 Punkte), 🟠 Bernstein (+1 Energie).
- **Bewertung**: 1–3 Sterne nach Restenergie, Level werden nacheinander freigeschaltet.

### Werkzeuge
| Werkzeug | Kosten | Wirkung |
|---|---|---|
| 🪏 Schaufel | 1 ⚡ | Kugel r=1,7, Kraft 2 |
| 🔩 Bohrer | 2 ⚡ | Tunnel 5 m in Blickrichtung, Kraft 4 |
| 🧨 Dynamit | Vorrat | Krater r=3,3, Kraft 5 |
| 📡 Sonar | 3 ⚡ | zeigt ungefähre Lage |

### Schwierigkeitskurve (Sternsuche)
- Weltgröße 18→36 Blöcke, Höhe 29→64, Splitter-Tiefe steigt (Level 1: 6–11 m, Level 10: 24–38 m).
- Ab Level 3 Höhlen in der Tiefe. Energie 26 + 4 je Level, Dynamit +1 alle 3 Level.

## 5. Steuerung (Touch zuerst)
- **Tippen** = mit aktuellem Werkzeug graben
- **Ein Finger ziehen** = Kamera drehen · **Zwei Finger** = zoomen/drehen · Mausrad am PC
- Kamera folgt automatisch dem Grabungsort (sanftes Nachführen).

## 6. Look & Feel
- Diorama-Würfel schwebt vor einem Dämmerungshimmel (violett → orange), die Seiten zeigen die Gesteinsschichten.
- Vertex-Farben mit Ambient Occlusion statt Texturen → sehr leicht, läuft flüssig auf iPads/Handys.
- Partikel beim Graben, Kamerawackeln bei Dynamit, goldener Kristall + Licht beim Fund.
- Prozedurale Sounds (WebAudio), Vibration wo verfügbar.

## 7. Technik
- **Three.js r160** (lokal in `vendor/`, keine CDN-Abhängigkeit), reine ES-Module, kein Build-Tool.
- Welt in **16³-Chunks**, nur geänderte Chunks werden neu vermascht; nur sichtbare Flächen werden erzeugt.
- Eigener **Voxel-Raycast (DDA)** für präzises Tippen.
- Deterministische Level über Seeds (gleiche Welt bei „Nochmal“).
- Fortschritt in `localStorage` (freigeschaltete Level, Sterne, Tiefenrekord, Ton).

```
index.html          UI-Gerüst, Import-Map
css/style.css       HUD, Menüs, Safe-Areas (Notch), responsive
js/main.js          Szene, Kamera, Eingabe, Spiellogik, UI
js/world.js         Voxel-Daten, Generierung, Meshing, Graben, Sandphysik, Raycast
js/levels.js        Werkzeuge & Level-Parameter
js/effects.js       Partikel, Sonar, Sternsplitter-Animation
js/audio.js         Prozedurale Sounds
js/noise.js         Seed-Zufall & Rauschen
tools/              Hilfsskripte (z. B. Icons erzeugen) – laufen am PC
```

## 8. Rolle des PCs (Ressourcen erzeugen)
Das Spiel kommt komplett ohne externe Dateien aus. Der PC kann später für hochwertigere Assets genutzt werden:
1. **3D-Modelle** (GLB) für Fundstücke: Sternsplitter, Fossilien, Werkzeuge – z. B. Bild mit FLUX → 3D mit TRELLIS,
   danach in `assets/models/` ablegen und per `GLTFLoader` laden.
2. **Texturen/Atlas** für Schichten (16×16 Pixel-Art) → ersetzen die Vertex-Farben.
3. **Musik & Soundeffekte** (z. B. lokal generiert) → `assets/audio/`.
4. **Vorberechnete Level** (z. B. handgebaute Dünen oder Höhlen als `.json`), falls Zufallswelten nicht reichen.
5. **Icons/Splashscreens**: `node tools/make-icons.js` rendert `icons/icon.svg` in alle PNG-Größen.

Wichtig für GitHub Pages: Assets klein halten (GLB < 1 MB, Texturen komprimiert), damit es auf dem Handy schnell lädt.

## 9. Roadmap
- [x] Prototyp: Voxel-Welt, 3 Werkzeuge + Sonar, Sandphysik, Wärmeanzeige, 20 Level, Tiefenrausch
- [x] Touch-Steuerung iPad/Handy, Safe-Areas, Home-Screen-App
- [x] GitHub-Pages-Deployment
- [ ] Modus „Sandsturm“ (alle Sandkörner wegräumen)
- [ ] Offline-Modus (Service Worker)
- [ ] Mehrere Splitter pro Level / Sammelalbum der Fundstücke
- [ ] Biome: Eiswüste, Vulkan, Mondkrater
- [ ] Assets vom PC: Modelle, Texturen, Musik
- [ ] Tägliche Herausforderung (Seed = Datum) mit Bestenliste
