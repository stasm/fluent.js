/*  eslint no-magic-numbers: [0]  */

const MAX_PLACEABLES = 100;

const messageStartRe = /^-?[a-zA-Z][a-zA-Z0-9_-]*[ \t]*=?/my;

const inlineWhitespaceRe = /[ \t]+/y;
const indentRe = /\n+[ \t*[.{}]/y;

const identifierRe = /-?[a-zA-Z][a-zA-Z0-9_-]*/y;
const externalRe = /$[a-zA-Z][a-zA-Z0-9_-]*/y;
const numberRe = /-?[0-9]+(\.[0-9]+)/y;
const stringRe = /"\.*"/y;

/**
 * The `Parser` class is responsible for parsing FTL resources.
 *
 * It's only public method is `getResource(source)` which takes an FTL string
 * and returns a two element Array with an Object of entries generated from the
 * source as the first element and an array of SyntaxError objects as the
 * second.
 *
 * This parser is optimized for runtime performance.
 *
 * There is an equivalent of this parser in syntax/parser which is
 * generating full AST which is useful for FTL tools.
 */
class RuntimeParser {
  /**
   * Parse FTL code into entries formattable by the MessageContext.
   *
   * Given a string of FTL syntax, return a map of entries that can be passed
   * to MessageContext.format and a list of errors encountered during parsing.
   *
   * @param {String} string
   * @returns {Array<Object, Array>}
   */
  getResource(string) {
    this._source = string;
    this._index = 0;
    this._length = string.length;
    this.entries = {};

    const errors = [];

    for (const offset of this.messageStartingPositions(string)) {
      this._index = offset;
      try {
        this.getMessage();
      } catch (e) {
        continue;
      }
    }

    return [this.entries, errors];
  }

  *messageStartingPositions(source) {
    let lastIndex = 0;

    while (true) {
      messageStartRe.lastIndex = lastIndex;
      if (messageStartRe.test(source)) {
        yield lastIndex;
      }

      const lineEnd = source.indexOf('\n', lastIndex)
      if (lineEnd === -1) {
        break;
      }

      lastIndex = lineEnd + 1;
    }
  }

  /**
   * Parse the source string from the current index as an FTL message
   * and add it to the entries property on the Parser.
   *
   * @private
   */
  getMessage() {
    const id = this.getIdentifier();

    this.skipInlineWS();

    if (this._source[this._index] === '=') {
      this._index++;
    }

    this.skipInlineWS();

    const val = this.getPattern();

    let attrs = null;

    if (this._source[this._index] === '.') {
      attrs = this.getAttributes();
    }

    if (attrs === null && typeof val === 'string') {
      this.entries[id] = val;
    } else {
      if (val === null && attrs === null) {
        throw this.error('Expected a value or an attribute');
      }

      this.entries[id] = {};

      if (val !== null) {
        this.entries[id].val = val;
      }

      if (attrs !== null) {
        this.entries[id].attrs = attrs;
      }
    }
  }

  /**
   * Skip any whitespace. Return true if it was inline or indented.
   *
   * @private
   */
  skipIndent() {
    this.skipInlineWS();

    if (this._source[this._index] !== '\n') {
      return this._source[this._index];
    }

    indentRe.lastIndex = this._index;
    if (indentRe.test(this._source)) {
      this._index = indentRe.lastIndex - 1;
      this.skipInlineWS();
      return this._source[this._index];
    }

    return '\n';
  }

  /**
   * Skip inline whitespace (space and \t).
   *
   * @private
   */
  skipInlineWS() {
    inlineWhitespaceRe.lastIndex = this._index;
    if (inlineWhitespaceRe.test(this._source)) {
      this._index = inlineWhitespaceRe.lastIndex;
    }
  }

  /**
   * Get identifier of a Message, Attribute or External Attribute.
   *
   * @returns {String}
   * @private
   */
  getIdentifier() {
    identifierRe.lastIndex = this._index;
    const result = identifierRe.exec(this._source);

    if (result === null) {
      this._index += 1;
      throw this.error(`Expected an identifier [${identifierRe.toString()}]`);
    }

    this._index = identifierRe.lastIndex;
    return result[0];
  }

  /**
   * Get Variant name.
   *
   * @returns {Object}
   * @private
   */
  getVariantName() {
    let name = '';

    const start = this._index;
    let cc = this._source.charCodeAt(this._index);

    if ((cc >= 97 && cc <= 122) || // a-z
        (cc >= 65 && cc <= 90) || // A-Z
        cc === 95 || cc === 32) { // _ <space>
      cc = this._source.charCodeAt(++this._index);
    } else {
      throw this.error('Expected a keyword (starting with [a-zA-Z_])');
    }

    while ((cc >= 97 && cc <= 122) || // a-z
           (cc >= 65 && cc <= 90) || // A-Z
           (cc >= 48 && cc <= 57) || // 0-9
           cc === 95 || cc === 45 || cc === 32) { // _- <space>
      cc = this._source.charCodeAt(++this._index);
    }

    // If we encountered the end of name, we want to test if the last
    // collected character is a space.
    // If it is, we will backtrack to the last non-space character because
    // the keyword cannot end with a space character.
    while (this._source.charCodeAt(this._index - 1) === 32) {
      this._index--;
    }

    name += this._source.slice(start, this._index);

    return { type: 'varname', name };
  }

  /**
   * Get simple string argument enclosed in `"`.
   *
   * @returns {String}
   * @private
   */
  getString() {
    const start = this._index + 1;

    while (++this._index < this._length) {
      const ch = this._source[this._index];

      if (ch === '"') {
        break;
      }

      if (ch === '\n') {
        throw this.error('Unterminated string expression');
      }
    }

    return this._source.substring(start, this._index++);
  }

  /**
   * Parses a Message pattern.
   * Message Pattern may be a simple string or an array of strings
   * and placeable expressions.
   *
   * @returns {String|Array}
   * @private
   */
  getPattern() {
    // We're going to first try to see if the pattern is simple.
    // If it is we can just look for the end of the line and read the string.
    //
    // Then, if either the line contains a placeable opening `{` or the
    // next line starts an indentation, we switch to complex pattern.
    const start = this._index;
    let eol = this._source.indexOf('\n', this._index);

    if (eol === -1) {
      eol = this._length;
    }

    const firstLineContent = start !== eol ?
      this._source.slice(start, eol) : null;

    if (firstLineContent && firstLineContent.includes('{')) {
      return this.getComplexPattern();
    }

    this._index = eol;

    if (this.skipIndent() === '\n') {
      // No indentation means we're done with this message.
      return firstLineContent;
    }

    if (this._source[this._index] === '.') {
      // The pattern is followed by an attribute.
      return firstLineContent;
    }

    if (firstLineContent) {
      // It's a multiline pattern which started on the same line as the
      // identifier. Reparse the whole pattern to make sure we get all of it.
      this._index = start;
    }

    return this.getComplexPattern();
  }

  /**
   * Parses a complex Message pattern.
   * This function is called by getPattern when the message is multiline,
   * or contains escape chars or placeables.
   * It does full parsing of complex patterns.
   *
   * @returns {Array}
   * @private
   */
  /* eslint-disable complexity */
  getComplexPattern() {
    let buffer = '';
    const content = [];
    let placeables = 0;


    outer:
    while (this._index < this._length) {

      let ch = this._source[this._index];

      // This block handles multi-line strings combining strings separated
      // by new line.
      if (ch === '\n') {

        const blankLinesStart = this._index;

        switch (this.skipIndent()) {
          case '.':
          case '}':
          case '*':
          case '[':
          case '\n':
            break outer;
          default:
            ch = this._source[this._index];
        }

        const blankLinesEnd = this._index - 1;
        const blank = this._source.substring(blankLinesStart, blankLinesEnd);

        // normalize new lines
        buffer += blank.replace(/\n[ \t]*/g, '\n');
      }

      if (ch === '{') {
        // Push the buffer to content array right before placeable
        if (buffer.length) {
          content.push(buffer);
        }
        if (placeables > MAX_PLACEABLES - 1) {
          throw this.error(
            `Too many placeables, maximum allowed is ${MAX_PLACEABLES}`);
        }
        buffer = '';
        content.push(this.getPlaceable());

        this._index++;

        ch = this._source[this._index];
        placeables++;
        continue;
      }

      if (ch === '\\') {
        const ch2 = this._source[this._index + 1];
        if (ch2 === '"' || ch2 === '{' || ch2 === '\\') {
          ch = ch2;
          this._index++;
        }
      }

      if (ch) {
        buffer += ch;
      }

      this._index++;
    }

    if (content.length === 0) {
      return buffer.length ? buffer : null;
    }

    if (buffer.length) {
      content.push(buffer);
    }

    return content;
  }
  /* eslint-enable complexity */

  /**
   * Parses a single placeable in a Message pattern and returns its
   * expression.
   *
   * @returns {Object}
   * @private
   */
  getPlaceable() {
    const start = ++this._index;

    this.skipIndent();

    if (this._source[this._index] === '*' ||
       (this._source[this._index] === '[' &&
        this._source[this._index + 1] !== ']')) {
      const variants = this.getVariants();

      return {
        type: 'sel',
        exp: null,
        vars: variants[0],
        def: variants[1]
      };
    }

    // Rewind the index and only support in-line white-space now.
    this._index = start;
    this.skipInlineWS();

    const selector = this.getSelectorExpression();

    this.skipIndent();

    const ch = this._source[this._index];

    if (ch === '}') {
      if (selector.type === 'attr' && selector.id.name.startsWith('-')) {
        throw this.error(
          'Attributes of private messages cannot be interpolated.'
        );
      }

      return selector;
    }

    if (ch !== '-' || this._source[this._index + 1] !== '>') {
      throw this.error('Expected "}" or "->"');
    }

    if (selector.type === 'ref') {
      throw this.error('Message references cannot be used as selectors.');
    }

    if (selector.type === 'var') {
      throw this.error('Variants cannot be used as selectors.');
    }

    if (selector.type === 'attr' && !selector.id.name.startsWith('-')) {
      throw this.error(
        'Attributes of public messages cannot be used as selectors.'
      );
    }


    this._index += 2; // ->

    this.skipInlineWS();

    if (this._source[this._index] !== '\n') {
      throw this.error('Variants should be listed in a new line');
    }

    this.skipIndent();

    const variants = this.getVariants();

    if (variants[0].length === 0) {
      throw this.error('Expected members for the select expression');
    }

    return {
      type: 'sel',
      exp: selector,
      vars: variants[0],
      def: variants[1]
    };
  }

  /**
   * Parses a selector expression.
   *
   * @returns {Object}
   * @private
   */
  getSelectorExpression() {
    const literal = this.getLiteral();

    if (literal.type !== 'ref') {
      return literal;
    }

    if (this._source[this._index] === '.') {
      this._index++;

      const name = this.getIdentifier();
      this._index++;
      return {
        type: 'attr',
        id: literal,
        name
      };
    }

    if (this._source[this._index] === '[') {
      this._index++;

      const key = this.getVariantKey();
      this._index++;
      return {
        type: 'var',
        id: literal,
        key
      };
    }

    if (this._source[this._index] === '(') {
      this._index++;
      const args = this.getCallArgs();

      this._index++;

      literal.type = 'fun';

      return {
        type: 'call',
        fun: literal,
        args
      };
    }

    return literal;
  }

  /**
   * Parses call arguments for a CallExpression.
   *
   * @returns {Array}
   * @private
   */
  getCallArgs() {
    const args = [];

    while (this._index < this._length) {
      this.skipInlineWS();

      if (this._source[this._index] === ')') {
        return args;
      }

      const exp = this.getSelectorExpression();

      // MessageReference in this place may be an entity reference, like:
      // `call(foo)`, or, if it's followed by `:` it will be a key-value pair.
      if (exp.type !== 'ref') {
        args.push(exp);
      } else {
        this.skipInlineWS();

        if (this._source[this._index] === ':') {
          this._index++;
          this.skipInlineWS();

          const val = this.getSelectorExpression();

          // If the expression returned as a value of the argument
          // is not a quote delimited string or number, throw.
          //
          // We don't have to check here if the pattern is quote delimited
          // because that's the only type of string allowed in expressions.
          if (typeof val === 'string' ||
              Array.isArray(val) ||
              val.type === 'num') {
            args.push({
              type: 'narg',
              name: exp.name,
              val
            });
          } else {
            this._index = this._source.lastIndexOf(':', this._index) + 1;
            throw this.error(
              'Expected string in quotes, number.');
          }

        } else {
          args.push(exp);
        }
      }

      this.skipInlineWS();

      if (this._source[this._index] === ')') {
        break;
      } else if (this._source[this._index] === ',') {
        this._index++;
      } else {
        throw this.error('Expected "," or ")"');
      }
    }

    return args;
  }

  /**
   * Parses an FTL Number.
   *
   * @returns {Object}
   * @private
   */
  getNumber() {
    numberRe.lastIndex = this._index;

    if (!numberRe.test(this._source)) {
      throw this.error('Expected a number');
    }

    const num = {
      type: 'num',
      val: this._source.slice(this._index, numberRe.lastIndex)
    };

    this._index = numberRe.lastIndex;
    return num;
  }

  /**
   * Parses a list of Message attributes.
   *
   * @returns {Object}
   * @private
   */
  getAttributes() {
    const attrs = {};

    while (this._index < this._length) {
      if (this._source[this._index] !== '.') {
        break;
      }
      this._index++;

      const key = this.getIdentifier();

      this.skipInlineWS();

      if (this._source[this._index] !== '=') {
        throw this.error('Expected "="');
      }
      this._index++;

      this.skipInlineWS();

      const val = this.getPattern();

      if (typeof val === 'string') {
        attrs[key] = val;
      } else {
        attrs[key] = {
          val
        };
      }
    }

    return attrs;
  }

  /**
   * Parses a list of Selector variants.
   *
   * @returns {Array}
   * @private
   */
  getVariants() {
    const variants = [];
    let index = 0;
    let defaultIndex;

    while (this._index < this._length) {
      const ch = this._source[this._index];

      if ((ch !== '[' || this._source[this._index + 1] === '[') &&
          ch !== '*') {
        break;
      }
      if (ch === '*') {
        this._index++;
        defaultIndex = index;
      }

      if (this._source[this._index] !== '[') {
        throw this.error('Expected "["');
      }

      this._index++;

      const key = this.getVariantKey();

      this.skipInlineWS();

      const variant = {
        key,
        val: this.getPattern()
      };
      variants[index++] = variant;

      this.skipIndent();
    }

    return [variants, defaultIndex];
  }

  /**
   * Parses a Variant key.
   *
   * @returns {String}
   * @private
   */
  getVariantKey() {
    // VariantKey may be a Keyword or Number

    const cc = this._source.charCodeAt(this._index);
    let literal;

    if ((cc >= 48 && cc <= 57) || cc === 45) {
      literal = this.getNumber();
    } else {
      literal = this.getVariantName();
    }

    if (this._source[this._index] !== ']') {
      throw this.error('Expected "]"');
    }

    this._index++;
    return literal;
  }

  /**
   * Parses an FTL literal.
   *
   * @returns {Object}
   * @private
   */
  getLiteral() {
    externalRe.lastIndex = this._index;
    if (externalRe.test(this._source)) {
      return {
        type: 'ext',
        name: this.getIdentifier()
      };
    }

    identifierRe.lastIndex = this._index;
    if (identifierRe.test(this._source)) {
      return {
        type: 'ref',
        name: this.getIdentifier()
      };
    }

    numberRe.lastIndex = this._index;
    if (numberRe.test(this._source)) {
      return this.getNumber();
    }

    stringRe.lastIndex = this._index;
    if (stringRe.test(this._source)) {
      return this.getString();
    }

    throw this.error('Expected literal');
  }

  /**
   * Creates a new SyntaxError object with a given message.
   *
   * @param {String} message
   * @returns {Object}
   * @private
   */
  error(message) {
    return new SyntaxError(message);
  }

}

/**
 * Parses an FTL string using RuntimeParser and returns the generated
 * object with entries and a list of errors.
 *
 * @param {String} string
 * @returns {Array<Object, Array>}
 */
export default function parse(string) {
  const parser = new RuntimeParser();
  return parser.getResource(string);
}
