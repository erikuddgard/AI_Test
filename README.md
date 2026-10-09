# Quizligan

En svensk quizliga för upp till 35 personer, med gemensamma resultat, poäng-/placeringstabell och animerade grafer.

## Publicera med Vercel och Supabase

Vercel kör webbplatsen och dess API. Supabase sparar ligorna i en gemensam databas så att resultaten finns kvar efter en ny publicering. Gratisplanerna kan passa en privat hobbyliga. **Vercel Hobby är avsedd för personlig, icke-kommersiell användning**; kontrollera villkoren om ligan används av ett företag eller i arbetet. Kontrollera även aktuella gränser och villkor hos [Vercel](https://vercel.com/pricing) och [Supabase](https://supabase.com/pricing). Supabase kan pausa inaktiva gratisprojekt. Exakta kvoter och priser har inte verifierats här.

Inget Vercel- eller Supabase-konto har skapats eller anslutits av assistenten, och dessa instruktioner innebär inte att sidan redan är offentligt publicerad.

### 1. Skapa databasen

1. Logga in på [Supabase](https://supabase.com/) och skapa ett projekt på gratisplanen om den passar användningen.
2. Öppna projektets **SQL Editor**, klistra in hela [supabase/schema.sql](supabase/schema.sql) och kör det. Gör detta **innan** webbplatsen driftsätts. Skriptet skapar tabellen och begränsar direktåtkomst med Row Level Security (RLS).
3. Hämta projektets URL och en **Secret key** (`sb_secret_…`) i **Settings → API Keys**. Supabase rekommenderar dessa nya servernycklar; en äldre `service_role`-nyckel stöds också. Använd inte en publishable-/`anon`-nyckel. Nyckeln ska anges säkert i Vercels miljöinställningar, aldrig i GitHub, chatten eller klientkoden.

### 2. Importera GitHub-repot i Vercel

1. Logga in på [Vercel](https://vercel.com/) och välj **Add New → Project → Import Git Repository**.
2. Anslut `erikuddgard/AI_Test` och använd branchen **`quizligan-deploy`**. Om importen väljer `main`, ändra **Production Branch** till `quizligan-deploy` i projektets Git-inställningar och driftsätt den branchen.
3. Använd rotkatalogen för repot, framework **Vite**, Node **22.x**, installationskommando `pnpm install --frozen-lockfile`, byggkommando `pnpm build` och output-katalog **`dist`**. Repots `vercel.json` kopplar också `/api/…` till serverfunktionen; publicera därför hela repot, inte enbart en uppladdad `dist`-katalog.
4. Lägg till följande variabler för **Production** och **Preview**:

   | Variabel | Värde | Hantering |
   | --- | --- | --- |
   | `SUPABASE_URL` | Projektets HTTPS-URL | URL:en är offentlig, men används här av servern. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Projektets Secret key (`sb_secret_…`) eller äldre `service_role`-nyckel | Hemlighet som endast får användas på servern. |

   Variabelnamnet `SUPABASE_SERVICE_ROLE_KEY` används även för den nya Secret key-typen. Lägg aldrig till prefixet `VITE_` på servernyckeln: sådana variabler kan hamna i webbläsarens JavaScript. Servernyckeln har hög behörighet och ska behandlas som ett lösenord. Produktions- och previewbyggen använder samma ligor om de får samma databasinställningar; använd ett separat Supabase-projekt för Preview om testresultaten behöver hållas åtskilda.
5. Klicka **Deploy**. Om du ändrar variabler efteråt behöver du göra en ny deployment för att serverfunktionen ska få dem.

Ingen beständig disk eller installerad Tesseract-process behövs på Vercel. Bildtolkningen körs i användarens webbläsare, och API:t sparar endast de granskade resultaten i Supabase. Vid Vercel-körning krävs båda Supabase-variablerna; tillfällig fillagring används inte som reserv.

### 3. Kontrollera och dela

1. Öppna HTTPS-adressen Vercel ger projektet och skapa en liga.
2. Läs in en tydlig resultatbild, granska namn och placeringar och spara ett quiz.
3. Ladda om sidan och öppna läslänken i en annan webbläsare. Kontrollera att samma resultat visas och att läsaren inte kan ändra dem.
4. Gör en ny deployment och kontrollera att resultaten finns kvar. Spara administratörslänken på en säker plats och dela **läslänken** med deltagarna.

Om sidan visar demon men inte kan skapa eller öppna en liga: kontrollera API-funktionens loggar i Vercel, att båda variablerna är satta för rätt miljö och att SQL-skriptet har körts i samma Supabase-projekt. Om Supabase har pausat projektet, återuppta det i dess dashboard och försök igen. Skriv inte ut nyckeln i felsökningsloggar.

## Funktioner och bildtolkning

- Skapa en tom liga och dela läslänken med teamet. Alla med läslänken kan se namn och resultat.
- Administratörslänken ger behörighet att lägga till, ändra och ta bort quiz. Nyckeln sparas i administratörens webbläsare; länken behövs för åtkomst på en annan enhet. Det finns ingen lösenordsåterställning. Servern lagrar endast nyckelns SHA-256-hash.
- Ladda upp **PNG/JPEG, högst 5 MB**. Tesseract.js läser bilden i webbläsaren med svenska och engelska språkdata. OCR-programmet och språkfilerna levereras från den egna webbplatsen; bilden skickas inte till en extern OCR-tjänst och originalbilden sparas inte med quizet. Första avläsningen kan ta längre tid medan språkfilerna hämtas.
- Granska avläsningen och rätta namn/placeringar innan du sparar. Använd konsekventa, unika namn för olika personer. Samma namn, oavsett versaler och extra mellanslag, kopplas till samma deltagare.
- Bildtolkningen fungerar bäst med en tydlig lista där varje rad börjar med placering, till exempel `1 Emma Lind`, `2. Oscar Berg` eller `3 Sofia Nilsson 850 poäng`. Quizets ursprungliga poäng används inte för ligapoängen. Otydliga bilder, medaljsymboler eller komplexa tabeller kan behöva rättas manuellt.
- Du kan även mata in deltagarna manuellt eller klistra in en resultatlista som text.
- Poäng = antal deltagare i quizet − placering + 1. Frånvaro = 0. Alla quiz räknas. Unika placeringar 1–N krävs; delade quizplaceringar avvisas. Vid lika totalpoäng visas delad ligaplacering och namnen sorteras alfabetiskt.
- Poäng-/placeringstabell, sökning, animerad totalgraf, utvecklingsgraf för topp 5, quizhistorik och mobilvy. Rörelse minskas när användarens systeminställning begär det.
- Läsare hämtar uppdateringar var tionde sekund medan sidan är synlig.

## Lokal utveckling

Node **22.18 eller senare inom 22-serien** och pnpm **10.34.3**. Den tidigare Node-serverns OCR-endpoint kräver även Tesseract 5 med minst `eng`-språkdata, men webbplatsens nya bildtolkning använder webbläsaren och kräver ingen native Tesseract-installation.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Vite kör klienten och API:t på port 8443 (eller `PORT`). OCR-filer förbereds av projektets scripts inför utveckling och byggning. De genererade filerna innehåller inga resultatbilder.

Utan Supabase-variabler sparas ligor lokalt i `.league-data/` (gitignorerad), eller katalogen i `LEAGUE_DATA_DIR`. Filerna skrivs atomärt och ändringar serialiseras inom en serverprocess. Kör en serverinstans när du använder fillagring. Data flyttas inte automatiskt från filerna till Supabase.

Om du vill utveckla mot Supabase använder du ett separat testprojekt och kör SQL-skriptet där. [`.env.example`](.env.example) visar variabelnamnen. Kopiera till en gitignorerad `.env.local`, fyll i värden lokalt och starta utvecklingsservern:

```sh
pnpm dev
```

Vite-konfigurationen laddar just de två Supabase-inställningarna till servern, medan processen använder redan satta värden i första hand. Nyckeln skickas inte till klienten. Lägg aldrig servernyckeln i en `VITE_`-variabel.

I den förberedda cloud-miljön finns verktygen under:

```sh
export PATH=/workspace/.cloud-tools/node_modules/.bin:$PATH
cd /workspace/AI_Test
```

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

`pnpm start` kör den byggda klienten och API:t med en vanlig Node-server. `pnpm preview` är en statisk förhandsvisning och kör inte ligans API. Kör exempelvis `node --env-file=.env.local server/start.ts` för att använda Supabase även i Node-produktionsservern.

## Alternativ: Node-server och beständig disk

För en egen Node-server med fillagring behövs en gemensam HTTPS-adress, en serverinstans och **beständig disk** för datakatalogen. Säkerhetskopiera datakatalogen och testa återställning innan ni använder ligan för riktiga resultat. GitHub Pages kan visa statiska filer men kör inte det API och den gemensamma lagring som denna app behöver.

En Dockerfile finns:

```sh
docker build -t quizligan .
docker volume create quizligan-data
docker run --rm --name quizligan -p 8443:8443 \
  -v quizligan-data:/data quizligan
```

Dockerbygget är **inte verifierat**: tidigare nätverksuppslag från Docker gav `EAI_AGAIN` och hämtningen av pnpm misslyckades även med proxyinställningar. Verifiera bygget och datalagringen i din hostingmiljö innan användning.

`render.yaml` är ett tidigare förberett, **betalt alternativ** för Render: en Docker Web Service på planen `starter`, en beständig disk på `/data` och en serverinstans. Om du väljer det, anslut repot och branchen `quizligan-deploy` som en Blueprint och granska kostnaden innan du skapar tjänsten. Inga konton eller tjänster har skapats av assistenten. Vercel/Supabase-alternativet ovan använder inte denna Render-konfiguration.

| Variabel | Standard | Användning |
| --- | --- | --- |
| `SUPABASE_URL` | Ingen | Krävs tillsammans med servernyckeln för Supabase-lagring. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingen | Serverhemlighet för Supabase-lagring. |
| `PORT` | `8443` | Lokal HTTP-port/egen Node-server. |
| `LEAGUE_DATA_DIR` | `.league-data` | Lokal fillagring när Supabase inte används. |
| `OCR_LANG` | `eng` (Docker: `eng+swe`) | Installerade språk för den äldre native OCR-endpointen. |

## Validering

Kör `pnpm test`, TypeScript-kontrollen och produktionsbygget enligt ovan efter ändringar. Tester täcker bland annat poäng för 1/10/20/35 deltagare, frånvaro, ogiltiga placeringar, namnnormalisering, texttolkning, administratörsbehörighet och persistens. Ett godkänt lokalt bygge ersätter inte kontrollen mot ett verkligt Supabase-projekt och en Vercel-deployment.

Tidigare webbläsarkontroller verifierade den vanliga Node-serverns ligaflöde, separata administratörs-/läsarwebbläsare, omladdning, redigering, grafer/tabbar och mobilbredd. Kontrollera även den nya webbläsaravläsningen och databasanslutningen enligt publiceringsstegen innan du bjuder in teamet.
