
// node ../../node_modules/requirejs/bin/r.js -o build.js

({
  "baseUrl": "./",
  "dir": "../build",
  "modules": [
    {
      "name": "navigen",
      "include": [
        "requirejs/require",
      ],
    }
  ],
  "shim": {
    "samufw/view": ["handlebars"],
  },
  "paths": {
    "handlebars": "handlebars/handlebars-v4.0.2",
  },
  "packages": [
    {
      "name": "samufw",
      "location": "samufw/src"
    }
  ],
})
