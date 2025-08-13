// metroLoader.js
const path = require('path');
const loadJsonFile = require('../../../../utils/jsonLoader.js');
const styles = {};

module.exports = {
  source: 'metroGeneral.json',
  async load() {
      
    console.log("Loading Stations Data")
      
    const rawData = this._loadFile('metroGeneral.json');
    return this._transform(rawData);
  },

  _loadFile(filename) {
    return loadJsonFile(path.join(__dirname, '..', filename));
  },

  _transform(data){
      
      console.log("Transforming data");
      
      //console.log(data);
      
    return data;
      
      
    }
  
};