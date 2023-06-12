/**
 * Created by sayed on 1/10/18.
 * WIP: Not being used currently
 */
const DB = require("./db");
const dbConfig = require(__home + "/config/db.config");

class DBO extends DB {
  constructor(config, options) {
    if (config) {
      console.log("Initializing DBO with configuration:", config, options);
      this.connection = this._super(config, options); // call parent constructor
      return this.connection;
    }
  }
  getDbConfig(mode) {
    const key = mode === "live" ? "live" : mode;
    var config = dbConfig.databases[key] || {};
    if (mode === "live") {
      config.connectionLimit = dbConfig.dbPool.connectionLimit;
    }
    return config;
  }
  selectDB(keyName, callback) {
    var config = this.getDbConfig(dbConfig.dbMode);
    console.log("Selecting DB config for:", keyName);
    if (!config[keyName]) {
      throw new Error(
        "Error 100: Could not find any database configuration for key '%s'",
        keyName
      );
    }
    if (this.selectedConfig !== keyName) {
      this.setDbConfig(keyName);
    }
    if (this.connection) {
      console.log("Connection exists. Changing DB.");
      this.connection.changeDB(config[keyName]).then(
        function (result) {
          // console.log('DBO: result of selectDB:', result && result.config);
          callback && callback(null, result);
        },
        function (err) {
          console.log("Error in changing DB:", err);
          callback(err);
        }
      );
    } else {
      console.log("Connection not existing. Creating and switching DB");
      callback(null, this.getInstance(config[keyName]));
    }
  }
  getInstance(config, newInstance) {
    const dbConfigObj = this.getDbConfig(dbConfig.dbMode);

    const selectedDbConfig =
      config || dbConfigObj[this.selectedConfig || dbConfig.defaultDb];
    // console.log('selected config: %s', this.selectedConfig || dbConfigObj.defaultDb);
    this.connection = this.connection || DB.get(selectedDbConfig, newInstance);
    return this.connection;
  }
  getDbName(callback) {
    this.connection.getCurrentDatabase(callback);
  }
  setDbConfig(dbConfigName) {
    console.log("setting dbConfig name to: ", dbConfigName);
    this.selectedConfig = dbConfigName;
  }
}

module.exports = DBO;
