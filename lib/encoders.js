
var ResultEncoder = function() {

};

ResultEncoder.prototype = {
  compactLanguage: function(lang) {

  },
  encode: function(result) {

  }
};

var JsonEncoder = function() {
  ResultEncoder.apply(this);
};

JsonEncoder.prototype = Object.create(ResultEncoder.prototype);
JsonEncoder.prototype.encode = function(result) {
  return JSON.stringify(result, null, 2);
};

var XmlEncoder = function() {
  ResultEncoder.apply(this);
};

XmlEncoder.prototype = Object.create(ResultEncoder.prototype);
XmlEncoder.prototype.encodeItem = function(item) {
  return "<item>foobar</item>";
};

exports.selectEncoder = function(req, res, next) {
  var type = req.accepts(["json", "xml"]);

  if (req.query.format) {
    type = req.query.format;
  }

  switch (type) {
    case "jsonp":
      res.locals.callback = req.query.callback;

    case "json":
      res.locals.encoder = new JsonEncoder;
      break;

    case "xml":
      res.locals.encoder = new XmlEncoder;
      break;

    default:
      throw new Error("Only JSON and XML supported");
  }

  res.type(type);
  next();
};

exports.encodeResponse = function(req, res, next) {
  res.locals.data = res.locals.encoder.encode(res.locals.result);
  next();
};
