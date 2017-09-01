var Sqlite = require( "nativescript-sqlite" );
var dbORM = require("./orm");
var moment = require("moment")
var dbName
var isDebug = false
var LOAD_CACHE = {}

function debug(text){
  if(isDebug)
    console.log("** ORM: " + text)
}


function foreach(items, each){

  return new Promise(function(accept, reject){

    if(!items)
      return accept()


    var next = function(index){

      if(index >= items.length){
        return accept()
      }

      var item = items[index]

      try{
        each(item, function(){
          next(++index)
        })        
      }catch(err){
        console.log("** error on process foreach position " + index + ": " + err)
        reject(err)
      }

    }

    next(0)


  })

}

function DbChecker(){

}

function ORM(){

}

function createDatabase (callback) {
  var sqlite = new Sqlite(dbName, function(err, db) {

    if(err)
      debug("Erro ao conectar com o banco de dados. Detalhes: " + err)

    callback(db)

    db.close()
  })
}


function getColumnType(column) {

  debug("** into getColumnType ")

  if(column.type == 'string' || column.type == 'date'){
      return "text"
  }else if(column.type == 'boolean'){
    return "int"
  }else if(typeof column.type === "function" ){
    return "int"
  }else if(column.type == 'decimal'){
    return "real"
  }else{
    return column.type
  }  

}

function getColumnDefinitions(column){
  
  debug("** into getColumnDefinitions ")

  var query = ""
  if(column.notNull)
    query += "not null"

  if(column.nullable == false)
    query += "not null"

  if(column._default || column.defaultValue)
    query += "default '" + column.defaultValue + "'"

  if(column.unique)
    query += "unique"  

  return query
}

function tableCreate(model){

  debug("** into tableCreate " + model.tableName)

  return new Promise(function(accept, reject){

  
    var query = "create table " + model.tableName + " ( "

    for(var j = 0; j < model.columns.length; j++){

      var column = model.columns[j]

      query += column.columnName || column.name

      if(column.list)
        continue

      if(column.key){
        query += " integer primary key autoincrement, "
        continue
      }

      query += " " + getColumnType(column)
      query += " " + getColumnDefinitions(column)


      if(j < model.columns.length - 1)
        query += ", "
    }

    query +=  " )"  

    debug("************ table create metadata begin *********************")
    debug(query)
    debug("************ table create metadata end *********************")


    execute(query, [], function(err){

      if(err){
        console.log("** error on create table " + model.tableName + ": " + err)
        return reject(err)
      }

      debug("** table " + model.tableName + " created ")

      accept()

    })

  })


}

function tableExists(model) {

  debug("** into tableExists " + model.tableName)

  var tableName = model.tableName

  return new Promise(function(accept, reject){
    
    var query = "select name From sqlite_master Where type='table' And name = '" + tableName + "'"
    
    debug("** check table exists: " + query)

    get(query, [], function(err, result){

      if(err){
        console.log("** error on ckeck if table " + tableName + " exists: " + err)
        return reject(err)
      }

      console.log("** table exists? " + result)

      accept(result == tableName)

    })

  })

}

function tableUpdate(model){

  debug("** into tableUpdate " + model.tableName)

  return new Promise(function(accept, reject){

    var queries = []

    getTableMetadata(model).then(function(columns){



      for(var i = 0; i < model.columns.length; i++){

        var column = model.columns[i]
        
        if(column.list)
          continue

        var columnName = column.columnName || column.name
        var columnFound = false

        for(var j = 0; j < columns.length; j++){

          var other = columns[j]

          if(columnName == other.name){
            columnFound = true
            break
          }

        }

        if(!columnFound){

          debug("** column " + columnName + ", table" + model.tableName  + " not found ")
          var query = "alter table " + model.tableName + " add " + columnName

          column.unique = false
          query += " " + getColumnType(column)
          query += " " + getColumnDefinitions(column)


          queries.push(query)
        } else {
          debug("** column " + columnName + ", table" + model.tableName  + " found ")
        }


      }


      if(queries.length > 0){

        foreach(queries, function(query, next){

          debug("** execute DDL: " + query)

          execute(query, [], function(err){

            if(err){
              console.log("** error on execute alter table [" + query + "]: " + err)
              return reject(err)
            }

            next()

          })

        }).then(function(){
          accept()
        }).catch(function(err){
          reject(err)
        })

      }else {
        accept()
      }



    }).catch(function(err){
      reject(err)
    })

  })

}

