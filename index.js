const mysql = require("mysql");
const debug = require("debug")(process.env.DEBUG || "DB");

let dbServers = {},
  dbEnvFile = __config + "db/db.env";
let handle = null;
try {
  dbServers = require(dbEnvFile);
} catch (e) {
  debug("ENV files error %s", dbEnvFile);
  debug("Error: ", e);
}
let dbConfig;
module.exports = {
  selectConfig: function (name, skip) {
    dbConfig = dbServers;
    this.selectedConfig = name.toLowerCase();
    let pickedConfig = dbServers[this.selectedConfig];
    if (pickedConfig && pickedConfig.host && pickedConfig.database) {
      dbConfig = pickedConfig;
    }
    debug('Loaded db config for "%s" mode', name, dbConfig.database);
    !skip && this.reconnect();
  },
  conn: handle,
  connect: function () {
    if (!handle) {
      const mode = __isLocal ? "local" : __mode;
      !dbConfig && this.selectConfig(mode, true);

      handle = mysql.createConnection(dbConfig);
      handle.connect(function (err) {
        if (err) {
          console.log("Error connecting to Db:", err);
          return false;
        }
        console.log("Database connected");
        return true;
      });
    }
    return handle;
  },
  reconnect: function () {
    this.end();
    this.connect();
  },
  end: function () {
    handle && handle.end && handle.end();
    handle = null;
  },
  getDbHandle: function () {
    return handle || this.connect();
  },
  selectDb: function (config, callback) {
    let newConfig;
    if (!config) {
      return callback && callback("Required config missing");
    }
    if (typeof config === "string") {
      newConfig = { database: config };
    } else {
      newConfig = {
        ...config,
        database: config.database || config.db || config.dbName,
      };
    }
    handle && handle.changeUser(newConfig, callback);
  },
  query: function (query, options, callback, failFlag) {
    const self = this;
    const params = typeof options == "function" ? null : options;
    callback =
      callback === undefined
        ? typeof options == "function"
          ? options
          : null
        : callback;
    callback =
      callback || ((err, res) => console.warn("db.query defCallback::result: ", err, res))
    const handle = self.getDbHandle();
    try {
      const q = handle.query(query, params, callback).on("error", function (err) {
        err && console.log("%s\nQuery failed with error:", q.sql, err);
        if (err && !failFlag) {
          const msg = err.message.split(":");
          const error = {
            code: msg[0],
            message: msg[1] ? msg[1] : msg[0],
            error: err,
          };
          self.query("INSERT INTO failed_query_log SET ?", {
              query: q.sql,
              code: error.code,
              message: error.message,
            },
            null,
            true
          );
        }
        return callback(err);
      });
      return q; 
    } catch(e) {
      console.log('Error in performing query:\n', e);
      callback(e);
    }
  },
  insert: function (data, table, callback) {
    var query = "INSERT INTO " + table + " SET ?";
    /*
                 var inserts = [data];
                 var sql = mysql.format(query, inserts);
                 return this.query(sql, data, callback);*/
    return this.query(query, data, callback);
  },
  update: function (table, data, condition, callback) {
    const keys = Object.keys(data)
      .map((i) => i + "=?")
      .join(",");
    let values = Object.values(data);

    const conditions = Object.keys(condition)
      .map((i) => i + "=?")
      .join(" AND ");
    values = values.concat(Object.values(condition));

    const query = `UPDATE ${table} SET ${keys} WHERE ${conditions}`;

    this.query(query, values, callback);
  },
  insertBatch: function (rows, table, callback) {
    var keys = [];
    var values = [];
    rows.forEach(function (row, index) {
      var temp = [];
      for (var key in row) {
        if (index == 0) keys.push(key);
        temp.push(row[key]);
      }
      values.push(temp);
    });
    var query = "INSERT INTO " + table + " (" + keys.join(", ") + ") VALUES ?";
    return this.query(query, [values], callback);
  },
  escape: (str) => {
    return mysql.escape(str);
  },
  getInstance: function () {
    return this;
  },
};
