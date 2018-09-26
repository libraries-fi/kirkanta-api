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

for (let type of searcher.supportedTypes) {
  app.get(`/v4/${type}`, (req, res, next) => {
    const options = extractOptions(req.query);

    const encode_options = {
      pretty: 'pretty' in req.query
    };

    let { pretty, ...values } = req.query;

    searcher.search(type, values, options).then((result) => {
      let [content_type, encode] = get_encoder(req);

      res.type(content_type);
      res.send(encode(result, options.langcode, encode_options));
    });
  });

  app.get(`/v4/${type}/:id`, (req, res, next) => {
    const options = extractOptions(req.query);

    const encode_options = {
      pretty: 'pretty' in req.query
    };

    searcher.fetch(type, req.params.id, options).then((data) => {
      let [content_type, encode] = get_encoder(req);

      res.type(content_type);
      res.send(encode({type, data}, options.langcode, encode_options));
    });
  });
}

const port = config.server.port;
const addr = config.server.address;

app.listen(port, addr, () => {
  console.log('Server started');
});
