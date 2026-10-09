# Quizligan

En svensk quizliga för upp till 35 personer. Den tidigare portfoliosidan har ersatts.

## Funktioner

- Skapa en tom liga och dela läslänken med teamet.
- Administratörslänken ger behörighet att lägga till, ändra och ta bort quiz. Nyckeln sparas i administratörens webbläsare; länken behövs för åtkomst på en annan enhet. Det finns ingen lösenordsåterställning.
- Ladda upp PNG/JPEG (max 5 MB). Serverns Tesseract läser namn och placeringar. Bilden behandlas lokalt på servern; temporärfilen tas bort efter avläsningen. Originalbilden sparas inte med quizet. Ingen extern AI-tjänst eller API-nyckel krävs.
- Granska avläsningen och rätta namn/placeringar innan du sparar. Samma namn, oavsett versaler och extra mellanslag, kopplas till samma deltagare. Använd konsekventa, unika namn för olika personer.
- Alternativ: mata in deltagarna manuellt eller klistra in text med `1 Emma Lind` på varje rad. Bildtolkningen fungerar bäst med en tydlig lista där placeringen står först på raden. Den använder den synliga placeringen, inte quizets ursprungliga poäng.
- Poäng = antal deltagare i det aktuella quizet − placering + 1. Frånvaro = 0. Alla quiz räknas. Unika placeringar 1–N krävs; delade quizplaceringar avvisas. Vid lika totalpoäng visas delad ligaplacering och namnen sorteras alfabetiskt.
- Poäng-/placeringstabell, sökning, animerad totalgraf, utvecklingsgraf för topp 5, quizhistorik och mobilvy. Rörelse minskas när användarens systeminställning begär det.
- Läsare hämtar uppdateringar var tionde sekund medan sidan är synlig.

## Utveckling

Node **22.18 eller senare inom 22-serien**, pnpm **10.34.3**, Tesseract 5 med minst `eng`-språkdata. Native TypeScript i Node används för servern och testerna.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Vite kör både klienten och API:t på port 8443 (eller `PORT`). I den förberedda cloud-miljön aktiveras verktygen med:

```sh
export PATH=/workspace/.cloud-tools/node_modules/.bin:$PATH
cd /workspace/AI_Test
```

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

`pnpm start` kör den byggda klienten och API:t med en vanlig Node-server. `pnpm preview` är Vites statiska förhandsvisning och kör inte ligans API; använd `pnpm start` för funktionstest av produktionsversionen.

## Lagring och publicering

Ligor sparas i serverns filer, **inte** i deltagarnas webbläsare. `LEAGUE_DATA_DIR` anger katalogen; standard är `.league-data/` (gitignorerad). Varje liga skrivs atomärt, och ändringar serialiseras inom en serverprocess. Administratörsnyckeln lagras som SHA-256-hash på servern. Den rena läslänken innehåller ingen administratörsnyckel.

För att länken ska fungera för teamet krävs en gemensam publicerad HTTPS-adress, en körande Node-server och **beständig disk** för datakatalogen. Enbart statisk hosting fungerar inte. Kör **en serverinstans**; flera instanser behöver en gemensam databas och distribuerad låsning. Säkerhetskopiera datakatalogen och testa återställning innan ni börjar använda ligan för riktiga resultat. Alla som har läslänken kan se namn och resultat.

En Dockerfile ingår och installerar även svenska OCR-språkdata:

```sh
docker build -t quizligan .
docker volume create quizligan-data
docker run --rm --name quizligan -p 8443:8443 \
  -v quizligan-data:/data quizligan
```

Anslut tjänsten till en HTTPS-domän genom din hostingplattform. Om plattformen sätter en port, skicka den som `PORT`. Publicering på en extern tjänst har inte utförts av detta bygge.

Miljövariabler (inga hemligheter behövs):

| Variabel | Standard | Syfte |
| --- | --- | --- |
| `PORT` | `8443` | HTTP-port |
| `LEAGUE_DATA_DIR` | `.league-data` | Beständig lagringskatalog |
| `OCR_LANG` | `eng` (Docker: `eng+swe`) | Installerade Tesseract-språk |

## Validering

Automatiska tester täcker poäng för 1/10/20/35 deltagare, frånvaro, ackumulerade poäng, ogiltiga placeringar, namnnormalisering, texttolkning, läsbehörighet, redigering, borttagning, datumsäkerhet, filpersistens och samtidiga skrivningar.

Webbläsarflödet har även verifierats på den byggda Node-servern: skapande av liga, verklig PNG-avläsning, granskning/sparande, ytterligare ett quiz med frånvaro, separata administratörs-/läsarwebbläsare, omladdning, redigering, graf-/tabelltabbar och mobilbredd utan horisontellt sidoöverflöde.

Dockerbygget kunde inte verifieras i cloud-miljön: nätverksuppslag från Docker gav `EAI_AGAIN` och hämtningen av pnpm misslyckades även med proxyinställningar. Dockerfilen behöver därför verifieras i hostingmiljön. Den vanliga Node-produktionsservern, inklusive OCR och delad lagring, har däremot körts och funktionstestats här.

## GitHub och en offentlig webbadress

Bygget ligger på GitHub-branchen `quizligan-deploy`. GitHub lagrar koden, men GitHub Pages kan inte köra denna apps server, OCR eller gemensamma lagring.

För full funktion finns `render.yaml`, avsedd för en Docker Web Service hos Render med en beständig disk på `/data` och en serverinstans. Startskriptet initierar diskens katalogägare och kör därefter appen som användaren `node`.

1. Logga in på ditt Render-konto och anslut GitHub-repot `erikuddgard/AI_Test`.
2. Skapa en Blueprint från branchen `quizligan-deploy` och dess `render.yaml`.
3. Granska kostnaden för server och beständig disk innan du godkänner skapandet. Konfigurationen använder den betalda planen `starter`; inget konto eller någon tjänst har skapats av assistenten.
4. Kontrollera att Dockerbygget lyckas och att tjänsten får en HTTPS-adress. Dockerbygget är fortfarande inte verifierat i cloud-miljön på grund av dess nätverksproblem.
5. Öppna adressen, skapa en liga och testa resultatbild, sparande, omladdning och läslänk från en annan webbläsare. Kontrollera också att resultaten finns kvar efter en serveromstart innan du bjuder in teamet.

Render-konfigurationen är förberedd för granskning. Den är inte ett kvitto på att en webbplats är publicerad, och aktuella priser måste kontrolleras i hostingtjänsten.
