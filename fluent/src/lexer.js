const messageStartRe = /^-?[a-zA-Z][a-zA-Z0-9_-]*[ \t]*=?/my;

// export
exports.messageOffsets =
function *messageOffsets(source) {
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

const inlineWhitespaceRe = /[ \t]+/y;
const indentRe = /\n+[ \t*[.{}]/y;

const entryIdentifierRe = /-?[a-zA-Z][a-zA-Z0-9_-]*/y;
const identifierRe = /[a-zA-Z][a-zA-Z0-9_-]*/y;
const externalRe = /\$[a-zA-Z][a-zA-Z0-9_-]*/y;
const numberRe = /-?[0-9]+(\.[0-9]+)?/y;
const stringRe = /".*?"/y;

const ENTRY_TOKENS = {
    INLINE_WHITESPACE: /[ \t]+/y,
    BREAK_INDENT: /\n\s*[ \t]/y,
    BREAK_LINE: /\n/y,

    ENTRY_ONE_LINE: /(-?[a-zA-Z][\w-]*)[ \t]*=[ \t]*([^\s{}]+)[ \t]*/y,
    ATTRIBUTE_ONE_LINE: /\.(-?[a-zA-Z][\w-]*)[ \t]*=[ \t]*([^\s{}]+)[ \t]*/y,

    ENTRY_START: /(-?[a-zA-Z][\w-]*)[ \t]*=?/y,
    ATTRIBUTE_START: /\.([a-zA-Z][\w-]*)[ \t]*=?/y,

    IDENTIFIER: /(-?[a-zA-Z][\w-]*)/y,
    STRING: /(".*?")/y,
    NUMBER: /(-?\d+(?:\.\d+)?)/y,
}

// export
exports.lexEntry =
function *lexEntry(source, index = 0) {
    while (true) {
        let matchFound = false;

        for (const [token, regex] of Object.entries(ENTRY_TOKENS)) {
            regex.lastIndex = index;
            if (regex.test(source)) {
                matchFound = true;
                regex.lastIndex = index;
                const values = regex.exec(source).slice(1);
                index = regex.lastIndex;
                yield { token, values };
                break;
            }
        }

        if (!matchFound) {
            return null;
        }
    }
}
