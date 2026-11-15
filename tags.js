/* Lokales Begriffs-Lexikon: Auto-Tags und Suchbegriff-Erweiterung.
   Läuft komplett im Browser – es werden keine Daten an einen Server geschickt.

   Eintrag: [Tag, [Oberbegriffe], [Wörter]]
   Wörter:  normale Wörter (ab 5 Zeichen) passen auch mitten im Wort ("kleid" in "Sommerkleider"),
            kurze Wörter nur am Wortanfang oder -ende, "=wort" nur als ganzes Wort. */
'use strict';

const LEXIKON_ROH = [
  ['Kleidung', [], ['kleidung', 'klamotten', 'anziehsachen', 'pullover', 'pulli', 'hemd', 'hemden', 'bluse', 'jeans', '=hose', '=hosen', 'socken', 'unterwäsche', 'anzug']],
  ['Kleider', ['Kleidung'], ['kleid']],
  ['Sommerkleidung', ['Kleidung', 'Sommer'], ['sommerkleid', 'sommersachen', 'shorts', 'kurze hose', 't-shirt', 'tshirt', 'sandale', 'flipflop', 'flip-flop', 'sonnenhut']],
  ['Bademode', ['Kleidung', 'Sommer', 'Schwimmen'], ['badehose', 'bikini', 'badeanzug', 'badesachen', 'schwimmsachen']],
  ['Schwimmen', ['Sommer'], ['schwimm', 'taucherbrille', 'schnorchel', 'planschbecken', 'luftmatratze']],
  ['Winterkleidung', ['Kleidung', 'Winter'], ['winterjacke', 'wintersachen', '=schal', 'handschuh', 'mütze', 'skihose', 'schneehose', 'schneeanzug', 'thermo', 'daunen', 'winterstiefel']],
  ['Jacken', ['Kleidung'], ['jacke', 'mantel', 'parka', 'anorak']],
  ['Schuhe', ['Kleidung'], ['schuh', 'stiefel', 'sneaker', 'pantoffel', 'sandale']],
  ['Babykleidung', ['Kleidung', 'Baby'], ['strampler', 'babybody', 'babykleidung', 'babysachen']],
  ['Baby', ['Kinder'], ['baby', 'kinderwagen', 'schnuller', 'wickel', 'babyschale', 'hochstuhl', 'laufstall']],
  ['Kinder', [], ['kinder']],
  ['Spielzeug', ['Kinder'], ['spielzeug', 'spielsachen', 'lego', 'duplo', 'playmobil', 'puppe', 'kuscheltier', 'stofftier', 'holzeisenbahn', 'bauklötze']],
  ['Spiele', [], ['brettspiel', 'gesellschaftsspiel', 'puzzle', 'kartenspiel']],
  ['Saisonal', [], ['saison']],
  ['Sommer', ['Saisonal'], ['sommer']],
  ['Winter', ['Saisonal'], ['winter']],
  ['Herbst', ['Saisonal'], ['herbst']],
  ['Frühling', ['Saisonal'], ['frühling', 'frühjahr']],
  ['Weihnachten', ['Deko', 'Saisonal', 'Winter'], ['weihnacht', 'christbaum', 'advent', 'lichterkette', 'krippe', 'tannenbaum', 'nikolaus', 'lametta', 'baumschmuck', 'baumkugel']],
  ['Ostern', ['Deko', 'Saisonal', 'Frühling'], ['oster']],
  ['Kostüme', ['Saisonal'], ['halloween', 'fasching', 'karneval', 'kostüm', 'verkleidung']],
  ['Deko', [], ['deko', '=vase', '=vasen', 'kerze', 'bilderrahmen', 'girlande']],
  ['Wintersport', ['Sport', 'Winter'], ['ski', 'snowboard', 'schlitten', 'schlittschuh']],
  ['Camping', ['Outdoor', 'Urlaub'], ['zelt', 'schlafsack', 'isomatte', 'camping', 'luftmatratze', 'gaskocher']],
  ['Outdoor', [], ['outdoor', 'wander']],
  ['Urlaub', [], ['urlaub', 'reise']],
  ['Reisegepäck', ['Urlaub'], ['koffer', 'reisetasche', 'rucksack', 'trolley']],
  ['Sport', [], ['sport', 'hantel', 'yogamatte', 'fußball', 'tennis', 'inliner', 'federball']],
  ['Fahrrad', ['Sport'], ['fahrrad', 'luftpumpe']],
  ['Werkzeug', ['Heimwerken'], ['werkzeug', 'bohrmaschine', 'bohrer', 'akkuschrauber', 'hammer', 'schraubenzieher', 'schraubendreher', 'zange', '=säge', 'stichsäge', 'wasserwaage', 'schraube', 'dübel']],
  ['Renovieren', ['Heimwerken'], ['pinsel', 'farbrolle', 'wandfarbe', 'tapete', '=lack', 'malerfolie', 'abdeckfolie', 'spachtel']],
  ['Heimwerken', [], ['heimwerk', 'baumarkt']],
  ['Elektronik', [], ['kabel', 'ladegerät', 'netzteil', 'adapter', 'hdmi', '=usb', 'festplatte', 'router', 'kopfhörer', 'lautsprecher', 'konsole', 'kamera', 'elektronik']],
  ['Dokumente', [], ['dokument', 'aktenordner', 'unterlagen', 'zeugnis', 'vertrag', 'verträge', 'steuer', 'rechnung', 'versicherung']],
  ['Bücher', ['Medien'], ['buch', 'bücher', 'roman', 'comic']],
  ['Medien', [], ['dvd', '=cd', '=cds', 'blu-ray', 'schallplatte', 'vinyl']],
  ['Küche', [], ['küche', 'kochtopf', '=topf', '=töpfe', 'pfanne', 'geschirr', 'besteck', 'gläser', 'tasse', 'teller', 'raclette', 'fondue', 'mixer', 'waffeleisen', 'backform', 'einmachglas', 'thermoskanne']],
  ['Textilien', [], ['bettwäsche', 'bettdecke', 'kissen', 'laken', 'handtuch', 'handtücher', 'tischdecke', 'gardine', 'vorhang', 'vorhänge', 'wolldecke']],
  ['Garten', ['Outdoor'], ['garten', 'gießkanne', 'blumentopf', 'rasenmäher', 'grill', 'sonnenschirm', 'liegestuhl', 'sitzauflage']],
  ['Erinnerungen', [], ['fotoalbum', 'fotoalben', 'erinnerung', 'andenken', 'tagebuch', 'briefe']],
  ['Party', [], ['party', 'luftballon', 'geburtstag', 'pappbecher', 'konfetti']],
  ['Geschenke', [], ['geschenk']],
  ['Musik', [], ['gitarre', 'keyboard', 'noten', 'flöte', 'instrument']],
  ['Basteln', [], ['bastel', 'wolle', 'strick', 'nähmaschine', 'nähzeug', 'stoffreste']],
  ['Haushalt', [], ['staubsauger', 'putzmittel', 'wischmopp', 'bügel']],
  ['Umzug', [], ['umzug', 'packpapier', 'luftpolster']],
  ['Auto', [], ['reifen', 'dachbox', 'schneekette', 'dachträger', '=auto']],
  ['Winterreifen', ['Auto', 'Winter'], ['winterreifen']],
  ['Sommerreifen', ['Auto', 'Sommer'], ['sommerreifen']],
];

