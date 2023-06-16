const mysql2 = require("mysql2");
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
  selectConfig(name, skip) {
    dbConfig = dbServers;
    this.selectedConfig = name.toLowerCase();
    let pickedConfig = dbServers[this.selectedConfig];
    if (pickedConfig && pickedConfig.host && pickedConfig.database) {
      dbConfig = pickedConfig;
    }
    debug('Loaded db config for "%s" mode', name, dbConfig.database);
    !skip && this.reconnect(); // not sure if this line should be here (could cause infinite recursion)
  },
  conn: handle,
  connect(withMode) {
    if (!handle || withMode) {
      const mode = withMode || (__isLocal ? "local" : __mode);
      this.selectConfig(mode, true);

      handle = mysql2.createConnection(dbConfig);
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
  reconnect() {
    this.end();
    this.connect();
  },
  end() {
    handle && handle.end && handle.end();
    handle = null;
  },
  getDbHandle() {
    return handle || this.connect();
  },
  selectDb(config, callback) {
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
  query(query, options, callback, failFlag) {
    const self = this;
    const params = typeof options == "function" ? null : options;
    callback =
      callback === undefined
        ? typeof options == "function"
          ? options
          : null
        : callback;
    callback =
      callback ||
      ((err, res) => console.warn("db.query defCallback::result: ", err, res));
    const handle = self.getDbHandle();
    try {
      return handle.query(query, params, callback);
    } catch (e) {
      console.log("Error in performing query:\n", e);
      callback(e);
    }
  },
  insert(data, table, callback) {
    var query = "INSERT INTO " + table + " SET ?";
    /*
                 var inserts = [data];
                 var sql = mysql2.format(query, inserts);
                 return this.query(sql, data, callback);*/
    return this.query(query, data, callback);
  },
  update(table, data, condition, callback) {
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
  insertBatch(rows, table, callback) {
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
    return mysql2.escape(str);
  },
  getInstance(forDB) {
    if (forDB) {
      this.tempDbChange = true;
      this.connect(forDB);
    } else if (this.tempDbChange) {
      // go back to using previous db config before when config was changed
      this.tempDbChange = false;
      this.reconnect();
    }
    return this;
  },
};
