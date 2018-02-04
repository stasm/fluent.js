const { messageOffsets, lexEntry } = require('../src/lexer');

const ftl = `foo =
  .attr = Attr
`;

for (const lexeme of lexEntry(ftl)) {
    console.log(lexeme);
}
