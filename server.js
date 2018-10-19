const express = require('express');
const { searcher } = require('./lib/searcher');

const app = express();
const config = require('./config');
const encoders = require('./lib/encoders');
const { stringToTerms } = require('./lib/filters');

app.set('env', config.debug ? 'development' : 'production');

function extractOptions(query) {
  const options = {
    langcode: query.lang,
    limit: query.limit,
    skip: query.skip || 0,
    sort: stringToTerms(query.sort),
    with: stringToTerms(query.with),
    refs: stringToTerms(query.refs),
  };

  delete query.lang;
  delete query.limit;
  delete query.skip;
  delete query.sort;
  delete query.with;
  delete query.refs;

  return options;
}

function get_encoder(req) {
  const class_map = new Map([
    ['json', encoders.json],
    ['xml', encoders.xml],
  ]);

  if (class_map.has(req.query.format)) {
    return [req.query.format, class_map.get(req.query.format)];
  }

  for (let [type, callback] of class_map) {
    if (req.accepts(type)) {
      return [type, callback];
    }
  }
}

app.get('*', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
})

app.get('*', (req, res, next) => {
  if (!Number.isNaN(config.cache)) {
    // console.log('EXPIRE', expires, config.cache);
    res.set('Cache-Control', `public, max-age=${config.cache}`);
  }

  next();
})

for (let type of searcher.supportedTypes) {
  app.get(`/v4/${type}`, async (req, res, next) => {
    try {
      const options = extractOptions(req.query);

      const encode_options = {
        pretty: 'pretty' in req.query
      };

      let { pretty, ...values } = req.query;

      let result = await searcher.search(type, values, options);
      let [content_type, encode] = get_encoder(req);

      res.type(content_type);
      res.send(encode(result, options.langcode, encode_options));
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  app.get(`/v4/${type}/:id`, async (req, res, next) => {
    try {
      const options = extractOptions(req.query);

      const encode_options = {
        pretty: 'pretty' in req.query
      };

      let data = await searcher.fetch(type, req.params.id, options);
      let [content_type, encode] = get_encoder(req);

      res.type(content_type);
      res.send(encode({type, data}, options.langcode, encode_options));
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
}

const port = config.server.port;
const addr = config.server.address;

app.listen(port, addr, () => {
  console.log('Server started');
});
