var BaseModel, Model, moment, orm,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

orm = require("./index");

moment = require('moment-mini');

Model = orm.Model;

BaseModel = (function(superClass) {
  extend(BaseModel, superClass);
  
  BaseModel.appDebug = false;
  
  function BaseModel(args) {
    this.that = args;
  }

  BaseModel.prototype.debug = function(text) {
    if (this.appDebug) {
      return console.log("base-model.js: " + text);
    }
  };

  BaseModel.prototype.fromJson = function(json, model, allString) {
    var col, i, len, m, obj, ref, value;
    if (!json) {
      return void 0;
    }
    obj = model || new this.clazz();
    obj.jsonEntity = json;
    ref = this.columns;
    for (i = 0, len = ref.length; i < len; i++) {
      col = ref[i];
      if (col.json) {
        value = void 0;
        if (col.owner) {
          if (json[col.owner]) {
            value = json[col.owner][col.json];
          }
        } else {
          value = json[col.json];
        }
        if (typeof col.type === "function") {
          m = new col.type();
          if (col.list) {
            obj[col.name] = m.fromJsonList(value, obj[col.name]);
          } else {
            obj[col.name] = m.fromJson(value, obj[col.name]);
          }
        } else if (col.fromJsonParser) {
          col.fromJsonParser(json, col.name, obj);
        } else if (col.type === 'int' && typeof value === 'string') {
          obj[col.name] = parseInt(value) || 0;
        } else if (col.type === 'decimal' && typeof value === 'string') {
          obj[col.name] = parseFloat(value) || 0;
        } else if (col.type === 'string') {
          obj[col.name] = value === void 0 ? "" : value;
        } else {
          obj[col.name] = value;
        }
        if (allString) {
          obj[col.name] = obj[col.name] + "";
        }
      }
    }
    return obj;
  };

  BaseModel.prototype.fromJsonList = function(jsonList) {
    var i, it, items, len, obj;
    if (!jsonList) {
      return [];
    }
    items = [];
    for (i = 0, len = jsonList.length; i < len; i++) {
      it = jsonList[i];
      obj = this.fromJson(it);
      items.push(obj);
    }
    return items;
  };

  BaseModel.prototype.toJson = function() {
    var col, i, it, j, json, len, len1, ref, ref1;
    json = {};
    ref = this.columns;
    for (i = 0, len = ref.length; i < len; i++) {
      col = ref[i];
      if (col.json) {
        if (col.owner) {
          json[col.owner] = {};
        }
      }
    }
    ref1 = this.columns;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      col = ref1[j];
      if (col.json) {
        it = json;
        if (col.owner) {
          it = json[col.owner];
          if (!it) {
            continue;
          }
        }
        if (typeof col.type === "function") {
          if (this[col.name]) {
            if (col.list) {
              it[col.json] = new col.type().toJsonList(this[col.name]);
            } else {
              it[col.json] = this[col.name].toJson();
            }
          }
        } else if (col.toJsonParser) {
          col.toJsonParser(this, col.name, col.json, it);
        } else {
          if (col.type === 'date') {
            if (this[col.name] && moment(this[col.name]).isValid()) {
              it[col.json] = moment(this[col.name]).format();
            }
          } else if (col.type === 'int') {
            if (this[col.name] === void 0) {
              it[col.json] = "0";
            } else if (typeof this[col.name] === 'string') {
              it[col.json] = ("" + (parseInt(this[col.name]) || 0)) || "0";
            } else {
              it[col.json] = this[col.name] + "";
            }
          } else if (col.type === 'decimal') {
            if (this[col.name] === void 0) {
              it[col.json] = "0.0";
            } else if (typeof this[col.name] === 'string') {
              it[col.json] = ("" + (parseFloat(this[col.name]) || 0.0)) || "0.0";
            } else {
              it[col.json] = this[col.name] + "";
            }
          } else if (col.type === "string") {
            it[col.json] = this[col.name] || "";
          } else if (col.type === "boolean") {
            it[col.json] = this[col.name];
          } else {
            it[col.json] = this[col.name];
          }
        }
      }
    }
    return json;
  };

  BaseModel.prototype.toJsonList = function(list) {
    var i, it, jsonList, len;
    jsonList = [];
    for (i = 0, len = list.length; i < len; i++) {
      it = list[i];
      jsonList.push(it.toJson());
    }
    return jsonList;
  };

  BaseModel.prototype.set = function(opts) {
    return this._set(opts);
  };

  BaseModel.prototype.save = function(callback) {
    return BaseModel.__super__.save.call(this, callback);
  };

  BaseModel.prototype.saveOrUpdatePromise = function() {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      if (that.id > 0 && !that.serverId) {
        return that.exists(that.id, function(result) {
          if (result) {
            return that.update(function(err) {
              if (err) {
                return reject(err);
              } else {
                return resolve();
              }
            });
          } else {
            return that.save(function(err) {
              if (err) {
                return reject(err);
              } else {
                return resolve();
              }
            });
          }
        });
      } else if (that.serverId > 0) {
        return that.getByServerId(that.serverId, function(entity) {
          if (entity) {
            that.id = entity.id;
            return that.update(function(err) {
              if (err) {
                return reject(err);
              } else {
                return resolve();
              }
            });
          } else {
            return that.save(function(err) {
              if (err) {
                return reject(err);
              } else {
                return resolve();
              }
            });
          }
        });
      } else {
        return that.save(function(err) {
          if (err) {
            return reject(err);
          } else {
            return resolve();
          }
        });
      }
    });
  };

  BaseModel.prototype.savePromise = function() {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      return that.save(function(err) {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  BaseModel.prototype.updatePromise = function() {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      return that.update(function(err) {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  BaseModel.prototype.update = function(callback) {
    return BaseModel.__super__.update.call(this, callback);
  };

  BaseModel.prototype.saveOrUpdate = function(callback) {
    var that;
    that = this;
    if (this.id > 0 && !this.serverId) {
      return this.exists(this.id, function(entity) {
        if (entity) {
          return that.update(callback);
        } else {
          return that.save(callback);
        }
      });
    } else if (this.serverId > 0) {
      return this.getByServerId(this.serverId, function(entity) {
        if (entity) {
          that.id = entity.id;
          return that.update(callback);
        } else {
          return that.save(callback);
        }
      });
    } else {
      return that.save(callback);
    }
  };

  BaseModel.prototype.remove = function(callback) {
    return BaseModel.__super__.remove.call(this, callback);
  };

  BaseModel.prototype.removePromise = function(callback) {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      return that.remove(function(err) {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  BaseModel.prototype.removeAll = function(callback) {
    return BaseModel.__super__.removeAll.call(this, callback);
  };

  BaseModel.prototype.removeAllPromise = function() {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      return that.removeAll(function(err) {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  BaseModel.prototype.removeByFilterPromise = function(args) {
    var i, it, len, that;
    that = this;
    if (Object.prototype.toString.call(args) !== '[object Array]') {
      args = [args];
    }
    for (i = 0, len = args.length; i < len; i++) {
      it = args[i];
      if (!it.op) {
        it.op = '=';
      }
    }
    return new Promise(function(resolve, reject) {
      return that.removeByFilter(args, function(err) {
        if (err) {
          console.log('err ' + err);
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  BaseModel.prototype.get = function(id, callback) {
    return BaseModel.__super__.get.call(this, id, callback);
  };

  BaseModel.prototype.getByServerId = function(id, callback) {
    if (id) {
      return BaseModel.__super__.getByServerId.call(this, id, callback);
    } else {
      return callback(void 0);
    }
  };

  BaseModel.prototype.all = function(callback) {
    return BaseModel.__super__.all.call(this, callback);
  };

  BaseModel.prototype.each = function(each, callback) {
    return BaseModel.__super__.each.call(this, each, callback);
  };

  BaseModel.prototype.toInsertQuery = function() {
    return BaseModel.__super__.toInsertQuery.call(this);
  };

  BaseModel.prototype.toUpdateQuery = function() {
    return BaseModel.__super__.toUpdateQuery.call(this);
  };

  BaseModel.prototype.count = function(callback) {
    return BaseModel.__super__.count.call(this, callback);
  };

  BaseModel.prototype.onSync = function() {
    this.sync = false;
    return this;
  };

  BaseModel.prototype.onSyncOk = function() {
    this.sync = true;
    return this;
  };

  BaseModel.prototype.foreach2 = function(items, each, callback) {
    var e, next, nextIndex, that;
    nextIndex = 0;
    that = this;
    next = function() {
      var e, entity, nextCall, result;
      if (!items || nextIndex >= items.length) {
        if (callback) {
          callback();
        }
        return;
      }
      entity = items[nextIndex];
      nextCall = function() {
        var e;
        nextIndex++;
        try {
          return next();
        } catch (error1) {
          e = error1;
          return that.debug("foreach error 1: " + e);
        }
      };
      result = each(entity, nextCall, nextIndex);
      if (!result) {
        nextIndex++;
        try {
          return next();
        } catch (error1) {
          e = error1;
          return that.debug("foreach error 2: " + e);
        }
      }
    };
    try {
      return next();
    } catch (error1) {
      e = error1;
      return this.debug("foreach error 3: " + e);
    }
  };

  BaseModel.prototype.runAll = function(list) {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      var each;
      each = function(p, next) {
        p.then(function() {
          return next();
        })["catch"](function(error) {
          return reject(error);
        });
        return true;
      };
      return that.foreach2(list, each, function() {
        return resolve();
      });
    });
  };

  BaseModel.prototype.saveOrUpdateBatch = function(list) {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      var each;
      each = function(p, next) {
        p.saveOrUpdatePromise().then(function() {
          return next();
        })["catch"](function(error) {
          return reject(error);
        });
        return true;
      };
      return that.foreach2(list, each, function() {
        return resolve();
      });
    });
  };

  BaseModel.prototype.saveBatch = function(list) {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      var each;
      each = function(p, next) {
        p.savePromise().then(function() {
          return next();
        })["catch"](function(error) {
          return reject(error);
        });
        return true;
      };
      return that.foreach2(list, each, function() {
        return resolve();
      });
    });
  };

  BaseModel.prototype.updateBatch = function(list) {
    var that;
    that = this;
    return new Promise(function(resolve, reject) {
      var each;
      each = function(p, next) {
        p.updatePromise().then(function() {
          return next();
        })["catch"](function(error) {
          return reject(error);
        });
        return true;
      };
      return that.foreach2(list, each, function() {
        return resolve();
      });
    });
  };

  return BaseModel;

})(Model);

exports.BaseModel = BaseModel;
