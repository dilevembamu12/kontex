// Polyfill File for Node 18 compatibility with undici
if (typeof File === 'undefined') {
    globalThis.File = class File {
        constructor(_parts, _name, _options) {}
    };
}
require('@vscode/vsce/out/main');
