import { includes } from './util';

function indent(content) {
  return content.split('\n').join('\n    ');
}

function containNewLine(elems) {
  const withNewLine = elems.filter(
    elem => (elem.type === 'TextElement' && includes(elem.value, '\n'))
  );
  return !!withNewLine.length;
}

// Bit masks representing the state of the serializer.
export const HAS_ENTRIES = 1;

export default class FluentSerializer {
  constructor({ withJunk = false } = {}) {
    this.withJunk = withJunk;
  }

  serialize(resource) {
    if (resource.type !== 'Resource') {
      throw new Error(`Unknown resource type: ${resource.type}`);
    }

    let state = 0;
    const parts = [];

    for (const entry of resource.body) {
      if (entry.type !== 'Junk' || this.withJunk) {
        parts.push(this.serializeEntry(entry, state));
        if (!(state & HAS_ENTRIES)) {
          state |= HAS_ENTRIES;
        }
      }
    }

    return parts.join('');
  }

  serializeEntry(entry, state = 0) {
    switch (entry.type) {
      case 'Message':
      case 'Term':
        return serializeMessage(entry);
      case 'Comment':
        if (state & HAS_ENTRIES) {
          return `\n${serializeComment(entry)}\n\n`;
        }
        return `${serializeComment(entry)}\n\n`;
      case 'GroupComment':
        if (state & HAS_ENTRIES) {
          return `\n${serializeGroupComment(entry)}\n\n`;
        }
        return `${serializeGroupComment(entry)}\n\n`;
      case 'ResourceComment':
        if (state & HAS_ENTRIES) {
          return `\n${serializeResourceComment(entry)}\n\n`;
        }
        return `${serializeResourceComment(entry)}\n\n`;
      case 'Junk':
        return serializeJunk(entry);
      default :
        throw new Error(`Unknown entry type: ${entry.type}`);
    }
  }

  serializeExpression(expr) {
    return serializeExpression(expr);
  }
}


function serializeComment(comment) {
  return comment.content.split('\n').map(
    line => line.length ? `# ${line}` : '#'
  ).join('\n');
}


function serializeGroupComment(comment) {
  return comment.content.split('\n').map(
    line => line.length ? `## ${line}` : '##'
  ).join('\n');
}


function serializeResourceComment(comment) {
  return comment.content.split('\n').map(
    line => line.length ? `### ${line}` : '###'
  ).join('\n');
}


function serializeJunk(junk) {
  return junk.content;
}


function serializeMessage(message) {
  const parts = [];

  if (message.comment) {
    parts.push(serializeComment(message.comment));
    parts.push('\n');
  }

  parts.push(serializeIdentifier(message.id));
  parts.push(' =');

  if (message.value) {
    parts.push(serializeValue(message.value));
  }

  for (const attribute of message.attributes) {
    parts.push(serializeAttribute(attribute));
  }

  parts.push('\n');
  return parts.join('');
}


function serializeAttribute(attribute) {
  const id = serializeIdentifier(attribute.id);
  const value = indent(serializeValue(attribute.value));
  return `\n    .${id} =${value}`;
}


function serializeValue(pattern) {
  const content = indent(serializePattern(pattern));
  const multi = containNewLine(pattern.elements);

  if (multi) {
    return `\n    ${content}`;
  }

  return ` ${content}`;
}


function serializePattern(pattern) {
  return pattern.elements.map(serializeElement).join('');
}


function serializeElement(element) {
  switch (element.type) {
    case 'TextElement':
      return serializeTextElement(element);
    case 'Placeable':
      return serializePlaceable(element);
    default:
      throw new Error(`Unknown element type: ${element.type}`);
  }
}


function serializeTextElement(text) {
  return text.value;
}


function serializePlaceable(placeable) {
  const expr = placeable.expression;

  switch (expr.type) {
    case 'Placeable':
      return `{${serializePlaceable(expr)}}`;
    case 'SelectExpression':
      // Special-case select expression to control the whitespace around the
      // opening and the closing brace.
      return expr.expression
        // A select expression with a selector.
        ? `{ ${serializeSelectExpression(expr)}}`
        // A variant list without a selector.
        : `{${serializeSelectExpression(expr)}}`;
    default:
      return `{ ${serializeExpression(expr)} }`;
  }
}


function serializeExpression(expr) {
  switch (expr.type) {
    case 'StringExpression':
      return serializeStringExpression(expr);
    case 'NumberExpression':
      return serializeNumberExpression(expr);
    case 'MessageReference':
      return serializeMessageReference(expr);
    case 'ExternalArgument':
      return serializeExternalArgument(expr);
    case 'AttributeExpression':
      return serializeAttributeExpression(expr);
    case 'VariantExpression':
      return serializeVariantExpression(expr);
    case 'CallExpression':
      return serializeCallExpression(expr);
    case 'SelectExpression':
      return serializeSelectExpression(expr);
    default:
      throw new Error(`Unknown expression type: ${expr.type}`);
  }
}


function serializeStringExpression(expr) {
  return `"${expr.value}"`;
}


function serializeNumberExpression(expr) {
  return expr.value;
}


function serializeMessageReference(expr) {
  return serializeIdentifier(expr.id);
}


function serializeExternalArgument(expr) {
  return `$${serializeIdentifier(expr.id)}`;
}


function serializeSelectExpression(expr) {
  const parts = [];

  if (expr.expression) {
    const selector = `${serializeExpression(expr.expression)} ->`;
    parts.push(selector);
  }

  for (const variant of expr.variants) {
    parts.push(serializeVariant(variant));
  }

  parts.push('\n');
  return parts.join('');
}


function serializeVariant(variant) {
  const key = serializeVariantKey(variant.key);
  const value = indent(serializeValue(variant.value));

  if (variant.default) {
    return `\n   *[${key}]${value}`;
  }

  return `\n    [${key}]${value}`;
}


function serializeAttributeExpression(expr) {
  const id = serializeIdentifier(expr.id);
  const name = serializeIdentifier(expr.name);
  return `${id}.${name}`;
}


function serializeVariantExpression(expr) {
  const id = serializeIdentifier(expr.id);
  const key = serializeVariantKey(expr.key);
  return `${id}[${key}]`;
}


function serializeCallExpression(expr) {
  const fun = serializeFunction(expr.callee);
  const args = expr.args.map(serializeCallArgument).join(', ');
  return `${fun}(${args})`;
}


function serializeCallArgument(arg) {
  switch (arg.type) {
    case 'NamedArgument':
      return serializeNamedArgument(arg);
    default:
      return serializeExpression(arg);
  }
}


function serializeNamedArgument(arg) {
  const name = serializeIdentifier(arg.name);
  const value = serializeArgumentValue(arg.val);
  return `${name}: ${value}`;
}


function serializeArgumentValue(argval) {
  switch (argval.type) {
    case 'StringExpression':
      return serializeStringExpression(argval);
    case 'NumberExpression':
      return serializeNumberExpression(argval);
    default:
      throw new Error(`Unknown argument type: ${argval.type}`);
  }
}


function serializeIdentifier(identifier) {
  return identifier.name;
}


function serializeVariantName(VariantName) {
  return VariantName.name;
}


function serializeVariantKey(key) {
  switch (key.type) {
    case 'VariantName':
      return serializeVariantName(key);
    case 'NumberExpression':
      return serializeNumberExpression(key);
    default:
      throw new Error(`Unknown variant key type: ${key.type}`);
  }
}


function serializeFunction(fun) {
  return fun.name;
}
