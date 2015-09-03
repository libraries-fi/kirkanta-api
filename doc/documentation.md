Kirjastohakemiston rajapinta v3
===============================

Päiväys       | Rajapinnan versio | Muutoksen kuvaus
------------- | ----------------- | ----------------
03.09.2015    | 3.0               | Ensimmäinen julkaisu

# Johdanto
Kirjastot.fi tarjoaa ilmaisen ja julkisen rajapinnan Kirjastohakemiston tietojen käyttöön kolmannen osapuolen sovelluksissa. Kirjastohakemisto sisältää yleisten kirjastojen, kirjastoautojen sekä oppilaitos- ja muiden erikoiskirjastojen esittelyt ja yhteistiedot. Kirjastohakemiston julkisivu sijaitsee osoitteessa http://hakemisto.kirjastot.fi.

**HUOM**
 Testivaiheen aikana rajapinta (3.0) käyttää tuotantoversiosta erillistä tietokantaa, jonka tietoja ei yleisesti ottaen päivitetä. Lisäksi tietueiden tunnisteet tulevat vielä muuttumaan, kun rajapinta ja Kirjastohakemiston uusi ylläpito otetaan tuotantokäyttöön syyskuun lopulla.

# Rajapinnan kuvaus
Rajapinnan kolmas versio korvaa kaikki aiemmat versiot, jotka on tarkoitus sulkea pysyvästi vuoden 2016 alkupuolella. Rajapinta noudattaa rest-periaatetta ja sitä käytetään tavallisilla _http-pyynnöillä_. Tuetut tietomuodot ovat xml, json sekä jsonp.

Kirjastohakemiston rajapinnan käyttö on maksutonta eikä vaadi erityistä lupaa, mutta käyttöön on otettu käyttöoikeusavaimet käyttäjien yksilöimiseksi tilastointia varten. Avaimia voi hankkia rekisteröitymällä osoitteessa http://kirkanta.kirjastot.fi/apikey. (**HUOM** Testivaiheessa osoite on http://kirkantadev.kirjastot.fi/apikey!)

Avaimia käytetään tilastoinnillisiin tarkoituksiin, joten tarkoitus ei ole ollut tuottaa vahvaa autentikointia. Olisi hyvä luoda uusi avain per uusi "projekti", mutta mitään ehdotonta sääntöä ei tämän osalta ole.

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
Kutsuissa käytettävät polut myötäilevät rest-filosofiaa. Polku sisältää haettavan resurssin tyypin sekä mahdollisen id-tunnisteen. Muut parametrit määritetään pyyntöosoitteen _query string_ -osassa.

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

## Yleiset parametrit
Kaikki kutsut tukevat tiettyjä parametreja, joilla voidaan vaikuttaa vastauksen tietotyyppiin ja palautettavien tietojen laajuuteen.

Parametri   | Sallitut arvot    | Kuvaus
----------- | ----------------- | ------
apikey      | _merkkijono_      | Rajapinnan käyttämiseen vaadittu yksityinen avain
lang        | fi, sv, se, en    | Palautettavan tietueen kieliversio [oletusarvo: kaikki kielet]
format      | xml, json, jsonp  | Vastauksen tietotyyppi [oletusarvo: json]
callback    | _merkkijono_      | Jsonp-formaattia käytettäessä callback-funktion nimi
limit       | _numero_          | Rajoittaa tulosten määrää per sivu [oletusarvo: 50]
start       | _numero_          | Sivutettujen tulosten aloittaminen n:nnen tietueen kohdalta.

## Tietotyypit
Tähän on listattu rajapinnan tukemat tietotyypit. Kaikille tietotyypeille pätevät yllä mainitut kaksi kutsuvaihtoehtoa.

Tyyppi       | Kuvaus
-------------| ------
organisation | Organisaatio eli kirjasto, kirjastoauto, osasto, jne.
library      | Muuten sama kuin 'organisaatio', mutta sisältää vain kirjastojen toimipisteet ja kirjastoautot
city         | Kunta (Helsinki, Kuopio, Rovaniemi, ...)
consortium   | Kirjastokimppa (HelMet, Keski-kirjastot, Vaski-kirjastot, ...)
opening_time | Kirjastojen aukioloajat
person       | Organisaation henkilökunta
region       | Maakunta-alue (Uusimaa, Pohjois-Savo, Lappi, ...)
service      | Palvelu (esimerkiksi asiakaskäytössä oleva laite, lisäpalvelu tai tila)

## Sisältöjen kielet ja kielikoodit
Kieli       | Koodi
----------- | -----
Suomi       | fi
Englanti    | en
Ruotsi      | sv
Saame       | se
Venäjä      | ru

## Organisaatioiden ja kirjastojen hakeminen
Kutsun osoitteen muoto on seuraava:
    `http://api.kirjastot.fi/v3/organisation?parametrit`
    `http://api.kirjastot.fi/v3/library?parametrit`

Organisaation ja kirjaston (library) välinen ero type-parametrin oletusarvossa. Organisaatioita haettaessa haetaan oletuksena kaikista organisaatiotietueita, mutta library-tyypillä suoditaan pois muut kuin kirjastojen toimipisteet ja kirjastoautot. Tarkoituksena on kätevöittää toimipisteiden hakemista pudottamalla pois yksi ylimääräinen, alati toistuva parametri kyselyistä.

