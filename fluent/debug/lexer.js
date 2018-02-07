var fs = require('fs');
const { messageOffsets, lexEntry } = require('../src/lexer');

let ftl;

ftl = `
quit-application-menuitem-mac
    .label = Quit { brand-shorter-name }
// Used by both Linux and OSX builds
quit-application-key-unix
    .key = Q
`;

//ftl = fs.readFileSync(__dirname + '/../../tools/perf/workload-low.ftl').toString();

for (const offset of messageOffsets(ftl)) {
    console.log(offset);
    for (const lexeme of lexEntry(ftl, offset)) {
        console.log(lexeme);
    }
}
