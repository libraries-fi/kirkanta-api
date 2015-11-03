Kirjastohakemiston rajapinta v3
===============================

Päiväys         | Rajapinnan versio | Muutoksen kuvaus
--------------- | ----------------- | ----------------
03.09.2015      | 3.0 (beta)        | Ensimmäinen julkaisu
02.10.2015      | 3.0 (beta)        | Päivitetty dokumentaatio
30.10.2015      | 3.0 (beta)        | Dokumentaatio kirjoitettu uusiksi

Kirjastotietueiden type- ja branch_type-kenttien arvot ovat muuttuneet 02.10.2015.

Vanhat dokumentaatiot: [API V2](/v2-doc.html), [API V1](/v1-doc.html)

# Johdanto
Kirjastot.fi tarjoaa ilmaisen ja julkisen rajapinnan Kirjastohakemiston tietojen käyttöön kolmannen osapuolen sovelluksissa. Kirjastohakemisto sisältää yleisten kirjastojen, kirjastoautojen sekä oppilaitos- ja muiden erikoiskirjastojen esittelyt ja yhteystiedot. Kirjastohakemiston julkisivu sijaitsee osoitteessa http://hakemisto.kirjastot.fi.

Rajapinnan kolmas versio korvaa kaikki aiemmat versiot, jotka tullaan sulkemaan myöhemmin tulevaisuudessa käytön vähennyttyä.

Teknisissä ongelmissa voi olla yhteydessä Kirjastot.fi'n tekniikkatiimiin: tekniikka@kirjastot.fi.
Sisältöjä koskevista virheistä voi ilmoittaa osoitteeseen hakemisto@kirjastot.fi.

**HUOM**
 Testivaiheen aikana rajapinta (3.0) käyttää tuotantoversiosta erillistä tietokantaa, jonka tietoja ei yleisesti ottaen päivitetä. Lisäksi tietueiden tunnisteet tulevat vielä muuttumaan, kun rajapinta ja Kirjastohakemiston uusi ylläpito otetaan tuotantokäyttöön loppuvuoden aikana.

# Rajapinnan kuvaus
Rajapinta noudattaa rest-periaatetta. Kutsut tehdään tavallisina _http-pyyntöinä_ ja kyselyn parametrit välitetään osoitteen _query-osassa_ eli tavallisina get-parametreina. Pyyntöihin vastataan asiakasohjelman määrittämässä muodossa, joka voi olla xml, json tai jsonp. Vastaukseen käytettävän tietotyypin voi asettaa http-protokollan mukaisesti Accept-otsakkeella tai get-parametrilla _format_, jolla on korkeampi prioriteetti.

Käytetty merkistö on utf-8.

Tietotyyppi | Mime-tyyppi               | Format-parametri
----------- | ------------------------- | ----------------
XML         | application/xml           | xml
JSON        | application/json          | json
JSONP       | application/javascript    | jsonp

Jsonp-muotoa käyttäessä täytyy myös määrittää ns. callback-funktion nimi get-parametrilla _callback_.

## Kyselyiden rakenne
Kutsuissa käytettävät polut myötäilevät rest-filosofiaa. Polku sisältää haettavan resurssin tyypin sekä mahdollisen id-tunnisteen. Muut parametrit määritetään pyyntöosoitteen _query string_ -osassa. Suodinehdot on mahdollista muuttaa kieltäviksi eli not-muotoisiksi lisäämällä parametrin nimen perään miinusmerkki. Kyselyn parametrit yhdistetään AND-konjunktiolla, eli tulosjoukkoon sisältyvät ne tietueet, jotka täsmäävät kaikkiin hakuehtoihin. Mikäli yksittäiselle parametrille on annettu monta arvoa, riittää että tietue täsmää johonkin niistä.

Kutsujen rakenne on seuraavanlainen:
```
https://api.kirjastot.fi/v3/organisation?name=pasila&city.name=helsinki&format=jsonp&callback=foo
https://api.kirjastot.fi/v3/organisation/81371?format=jsonp&callback=foo
```

