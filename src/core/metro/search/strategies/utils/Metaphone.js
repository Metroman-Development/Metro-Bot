// utils/Metaphone.js
class Metaphone {
  static process(text) {
    if (!text) return { primary: '', alternate: '' };
    
    let primary = '';
    let alternate = '';
    const str = text.toUpperCase().replace(/[^A-Z]/g, '');
    
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const prev = str[i-1];
      const next = str[i+1];
      
      // Skip duplicates except C
      if (c === prev && c !== 'C') continue;
      
      switch(c) {
        // Vowels (only at start)
        case 'A': case 'E': case 'I': case 'O': case 'U':
          if (i === 0) {
            primary += c;
            alternate += c;
          }
          break;
          
        // Consonants with special rules  
        case 'C':
          if (next === 'H') {
            primary += 'K'; alternate += 'K'; i++;
          } else if (next === 'I' && str[i+2] === 'A') {
            primary += 'X'; alternate += 'X'; i += 2;
          } else if (next === 'E' || next === 'I' || next === 'Y') {
            primary += 'S'; alternate += 'S'; i++;
          } else {
            primary += 'K'; alternate += 'K';
          }
          break;
          
        case 'D':
          if (next === 'G' && (str[i+2] === 'E' || str[i+2] === 'I' || str[i+2] === 'Y')) {
            primary += 'J'; alternate += 'J'; i += 2;
          } else {
            primary += 'T'; alternate += 'T';
          }
          break;
          
        case 'G':
          if ((next === 'E' || next === 'I' || next === 'Y') && prev !== 'G') {
            primary += 'J'; alternate += 'J';
          } else {
            primary += 'K'; alternate += 'K';
          }
          if (next === 'G') i++;
          break;
          
        // Simplified rules for other letters
        case 'B': case 'F': case 'K': case 'P': 
        case 'Q': case 'V': case 'X': case 'Z':
          primary += c; alternate += c;
          break;
          
        case 'H': 
          if (i > 0 && this.isVowel(prev) && this.isVowel(next)) {
            primary += 'H'; alternate += 'H';
          }
          break;
          
        case 'J':
          primary += 'J'; alternate += 'H'; // Alternate sound
          break;
          
        case 'L': case 'M': case 'N': case 'R':
          primary += c; alternate += c;
          break;
          
        case 'S':
          if (next === 'H') {
            primary += 'X'; alternate += 'X'; i++;
          } else {
            primary += 'S'; alternate += 'S';
          }
          break;
          
        case 'T':
          if (next === 'H') {
            primary += '0'; alternate += '0'; i++; // '0' represents TH sound
          } else {
            primary += 'T'; alternate += 'T';
          }
          break;
          
        case 'W': case 'Y':
          if (this.isVowel(next)) {
            primary += c; alternate += c;
          }
          break;
      }
    }
    
    return {
      primary: primary.substring(0, 4) || '',
      alternate: alternate.substring(0, 4) || ''
    };
  }
  
  static isVowel(c) {
    return ['A','E','I','O','U'].includes(c);
  }
}

module.exports = Metaphone;