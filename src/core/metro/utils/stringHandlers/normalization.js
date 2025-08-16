class Normalizer {
  constructor() {
    // Chilean-specific phonetic rules
    this.chileanRules = [
      ['ch', 'X'], ['ll', 'Y'], ['rr', 'R'], ['ñ', 'N'],
      ['que', 'KE'], ['qui', 'KI'], ['gé', 'JE'], ['gi', 'JI'],
      ['v', 'B'], ['z', 'S'], ['h', ''], ['y', 'I']
    ];
  }

  /**
   * Core normalization for all text processing
   * - Lowercases
   * - Removes accents/diacritics
   * - Keeps only alphanumeric + spaces
   * - Trims whitespace
   */
  normalize(text) {
    if (typeof text !== 'string') return '';
    return text
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^A-Z0-9\s]/g, '') // Keep alphanumeric + spaces
      .trim();
  }

  /**
   * For search: Just an alias to normalize()
   * (Kept separate for future expansion if needed)
   */
  normalizeForSearch(text) {
    return this.normalize(text); 
  }

  /**
   * Chilean-specific phonetic transformation
   * Applies after normalization
   */
  phonetic(text) {
    let processed = this.normalize(text);
    for (const [from, to] of this.chileanRules) {
      processed = processed.replace(new RegExp(from, 'g'), to);
    }
    return processed;
  }
}

module.exports = new Normalizer();