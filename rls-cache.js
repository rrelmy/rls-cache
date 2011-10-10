/**
 * @version 0.1
 * @author Rémy M. Böhler
 * @license none (public domain), but feel free to buy me some beer
 * @link http://dev.w3.org/html5/webstorage/
 * @todo check browser support (only checked with chrome 14 and ff7)
 * @todo internet explorer backends?
 * @todo configurable backends
 * @todo external backends support
 */
var RlsCache = function() {
    var EXPIRATION_SUFFIX = '-expiration';
    /**
     * returns the corresponding expirationKey
     */
    var expirationKey = function(key) {
        return key + EXPIRATION_SUFFIX;
    };
    
    /**
     * returns unix timestamp (seconds since January 1, 1970, 00:00:00 UTC)
     */
    var getTimestamp = function() {
        return new Date().getTime() / 1000;
    };
    
    /**
     * check for native JSON support
     * a polyfill supporting stringify and parse would be sufficient.
     */
    var nativeJsonSupport = typeof JSON == 'object' && !!JSON.stringify;
    
    /**
     * check for html5 storage and JSON support
     *
     * storage support could be better, if JSON is not native supported it could store string|number 
     */
    var storageSupport = !!window.Storage && nativeJsonSupport; // JSON.stringify check needed?
    
    /**
     * backends provides four methods
     * objects containing methods are not supported! only values are returned.
     *
     * @param string key
     * @param mixed value
     * @param int ttl time to live in seconds
     * set(key, value, ttl)
     *  
     * @param string key
     * get(key)
     *
     * @param string key
     * remove(key)
     *
     * clear()
     */
    var backends = {
        /**
         * html5 storage
         * requires html5 storage support
         *
         * storage.storage must be a html5 storage interface
         */
        storage: {
            storage: null,
            /**
             * needs to be called before using the backend
             * determines what
             */
            _init: function() {
                if (!!window.localStorage) {
                    this.storage = window.localStorage;
                } else if (!!window.sessionStorage) {
                    this.storage = window.sessionStorage;
                } else if (!!window.globalStorage) {
                    this.storage = window.globalStorage;
                } else {
                    throw 'NoInterfaceFound';
                }
            },
            set: function(key, value, ttl) {
                if (typeof value == 'object') {
                    value = JSON.stringify(value);
                }
                try {
                    if (typeof ttl == 'number' && ttl | 1 > 0) {
                        this.storage.setItem(expirationKey(key), getTimestamp() + (ttl | 1));
                    }
                    return this.storage.setItem(key, value);
                } catch (e) {
                    // TODO better exception handling
                    // QuotaExceededException's could meen no storage at all or we should delete older items
                    return false;
                }
            },
            get: function(key) {
                var expirationTime = this.storage.getItem(expirationKey(key));
                if (expirationTime && expirationTime <= getTimestamp()) {
                    // the cache entrie expired
                    this.remove(key);
                    return null;
                }
                var value = this.storage.getItem(key);
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value;
                }
            },
            remove: function(key) {
                this.storage.removeItem(key);
                this.storage.removeItem(expirationKey(key));
            },
            clear: function() {
                return this.storage.clear();
            }
        },
        /**
         * basic cache, stores cache to a variable
         */
        basic: {
            cache: {},
            _init: function() {},
            set: function(key, value, ttl) {
                var expire = null;
                if (typeof ttl == 'number' && ttl | 1 > 0) {
                    expire = getTimestamp() + (ttl | 1);
                }
                this.cache[key] = {
                    data: value,
                    expire: expire
                };
            },
            get: function(key) {
                if (typeof this.cache[key] == 'object') {
                    if (!this.cache[key].expire || this.cache[key].expire > getTimestamp()) {
                        return this.cache[key].data;
                    }
                    // the cache entrie expired, so we remove it.
                    this.remove(key);
                }
                return null;
            },
            remove: function(key) {
                delete this.cache[key];
            },
            /**
             * clears the cache storage
             */
            clear: function() {
                this.cache = {};
            }
        },
        /**
         * blackhole backend
         * does not store anything
         */
        blackhole: {
            _init: function() {},
            set: function(key, value, ttl) {return true;},
            get: function(key) {return null;},
            remove: function(key) {},
            clear: function() {}
        }
    };
    
    // determine cache backend
    var backend = null;
    if (storageSupport) {
        backend = 'storage';
    } else {
        backend = 'basic';
    }
    
    // init backend, fallback on errors
    while (backend != 'blackhole') {
        try {
            // init backend
            backends[backend]._init();
            break;
        } catch(e) {
            if (backend == 'storage') {
                // fallback to basic backend if storage fails
                backend = 'basic';
            } else {
                // if nothing works fallback to the blackhole
                backend = 'blackhole';
            }
        }
    }
console.info(backend);
    return backends[backend];
}();