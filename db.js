/**
 * WIP: Not being used currently
 * Used by dbo.js
 */
const Promise = require("promise");
const mysql2 = require("mysql2");
const allowedKeys = ["usePool", "connectNow"];
class DB {
  constructor(config, options = {}) {
    if (config) {
      console.log("Got DB config:", config);
      this.config = config;
    }

    const usePool =
      false && typeof options.usePool === "undefined" ? true : options.usePool;
    const connectNow =
      typeof options.connectNow === "undefined" ? true : options.connectNow;
    this.connectNow = connectNow;
    if (usePool) {
      this.usePool = true;
      this.createPool();
    } else {
      this.createConnection();
    }
    !connectNow || this.connectDB();
  }
  createPool() {
    this.pool || console.log("Creating pool!");
    this.pool = this.pool || mysql2.createPool(this.config); //create pool, instead of single connection
    return this.pool;
  }
  createConnection() {
    this.handle = this.handle || mysql2.createConnection(this.config);
    return this.handle;
  }
  getPoolHandle() {
    const pool = this.createPool();
    return new Promise((resolve, reject) => {
      if (this.handle) return resolve(this.handle);
      pool.getConnection((err, connection) => {
        if (err) {
          console.log("Error in getting pool-connection:", err);
          return reject(err);
        }
        this.handle = connection;
        resolve(this.handle);
      });
    });
  }
  connectHandle(callback) {
    this.createConnection();
    this.handle.connect((err) => {
      if (err) {
        console.error("error connecting: " + err.stack);
        return callback ? callback(err) : new Error(err);
      }
      console.log("connected as id " + this.handle.threadId);
      return callback ? callback(null, this.handle) : this.handle;
    });
  }
  connectDB() {
    return new Promise((resolve, reject) => {
      if (this.handle) resolve(this.handle);
      else if (this.usePool) this.getPoolHandle().then(resolve).catch(reject);
      else this.connectHandle().then(resolve).catch(reject);
    });
  }
  set(key, value) {
    if (allowedKeys.indexOf(key) < 0) {
      throw new RangeException(
        key + " is not a valid key used by the library. Hence, it was not set"
      );
    }
    this[key] = value;
  }
  changeDB(newDbConfig) {
    const config =
      typeof newDbConfig === "string" ? { database: newDbConfig } : newDbConfig;
    this.config = {
      ...this.config,
      ...config,
    };
    return new Promise((resolve, reject) => {
      console.log("changing DB to: ", this.config);
      this.connectDB().then(
        (handle) => {
          console.log("DB connected. Attempting DB change now!");
          handle.changeUser(config, (err) => {
            if (err) {
              console.log("failed to change to database ", config, err);
              return reject(err);
            }
            resolve(handle);
          });
        },
        (err) => {
          console.log("DB connected FAILED: ", err);
          reject(err);
        }
      );
    });
  }
  getCurrentDatabase(callback) {
    this.query("SELECT DATABASE() AS DB", callback);
  }
  end(callback) {
    if (this.pool) {
      this.pool.end(callback);
    } else {
      this.handle && this.handle.end && this.handle.end(); //for connections (individual)
      this.handle && this.handle.destroy && this.handle.destroy(); //for pools
      this.handle = null;
    }
  }
  query() {
    const query = arguments[0];
    let options;
    if (arguments.length >= 2) {
      if ((typeof arguments[1]).match(/number|array|object|string|boolean/i)) {
        options = arguments[1];
      } else if (
        (typeof arguments[2]).match(/number|array|object|string|boolean/i)
      ) {
        options = arguments[2];
      } else {
        options = query.indexOf("?") >= 0 ? {} : null;
      }
    }
    console.log("QueryOptions:", options);
    const callback =
      typeof arguments[1] === "function" ? arguments[1] : arguments[2];
    const failFlag = Boolean(arguments[3] || typeof arguments[2] === "boolean");

    const params = options || null;
    callback =
      callback ||
      function (err, res) {
        console.warn("db.query defCallback::result: ", err, res);
      };

    return this.connectDB().then(
      (handle) => {
        // console.log('DB connected. Processing query:', query);
        const q = this.handle
          .query(query, params, callback)
          .on("error", (err) => {
            if (err && !failFlag) {
              console.log("%s\nQuery FAILED:", params);
              const msg = err.message.split(":");
              const error = {
                code: msg[0],
                message: msg[1] ? msg[1] : msg[0],
                error: err,
              };
              this.query(
                "INSERT INTO failed_query_log SET ?",
                {
                  query: q.sql,
                  code: error.code,
                  message: error.message,
                },
                null,
                true
              );
            }
            callback && callback(err);
          });
        return q;
      },
      (err) => {
        console.log("Query connection failed to DB:", err);
        callback(err);
      }
    );
  }
  insert(data, table, callback) {
    const query = "INSERT INTO " + table + " SET ?";
    /*
         const inserts = [data];
         const sql = mysql2.format(query, inserts);
         return this.query(sql, data, callback);*/
    return this.query(query, data, callback);
  }
  update(table, values, condition, callback) {
    const query = "UPDATE " + table + " SET ?";
    const data = values;
    if (condition && Object.keys(condition).length) {
      query += " WHERE ";
      data = [values];
      for (const key in condition) {
        query += key + " ?, ";
        data.push(condition[key]);
      }
      query = query.replace(/, $/, "");
    }
    this.query(query, data, callback);
  }
  insertBatch(rows, table, callback) {
    const keys = [];
    const values = [];
    rows.forEach(function (row, index) {
      const temp = [];
      for (const key in row) {
        if (index == 0) keys.push(key);
        temp.push(row[key]);
      }
      values.push(temp);
    });
    const query =
      "INSERT INTO " + table + " (" + keys.join(", ") + ") VALUES ?";
    return this.query(query, [values], callback);
  }
}

module.exports = DB;
