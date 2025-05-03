async function fetchWithRetry(fn, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  fetchWithRetry
};