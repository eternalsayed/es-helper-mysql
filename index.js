//Note: Original DB.JS renamed to MySQL.js. THIS FILE IS THE ONE BEING USED
let handle = null;
const mysql = require('mysql');
let dbServers = require(__config + '/db/db.env');
const debug = require('debug')(process.env.DEBUG);
let dbConfig;
module.exports = {
    selectConfig: function(name) {
        this.selectedConfig = name.toLowerCase();
        dbConfig = dbServers[this.selectedConfig];
        this.reconnect();
    },
    connect: function () {
        if (!handle) {
            const mode = __isLocal ? 'local' : __mode;
            dbConfig = dbConfig || dbServers[mode];
console.log(dbConfig);
            debug('Loaded db config for "%s" mode', mode, dbConfig.database);

            handle = mysql.createConnection(dbConfig);
            handle.connect(function (err) {
                if (err) {
                    console.log('Error connecting to Db:', err);
                    return false;
                }
                console.log('Database connected');
                return true;
            });
        }
        return handle;
    },
    reconnect: function() {
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
    query: function (query, options, callback, failFlag) {
        var self = this;
        var params = typeof options == 'function' ? null : options;
        callback = callback === undefined ? (typeof options == 'function' ? options : null) : callback;
        callback = callback || function (err, res) {
            console.warn('db.query defCallback::result: ', err, res);
        };
        var handle = self.getDbHandle();
        var q = handle.query(query, params, callback).on('error', function (err) {
            err && console.log('%s\nQuery failed with error:', q.sql, err);
            if (err && !failFlag) {
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
            return callback(err);
        });
        return q;
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
    },
    getInstance: function () {
        return this;
    }
};
