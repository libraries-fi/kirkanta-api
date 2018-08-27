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
The API can be used free of charge and without authentication. There are no usage limits per se,
but we reserve the right to block any clients deemed to be generating excessive amounts of
*dumb queries*.

## Endpoints
### Standard endpoints

Endpoint        | Description
--------------- | -----------
/library        | Libraries including mobile libraries.
/consortiums    | Library consortiums.
/services       | Common service data.

### Non-library extensions
These extensions have been created to allow for better integration with Finna.fi.

Endpoint            | Description
------------------- | -----------
/service_point      | Libraries and non-library service points.
/finna_organisation | Extended version of `consortium`, provides additional Finna-specific data.

## Libraries
```
https://api.kirjastot.fi/v4/library?
https://api.kirjastot.fi/v4/library/<id>
```

### Types of libraries

Identifier          | Description
------------------- | ------
library             | Regular municipal library
mobile              | Mobile library (a car)
--                  | --
children            | Children's library
home_service        | A home service library
institutional       | Institutional library
main_library        | Main library
music               | Music library
special             | Special library
--                  | --
polytechnic         | Polytechnic library
school              | Primary school library
university          | University library
vocational_college  | Vocational college library

### Other service points
```
https://api.kirjastot.fi/v4/service_point
https://api.kirjastot.fi/v4/service_point/<id>
```

All service points (including libraries) can be queried using endpoint `/service_point`. This
endpoint shares the parameters of `/library`, **however**, non-library service points do not contain
service nor staff data. Here the parameter `type` has additional possible values.

#### Service point types
Type    | Description
------- | -----------
archive | Archive
museum  | Museum
other   | Unspecified type

## Library consortiums
```
https://api.kirjastot.fi/v4/consortium?
https://api.kirjastot.fi/v4/consortium/<id>
```

### Consortiums as Finna organisations
```
https://api.kirjastot.fi/v4/finna_organisation?
https://api.kirjastot.fi/v4/finna_organisation/<id>
```

This endpoint returns consortiums as well as consortium-like documents that are special to Finna.fi.
In addition, each document contains extra fields. The endpoint accepts same parameters as `consortium`.
