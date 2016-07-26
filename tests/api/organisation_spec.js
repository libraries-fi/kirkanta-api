"use strict";

let frisby = require("frisby");
let config = require("../config");

frisby.create("Fetch organisations (json)")
  .get(config.api.url + "/organisation.json")
  .expectStatus(200)
  .expectHeaderContains("content-type", "application/json")
  .expectJSON({
    type: "organisation"
  })
  .expectJSONTypes("items.0", {
    id: Number,
    name: {
      fi: String
    },
  })
  .toss();

frisby.create("Fetch organisations (xml)")
  .get(config.api.url + "/organisation.xml")
  .expectStatus(200)
  .expectHeaderContains("content-type", "application/xml")
  .toss();

