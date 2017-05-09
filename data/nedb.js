const nedb = require('nedb-promise');

module.exports = {
  pages: nedb({filename: __dirname + '/../nedb/pages.json', autoload: true})
};
