const messageStartRe = /^-?[a-zA-Z][a-zA-Z0-9_-]*[ \t]*=?/my;

//export
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

const SKIP_TOKENS = {
    INLINE_WHITESPACE: /[ \t]+/y,
    BREAK_INDENT: /\n\s*[ \t]/y,
    BREAK_LINE: /\s*\n/y,
    COMMENT: /\/\/.*\n/y,
    SECTION: /\[\[.*\n/y,
}

const ENTRY_TOKENS = {
    ENTRY_ONE_LINE: /^(-?[a-zA-Z][\w-]*)[ \t]*=[ \t]*([^\n{}]+)[ \t]*(?=\n)/my,
    ATTRIBUTE_ONE_LINE: /\.(-?[a-zA-Z][\w-]*)[ \t]*=[ \t]*([^\n{}]+)[ \t]*(?=\n)/y,

    TEXT: /[ \t]*([^\n{}]+)[ \t]*/y,

    ENTRY_START: /^(-?[a-zA-Z][\w-]*)[ \t]*=?/my,
    ATTRIBUTE_START: /\.([a-zA-Z][\w-]*)[ \t]*=/y,

    PLACEABLE_MESSAGE_REFERENCE: /\{\s*(-?[a-zA-Z][\w-]+)\s*\}/y,
    PLACEABLE_EXTERNAL_ARGUMENT: /\{\s*(\$[a-zA-Z][\w-]+)\s*\}/y,
    PLACEABLE_EMPTY_STRING: /\{\s*("")\s*\}/y,

    IDENTIFIER: /(-?[a-zA-Z][\w-]*)/y,
    STRING: /(".*?")/y,
    NUMBER: /(-?\d+(?:\.\d+)?)/y,
};


//export
exports.lexEntry =
function *lexEntry(source, index = 0) {
    while (true) {
        let matchFound = false;

        for (const [token, regex] of Object.entries(SKIP_TOKENS)) {
            regex.lastIndex = index;
            if (regex.test(source)) {
                matchFound = true;
                index = regex.lastIndex;
                yield { token };
                break;
            }
        }

        if (matchFound) {
            continue;
        }

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