## Tietotyypit
Tähän on listattu rajapinnan tukemat tietotyypit. Kaikille tietotyypeille pätevät yllä mainitut kaksi kutsuvaihtoehtoa.

Tyyppi              | Kuvaus
------------------- | ------
organisation        | Organisaatio eli kirjasto, kirjastoauto, osasto, jne.
library             | Muuten sama kuin 'organisaatio', mutta sisältää vain kirjastojen toimipisteet ja kirjastoautot
city                | Kunta (Helsinki, Kuopio, Rovaniemi, ...)
consortium          | Kirjastokimppa (HelMet, Keski-kirjastot, Vaski-kirjastot, ...)
opening_time        | Kirjastojen aukioloajat
person              | Organisaation henkilökunta
provincial_library  | Maakuntakirjasto-alue
region              | Maakunta-alue (Uusimaa, Pohjois-Savo, Lappi, ...)
service             | Palvelu (esimerkiksi asiakaskäytössä oleva laite, lisäpalvelu tai tila)

## Sisältöjen kielet ja kielikoodit
Kieli       | Koodi
----------- | -----
Suomi       | fi
Englanti    | en
Ruotsi      | sv
Saame       | se
Venäjä      | ru

Sisällöt tuotetaan pääsääntöisesti suomeksi ja aluekohtaisesti ruotsiksi. Kirjastot päättävät itsenäisesti, millä kielillä he tarjoavat tietojaan.

## Yleiset parametrit
Kaikki kutsut tukevat tiettyjä parametreja, joilla voidaan vaikuttaa vastauksen tietotyyppiin ja palautettavien tietojen laajuuteen.

Parametri   | Sallitut arvot        | Kuvaus
----------- | --------------------- | ------
lang        | en, fi, ru, se, sv    | Palautettavan tietueen kieliversio [oletusarvo: kaikki kielet]
format      | xml, json, jsonp      | Vastauksen tietotyyppi [oletusarvo: json]
callback    | _merkkijono_          | Jsonp-formaattia käytettäessä callback-funktion nimi
limit       | _numero_              | Rajoittaa tulosten määrää per sivu [oletusarvo: 50]
skip        | _numero_              | Sivutettujen tulosten aloittaminen n:nnen tietueen kohdalta.
sort        | _lista_               | Tulosjoukon järjestämiseen käytetyt kentät

## Hakuehdot ja järjestäminen
Useita hakuehtoja käytettäessä tulosjoukko sisältää ne tietueet, jotka täsmäävät kaikkiin hakuehtoihin. Mikäli yksittäinen parametri hyväksyy monta arvoa (pilkuilla erotettuna listana), tietueiden tulee täsmätä johonkin kyseisen joukon arvoista. Hakuehdot voi kääntää kielteisiksi lisäämällä parametrin nimen **perään** miinusmerkin. (?city.name-=helsinki)

Hakukyselyiden palauttamien tulosjoukkojen järjestämiseen voi käyttää pääsääntöisesti kaikkien suodinparametrien nimiä. Järjestäminen useamman kuin yhden parametrin avulla on sallittua. Järjestys on oletusarvoisesti pienimmästä suurimpaan, mutta sen voi kääntää ympäri parametrikohtaisesti liittämällä parametrin **eteen** miinusmerkin (?sort=city.name,-name).

Kieliriippuvaisten kenttien mukaan suotiessa ja järjestettäessä käytetään valittua kieltä. Mikäli kieltä ei ole valittu, tulosjoukko sisältää arvot kaikilla kielillä, mutta suotiminen ja järjestäminen tehdään suomenkielisten arvojen perusteella.

# Organisaatiot / kirjastot
Kutsun osoitteen muoto on seuraava:
```
https://api.kirjastot.fi/v3/organisation?parametrit
https://api.kirjastot.fi/v3/library?parametrit
```

