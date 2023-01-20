import fs from "../fs.js";

function Util () {}

Util.prototype.openFile = function (file) {
  //return this.openFileWithNode('./example/' + file)
  return this.openFileWithNode(file)
}

Util.prototype.openFileWithNode = function (file) {
  return fs.readFileSync(file, 'binary')
}

Util.prototype.writeFile = function (filename, data) {
  this.writeFileWithNode(filename, data)
}

Util.prototype.writeFileWithNode = function (filename, data) {
  fs.writeFileSync(filename, data, 'binary')
}

Util.prototype.onWriteEnd = function (filename, url) {}

Util.prototype.onError = function (e) {}

export default Util;
