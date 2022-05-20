/**
 * Created by sayed on 1/10/18.
 * WIP: Not being used currently
 */
var DB = require("./db.mysql");
const dbConfig = require(__home + "/config/db.config");

function DBO(config, newInstance) {
  if (config) {
    console.log("Initializing DBO with configuration:", config);
    this.connection = DB.get(config, newInstance);
    return this.connection;
  }
}

DBO.prototype = {
  getDbConfig: function (mode) {
    const key = mode === "live" ? "live" : mode;
    var config = dbConfig.databases[key] || {};
    if (mode === "live") {
      config.connectionLimit = dbConfig.dbPool.connectionLimit;
    }
    return config;
  },
  selectDB: function (keyName, callback) {
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
  },
  getInstance: function (config, newInstance) {
    const dbConfigObj = this.getDbConfig(dbConfig.dbMode);

    var selectedDbConfig =
      config || dbConfigObj[this.selectedConfig || dbConfig.defaultDb];
    // console.log('selected config: %s', this.selectedConfig || dbConfigObj.defaultDb);

    this.connection = this.connection || DB.get(selectedDbConfig, newInstance);
    return this.connection;
  },
  getDbName: function (callback) {
    this.connection.getCurrentDatabase(callback);
  },
  setDbConfig: function (dbConfigName) {
    console.log("setting dbConfig name to: ", dbConfigName);
    this.selectedConfig = dbConfigName;
  },
};

module.exports = DBO;
