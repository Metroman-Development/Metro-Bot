// metroLoader.js
const path = require('path');
const loadJsonFile = require('../../../../src/utils/jsonLoader');
const styles = require('../../../../config/metro/styles.json');

module.exports = {
  source: 'metroGeneral.json',
  async load() {
      
    console.log("Loading Stations Data")
      
    const rawData = this._loadFile('metroGeneral.json');
    return this._transform(rawData);
  },

  _loadFile(filename) {
    return loadJsonFile(path.join(__dirname, '../json', filename));
  },

  _transform(data){
      
      console.log("Transforming data");
      
      //console.log(data);
      
    return data;
      
      
    }
  
};