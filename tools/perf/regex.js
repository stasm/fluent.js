var fs = require('fs');

function ms([seconds, nanoseconds]) {
  return Math.round((seconds * 1e9 + nanoseconds) / 1e3) / 1e3;
}

const text = "Lorem ipsum dolor sit amet";

const index = 6;
const withGroup = /(ipsum)/y;
const withoutGroup = /ipsum/y;

let values;

var cumulative = {};
var start = process.hrtime();

cumulative.withGroupExecStart = process.hrtime(start);
    withGroup.lastIndex = index;
    const result = withGroup.exec(text);

    if (result !== null) {
        values = result.slice(1);
    }
cumulative.withGroupExecEnd = process.hrtime(start);

cumulative.withGroupTestExecStart = process.hrtime(start);
    withGroup.lastIndex = index;

    if (withGroup.test(text)) {
        withGroup.lastIndex = index;
        const result = withGroup.exec(text);
        values = result.slice(1);
    }
cumulative.withGroupTestExecEnd = process.hrtime(start);

cumulative.withGroupTestSliceStart = process.hrtime(start);
    withGroup.lastIndex = index;

    if (withGroup.test(text)) {
        values = text.slice(index, withGroup.lastIndex);
    }
cumulative.withGroupTestSliceEnd = process.hrtime(start);

cumulative.withoutGroupTestSliceStart = process.hrtime(start);
    withoutGroup.lastIndex = index;

    if (withoutGroup.test(text)) {
        values = text.slice(index, withoutGroup.lastIndex);
    }
cumulative.withoutGroupTestSliceEnd = process.hrtime(start);


var results = {
  "withGroup exec": ms(cumulative.withGroupExecEnd) - ms(cumulative.withGroupExecStart),
  "withGroup test exec": ms(cumulative.withGroupTestExecEnd) - ms(cumulative.withGroupTestExecStart),
  "withGroup test slice": ms(cumulative.withGroupTestSliceEnd) - ms(cumulative.withGroupTestSliceStart),
  "withoutGroup test slice": ms(cumulative.withoutGroupTestSliceEnd) - ms(cumulative.withoutGroupTestSliceStart),
};
console.log(JSON.stringify(results));
