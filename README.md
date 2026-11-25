# Tiefenzeit – Die Suche nach dem Zeitkristall

Ein 3D-Grabungsspiel im Browser, gebaut für iPad, Handy und PC. Du gräbst dich durch die Epochen der Wüste
Ar-Ruhal und suchst mit dem Resonanz-Detektor den versteckten Zeitkristall, die Nadel im Heuhaufen.

- Konzept und Fahrplan: [KONZEPT.md](KONZEPT.md)
- Ressourcen vom PC erzeugen: [tools/ASSETS.md](tools/ASSETS.md)

## Spielen

**Lokal:** Der Ordner braucht einen kleinen Webserver, weil ES-Module über `file://` nicht laden:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen (vom iPad aus über die IP des PCs im WLAN)
```

**Online über GitHub Pages:**

1. Im Repository unter *Settings → Pages → Build and deployment → Source* den Eintrag **GitHub Actions** wählen.
2. Den Code auf `main` bringen (mergen). Der Workflow `.github/workflows/pages.yml` veröffentlicht ihn dann automatisch,
   alternativ unter *Actions → Deploy to GitHub Pages → Run workflow* von Hand starten.
3. Die Adresse lautet `https://<benutzer>.github.io/<repo>/`.

Auf dem iPad: In Safari öffnen, dann *Teilen → Zum Home-Bildschirm*. So startet das Spiel als Vollbild-App.

## Technik

Reines HTML, CSS und JavaScript mit Three.js 0.170 (liegt in `vendor/`, MIT-Lizenz). Es gibt keinen Build-Schritt.