function getTableMetadata(model) {

  debug("** into getTableMetadata " + model.tableName)

  var tableName = model.tableName

  return new Promise(function(accept, reject){

    var columns = []
    var query = "PRAGMA table_info('" + tableName + "')"

    all(query, [], function(err, results){

      if(err){
        console.log("** error on get table " + tableName + " metadata: " + err)
        return reject(err)
      }

      debug("** table metadata: " + results)

      if(results){
        for(var i = 0; i < results.length; i++){

          var result = results[i]
          columns.push({
            position: result[0],
            name: result[1],
            type: result[2],
            nullable: result[3] == 0,
            defaultValue: result[4],
            key: result[5] == 1
          })

        }
      }

      debug("** columns = " + JSON.stringify(columns))

      accept(columns)

    })

  })
  

}

function onDebug(b){
  isDebug = b
}

DbChecker.prototype.onDebug = onDebug
ORM.prototype.onDebug = onDebug

function init (args) {

  dbName = args.databaseName
  var forceDbReset = args.reset
  var models = args.models

  if(args.debug)
    onDebug(true)

  debug("** force database reset: " + forceDbReset)
  debug('call database version method')

  if(forceDbReset)
   Sqlite.deleteDatabase(dbName)

  return new Promise(function(accept, reject){
    // version checker
    

      foreach(models, function(model, next){

        tableExists(model).then(function(exists){

          if(!exists){
            tableCreate(model).then(function(){
              next()
            }).catch(function(err){
              reject(err)
            })
          }else{
            tableUpdate(model).then(function(){
              next()
            }).catch(function(err){
              reject(err)
            })
          }

        }).catch(function(){
          reject(err)  
        })

      }).then(function(){
        accept()
      }).catch(function(err){
        reject(err)
      })        


        
          
  

  })
}


DbChecker.prototype.init = init
ORM.prototype.init = init

DbChecker.prototype.createOrUpdate = function(reset, databaseName, models, callback, errorCallback){
  init({
    reset: reset,
    databaseName: databaseName, 
    models: models
  }).then(function(){
    callback()
  }).catch(function(err){
    errorCallback(err)
  })
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

Model.prototype.foreach = foreach

Model.prototype.executeNativeNonQuery = execute;

Model.prototype.executeNativeAll = all;
Model.prototype.executeNative = all;
Model.prototype.executeNativeGet = get;

Model.prototype.executeNativeResultsTransformer = function(sql, params, callback){

  var self = this

  createDatabase(function(db) {

    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.all(sql, params, function(err, results){

      if(err){
        console.log("** executeNativeResultsTransformer: error on run sql: " + err)
      }else{
        Model.prototype._resultsToJson.call(self, results, callback)
      }

    })

  });

}

Model.prototype.executeNativeResultTransformer = function(sql, params, callback){

  var self = this

  createDatabase(function(db) {

    debug('execute ' + sql + "  values " + JSON.stringify(params))

    db.get(sql, params, function(err, result){

      if(err){
        console.log("** executeNativeResultTransformer: error on run sql: " + err)
      }else{
        if(result)
          Model.prototype._resultToJson.call(self, result, callback)
        else
          callback(null)
      }

    })

  });

}

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

Model.prototype._toInsertQuery = function(table, attrs){
  var args = []
  var names = ""
  var values = ""

  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]


    if(it.key || it.list)
      continue

    names += (it.columnName || it.name) + ","
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

        if(!attrs[it.name]){
          args.push(null)
          continue
        }

        var keyName = getModelKeyName(attrs[it.name])

        if(!attrs[it.name][keyName]){
          args.push(null)
          continue
        }

        var keyVal = attrs[it.name][keyName]

        if(typeof keyVal === "string")
          keyVal = parseInt(keyVal)

        args.push(keyVal)


      }else{

        if(it.type == 'int'){
          if(typeof attrs[it.name] === 'string')
            attrs[it.name] = parseInt(attrs[it.name]) || 0
          else
            attrs[it.name] = attrs[it.name] || 0
        }else if(it.type == 'decimal'){
          if(typeof attrs[it.name] === 'string')
            attrs[it.name] = parseFloat(attrs[it.name]) || 0
          else
            attrs[it.name] = attrs[it.name] || 0
        }

        args.push(attrs[it.name])
      }
    }catch(e){
      debug("Model.prototype._save error: " + e)
    }

  }

  // remove last (,)
  names = names.substring(0, names.length-1)
  values = values.substring(0, values.length-1)

  return {
    query: "insert into " + table + " (" + names + ") values (" + values + ")",
    args: args
  }
}

