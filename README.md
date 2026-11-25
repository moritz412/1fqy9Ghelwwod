# ✦ Sternsplitter

3D-Grabespiel für iPad, Handy und Browser: Ein Stern ist über der Wüste zersprungen.
Grab dich durch Sand und Gestein, folge der Wärmeanzeige und finde den leuchtenden Sternsplitter –
oder grab im **Tiefenrausch** so tief du kannst.

👉 Entwurf & Roadmap: [docs/ENTWURF.md](docs/ENTWURF.md)

## Spielen
Nach der Einrichtung von GitHub Pages (siehe unten) unter
`https://<github-name>.github.io/<repo-name>/` – am iPad/iPhone in Safari öffnen und über
**Teilen → Zum Home-Bildschirm** als Vollbild-App speichern.

**Steuerung:** Tippen = graben · Wischen = drehen · Zwei Finger = zoomen

## Lokal starten
Kein Build nötig, nur ein statischer Webserver:
```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen (auch vom iPad im selben WLAN über die PC-IP)
```

## GitHub Pages einrichten
1. Repository → **Settings → Pages**
2. *Source*: **GitHub Actions** wählen
3. Der Workflow `.github/workflows/pages.yml` veröffentlicht bei jedem Push automatisch.

(Alternativ *Deploy from a branch* → Branch wählen → Ordner `/ (root)` – funktioniert ebenfalls, da kein Build nötig ist.)

## Icons neu erzeugen (am PC)
```bash
npm i -D playwright   # einmalig
node tools/make-icons.js
```

## Technik
Three.js r160 (lokal in `vendor/`, MIT-Lizenz), ES-Module ohne Build-Schritt, Voxel-Chunks mit
Ambient Occlusion, prozedurale Welt- und Sounderzeugung.
