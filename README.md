# Nexus Schrottberg

Ein 3D-Sammel- und Aufräumspiel im Browser für iPad, Handy und PC. Auf dem Hangardeck der **Nexus-Raumstation**
liegen 5.000.000 Teile Weltraumschrott, und darin steckt der verlorene **Nexus-Kern**. Du steuerst den **Nexus-Bot**,
sortierst Teil für Teil, verkaufst Funde am Nexus-Markt, rüstest den Bot auf und kaufst Helfer, die automatisch mitarbeiten.

- Konzept: [KONZEPT.md](KONZEPT.md)
- Ressourcen vom PC: [tools/ASSETS.md](tools/ASSETS.md)
- Erster Prototyp (Graben in Schichten): [docs/KONZEPT-v0-grabung.md](docs/KONZEPT-v0-grabung.md)

## Steuerung
| | Touch | PC |
|---|---|---|
| Fahren | Stick links | WASD / Pfeiltasten |
| Kamera | ziehen, kneifen | Maus ziehen, Mausrad |
| Greifen | GREIFEN halten oder auf den Haufen tippen | Leertaste |
| Markt | Button am Dock | E |

## Spielen

**Lokal:**
```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

**Online:** https://moritz412.github.io/1fqy9Ghelwwod/

Die Seite wird über GitHub Pages direkt aus dem Branch `claude/peaceful-albattani-sd46bs` (Ordner `/`) ausgeliefert.
Jeder Push auf diesen Branch aktualisiert das Spiel nach ein bis zwei Minuten.

Auf dem iPad: In Safari öffnen, dann *Teilen → Zum Home-Bildschirm*. So startet das Spiel als Vollbild-App.
Der Spielstand wird im Browser gespeichert.

## Technik
Reines HTML, CSS und JavaScript mit Three.js 0.170 (in `vendor/`, MIT). Es gibt keinen Build-Schritt.
Der Haufen ist eine Höhenkarte mit 64 × 64 Säulen, jede Säule speichert ihre Teile als Zahl. Gezeichnet wird nur die Oberfläche,
deshalb laufen auch 5 Millionen Teile flüssig auf dem Tablet.