function getModelKeyName(model){
  for(var i = 0; i < model.columns.length; i++){
    var col = model.columns[i]
    if(col.key){
      return col.name
    }
  }
}

Model.prototype._toUpdateQuery = function(table, attrs){
  var args = []
  var names = ""

  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]

    if(it.key || it.list)
      continue

    names += (it.columnName || it.name) + " = ?,"
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

      if(!attrs[it.name]){
        args.push(null)
        continue
      }

      var keyName = getModelKeyName(attrs[it.name])

      if(!attrs[it.name][keyName]){
        args.push(null)
        continue
      }

      var keyVal = attrs[it.name][keyName]

      if(typeof keyVal === "string")
        keyVal = parseInt(keyVal)

      args.push(keyVal)

    }else{

      if(it.type == 'int'){
        if(typeof attrs[it.name] === "string")
          attrs[it.name] = parseInt(attrs[it.name]) || 0
        else
          attrs[it.name] = attrs[it.name] || 0
      }else if(it.type == 'decimal'){
        if(typeof attrs[it.name] === "string")
          attrs[it.name] = parseFloat(attrs[it.name]) || 0
        else
          attrs[it.name] = attrs[it.name] || 0
      }

      args.push(attrs[it.name])
    }
  }

  args.push(attrs['id'])

  // remove last (,)
  names = names.substring(0, names.length-1)

  return {
    query: "update " + table + " set " + names + " where id = ?",
    args: args
  }
}

Model.prototype._save = function(table, attrs, callback){

  LOAD_CACHE = {}
  var result = this._toInsertQuery(table, attrs)
  var that = this

  execute(result.query, result.args, function(err, id){

    if(!err){
      var keyName = getModelKeyName(that)
      attrs[keyName] = id
    }

    debug('save callback in model. err=' + err)



    callback(err)
  })
}

Model.prototype._update = function(table, attrs, callback){

  LOAD_CACHE = {}
  var result = this._toUpdateQuery(table, attrs)

  execute(result.query, result.args, function(err){
    debug('update callback in model. err=' + err)
    callback(err)
  })
}

Model.prototype._remove = function(table, attrs, callback){
  LOAD_CACHE = {}
  execute("delete from " + table + " where id = ?", [attrs['id']], function(err){
    debug('delete callback in model. err=' + err)
    callback(err)
  })
}

Model.prototype._removeAll = function(table, callback){
  LOAD_CACHE = {}
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

  for(var i = 0; i < this.columns.length; i++){
    
    if(this.columns[i].list)
      continue    

    names += (this.columns[i].columnName || this.columns[i].name) + ","
  }

  names = names.substring(0, names.length-1)

  for(it in conditions){
    debug('get ' + it)

    var op = conditions[it].op

    if(!op)
      op = "="

    cons += conditions[it].col + " " + op + " ? and"
    args.push(conditions[it].val)
  }

  cons = cons.substring(0, cons.length-3)

  get(" select " + names + " from " + table + " where " + cons, args, callback)
}

Model.prototype._all = function(table, attrs, options, callback){
  var names = ""
  var cons = ""
  var sql = ""
  var args = []


  for(var i = 0; i < this.columns.length; i++){
    if(this.columns[i].list)
      continue     
    names += "c." + (this.columns[i].columnName || this.columns[i].name) + ","
  }

  names = names.substring(0, names.length-1)

  sql = " select " + names + " from " + table + " c "

  if(options){
    var conditions
    var extra = {}
    var sort = undefined
    var order = undefined
    var joins = []

    if(Object.prototype.toString.call(options) === '[object Array]'){
      conditions = options
    } else {
      conditions = options.conditions
      extra = options.extra || {}
      sort = options.sort
      order = options.order

      if(options.joins){
        for(var i in options.joins){
          joins.push(options.joins[i])
        }
      }
    }

    for(var i in joins){
      sql += " " + joins[i] + " "
    }

    if(conditions && conditions.length > 0){

      if(!(Object.prototype.toString.call(conditions) === '[object Array]')){
        conditions = [ conditions ]
      }

      for(it in conditions){

        if(conditions[it].native){
          cons += " " + conditions[it].native + " and"
          if(conditions[it].val)
            args.push(conditions[it].val)
        }else{

          var columnName = conditions[it].col
          var op = conditions[it].op

          if(columnName.indexOf(".") == -1)
            columnName = "c." + columnName


          if(!op)
            op = "="

          cons += " " + columnName + " " + op + " ? and"
          args.push(conditions[it].val)

        }
      }

      cons = cons.substring(0, cons.length-3)
      sql += " where " + cons
    }

    if(sort){
      sql += " order by " + sort
    }

    if(order){
      sql += " " + order
    }

    if(options.limit){
      sql += " limit ? offset ?"
      args.push(options.limit)
      args.push(options.offset || 0)
    }
  }


  all(sql, args, callback)
}

