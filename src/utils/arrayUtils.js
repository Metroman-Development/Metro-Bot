// utils/arrayUtils.js

/**
 * Splits an array into chunks of specified size
 * @param {Array} array - The array to chunk
 * @param {number} size - The size of each chunk
 * @returns {Array[]} Array of chunks
 */
function chunkArray(array, size) {
  if (!Array.isArray(array)) {
    throw new Error('First argument must be an array');
  }

  if (typeof size !== 'number' || size <= 0) {
    throw new Error('Chunk size must be a positive number');
  }

  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Removes duplicates from an array
 * @param {Array} array - The array to deduplicate
 * @param {Function} keyFn - Optional function to extract comparison key
 * @returns {Array} Array without duplicates
 */
function removeDuplicates(array, keyFn = null) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (keyFn && typeof keyFn === 'function') {
    const seen = new Set();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return [...new Set(array)];
}

/**
 * Groups array elements by a key function
 * @param {Array} array - The array to group
 * @param {Function} keyFn - Function to extract grouping key
 * @returns {Object} Object with grouped elements
 */
function groupBy(array, keyFn) {
  if (!Array.isArray(array)) {
    return {};
  }

  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Safely gets an item at a specific index
 * @param {Array} array - The array to access
 * @param {number} index - The index to access
 * @param {*} defaultValue - Default value if index is out of bounds
 * @returns {*} The item at index or default value
 */
function safeGet(array, index, defaultValue = null) {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index];
}

/**
 * Flattens a nested array to specified depth
 * @param {Array} array - The array to flatten
 * @param {number} depth - Maximum depth to flatten (default: 1)
 * @returns {Array} Flattened array
 */
function flattenArray(array, depth = 1) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (depth <= 0) {
    return array.slice();
  }

  return array.reduce((flat, item) => {
    if (Array.isArray(item) && depth > 0) {
      return flat.concat(flattenArray(item, depth - 1));
    }
    return flat.concat(item);
  }, []);
}

/**
 * Filters array and returns both matching and non-matching items
 * @param {Array} array - The array to partition
 * @param {Function} predicate - Function to test each element
 * @returns {Array[]} Array with [matching, nonMatching] arrays
 */
function partition(array, predicate) {
  if (!Array.isArray(array)) {
    return [[], []];
  }

  const matching = [];
  const nonMatching = [];

  array.forEach(item => {
    if (predicate(item)) {
      matching.push(item);
    } else {
      nonMatching.push(item);
    }
  });

  return [matching, nonMatching];
}

/**
 * Creates an array of specified length filled with a value or function result
 * @param {number} length - Length of the array
 * @param {*|Function} fillValue - Value to fill with, or function to generate values
 * @returns {Array} Filled array
 */
function createFilledArray(length, fillValue) {
  if (typeof length !== 'number' || length < 0) {
    return [];
  }

  const array = new Array(length);

  if (typeof fillValue === 'function') {
    for (let i = 0; i < length; i++) {
      array[i] = fillValue(i);
    }
  } else {
    array.fill(fillValue);
  }

  return array;
}

/**
 * Shuffles array elements randomly (Fisher-Yates algorithm)
 * @param {Array} array - The array to shuffle
 * @returns {Array} New shuffled array
 */
function shuffleArray(array) {
  if (!Array.isArray(array)) {
    return array;
  }

  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  chunkArray,
  removeDuplicates,
  groupBy,
  safeGet,
  flattenArray,
  partition,
  createFilledArray,
  shuffleArray
};