Organisaation ja kirjaston (library) välinen ero type-parametrin oletusarvossa. Organisaatio on geneerinen tyyppi, joka kattaa toimipisteiden ohella osastot, kirjastoautojen pysäkit sekä erilaiset metatietueet jne. Library-tyyppi on oikopolku, jolla suoditaan pois muut kuin toimipisteet ja kirjastoautot.

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
--------------- | --- | --- | ------
with            | X |   | Sisällyttää tietueisiin valinnaisia tietolohkoja (ks. listaus alempana)
refs            | X |   | Valittujen alitietueiden palauttaminen osana tulosta
branch_type     | X | X | Kirjaston toimipiste -tyyppisten (branchlibrary) tietueiden alakategoria (ks. listaus alempana)
created.after   |   |   | Hakee tietueet, jotka on luotu myöhemmin kuin määrättynä pvm:nä
created.before  |   |   | Tietueiden viimeinen luonti-pvm
city            | X | X | Kunnan id-tunniste
city.name       | X | X | Kunnan täsmällinen nimi. Haettaessa ruotsin kielellä käytetään ruotsalaista nimeä
city.slug       | X | X | Kunnan nimestä johdettu tunniste
consortium      | X | X | Kirjastokimpan id-tunniste
distance        |   | X | Määrittää koordinaattihaussa sallitun etäisyyden määrätystä pisteestä; arvo kilometreinä (1 = 1 km, 100 = 100 km)
geo             |   |   | Koordinaattiparilla hakeminen (käytetään yhdessä distance-parametrin kanssa) (24.3434,71.1235)
id              | X | X | Parametria voidaan käyttää, kun halutaan hakea monen tunnetun tietueen tiedot yhdellä kertaa
modified.after  |   | X | Hakee tietueet, joita muokattu myöhemmin kuin määrättynä pvm:nä
modified.before |   |   | Tietueiden viimeinen muokkaus-pvm
name            |   | X | Hakee kirjastot, joiden nimi alkaa määrätyllä merkkijonolla. Riippuu valitusta kielestä.
region          | X | X | Maakunta-alueen id-tunniste
region.name     | X | X | Maakunta-alueen täsmällinen nimi. Riippuu valitusta kielestä.
region.slug     | X | X | Maakunta-alueen nimestä johdettu tunniste
period.start    |   |   | Kun sisällytetään aukiolotiedot, voidaan määrittää haettava väli
period.end      |   |   | Kun sisällytetään aukiolotiedot, voidaan määrittää haettava väli
service         | X |   | Organisaatioon liitetyn palvelun id-tunniste
service.name    |   |   | Hakee organisaatiot, joihin on liitetty palvelu, jonka (ei-täsmällinen) nimi alkaa määrätyllä merkkijonolla
service.slug    | X |   | Palvelutietueen nimestä johdettu tunniste
short_name      |   | X | Tietueen nimen mahdollinen lyhyempi muoto. Riippuu valitusta kielestä.
type            | X | X | Tietuiden päätason tyyppi (ks. listaus alempana)

Lisäksi tulokset voi järjestää ehdoilla _modified_ sekä _created_, jotka ilmaisevat muokkaus- ja luontipäivämääriä.

## Organisaatiotyypit (type)
Tunniste            | Tunniste (api-v2)   | Kuvaus
------------------- | ------------------- | ------
library             | branchlibrary       | Kirjaston toimipiste ("kirjasto")
centralized_service | unit                | Keskitetty palvelu
department          | department          | Osasto
facility            | library             | Kirjastolaitos
mobile_stop         | mobile_stop         | Kirjastoauton pysäkki
other               | organisation        | Muu organisaatio