Model.prototype._removeBy = function(table, attrs, conditions, callback){
  var cons = ""
  var sql = ""
  var args = []

  sql = " delete from " + table

  if(conditions){
    for(it in conditions){

      var op = conditions[it].op

      if(!op)
        op = "="

      cons += " " + conditions[it].col + " " + op + " ? and"
      args.push(conditions[it].val)
    }

    cons = cons.substring(0, cons.length-3)
    sql += " where " + cons
  }

  execute(sql, args, callback)
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

  for(var i = 0; i < _this.columns.length; i++){
    
    var col = _this.columns[i]
    
    if(typeof col.type === "function"){

      if(!col.list){
        var funcName = col.name
        funcName = funcName[0].toUpperCase() + funcName.substring(1,funcName.length)
        var funcBody = "var self = this, obj=self['" + col.name + "']; return new Promise(function(accept, reject){ obj.get(obj.id, function(result){ self['" + col.name + "'] = result ;accept(result) })  })"
        _this['get' + funcName] = new Function("callback", funcBody)
      } else if(col.list && !col.eager){
        var funcName = col.name
        funcName = funcName[0].toUpperCase() + funcName.substring(1,funcName.length)
        var keyName = getModelKeyName(_this)
        var funcBody = "var self = this, type = this['" + col.name + "']; return new Promise(function(accept, reject){ type.filter([{ col: '" + col.relationColumn + "', val: self['"+keyName+"']  }], function(results){ self['" + col.name + "'] = results; accept(results) }) });"
        _this['get' + funcName] = new Function("callback", funcBody)        
      }
    }
  }  
}

Model.prototype._prepare = function(_this, attrs){
  for(it in attrs)
    attrs[it] = _this[it]
}

Model.prototype.cacheClear = function(){ LOAD_CACHE = {}; }

Model.prototype._resultToJson = function(item, callback, onItemConverter){


  try{
    debug("Model.prototype._resultToJson " + item)

    if(item){
      var opts = {}
      var i = 0

      var self = this
      foreach(this.columns, function(it, next){
        
        var value = item[i++]

        if(it.type == 'date' &&  value && moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').isValid()){
          opts[it.name] = moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').toDate()
          next()
        }else if(it.type == 'boolean'){
          opts[it.name] = value && value == 1 ? true : false
          next()        
        }else if(it.list){
          opts[it.name] = new it.type()
          next()        
        }else if(typeof it.type === "function" ){
          if(value){
            
            var type = new it.type()
            var key = type.tableName + "#" + value
            var keyName = getModelKeyName(type)
            
            if(it.eager){

              
              if(LOAD_CACHE[key]){
                
                opts[it.name] = LOAD_CACHE[key]
                next()                

              }else{

                type.get(value, function(result){
                  LOAD_CACHE[key] = result
                  opts[it.name] = result
                  next()
                })

              }

            }else{
              opts[it.name] = type
              opts[it.name][keyName] = value
              LOAD_CACHE[key] = opts[it.name]
              next()
            }
          }else{
            next()
          }
        }else{
          opts[it.name] = value
          next()
        }

        
      }).then(function(){

        var itemConverted = new self.clazz(opts)
        var key = itemConverted.tableName + "#" + itemConverted[getModelKeyName(itemConverted)]

        if(!LOAD_CACHE[key]){
          LOAD_CACHE[key] = itemConverted
        }

        foreach(self.columns, function(it, next){

          if(it.list){
            var type = new it.type()
            var keyName = getModelKeyName(type)

            if(it.eager && !opts[it.name]){
              type.filter([{ col: it.relationColumn, val: opts[keyName]  }], function(results){
              
                opts[it.name] = results
                next()

              })
            }else{
              next()
            }

            
          }else{
            next()
          }

        }).then(function(){
          
          itemConverted = new self.clazz(opts)

          if(onItemConverter)
            onItemConverter(item, itemConverted)

          callback(itemConverted)


        })        
        
      })


    }else{    
      callback(undefined)
    }

  }catch(error){
    callback(undefined)
    debug("Model.prototype._resultToJson error: " + error)
  }
}

