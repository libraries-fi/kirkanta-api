Kirjastohakemiston rajapinta v3
===============================

Päiväys       | Rajapinnan versio | Muutoksen kuvaus
------------- | ----------------- | ----------------
03.09.2015    | 3.0 (beta)        | Ensimmäinen julkaisu
02.10.2015    | 3.0 (beta)        | Päivitetty dokumentaatio

Kirjastotietueiden type- ja branch_type-kenttien arvot ovat muuttuneet 02.10.2015.

Vanhat dokumentaatiot: [API V2](/v2-doc.html), [API V1](/v1-doc.html)

# Johdanto
Kirjastot.fi tarjoaa ilmaisen ja julkisen rajapinnan Kirjastohakemiston tietojen käyttöön kolmannen osapuolen sovelluksissa. Kirjastohakemisto sisältää yleisten kirjastojen, kirjastoautojen sekä oppilaitos- ja muiden erikoiskirjastojen esittelyt ja yhteistiedot. Kirjastohakemiston julkisivu sijaitsee osoitteessa http://hakemisto.kirjastot.fi.

Teknisissä ongelmissa voi olla yhteydessä Kirjastot.fi'n tekniikkatiimiin: tekniikka@kirjastot.fi.
Sisältöjä koskevista virheistä voi ilmoittaa osoitteeseen toimitus2@kirjastot.fi.

**HUOM**
 Testivaiheen aikana rajapinta (3.0) käyttää tuotantoversiosta erillistä tietokantaa, jonka tietoja ei yleisesti ottaen päivitetä. Lisäksi tietueiden tunnisteet tulevat vielä muuttumaan, kun rajapinta ja Kirjastohakemiston uusi ylläpito otetaan tuotantokäyttöön lokakuun aikana.

# Rajapinnan kuvaus
Rajapinnan kolmas versio korvaa kaikki aiemmat versiot, jotka on tarkoitus sulkea pysyvästi vuoden 2016 alkupuolella. Rajapinta noudattaa rest-periaatetta ja sitä käytetään tavallisilla _http-pyynnöillä_. Tuetut tietomuodot ovat xml, json sekä jsonp.

## Tietojen muoto
Rajapinta tukee xml-, json- ja jsonp-formaatteja. Xml-dokumenttien yhteydessä ei ainakaan toistaiseksi käytetään skeemaa rakenteen validoimiseksi. Käytetty merkistö on utf-8.

Asiakasohjelma voi määrittää vastauksen tietotyypin joko http-protokollan mukaisella _Accept_-otsakkeella, jonka voi ylikirjoittaa get-parametrilla _format_. Mikäli otsikkotiedoissa määritellään useampi tyyppi, valitaan http-standardin mukaisesti korkeimman prioriteetin omaava tyyppi.

Tietotyyppi | Accept-otsikko (mime)     | Format-parametri
----------- | ------------------------- | ----------------
XML         | application/xml           | xml
JSON        | application/json          | json
JSONP       | application/javascript    | jsonp

Jsonp-muotoa käyttäessä täytyy myös määrittää ns. callback-funktion nimi get-parametrilla _callback_.

# Rajapinnan kutsut
Kutsuissa käytettävät polut myötäilevät rest-filosofiaa. Polku sisältää haettavan resurssin tyypin sekä mahdollisen id-tunnisteen. Muut parametrit määritetään pyyntöosoitteen _query string_ -osassa. Suodinehdot on mahdollista muuttaa kieltäviksi eli not-muotoisiksi lisäämällä parametrin nimen perään miinusmerkki. Useita parametreja käytettäessä tulosjoukkoon sisältyvät ne tietueet, jotka täsmäävät kaikkiin hakuehtoihin.

Kutsujen muoto on seuraavanlainen:
```
http://api.kirjastot.fi/v3/:resurssi?parametrit
http://api.kirjastot.fi/v3/:resurssi/:id?parametrit
```

