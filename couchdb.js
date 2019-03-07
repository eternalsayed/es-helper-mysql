module.exports = function () {
    const NodeCouchDb = require('node-couchdb');
    let instance;
    return {
        init: function (config) {
            let options = {};
            config = config || {};
            if(config.url) {
                let host = url.split('//');
                options.host = host[1] ?host[1] :host[0];//url
                const protocol = host[0].match(/^https?/);
                options.protocol = protocol && protocol[0] || 'http';
                options.port = config.port || 6984;
            } else if(config.remote) {
                options = config.remote;
            }
            if(config.auth) {
                options.auth = {
                    user: config.auth.user,
                    pass: config.auth.pass
                }
            }
            if(config.useCache) {
                const MemcacheNode = require('node-couchdb-plugin-memcached');
                options.cache = new MemcacheNode
            }
            instance = new NodeCouchDb(options);
            return instance;
        },
        getInstance: function (config) {
            return instance || this.init(config);
        }
    }
};