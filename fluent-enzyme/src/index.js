/*
 * @module fluent-enzyme
 * @overview
 *
 */

import { mount as _mount } from 'enzyme';
import { Localized, ReactLocalization, isReactLocalization }
  from 'fluent-react';

export class FakeMessageContext {
  hasMessage() {
    return true;
  }

  getMessage(id) {
    return id.toUpperCase();
  }

  format(msg) {
    return msg;
  }

  formatToParts(msg) {
    return [msg];
  }
}

export class FakeReactLocalization extends ReactLocalization {
  constructor() {
    super([new FakeMessageContext()]);
  }
}

export function mount(comp, options = {}) {
  const {
    context = {},
    childContextTypes = {}
  } = options;

  return _mount(comp, Object.assign({}, options, {
    context: Object.assign({}, context, {
      l10n: new FakeReactLocalization()
    }),
    childContextTypes: Object.assign({}, childContextTypes, {
      l10n: isReactLocalization
    })
  }));
}

export function findLocalizedById(wrapper, id) {
  return wrapper.findWhere(
    elem => elem.type() === Localized && elem.prop('id') === id
  );
}
