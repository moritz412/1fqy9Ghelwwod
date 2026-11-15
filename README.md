# Wo ist's? – Lager-App für zu Hause

Merkt sich, wo du Dinge verstaut hast: Raum › Schrank › Fach › Karton. Mit Fotos, automatischen Tags und einer Suche, die auch Oberbegriffe und verwandte Begriffe versteht.

**Alle Daten bleiben auf deinem Gerät** – kein Konto, keine Cloud, kein Tracking. Details im [Konzept](KONZEPT.md).

## Starten

Die App besteht nur aus statischen Dateien, ohne Build-Schritt und ohne Abhängigkeiten.

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Fürs Handy die Dateien auf einem beliebigen statischen Webspace mit https bereitstellen (z. B. GitHub Pages) und die Seite „Zum Home-Bildschirm“ hinzufügen. Der Webspace liefert nur den Programmcode aus – deine Einträge und Fotos verlassen das Gerät nicht.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `style.css` | Oberfläche |
| `app.js` | Datenhaltung (IndexedDB), Ansichten, Suche, Fotos, Sicherung |
| `tags.js` | Begriffs-Lexikon für Auto-Tags und Suchbegriff-Erweiterung |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation |
