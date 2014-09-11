/* global it, assert:true, describe, beforeEach */
/* global window, navigator, process */
'use strict';

var assert = require('assert') || window.assert;

if (typeof navigator !== 'undefined') {
  var L10n = navigator.mozL10n._getInternalAPI();
  var Env = L10n.Env;
} else {
  var Env = process.env.L20N_COV ?
    require('../../build/cov/lib/l20n/env').Env
    : require('../../lib/l20n/env').Env;
}

describe('ctx.get', function() {
  var l10n;

  beforeEach(function(done) {
    l10n = new Env('myapp');
    l10n.register({
      version: 2.0,
      locales: {
        'pl': {
          'version': '1.0-1'
        },
        'de': {
          'version': '1.0-1'
        },
        'en-US': {
          'version': '1.0-1'
        }
      },
      default_locale: 'en-US'
    });
    l10n.addEventListener('availablelanguageschange', function() {
      done();
    });
  });

  it('returns the value from the AST', function(done) {
    var ctx = l10n.getContext(['res1', 'res2']);
    ctx.get('foo').then(function(val) {
      assert.strictEqual(val, 'this is fooundefined');
      done();
    });
  });

});
