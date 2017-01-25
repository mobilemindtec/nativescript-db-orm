var Sqlite = require( "nativescript-sqlite" );
var dbORM = require("./orm");
var moment = require("moment")
var dbName 
var isDebug = false

function debug(text){  
  if(isDebug)
    console.log("** ORM: " + text)
}


function DbChecker(){

}

function createDatabase (callback) {
  new Sqlite(dbName, function(err, db) {
    
    if(err)
      debug("Erro ao conectar com o banco de dados. Detalhes: " + err)

    callback(db)  

    db.close()
  })  
}

DbChecker.prototype.onDebug = function(b){
  isDebug = b
}

DbChecker.prototype.createOrUpdate = function(reset, databaseName, models, callback){

  dbName = databaseName

  debug("## database reset=" + reset)
  debug('call database version method')

  if(reset)
   Sqlite.deleteDatabase(dbName)

  // version checker
  createDatabase(function(db) {
    db.version(function(err, ver) {

      ver = parseInt(ver)
      debug('database version ' + ver)

      if (ver == 0) {

        var tables = []

        for(var i = 0; i < models.length; i++){
          
          var model = models[i]

          var table = "create table " + model.tableName + " ( "

            for(var j = 0; j < model.columns.length; j++){

              var column = model.columns[j]
              
              table += column.name

              if(column.key){
                table += " integer primary key autoincrement, "
                continue
              }

              if(column.type == 'string' || column.type == 'date'){
                  table += " text"
              }else if(column.type == 'boolean'){
                table += " int"
              }else if(typeof column.type === "function" ){
                table += " int"
              }else if(column.type == 'decimal'){
                table += " real"
              }else{
                table += " " + column.type
              }

              if(column.nullable)
                table += " not null"

              if(column._default)
                table += " default '" + column._default + "'"

              if(j < model.columns.length - 1)
                table += ", "
            }

          table +=  " )"
          
          tables.push(table)
        }

        for(it in tables){
          debug(tables[it])
          db.execSQL(tables[it], function(err){
            if(err){
              debug("error to create table : " + err)
            }else{
              debug("success to create table")
            }
          });
        }

        debug('update database to version 1')
        db.version(1); // Sets the version to 1
      
      }else{
        debug('dont update database version')
      }

      callback()
    });
  });     
}

function Model(){

}

function extend(ChildClass, ParentClass) {
  ChildClass.prototype = new ParentClass();
  ChildClass.prototype.constructor = ChildClass;
}



function execute(sql, params, callback){

  createDatabase(function(db) {
    
    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.execSQL(sql, params, callback)

  });   
}

Model.prototype.executeNative = execute;

function get(sql, params, callback){
  createDatabase(function(db) {
    
    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.get(sql, params, callback)

  });   
}

Model.prototype.getNative = get;

function all(sql, params, callback){
  createDatabase(function(db) {
    
    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.all(sql, params, callback)

  });   
}

Model.prototype.allNative = all;

function each(sql, params, rowCallback, finishedCallback){
  createDatabase(function(db) {
    
    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.each(sql, params, rowCallback, finishedCallback)

  });   
}

Model.prototype.eachNative = each;


Model.prototype._save = function(table, attrs, callback){
  var args = []
  var names = ""
  var values = ""

  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]

    if(it.name == 'id')
      continue

    names += it.name + ","
    values += "?,"

    try{

      if(it.type == 'date'){
        if(attrs[it.name]){
          var val = attrs[it.name] && moment(attrs[it.name]).isValid() ? moment(attrs[it.name]).format('YYYY-MM-DD HH:mm:ss.SSS') : null
          args.push(val)
        }else{
          args.push(null)        
        }
      }else if(it.type == 'boolean'){
        args.push(attrs[it.name] ? 1 : 0)
      }else if(typeof it.type === "function"){
        
        if(!attrs[it.name] || !attrs[it.name].id){
          args.push(null) 
          continue
        }

        if(typeof attrs[it.name].id === "string")
          attrs[it.name].id = parseInt(attrs[it.name].id)

        args.push(attrs[it.name].id)    

      }else{ 

        if(it.type == 'int' && typeof attrs[it.name] === 'string')
          attrs[it.name] = parseInt(attrs[it.name])
        else if(it.type == 'decimal' && typeof attrs[it.name] === 'string')
          attrs[it.name] = parseFloat(attrs[it.name])

        args.push(attrs[it.name] || null)
      }      
    }catch(e){
      debug("Model.prototype._save error: " + e)
    }

  }
  
  // remove last (,)
  names = names.substring(0, names.length-1)
  values = values.substring(0, values.length-1)

  execute("insert into " + table + " (" + names + ") values (" + values + ")", args, function(err, id){
    
    if(!err)
      attrs['id'] = id
    
    debug('save callback in model. err=' + err)

    callback(err)
  })   
}

