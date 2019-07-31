#!/usr/bin/env node

'use strict';

require = require('esm')(module);
require('intl-pluralrules');
const Fluent = require('../fluent-bundle/src');

process.stdin.resume();
process.stdin.on('data', print);

function print(data) {
  let bundle = new Fluent.FluentBundle("en-US", {
    useIsolating: false
  });
  bundle.addResource(new Fluent.FluentResource(data.toString()));

  let message = bundle.getMessage("test");
  if (message && message.value) {
      let errors = [];
      let value = bundle.formatPattern(message.value, {}, errors);
      let result = {value, errors};
      console.log(JSON.stringify(result, null, 4));
  }
}
