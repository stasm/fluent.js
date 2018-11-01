'use strict';

import assert from 'assert';

import FluentBundle from '../src/bundle';
import { ftl } from '../src/util';

suite('Attributes', function() {
  let bundle, args, errs;

  setup(function() {
    errs = [];
  });

  suite('missing', function(){
    suiteSetup(function() {
      bundle = new FluentBundle('en-US', { useIsolating: false });
      bundle.addMessages(ftl`
        foo = Foo
        bar = Bar
            .attr = Bar Attribute
        baz = { foo } Baz
        qux = { foo } Qux
            .attr = Qux Attribute

        ref-foo = { foo.missing }
        ref-bar = { bar.missing }
        ref-baz = { baz.missing }
        ref-qux = { qux.missing }
      `);
    });

    test('falls back gracefully for entities with string values and no attributes', function() {
      const val = bundle.format('ref-foo', args, errs);
      assert.equal(val, 'Foo');
      assert.equal(errs.length, 1);
      assert(errs[0] instanceof ReferenceError); // unknown attribute
    });

    test('falls back gracefully for entities with string values and other attributes', function() {
      const val = bundle.format('ref-bar', args, errs);
      assert.equal(val, 'Bar');
      assert.equal(errs.length, 1);
      assert(errs[0] instanceof ReferenceError); // unknown attribute
    });

    test('falls back gracefully for entities with pattern values and no attributes', function() {
      const val = bundle.format('ref-baz', args, errs);
      assert.equal(val, 'Foo Baz');
      assert.equal(errs.length, 1);
      assert(errs[0] instanceof ReferenceError); // unknown attribute
    });

    test('falls back gracefully for entities with pattern values and other attributes', function() {
      const val = bundle.format('ref-qux', args, errs);
      assert.equal(val, 'Foo Qux');
      assert.equal(errs.length, 1);
      assert(errs[0] instanceof ReferenceError); // unknown attribute
    });
  });

  suite('with string values', function(){
    suiteSetup(function() {
      bundle = new FluentBundle('en-US', { useIsolating: false });
      bundle.addMessages(ftl`
        foo = Foo
            .attr = Foo Attribute
        bar = { foo } Bar
            .attr = Bar Attribute

        ref-foo = { foo.attr }
        ref-bar = { bar.attr }
      `);
    });

    test('can be referenced for entities with string values', function() {
      const val = bundle.format('ref-foo', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly for entities with string values', function() {
      const val = bundle.format('foo.attr', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be referenced for entities with pattern values', function() {
      const val = bundle.format('ref-bar', args, errs);
      assert.equal(val, 'Bar Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly for entities with pattern values', function() {
      const val = bundle.format('bar.attr', args, errs);
      assert.equal(val, 'Bar Attribute');
      assert.equal(errs.length, 0);
    });
  });

  suite('with simple pattern values', function(){
    suiteSetup(function() {
      bundle = new FluentBundle('en-US', { useIsolating: false });
      bundle.addMessages(ftl`
        foo = Foo
        bar = Bar
            .attr = { foo } Attribute
        baz = { foo } Baz
            .attr = { foo } Attribute
        qux = Qux
            .attr = { qux } Attribute

        ref-bar = { bar.attr }
        ref-baz = { baz.attr }
        ref-qux = { qux.attr }
      `);
    });

    test('can be referenced for entities with string values', function() {
      const val = bundle.format('ref-bar', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly for entities with string values', function() {
      const val = bundle.format('bar.attr', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be referenced for entities with simple pattern values', function() {
      const val = bundle.format('ref-baz', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly for entities with simple pattern values', function() {
      const val = bundle.format('baz.attr', args, errs);
      assert.equal(val, 'Foo Attribute');
      assert.equal(errs.length, 0);
    });

    test('works with self-references', function() {
      const val = bundle.format('ref-qux', args, errs);
      assert.equal(val, 'Qux Attribute');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly when it uses a self-reference', function() {
      const val = bundle.format('qux.attr', args, errs);
      assert.equal(val, 'Qux Attribute');
      assert.equal(errs.length, 0);
    });
  });

  suite('with values with select expressions', function(){
    suiteSetup(function() {
      bundle = new FluentBundle('en-US', { useIsolating: false });
      bundle.addMessages(ftl`
        foo = Foo
            .attr = { "a" ->
                        [a] A
                       *[b] B
                    }

        ref-foo = { foo.attr }
      `);
    });

    test('can be referenced', function() {
      const val = bundle.format('ref-foo', args, errs);
      assert.equal(val, 'A');
      assert.equal(errs.length, 0);
    });

    test('can be formatted directly', function() {
      const val = bundle.format('foo.attr', args, errs);
      assert.equal(val, 'A');
      assert.equal(errs.length, 0);
    });
  });
});