Model.prototype._resultsToJson = function(items, callback, onItemConverter){

  debug("Model.prototype._resultsToJson " + items)
  var results = []
  var that = this

  if(items){  

    foreach(items, function(item, next){

      that._resultToJson(item, function(result){
        results.push(result)
        next()
      }, onItemConverter)
      
    }).then(function(){
      callback(results)
    })

  }else {
    callback(undefined)
  }
}

Model.prototype._set = function(params){
  for(it in params){
    this.attrs[it] = params[it]
  }

  Model.prototype._init.call(this, this, this.attrs)
}


// implements

Model.prototype.persist = function(){

  var items = []
  var list = []
  var that = this


  for(var i = 0; i < this.columns.length; i++){
    var col = this.columns[i]
    if(typeof col.type === 'function'){
      if(col.cascade && this[col.name]){
        if(col.list){
          for(j in this[col.name]){
            var it = this[col.name][j]

            it[col.relationName] = this

            list.push(it)
          }
        }else{
          items.push(this[col.name])
        }
      }

    }
  }

  items.push(this)

  return this.saveOrUpdateAll(items).then(function(){
    return that.saveOrUpdateAll(list)
  })

}

Model.prototype.saveAll = function(items){
  
  return new Promise(function(accept, reject){

    foreach(items, function(item, next){

      item.save(function(){
        if(err){
          return reject(err)
        }
        next()
      })

      next()
    }).then(function(){
      accept()
    })

  })

}

Model.prototype.updateAll = function(items){
  
  return new Promise(function(accept, reject){

    foreach(items, function(item, next){

      item.update(function(){
        if(err){
          return reject(err)
        }
        next()
      })

      next()
    }).then(function(){
      accept()
    })

  })

}

Model.prototype.deleteAll = function(items){
  
  return new Promise(function(accept, reject){

    foreach(items, function(item, next){

      item.remove(function(){
        if(err){
          return reject(err)
        }
        next()
      })

      next()
    }).then(function(){
      accept()
    })

  })

}

Model.prototype.saveOrUpdateAll = function(items){
  
  return new Promise(function(accept, reject){

    foreach(items, function(item, next){

      var keyName = getModelKeyName(item)

      if(!item[keyName]){
          item.save(function(err){
            if(err){
              return reject(err)
            }
            next()
          })
          return        
      }

      item.get(item[keyName], function(result){
        if(result){

          item.update(function(err){
            if(err){
              return reject(err)
            }
            next()
          })

        } else {

          item.save(function(err){
            if(err){
              return reject(err)
            }
            next()
          })

        }       
      })

      
    }).then(function(){
      accept()
    })

  })

}

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

Model.prototype.toInsertQuery = function(callback){
  Model.prototype._prepare.call(this, this, this.attrs)
  return Model.prototype._toInsertQuery.call(this, this.tableName, this.attrs)
}

Model.prototype.toUpdateQuery = function(callback){
  Model.prototype._prepare.call(this, this, this.attrs)
  return Model.prototype._toUpdateQuery.call(this, this.tableName, this.attrs)
}

Model.prototype.toReplaceQuery = function(join, callback){

    var query = "replace into " + this.tableName + " ("

    for(var i = 0; i < this.columns.length; i++){
      var it = this.columns[i]

      if(it.list)
        continue

      if(it.key){
        query += (it.columnName || it.name) + ","
        break
      }
    }

    for(var i = 0; i < this.columns.length; i++){
      var it = this.columns[i]
      
      if(it.list)
        continue
      
      if(!it.key)
        query += (it.columnName || it.name) + ","
    }

    query = query.substring(0, query.length-1) + ") "

    query += " select "

    for(var i = 0; i < this.columns.length; i++){
      var it = this.columns[i]

      if(it.list)
        continue    

      if(it.key){
        query += callback(it.name) || "c." + (it.columnName || it.name)
        query += ","
      }
    }

    for(var i = 0; i < this.columns.length; i++){
      var it = this.columns[i]

      if(it.list)
        continue    

      if(!it.key){
        query += callback(it.name) || "c." + (it.columnName || it.name)
        query += ","
      }
    }

    query = query.substring(0, query.length-1)
    query += " from " + this.tableName + " c "
    return query + " " + join
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

Model.prototype.removeByFilter = function(conditions, callback){
  Model.prototype._removeBy.call(this, this.tableName, this.attrs, conditions)
}

Model.prototype.count = function(callback){
  Model.prototype._count.call(this, this.tableName, callback)
}

Model.prototype.get = function(id, callback){
  var self = this
  var keyName = getModelKeyName(this)
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: keyName, 'op': '=', 'val': id }] , function(err, item){

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
exports.ORM = ORM;
exports.Model = Model;
