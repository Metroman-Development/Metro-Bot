// utils/metaphone.js

/**
 * Metaphone algorithm for phonetic string matching.
 * Reduces words to a phonetic code based on their pronunciation.
 *
 * @param {string} word - The input word to transform.
 * @returns {string} The Metaphone code for the word.
 */
function metaphone(word) {
    if (!word) return '';

    // Convert to uppercase and remove non-alphabetic characters
    let str = word.toUpperCase().replace(/[^A-Z]/g, '');

    // Short words are returned as-is
    if (str.length <= 1) return str;

    // Apply transformation rules
    str = transformInitial(str);
    str = transformVowels(str);
    str = transformConsonants(str);
    str = transformFinal(str);

    return str;
}

// Helper functions for transformations
function transformInitial(str) {
    // Drop duplicate adjacent letters, except for C
    str = str.replace(/([^C])\1+/g, '$1');

    // Transform initial letters
    if (str.startsWith('KN') || str.startsWith('GN') || str.startsWith('PN') || str.startsWith('AE') || str.startsWith('WR')) {
        str = str.slice(1);
    } else if (str.startsWith('X')) {
        str = 'S' + str.slice(1);
    } else if (str.startsWith('WH')) {
        str = 'W' + str.slice(1);
    }

    return str;
}

function transformVowels(str) {
    // Keep only the first vowel
    const firstVowel = str.match(/[AEIOU]/);
    if (firstVowel) {
        str = str.replace(/[AEIOU]/g, '');
        str = firstVowel[0] + str;
    }
    return str;
}

function transformConsonants(str) {
    // Transform specific consonant patterns
    const transformations = {
        'B(?!$)|C(K|H|IA)|D(G|GE|GI|GY)|F|G(H|N|NED)|H(?!$)|J|K(?!N)|L|M|N(?!$)|P(H|S)|Q|R|S(H|IO|IA)|T(IA|IO|H)|V|W(?!$)|X|Y(?!$)|Z': '',
        'CK': 'K',
        'PH': 'F',
        'SCH': 'SK',
        'TCH': 'CH',
        'CIA': 'X',
        'CH': 'X',
        'CI': 'S',
        'CE': 'S',
        'CY': 'S',
        'GN': 'N',
        'KN': 'N',
        'PN': 'N',
        'WR': 'R',
        'DG': 'J',
        'DGE': 'J',
        'DGI': 'J',
        'DGY': 'J',
        'TIA': 'X',
        'TIO': 'X',
        'TH': '0',
        'WH': 'W',
    };

    for (const [pattern, replacement] of Object.entries(transformations)) {
        const regex = new RegExp(pattern, 'g');
        str = str.replace(regex, replacement);
    }

    return str;
}

function transformFinal(str) {
    // Remove trailing letters
    str = str.replace(/[AEIOUY]$/, '');

    // Remove duplicate letters
    str = str.replace(/(.)\1+/g, '$1');

    return str;
}

module.exports = metaphone;
