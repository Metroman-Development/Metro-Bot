// metroLoader.js
const path = require('path');
const fs = require('fs').promises;
const styles = require('../../../../config/metro/styles.json');

module.exports = {
  source: 'metroGeneral.json',
  async load() {
      
    console.log("Loading Stations Data")
      
    const rawData = await this._loadFile('metroGeneral.json');
    return this._transform(rawData);
  },

  async _loadFile(filename) {
    const data = await fs.readFile(path.join(__dirname, '../json', filename), 'utf8');
    return JSON.parse(data);
  },

  _transform(data){
      
      console.log("Transforming data");
      
      //console.log(data);
      
    return data;
      
      
    }
  
};