Model.prototype._update = function(table, attrs, callback){
  var args = []
  var names = ""

  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]

    if(it.name == 'id')
      continue

    names += it.name + " = ?,"
    //values += "?,"

    if(it.type == 'date'){
      if(attrs[it.name]){
        var val = attrs[it.name] && moment(attrs[it.name]).isValid() ? moment(attrs[it.name]).format('YYYY-MM-DD HH:mm:ss.SSS') : null
        args.push(val)
      }else{
        args.push(null)        
      }
    }else if(it.type == 'boolean'){
      args.push(attrs[it.name] ? 1 : 0)
    }else if(typeof it.type === "function" ){
      if(!attrs[it.name] || !attrs[it.name].id){
        args.push(null) 
        continue
      }

      if(typeof attrs[it.name].id === "string")
        attrs[it.name].id = parseInt(attrs[it.name].id)

      args.push(attrs[it.name].id)    
    }else{ 

      if(it.type == 'int' && typeof attrs[it.name] === "string")
        attrs[it.name] = parseInt(attrs[it.name])

      if(it.type == 'decimal' && typeof attrs[it.name] === "string")
        attrs[it.name] = parseFloat(attrs[it.name])

      args.push(attrs[it.name] || null)
    }
  }

  args.push(attrs['id'])

  // remove last (,)
  names = names.substring(0, names.length-1)

  var query = "update " + table + " set " + names + " where id = ?"
  debug("## execute " + query)

  execute(query, args, function(err){
    debug('update callback in model. err=' + err)
    callback(err)
  })   
}

Model.prototype._remove = function(table, attrs, callback){
  execute("delete from " + table + " where id = ?", [attrs['id']], function(err){
    debug('delete callback in model. err=' + err)
    callback(err)
  })     
}

Model.prototype._removeAll = function(table, callback){
  execute("delete from " + table, [], function(err){
    debug('delete all models callback. err=' + err)
    callback(err)
  })     
}


Model.prototype._count = function(table, callback){
  get("select count(id) from " + table, [], callback)     
}

Model.prototype._get = function(table, attrs, conditions, callback){
  var names = ""
  var cons = ""
  var args = []

  for(var i = 0; i < this.columns.length; i++)
    names += this.columns[i].name + ","    
  
  names = names.substring(0, names.length-1)

  for(it in conditions){
    debug('get ' + it)
    cons += conditions[it].col + " " + conditions[it].op + " ? and"
    args.push(conditions[it].val)
  }  

  cons = cons.substring(0, cons.length-3)

  get(" select " + names + " from " + table + " where " + cons, args, callback)
}

Model.prototype._all = function(table, attrs, conditions, callback){
  var names = ""
  var cons = ""
  var sql = ""
  var args = []

  for(var i = 0; i < this.columns.length; i++)
    names += this.columns[i].name + ","    
  
  names = names.substring(0, names.length-1)

  sql = " select " + names + " from " + table

  if(conditions){
    for(it in conditions){      
      cons += " " + conditions[it].col + " " + conditions[it].op + " ? and"
      args.push(conditions[it].val)      
    }  

    cons = cons.substring(0, cons.length-3)
    sql += " where " + cons
  }
  

  all(sql, args, callback)
}

Model.prototype._selectAll = function(query, args, callback){
  all(query, args, callback)
}

Model.prototype._selectOne = function(query, args, callback){
  get(query, args, callback)
}


Model.prototype._init = function(_this, attrs){
  for(it in attrs)
    _this[it] = attrs[it]
}  

Model.prototype._prepare = function(_this, attrs){
  for(it in attrs)
    attrs[it] = _this[it]
}  