**Esimerkkejä**
```
http://api.kirjastot.fi/v3/organisation?name=pasila&format=jsonp&callback=foo
http://api.kirjastot.fi/v3/organisation/23423?format=jsonp&callback=foo
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
start       | _numero_              | Sivutettujen tulosten aloittaminen n:nnen tietueen kohdalta.
sort        | _lista_               | Tulosjoukon järjestämiseen käytetyt kentät

## Tulosjoukkojen järjestäminen ja suotiminen
Useita hakuehtoja käytettäessä tulosjoukko sisältää ne tietueet, jotka täsmäävät kaikkiin hakuehtoihin. Mikäli yksittäinen parametri hyväksyy monta arvoa (pilkuilla erotettuna listana), tietueiden tulee täsmätä johonkin kyseisen joukon arvoista. Hakuehdot voi kääntää kielteisiksi lisäämällä parametrin nimen **perään** miinusmerkin. (?city.name-=helsinki)

Hakukyselyiden palauttamien tulosjoukkojen järjestämiseen voi käyttää pääsääntöisesti kaikkien suodinparametrien nimiä. Järjestäminen useamman kuin yhden parametrin avulla on sallittua. Järjestys on oletusarvoisesti pienimmästä suurimpaan, mutta sen voi kääntää ympäri parametrikohtaisesti liittämällä parametrin **eteen** miinusmerkin (?sort=city.name,-name).

Kieliriippuvaisten kenttien mukaan suotiessa ja järjestettäessä käytetään valittua kieltä. Mikäli kieltä ei ole valittu, tulosjoukko sisältää arvot kaikilla kielillä, mutta suotiminen ja järjestäminen tehdään suomenkielisten arvojen perusteella.

## Organisaatioiden ja kirjastojen hakeminen
Kutsun osoitteen muoto on seuraava:
    `http://api.kirjastot.fi/v3/organisation?parametrit`
    `http://api.kirjastot.fi/v3/library?parametrit`

Organisaation ja kirjaston (library) välinen ero type-parametrin oletusarvossa. Organisaatioita haettaessa haetaan oletuksena kaikista organisaatiotietueita, mutta library-tyypillä suoditaan pois muut kuin kirjastojen toimipisteet ja kirjastoautot. Tarkoituksena on kätevöittää toimipisteiden hakemista pudottamalla pois yksi ylimääräinen, alati toistuva parametri kyselyistä.

### Sallitut parametrit
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
--------------- | - | - | ------
with            | X |   | Valinnaisia tietolohkoja, joita ei siirrettävän tiedon optimoimiseksi sisällytetä oletuksena (ks. listaus alempana)
branch_type     | X | X | Kirjaston toimipiste -tyyppisten (branchlibrary) tietueiden alakategoria ("millainen toimipiste?") (ks. listaus alempana)
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

#### Valinnaisten lohkojen kuvaus (with-parametrin arvot)
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

#### Organisaatiotietueiden tyypit
Tunniste            | Tunniste (api-v2)   | Kuvaus
------------------- | ------------------- | ------
library             | branchlibrary       | Kirjaston toimipiste ("kirjasto")
centralized_service | unit                | Keskitetty palvelu
department          | department          | Osasto
facility            | library             | Kirjastolaitos
mobile_stop         | mobile_stop         | Kirjastoauton pysäkki
other               | organisation        | Muu organisaatio

#### Kirjaston toimipisteiden alakategoriat
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

#### Kirjastojen kuvausteksti
Kirjastojen kuvausteksti (extra.description) on html-muotoiltu merkkijono. Vanhat rajapinnat palauttivat kuvaustekstin plaintext-muodossa, mutta uudessa Kirjastohakemistossa kyseinen kuvaus on muutettu rikastekstiksi. Useimmat kuvaukset voivat kuitenkin vaikuttaa edelleen plaintextiltä. Kuvauksen syöttämiseen käytetään CKEditor-tekstieditoria ja sen oletusmuotoiluja. Teksti voi sisältää linkkejä, listoja ja taulukoita.

#### Kuvien koot
Kirjastojen tietueisiin lisätyt kuvat ovat saatavilla valmiiksi muutamassa eri koossa. Pienempiä(kään) kokoja ei ole ns. cropattu mihinkään tiettyyn kuvasuhteeseen vaan alkuperäiset mittasuhteet on säilytetty. Kaikki kuvat on pakattu jpeg-muotoon.