## Toimipisteiden alatyypit (branch_type)
Tunniste            | Tunniste (api-v2)             | Kuvaus
------------------- | ----------------------------- | ------
children            | childrens_library             | Lasten kirjasto
home_service        | home_service                  | Kotipalvelu
institutional       | institution_library           | Laitoskirjasto
library             | default                       | Kirjasto (yleinen kirjaston toimipiste)
main_library        | main_library                  | Pääkirjasto
mobile              | mobile                        | Kirjastoauto
music               | music_library                 | Musiikkikirjasto
other               | other                         | Muu kirjastoalan organisaatio
polytechnic         | polytechnic_library           | Ammattikorkeakoulukirjasto
regional            | regional                      | Aluekirjasto
special             | special_library               | Erikoiskirjasto
university          | university_library            | Yliopistokirjasto
vocational_college  | vocational_college_library    | Ammattioppilaitoskirjasto

## Valinnaiset tiedot (with)
Siirrettävän tiedon optimoimiseksi organisaatiotietueet eivät oletuksena sisällä kaikkia vähemmän tarpeellisia tietolohkoja. Ne voidaan 'aktivoida' antamalla with-parametrille taulukossa esiteltyjä arvoja. Kyseiset arvot vastaavat tietueessa samannimistä kenttää, jonka arvona on joko assosiatiivinen taulukko tai lista.

Tunniste      | Kuvaus
------------- | ------
accessibility | Esteettömyystiedot
extra         | Sekalaisia tietoja, jotka on siirrettävän datan määrän optimoimiseksi siirretty miljoonalaatikkoon
links         | Linkkejä ulkoisiin palveluihin kuten some-palveluihin
mail_address  | Mahdollinen toimipisteen sijainnista poikkeava postiosoite
persons       | Lista organisaation tietueeseen liitetyistä työntekijöistä
phone_numbers | Lista puhelinnumeroista
pictures      | Lista valokuvista
services      | Lista palveluista
schedules     | Aukiolotiedot määrätylle ajanjaksolle. Aikaväli määritetään lisäparametrein period.start ja period.end

## Alitietueet (refs)
Refs-parametrilla voidaan asettaa rajapinta palauttamaan viittaukset muihin tietueisiin osana tulosjoukkoa. Tällöin rajapinta palauttaa nämä alitietueet ryhmiteltynä tyypin perusteella tuloksen ylätasolla kentässä *references*.

Tunniste            | Kuvaus
------------------- | ------
city                | Kunnat, joihin tulosjoukon organisaatiotietueet viittaavat
region              | Maakunnat (kuten yllä)
provincial_library  | Maakuntakirjastoalueet (kuten yllä)
consortium          | Kirjastokimpat (kuten yllä)

## Kuvaustekstin muotoilut
Kirjastojen kuvausteksti (extra.description) on html-muotoiltu merkkijono. Vanhat rajapinnat palauttivat kuvaustekstin plaintext-muodossa, mutta uudessa Kirjastohakemistossa kyseinen kuvaus on muutettu rikastekstiksi. Useimmat kuvaukset voivat kuitenkin vaikuttaa edelleen plaintextiltä. Kuvauksen syöttämiseen käytetään CKEditor-tekstieditoria ja sen oletusmuotoiluja. Teksti voi sisältää linkkejä, listoja ja taulukoita.

## Kuvien koot
Kirjastojen tietueisiin lisätyt kuvat ovat saatavilla valmiiksi muutamassa eri koossa. Pienempiä(kään) kokoja ei ole ns. cropattu mihinkään tiettyyn kuvasuhteeseen vaan alkuperäiset mittasuhteet on säilytetty. Kaikki kuvat on pakattu jpeg-muotoon.

Kokoluokka  | Resoluutio (max)
----------- | ----------------
small       | 100 x 100 px
medium      | 570 x 570 px
large       | 1980 x 1980 px
huge        | 3840 x 3840 px

## Esimerkkejä kyselyistä
Haetaan Oulussa ja Rovaniemellä sijaitsevia kirjastoja. (Kunnan ID-tunniste testiympäristössä.)
```
https://api.kirjastot.fi/v3/library?city=15404,15453
https://api.kirjastot.fi/v3/library?city.name=oulu,rovaniemi
```

