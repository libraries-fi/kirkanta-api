KIRKANTA-API
============

REST interface for accessing public data from [Kirjastohakemisto](https://hakemisto.kirjastot.fi),
the Finnish Library Database. This app is not very usable alone, as it depends on the database of
[kirkanta](https://github.com/libraries-fi/kirkanta), the administrator interface.

This branch is a development branch for the next major release. Schema-wise there are not many changes,
but internally we've ditched the hybrid Elasticsearch-PostgreSQL approach and instead went full-on with
the latter.

## Deployment
Install dependencies using *npm install* and run the app with *npm start*.

## Progress
Missing features:
- Results in XML format.

## Kirkanta repository family
- [Kirjastohakemisto](https://github.com/libraries-fi/kirjastohakemisto) -- frontend
- [Kirkanta](https://github.com/libraries-fi/kirkanta) -- backend
- [Kirkanta API](https://github.com/libraries-fi/kirkanta-api) -- REST API
- [Kirkanta Widgets](https://github.com/libraries-fi/kirkanta-embed) -- Build embeddable widgets
