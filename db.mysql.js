var Promise = require('promise');
var mysql = require('mysql');
const allowedKeys = ["usePool", "connectNow"];
function DB(config) {
    console.log("Got DB config:", config);
    var self = this;
    self.config = config;
    const usePool = false && typeof self.usePool === 'undefined' ? true : self.usePool;
    const connectNow = typeof self.connectNow === 'undefined' ? true : self.connectNow;
    self.connectNow = connectNow;

    if (usePool) {
        self.usePool = true;
        self.createPool();
    }
    else {
        self.createConnection();
    }
    !connectNow || self.connectDB();

}
DB.prototype = {
    createPool: function () {
        var self = this;
        self.pool || console.log('Creating pool!');
        self.pool = self.pool || mysql.createPool(self.config);//create pool, instead of single connection
        return self.pool;
    },
    createConnection: function () {
        var self = this;
        self.handle = self.handle || mysql.createConnection(self.config);
        return self.handle;
    },
    getPoolHandle: function () {
        var self = this;
        const pool = self.createPool();
        return new Promise(function (resolve, reject) {
            if(self.handle) return resolve(self.handle);
            pool.getConnection(function (err, connection) {
                if(err) {
                    console.log("Error in getting pool-connection:", err);
                    return reject(err);
                }
                self.handle = connection;
                resolve(self.handle);
            })
        });
    },
    connectHandle: function (callback) {
        var self = this;
        self.createConnection();
        self.handle.connect(function (err) {
            if (err) {
                console.error('error connecting: ' + err.stack);
                throw new Error(err);
            }
            console.log('connected as id ' + self.handle.threadId);
            callback && callback(null, self.handle);
        });
    },
    connectDB: function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.usePool || console.log('has pool?:', Boolean(self.usePool));
            if (self.handle)
                resolve(self.handle);
            else if (self.usePool)
                self.getPoolHandle().then(resolve, reject);
            else
                self.connectHandle().then(resolve, reject);
        });
    },
    set: function (key, value) {
        var self = this;
        if (allowedKeys.indexOf(key) < 0) {
            throw new RangeException(key + " is not a valid key used by the library. Hence, it was not set");
        }
        self[key] = value;
    },
    changeDB: function (newDbConfig) {
        var self = this;
        const config = typeof newDbConfig === 'string' ? {database: newDbConfig} : newDbConfig;
        self.config = {
            host: config.host || self.config.host,
            user: config.user || self.config.user,
            password: config.password || self.config.password,
            database: config.database
        };
        return new Promise(function (resolve, reject) {
            console.log('changing DB to: ', self.config);
            self.connectDB().then(function (handle) {
                console.log('DB connected. Attempting DB change now!');
                handle.changeUser(config, function (err) {
                    if (err) {
                        console.log('failed to change to database ', config, err);
                        return reject(err);
                    }
                    resolve(handle);
                })
            }, function (err) {
                console.log('DB connected FAILED: ', err);
                reject(err);
            })
        })
    },
    getCurrentDatabase: function (callback) {
        this.query("SELECT DATABASE() AS DB", callback);
    },
    end: function (callback) {
        var self = this;
        if (self.pool) {
            self.pool.end(callback);
        }
        else {
            self.handle && self.handle.end && self.handle.end();//for connections (individual)
            self.handle && self.handle.destroy && self.handle.destroy();//for pools
            self.handle = null;
        }
    },
    query: function () {
        var self = this;
        const query = arguments[0];
        var options;
        if(arguments.length>=2) {
            if((typeof arguments[1]).match(/number|array|object|string|boolean/i)) {
                options = arguments[1];
            }
            else if((typeof arguments[2]).match(/number|array|object|string|boolean/i)) {
                options = arguments[2];
            }
            else {
                options = query.indexOf('?')>=0 ?{} :null;
            }
        }
        console.log('QueryOptions:', options);
        var callback = typeof arguments[1]==='function' ?arguments[1] :arguments[2];
        const failFlag = Boolean(arguments[3] || typeof arguments[2]==='boolean');

        var params = options || null;
        callback = callback || function (err, res) {
                console.warn('db.query defCallback::result: ', err, res);
            };

        return self.connectDB().then(function (handle) {
            // console.log('DB connected. Processing query:', query);
            var q = self.handle.query(query, params, callback).on('error', function (err) {
                if (err && !failFlag) {
                    console.log('%s\nQuery FAILED:', params);
                    var msg = err.message.split(':');
                    var error = {
                        code: msg[0],
                        message: msg[1] ? msg[1] : msg[0],
                        error: err
                    };
                    self.query("INSERT INTO failed_query_log SET ?", {
                        query: q.sql,
                        code: error.code,
                        message: error.message
                    }, null, true);
                }
                callback && callback(err);
            });
            return q;
        }, function (err) {
            console.log("Query connection failed to DB:", err);
            callback(err);
        });
    },
    insert: function (data, table, callback) {
        var query = "INSERT INTO " + table + " SET ?";
        /*
         var inserts = [data];
         var sql = mysql.format(query, inserts);
         return this.query(sql, data, callback);*/
        return this.query(query, data, callback);
    },
    update: function (table, values, condition, callback) {
        var query = "UPDATE " + table + " SET ?";
        var data = values;
        if (condition && Object.keys(condition).length) {
            query += " WHERE ";
            data = [values];
            for (var key in condition) {
                query += key + " ?, ";
                data.push(condition[key]);
            }
            query = query.replace(/, $/, '');
        }
        db.query(query, data, callback);
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
        var query = "INSERT INTO " + table + " (" + keys.join(', ') + ") VALUES ?";
        return this.query(query, [values], callback);
    }
};

module.exports = {
    get: function (config, newInstance) {
        if (!newInstance) {
            console.log('requesting DB for config:', config);
            this.instance = this.instance || (new DB(config));
            return this.instance;
        }
        return new DB(config);
    }
};