Haetaan Uudenmaan ja Pohjois-Savon alueella sijaitsevia kirjastoja. (Maakunnan ID-tunniste testiympäristössä.)
```
https://api.kirjastot.fi/v3/library?region=963,974
https://api.kirjastot.fi/v3/library?region.name=uusimaa,pohjois-savo
```

Haetaan kirjastoja, jotka sijaitsevat 10 km:n säteellä Helsingin rautatieasemalta ja joista löytyy kopiokone.
`https://api.kirjastot.fi/v3/library?geo=60.171142,24.944387&distance=10&service.name=kopiokone`

Kirjastot joilla on palvelut (id-tunnisteet) X ja Y.
`https://api.kirjastot.fi/v3/library?service=X,Y`

Pasilan kirjaston tietue sisältäen aukioloajat marraskuulle 2015.
`https://api.kirjastot.fi/v3/library/81371?with=schedules&period.start=2015-11-01&period.end=2015-11-30`

# Aukiolotiedot
```
https://api.kirjastot.fi/v3/opening_time?parametrit
```

Aukiolotietoja voi hakea erikseen massahakuna. Huomaa, että sivutus pätee myös aikatauluhaussa, joten suurilla aikaväleillä tai kirjastojen määrillä kaikkia tuloksia ei välttämättä näytetä yhdellä kertaa.

Aukioloajat ilmoitetaan päiväkohtaisina tietueina. Yhdellä kyselyllä on mahdollista hakea monen organisaation aukiolotiedot samalla kertaa.

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
--------------- | --- | --- | ------
organisation    | X | X | Organisaation tietueen id-tunniste
period.start    |   |   | Aikavälin ensimmäinen päivä
period.end      |   |   | Aikavälin viimeinen päivä

## Monta aukioloa per päivä
Jotkin kirjastoista voivat olla hetkellisesti suljettuna keskellä päivää, mutta yleisesti ottaen tämä on harvinaista. Tämän vuoksi rajapinnan palauttamissa tietueissa aukiolot ilmoitetaan kahdella eri tavalla.

1. Yksinkertaistettu muoto: aukiolotietueen juuressa kentät **opens** ja **closes**.
2. Täydellinen muoto: lista arvopareja **opens** ja **closes** kentässä **times**.

Molemmat esitysmuodot pätevät kaikissa tilanteissa. Niissä tapauksissa, missä kirjasto on päivän aikana auki pätkittäin, yksinkertaistettu muoto ilmoittaa päivän ensimmäisen aukeamisajan ja viimeisen sulkeutumisajan.

Katso myös seuraavasta kappaleesta lisähuomautus koskien omatoimikirjastojen aukioloja.

## Osastokohtaiset aukiolot
Joillakin toimipisteillä voi olla normaalista poikkeavia aukioloaikoja eri osastoilla, tai kirjastot voivat toimia osan ajasta ns. omatoimikirjastoina, jolloin henkilökunta ei ole paikalla mutta kirjastoon pääsee sisälle esimerkiksi kirjastokortilla tunnistautumalla. Mikäli toimipisteen tietueelle on syötetty tällaisia aukiolotietoja, ne löytyvät päivätietueesta kentästä **sections**, joka on assosiatiivinen taulukko kaikista syötetyistä osastoista.

Osastotiedoissa omatoimikirjasto on erikoistapaus, jota tulisi pitää tavallisten aukioloaikojen laajennuksena. Omatoimikirjaston aukioloajat voivat syöttötavasta riippuen limittyä normaalien aukioloaikojen kanssa, jolloin omatoimikirjaston aukioloiksi tulisi ajatella ne ajanjaksot, jolloin normaalien aukiolotietojen mukaan kirjasto olisi suljettuna.

Valittavissa olevat osastot ovat kaikille kirjastoille samat. Toistaiseksi käytössä ovat seuraavat osastot:

