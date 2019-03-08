# es-helper-mysql
Utility functions wrapper over native NodeJS `mysql` package to perform operations like connect, querying, insertion, batch-insertion, etc. easily. Could be buggy; use at your risk. Has bee helping me though in a number of projects over years.

## Installation
You can install the utility using `npm`, or you can simply download the zip (Click on 'Download zip' button above) and reference the index.js file in your NodeJS code. Please note that this code is not to be used in Front End as not only it is irrelevant, but may fail as well.

Using `npm`, run below command:

`npm i --save https://github.com/eternalsayed/es-helper-mysql`

## Usage
```javascript
const esMysql = require('es-helper-mysql');
const dbo = esMysql.getDbHandle();
const db = dbo.getInstance();
db.query('SELECT * FROM users', (err, res) => {
  db.end();
  callback(err, res);
});
```

## Helper functions
### connect()
Selects one of the configuration from availables ones, based on the `__mode` set via `setCommonGlobals` in `es-util-app`. Since you can override these values (not advisable though) at any place, you can choose any of the configurations of available DB configs before the connect function is called.


## Contributing:
You're more than welcome to help me improvise this code. To begin, fork the project, create a branch in your name from `master` and when you're done, please raise a `pull-request`. I'll try to be prompt in merging your requests ASAP.