Model.prototype._resultToJson = function(item, callback, onItemConverter){

  try{
    debug("Model.prototype._resultToJson " + item)

    if(item){
      var opts = {}
      var i = 0          
      for(var j = 0; j < this.columns.length; j++){

        var it = this.columns[j]
        var value = item[i++]

        //debug("## it.type=" + it.type + ", it.name=" + it.name + ", value=" + value)

        if(it.type == 'date' &&  value && moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').isValid())
          opts[it.name] = moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').toDate()
        else if(it.type == 'boolean')   
          opts[it.name] = value && value == 1 ? true : false
        else if(typeof it.type === "function" ){
          if(value){
            opts[it.name] = new it.type({id: value})
          }
        }
        else
          opts[it.name] = value
      }    

      var itemConverted = new this.clazz(opts)
      if(onItemConverter)
        onItemConverter(item, itemConverted)

      if(callback)
        return callback(itemConverted)
      else
        return itemConverted
    }
    if(callback)
      callback(undefined)
    else
      return undefined
  }catch(error){
    callback(undefined)
    debug("Model.prototype._resultToJson error: " + error)
  }
}  

Model.prototype._resultsToJson = function(items, callback, onItemConverter){

  debug("Model.prototype._resultsToJson " + items)
  var results = []
  if(items){
    for(var j = 0; j < items.length; j++){
      var item = items[j]      
      results.push(this._resultToJson(item, undefined, onItemConverter))
    }

    return callback(results)    
  }
  callback(undefined)
} 

Model.prototype._set = function(params){
  for(it in params){    
    this.attrs[it] = params[it]
  }

  Model.prototype._init.call(this, this, this.attrs)
}


// implements

Model.prototype.save = function(callback){
  var self = this
  Model.prototype._prepare.call(this, this, this.attrs)
  Model.prototype._save.call(this, this.tableName, this.attrs, function(err){

    if(err){
      debug("Model.prototype.save error: " + err)
      if(callback)
        callback(err)
    }


    self['id'] = self.attrs['id']      
    if(callback)
      callback()
  })
}


Model.prototype.update = function(callback){
  Model.prototype._prepare.call(this, this, this.attrs)
  Model.prototype._update.call(this, this.tableName, this.attrs, callback)
}

Model.prototype.remove = function(callback){    
  Model.prototype._remove.call(this, this.tableName, this.attrs, callback)
}

Model.prototype.removeAll = function(callback){    
  Model.prototype._removeAll.call(this, this.tableName, callback)
}

Model.prototype.count = function(callback){    
  Model.prototype._count.call(this, this.tableName, callback)
}

Model.prototype.get = function(id, callback){
  var self = this
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: 'id', 'op': '=', 'val': id }] , function(err, item){      

    if(err){
      debug("Model.prototype.get error: " + err)
      callback(null)
    }

    if(item)
      Model.prototype._resultToJson.call(self, item, callback)    
    else
      callback(null)
  })
}

Model.prototype.getByServerId = function(serverId, callback){
  var self = this
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: 'serverId', 'op': '=', 'val': serverId }] , function(err, item){      

    if(err){
      debug("Model.prototype.getByServerId error: " + err)
      callback(null)
    }

    if(item)
      Model.prototype._resultToJson.call(self, item, callback)    
    else
      callback(null)
  })
}

Model.prototype.all = function(callback){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){

    if(err){
      debug("Model.prototype.all error: " + err)
      callback(null)
    }

    if(items){
      debug("###### select " + self.tableName + " count=(" + items.length + ")")      
      Model.prototype._resultsToJson.call(self, items, callback)      
    }else{
      debug("###### select " + self.tableName + " count=(0)")
      callback(null)
    }
  })
},

Model.prototype.filter = function(conditions, callback){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, conditions, function(err, items){

    if(err){
      debug("Model.prototype.filter error: " + err)
      callback(null)
    }

    if(items){
      debug("###### select " + self.tableName + " count=(" + items.length + ")")
      Model.prototype._resultsToJson.call(self, items, callback)      
    }else{
      debug("###### select " + self.tableName + " count=(0)")
      callback(null)
    }
  })
},


Model.prototype.each = function(each, callback){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){   

    if(err){
      debug("Model.prototype.each error: " + err)
      callback(null)
    }

    if(items){
      debug("###### select " + self.tableName + " count=(" + items.length + ")")
      Model.prototype._resultsToJson.call(self, items, callback)      
    }else{
      debug("###### select " + self.tableName + " count=(0)")
      callback()
    }
  })
}


exports.DbChecker = DbChecker;
exports.Model = Model;