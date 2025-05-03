module.exports = (linesData) => {
  const linesIndex = linesData.reduce((acc, line) => ({
    ...acc,
    [line.id.toLowerCase()]: line
  }), {});

  const getLine = (lineId) => 
    linesIndex[lineId.toLowerCase()] || null;

  return { getLine };
};