Tunniste      | Kuvaus
------------- | ------
magazines     | Lehtisali
selfservice   | Omatoimikirjasto

## Kirjastoautojen reitit
Kirjastohakemistossa kirjastoautojen pysäkit ovat itsenäisiä organisaatiotietueita. Niiden aukiolotiedot ovat siten haettavissa kuten kaikkien muidenkin organisaatiotietueiden. Useimmiten pysäkkien aukiolot kiinnostavat kuitenkin osana kirjastoauton kulkemaa reittiä. Tämän vuoksi kirjastoauton aukioloaikojen tietueissa on erikoistapauksena kenttä **route**, joka sisältää kyseisen päivän reittiin kuuluvat pysäkit kronologisessa järjestyksessä.

Tämän lisäksi tavallisista toimipisteistä tutut kentät **opens** ja **closes** ilmaisevat päivän ensimmäisen pysäkin saapumisajan ja viimeisen pysäkin lähtöajan. Jos kirjastoauto ei kierrä lainkaan, on päivätietueen **closed**-kentän arvo 'true' ja reittilista tyhjä.

Päiväkohtaiset reittitiedot sisältävät siis vain ne pysäkit, joiden kautta kirjastoauto kyseisenä päivänä kulkee. (Siis pysäkit, jotka ovat auki tuolloin.) Mikäli halutaan selvittää kaikki mahdolliset kirjastoauton kiertämät pysäkit, ne voidaan hakea erillisellä organisaatiokyselyllä määrittämällä parent-parametrin arvoksi kirjastoauton id.

# Palvelutiedot
```
https://api.kirjastot.fi/v3/service?parametrit
https://api.kirjastot.fi/v3/service/<id>
```

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
--------------- | --- | --- | ------
id              | X | X | Parametria voidaan käyttää, kun halutaan hakea monen tunnetun tietueen tiedot yhdellä kertaa
created.after   |   |   | Hakee tietueet, jotka on luotu myöhemmin kuin määrättynä pvm:nä
created.before  |   |   | Viimeinen luonti-pvm
modified.after  |   |   | Hakee tietueet, joita muokattu myöhemmin kuin määrättynä pvm:nä
modified.before |   |   | Viimeinen muokkaus-pvm
name            |   | X | Hakee tietueet, joiden nimi alkaa määrätyllä merkkijonolla. Arvo riippuu kielestä.
type            | X | X | Palvelun tyypin tunnisteella suotiminen

# Henkilökunta
```
https://api.kirjastot.fi/v3/person?parametrit
https://api.kirjastot.fi/v3/person/<id>
```
Henkilökuntatietojen kattavuus on vaihtelevaa. Pääsääntöisesti on toivottavaa, että vähintään avainhenkilöiden tiedot olisi syötetty.

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
----------------| --- | --- | ------
id              | X | X | Voi käyttää tunnettujen henkilötietueiden hakemiseen yhdellä kyselyllä
first_name      |   | X | Etunimihaku
last_name       |   | X | Sukunimihaku
name            |   |   | Koko nimellä hakeminen
organisation    | X | X | Sen organisaation id, johon henkilöt liitetty

# Kunnat
```
https://api.kirjastot.fi/v3/city?parametrit
https://api.kirjastot.fi/v3/city/<id>
```

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri           | M | S | Kuvaus
------------------- | --- | --- | ------
id                  | X | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | X | Hakee kunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
consortium          | X | X | Kirjastokimpan id-tunniste
region              | X | X | Maakunnan id-tunniste
provincial_library  | X | X | Maakuntakirjastoalueen id-tunniste

# Maakunnat
```
https://api.kirjastot.fi/v3/region?parametrit
https://api.kirjastot.fi/v3/region/<id>
```

M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri           | M | S | Kuvaus
------------------- | --- | --- | ------
id                  | X | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | X | Hakee maakunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