### Sallitut parametrit
M := hyväksyy monta valintaa kerralla pilkuin erotettuna listana (foo,bar,baz)

Parametri       | M | Kuvaus
--------------- | - | ------
with            | X | Valinnaisia tietolohkoja, joita ei siirrettävän tiedon optimoimiseksi sisällytetä oletuksena (ks. listaus alempana)
sort            |   | Lajitteluun käytetty kenttä; distance, name
branch_type     | X | Kirjaston toimipiste -tyyppisten (branchlibrary) tietueiden alakategoria ("millainen toimipiste?") (ks. listaus alempana)
city            | X | Kunnan id-tunniste
city.name       | X | Kunnan täsmällinen nimi. Haettaessa ruotsin kielellä käytetään ruotsalaista nimeä.
consortium      | X | Kirjastokimpan id-tunniste
distance        |   | Määrittää koordinaattihaussa sallitun etäisyyden määrätystä pisteestä; arvo kilometreinä (1 = 1 km, 100 = 100 km)
geo             |   | Koordinaattiparilla hakeminen (käytetään yhdessä distance-parametrin kanssa) (24.3434,71.1235)
id              | X | Parametria voidaan käyttää, kun halutaan hakea monen tunnetun tietueen tiedot yhdellä kertaa
modified        |   | Hakee tietueet, joita muokattu myöhemmin kuin määrättynä pvm:nä
name            |   | Hakee kirjastot, joiden nimi alkaa määrätyllä merkkijonolla. Riippuu valitusta kielestä.
region          | X | Maakunta-alueen id-tunniste
region.name     | X | Maakunta-alueen täsmällinen nimi. Riippuu valitusta kielestä.
period.start    |   | Kun sisällytetään aukiolotiedot, voidaan määrittää haettava väli
period.end      |   | Kun sisällytetään aukiolotiedot, voidaan määrittää haettava väli
service         | X | Organisaatioon liitetyn palvelun id-tunniste
service.name    |   | Hakee organisaatiot, joihin on liitetty palvelu, jonka (ei-täsmällinen) nimi alkaa määrätyllä merkkijonolla
type            | X | Tietuiden päätason tyyppi (ks. listaus alempana)

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
schedules     | Aukiolotiedot määrätylle ajanjaksolle. Aikaväli määritetään lisäparametrein schedules.start ja schedules.end

#### Organisaatiotietueiden tyypit
Tunniste        | Kuvaus
--------------- | ------
branchlibrary   | Kirjaston toimipiste ("kirjasto")
department      | Osasto
library         | Kirjastolaitos
mobile_stop     | Kirjastoauton pysäkki
organisation    | Muu organisaatio
unit            | Keskitetty palvelu

#### Kirjaston toimipisteiden alakategoriat
Tunniste | Kuvaus
-------- | ------
childrens_library | Lasten kirjasto
default | Kirjasto (yleinen kirjaston toimipiste)
home_service | Kotipalvelu
institution_library | Laitoskirjasto
main_library | Pääkirjasto
mobile | Kirjastoauto
music_library | Musiikkikirjasto
other | Muu kirjastoalan organisaatio
polytechnic_library | Ammattikorkeakoulukirjasto
regional | Aluekirjasto
special_library | Erikoiskirjasto
university_library | Yliopistokirjasto
vocational_college_library | Ammattioppilaitoskirjasto

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

Parametri    | M | Kuvaus
------------ | - | ------
id           | X | Parametria voidaan käyttää, kun halutaan hakea monen tunnetun tietueen tiedot yhdellä kertaa
modified     |   | Hakee tietueet, joita muokattu myöhemmin kuin määrättynä pvm:nä
name         |   | Hakee tietueet, joiden nimi alkaa määrätyllä merkkijonolla
type         | X | Palvelun tyypin tunnisteella suotiminen

## Kirjastojen aukioloaikojen hakeminen
Aukiolotietoja voi hakea erikseen massahakuna. Huomaa, että sivutus pätee myös aikatauluhaussa, joten suurilla aikaväleillä tai kirjastojen määrillä kaikkia tuloksia ei välttämättä näytetä yhdellä kertaa.

Parametri       | M | Kuvaus
--------------- | - | ------
organisation    | X | Organisaation tietueen id-tunniste
period.start    |   | Aikavälin ensimmäinen päivä
period.end      |   | Aikavälin viimeinen päivä

## Organisaatioon liitettyjen henkilöiden hakeminen
Parametri           | M | Kuvaus
----------------| - | ------
id              | X | Voi käyttää tunnettujen henkilötietueiden hakemiseen yhdellä kyselyllä
first_name      |   | Etunimihaku
last_name       |   | Sukunimihaku
name            |   | Yhdistetty nimihaku
organisation    | X | Sen organisaation id, johon henkilöt liitetty

## Kuntien listaaminen
Parametri           | M | Kuvaus
------------------- | - | ------
id                  | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | Hakee kunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
consortium          | X | Kirjastokimpan id-tunniste
region              | X | Maakunnan id-tunniste
provincial_library  | X | Maakuntakirjastoalueen id-tunniste

## Maakuntien listaaminen
Parametri           | M | Kuvaus
------------------- | - | ------
id                  | X | Voi käyttää tunnettujen kuntien tietueiden hakemiseen yhdellä kyselyllä
name                |   | Hakee maakunnat, joiden nimi alkaa määrätyllä merkkijonolla (kieliriippuvainen)