function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const LEXIKON = LEXIKON_ROH.map(([tag, parents, words]) => ({
  tag, parents, ntag: norm(tag),
  words: words.map(w => w.startsWith('=') ? { w: norm(w.slice(1)), exact: true } : { w: norm(w) }),
}));

function wordHits(word, ntext, tokens) {
  if (word.exact) return tokens.some(t => t === word.w || t === word.w + 's');
  if (/[^a-z0-9]/.test(word.w)) return ntext.includes(word.w);
  if (word.w.length <= 4) return tokens.some(t => t.startsWith(word.w) || t.endsWith(word.w));
  return ntext.includes(word.w);
}

/* Liefert passende Tags (inkl. Oberbegriffe) für einen Freitext. */
function suggestTags(text) {
  const ntext = norm(text);
  const tokens = ntext.split(/[^a-z0-9]+/).filter(Boolean);
  const out = [];
  const add = t => { if (!out.includes(t)) out.push(t); };
  for (const c of LEXIKON) {
    if (c.words.some(w => wordHits(w, ntext, tokens))) {
      add(c.tag);
      c.parents.forEach(add);
    }
  }
  return out;
}

/* Erweitert einen (normalisierten) Suchbegriff um verwandte Tags und Wörter. */
function expandQuery(tok) {
  const tags = new Set(), words = new Set(), hits = [];
  if (tok.length < 3) return { tags, words };
  for (const c of LEXIKON) {
    const hit = c.ntag.startsWith(tok) || tok.startsWith(c.ntag) ||
      c.words.some(w => wordHits(w, tok, [tok]) || (!w.exact && w.w.startsWith(tok)));
    if (hit) hits.push(c);
  }
  // Oberbegriffe weglassen, wenn ein spezifischerer Begriff getroffen wurde
  // ("Winterjacke" soll Jacken finden, nicht alles mit "Winter").
  const broad = new Set(hits.flatMap(c => c.parents));
  for (const c of hits) {
    if (hits.length > 1 && broad.has(c.tag)) continue;
    tags.add(c.ntag);
    c.words.forEach(w => words.add(w.w));
  }
  return { tags, words };
}