Kokoluokka  | Resoluutio (max)
----------- | ----------------
small       | 100 x 100 px
medium      | 570 x 570 px
large       | 1980 x 1980 px
huge        | 3840 x 3840 px

### Esimerkkejä kyselyistä
Haetaan Oulussa ja Rovaniemellä sijaitsevia kirjastoja (kunnan ID-tunniste testiympäristössä)
    `http://api.kirjastot.fi/v3/library?city=14453,14502`
    `http://api.kirjastot.fi/v3/library?city.name=oulu,rovaniemi`

Haetaan Uudenmaan ja Pohjois-Savon alueella sijaitsevia kirjastoja (maakunnan ID-tunniste testiympäristössä)
    `http://api.kirjastot.fi/v3/library?region=906,917`
    `http://api.kirjastot.fi/v3/library?region.name=uusimaa,pohjois-savo`

Haetaan kirjastoja, jotka sijaitsevat 10 km:n säteellä Helsingin rautatieasemalta ja joista löytyy kopiokone
    `http://api.kirjastot.fi/v3/library?geo=60.171142,24.944387&distance=10&service.name=kopiokone`

Kirjastot joilla on palvelut X ja Y (id-tunnisteet)
    `http://api.kirjastot.fi/v3/library?service=X,Y`

Pasilan kirjaston tietue sisältäen aukioloajat syyskuulle 2015.
    `http://api.kirjastot.fi/v3/library/71895?with=schedules&period.start=2015-09-01&period.end=2015-09-30`

## Palveluiden hakeminen
Kutsun osoitteen muoto on seuraava:
    `http://api.kirjastot.fi/v3/service?parametrit`

### Sallitut parametrit
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
--------------- | - | - | ------
id              | X | X | Parametria voidaan käyttää, kun halutaan hakea monen tunnetun tietueen tiedot yhdellä kertaa
created.after   |   |   | Hakee tietueet, jotka on luotu myöhemmin kuin määrättynä pvm:nä
created.before  |   |   | Viimeinen luonti-pvm
modified.after  |   |   | Hakee tietueet, joita muokattu myöhemmin kuin määrättynä pvm:nä
modified.before |   |   | Viimeinen muokkaus-pvm
name            |   | X | Hakee tietueet, joiden nimi alkaa määrätyllä merkkijonolla. Arvo riippuu kielestä.
type            | X | X | Palvelun tyypin tunnisteella suotiminen

## Kirjastojen aukioloaikojen hakeminen
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Aukiolotietoja voi hakea erikseen massahakuna. Huomaa, että sivutus pätee myös aikatauluhaussa, joten suurilla aikaväleillä tai kirjastojen määrillä kaikkia tuloksia ei välttämättä näytetä yhdellä kertaa.

Parametri       | M | S | Kuvaus
--------------- | - | - | ------
organisation    | X | X | Organisaation tietueen id-tunniste
period.start    |   |   | Aikavälin ensimmäinen päivä
period.end      |   |   | Aikavälin viimeinen päivä

## Organisaatioon liitettyjen henkilöiden hakeminen
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri       | M | S | Kuvaus
----------------| - | - | ------
id              | X | X | Voi käyttää tunnettujen henkilötietueiden hakemiseen yhdellä kyselyllä
first_name      |   | X | Etunimihaku
last_name       |   | X | Sukunimihaku
name            |   |   | Yhdistetty nimihaku
organisation    | X | X | Sen organisaation id, johon henkilöt liitetty

## Kuntien listaaminen
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri           | M | S | Kuvaus
------------------- | - | - | ------
id                  | X | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | X | Hakee kunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
consortium          | X | X | Kirjastokimpan id-tunniste
region              | X | X | Maakunnan id-tunniste
provincial_library  | X | X | Maakuntakirjastoalueen id-tunniste

## Maakuntien listaaminen
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)
S := kenttää voi käyttää järjestämiseen sort-parametrin arvona

Parametri           | M | S | Kuvaus
------------------- | - | - | ------
id                  | X | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | X | Hakee maakunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
