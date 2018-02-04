const parse = require('../src/parser');

const [entries] = parse(`
foo = { $num -> 
    *[3] Foo
}
`)

console.log(entries);
