Kirkanta API v4
===============

Date        | API version     | Summary of changes
----------- | --------------- | ------------------
2018-08-27  | 4.0.0-preview   | Published a preview version.

## Introduction
Kirjastot.fi offers a free and public API for accessing data of all Finnish libraries. The library
database consists of municipal libraries as well as mobile libraries and faculty libraries of
universities and other educational organisations.

## Terms of Use
Use of the API is free of charge. There are no usage limits regarding querying the servers, but we
reserve the right to block any clients deemed to be generating unnecessarily excessive loads.

## Endpoints
### Standard endpoints

Endpoint        | Description
--------------- | -----------
/library        | Libraries including mobile libraries.
/consortiums    | Library consortiums
/services       | Service data

### Non-library extensions
These extensions have been created to allow for better integration with Finna.fi.

Endpoint            | Description
------------------- | -----------
/service_point      | Libraries and non-library service points.
/finna_organisation | Extended version of `consortium`, provides additional Finna-specific data.


## Libraries

### Types of libraries

Identifier          | Description
------------------- | ------
children            | Children's library
home_service        | A home service library
institutional       | Institutional library
library             | Kirjasto (yleinen kirjaston toimipiste)
main_library        | Pääkirjasto
mobile              | Kirjastoauto
music               | Musiikkikirjasto
other               | Muu kirjastoalan organisaatio
polytechnic         | Ammattikorkeakoulukirjasto
regional            | Aluekirjasto
school              | Koulukirjasto
special             | Erikoiskirjasto
university          | Yliopistokirjasto
vocational_college  | Ammattioppilaitoskirjasto

### Other service points
Non-library service points can be queried for using endpoint `/service_point`. The endpoint shares
the parameters that of `/library`, **however**, non-library service points do not contain any information
about staff nor their services. The distinction between service point types is made by property `type`.

#### Service point types
Type    | Description
------- | -----------
archive | Archive
museum  | Museum
other   | Unspecified type
