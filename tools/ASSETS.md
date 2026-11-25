# Ressourcen auf dem PC erzeugen

Das Spiel läuft heute mit prozeduralen Farben. Der PC (GPU) kann hochwertigere Ressourcen erzeugen, die dann in
`assets/` abgelegt werden. Das Spiel muss danach nur noch laden, nicht rechnen.

## 1. Schicht-Texturen (Bildmodell, z. B. FLUX)

Je eine nahtlose Kachel, 512×512 erzeugen und auf 256×256 verkleinern:

| Datei                       | Prompt-Idee                                                       |
|-----------------------------|-------------------------------------------------------------------|
| `assets/tex/sand.webp`      | seamless tileable desert dune sand texture, top-down, warm golden |
| `assets/tex/clay.webp`      | seamless tileable dry ochre clay with pebbles and cracks          |
| `assets/tex/ruin.webp`      | seamless tileable terracotta brick ruin fragments in earth        |
| `assets/tex/stone.webp`     | seamless tileable blue-grey sedimentary rock strata               |
| `assets/tex/basalt.webp`    | seamless tileable dark red volcanic basalt with glowing cracks    |

Export als WebP mit Qualität 80. Im Spiel werden die Texturen später als Texture-Atlas auf das `InstancedMesh` gelegt.

## 2. Fundstücke als 3D-Modelle (z. B. TRELLIS)

Aus einem freigestellten Referenzbild ein Modell erzeugen, dann:

1. In Blender auf maximal 2.000 Dreiecke dezimieren (*Decimate*).
2. Den Ursprung in die Mitte setzen und das Modell auf etwa 1 Einheit skalieren.
3. Als `.glb` mit Draco-Kompression exportieren.

Gebraucht werden: `core.glb` (Nexus-Kern), Schrottteile (5–10 Varianten), Fundstücke (Kupferspule, Sondenteil, Abzeichen, Alien-Artefakt), Helfer-Drohnen und ein detaillierter Nexus-Bot (Vorlage `assets/ref/nexus-bot.png`).

## 3. Icons

`icon.svg` ist die Vorlage. PNG-Größen (180, 512) lassen sich mit jedem Browser-Screenshot oder mit
`rsvg-convert -w 512 icon.svg > icon-512.png` erzeugen.

## 4. Vorberechnete Felder (später)

Für den Modus *Tagesgrabung* kann der PC Seeds testen und nur faire Felder auswählen, also solche, bei denen der
Kristall mit der Start-Ausdauer erreichbar ist. Die guten Seeds kommen als Liste nach `assets/seeds.json`.
