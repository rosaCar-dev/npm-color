"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getColorDotFromToken = getColorDotFromToken;
function getColorDotFromToken(colorToken) {
    if (colorToken.includes('Blue'))
        return '🔵';
    if (colorToken.includes('Green'))
        return '🟢';
    if (colorToken.includes('Red'))
        return '🔴';
    if (colorToken.includes('Yellow') || colorToken.includes('orange'))
        return '🟡';
    if (colorToken.includes('Magenta'))
        return '🟣';
    if (colorToken.includes('Cyan'))
        return '🔵';
    return '⚪';
}
//# sourceMappingURL=colorUtils.js.map