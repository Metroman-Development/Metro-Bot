// File: config/apiConfig.js
require('dotenv').config();

const metroApiConfig = {
  baseUrl: process.env.METRO_API_BASE_URL,
  path: process.env.METRO_API_PATH,
  defaultDay: process.env.METRO_API_DEFAULT_DAY,
  paramOrder: process.env.METRO_API_PARAMS.split(','),
  
  buildUrl: function(startCode, endCode, farePeriod) {
    const params = new URLSearchParams();
    params.append(this.paramOrder[0], startCode.toUpperCase());
    params.append(this.paramOrder[1], endCode.toUpperCase());
    params.append(this.paramOrder[2], this.defaultDay);
    params.append(this.paramOrder[3], farePeriod.toUpperCase());
    
    return `${this.baseUrl}${this.path}?${params.toString()}`;
  }
};

module.exports = metroApiConfig;
