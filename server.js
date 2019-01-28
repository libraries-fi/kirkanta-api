const express = require('express');
const { searcher } = require('./lib/searcher');

const app = express();
const config = require('./config');
const encoders = require('./lib/encoders');
const { stringToTerms } = require('./lib/filters');

app.set('env', config.debug ? 'development' : 'production');

function extractOptions(query) {
  const options = {
    langcode: query.lang || config.fallbackLanguage,
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
    res.set('Cache-Control', `public, max-age=${config.cache}`);
  }

  next();
})

app.get('/v4/schedules/:foo', function(req, res) {
  const id = req.params.foo;
  res.status(404).send(`This endpoint does not exist. Maybe try /v4/schedules?library=${id} instead?`);
});

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
      res.status(500).send(config.debug ? err.stack : err.message);
    }
  });

  app.get(`/v4/${type}/:id`, async (req, res, next) => {
    try {
      const options = extractOptions(req.query);
      options.limit = 1;

      const encode_options = {
        pretty: 'pretty' in req.query,
      };

      let field = parseInt(req.params.id) ? 'id' : 'slug';
      const values = {[field]: req.params.id};

      switch (type) {
        case 'library':
        case 'service_point':
          if ('status' in req.query) {
            /**
             * NOTE: For consistency we don't want to allow FILTERING by status,
             * but simply include calculated liveStatus value.
             */
            values.status = '';
          }
      }

      let result = await searcher.search(type, values, options);
      let [content_type, encode] = get_encoder(req);

      result.data = result.items[0];
      delete result.items;

      if (result.data) {
        res.type(content_type);
        res.send(encode(result, options.langcode, encode_options));
      } else {
        res.status(400).send(`Requested ${type} was not found (${field}=${req.params.id})`);
      }

    } catch (err) {
      res.status(500).send(config.debug ? err.stack : err.message);
    }
  });
}


const cluster = require('cluster');
const cpuCount = require('os').cpus().length;

if (cluster.isMaster) {
  console.log('Server started');
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
} else {
  const port = config.server.port;
  const addr = config.server.address;

  app.listen(port, addr, () => {
    console.log(`Worker ${process.pid} is up`);
  });
}
