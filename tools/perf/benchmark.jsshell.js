load('../../fluent/fluent.js');
load('../../fluent-syntax/fluent-syntax.js');

var ftlCode = read('./workload-low.ftl');
var args = {};

function ms(time) {
  // time is in milliseconds with decimals
  return Math.round(time * 1e3) / 1e3;
}

var times = {};

times.ftlParseStart = dateNow();
var resource = FluentSyntax.parse(ftlCode);
times.ftlParseEnd = dateNow();

times.ftlEntriesParseStart = dateNow();
var [entries] = Fluent._parse(ftlCode);
times.ftlEntriesParseEnd = dateNow();

var ctx = new Fluent.MessageContext('en-US');
var errors = ctx.addMessages(ftlCode);

times.format = dateNow();
for (const [id, message] of ctx.messages) {
  ctx.format(message, args, errors);
  if (message.attrs) {
    for (const name in message.attrs) {
      ctx.format(message.attrs[name], args, errors)
    }
  }
}
times.formatEnd = dateNow();

var results = {
  "parse full AST (ms)": ms(times.ftlParseEnd - times.ftlParseStart),
  "parse runtime AST (ms)": ms(times.ftlEntriesParseEnd - times.ftlEntriesParseStart),
  "format (ms)": ms(times.formatEnd - times.format),
};

print(JSON.stringify(results));
