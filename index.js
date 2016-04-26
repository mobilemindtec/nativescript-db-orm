var Sqlite = require( "nativescript-sqlite" );
var dbORM = require("./orm");
var moment = require("moment")
var dbName 

function debug(text){  
  //console.log(text)
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

DbChecker.prototype.createOrUpdate = function(reset, databaseName, models, done){

  dbName = databaseName

  say("## database reset=" + reset)
  say('call database version method')

  if(reset)
   Sqlite.deleteDatabase(dbName)

  // version checker
  createDatabase(function(db) {
    db.version(function(err, ver) {

      ver = parseInt(ver)
      say('database version ' + ver)

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
          say(tables[it])
          db.execSQL(tables[it]);
        }

        say('update database to version 1')
        db.version(1); // Sets the version to 1
      
      }else{
        say('dont update database version')
      }

      done()
    });
  });     
}

function Model(){

}

function extend(ChildClass, ParentClass) {
  ChildClass.prototype = new ParentClass();
  ChildClass.prototype.constructor = ChildClass;
}


function say(message){
  if(debug)
    debug("### " + message)
}

function execute(sql, params, callback){
  createDatabase(function(db) {
    
    say('execute ' + sql + "  values " + JSON.stringify(params))

    db.execSQL(sql, params, callback)

  });   
}

Model.prototype.executeNative = execute;

function get(sql, params, callback){
  createDatabase(function(db) {
    
    say('execute ' + sql + "  values " + JSON.stringify(params))

    db.get(sql, params, callback)

  });   
}

Model.prototype.getNative = get;

function all(sql, params, callback){
  createDatabase(function(db) {
    
    say('execute ' + sql + "  values " + JSON.stringify(params))

    db.all(sql, params, callback)

  });   
}

Model.prototype.allNative = all;

function each(sql, params, rowCallback, finishedCallback){
  createDatabase(function(db) {
    
    say('execute ' + sql + "  values " + JSON.stringify(params))

    db.each(sql, params, rowCallback, finishedCallback)

  });   
}

Model.prototype.eachNative = each;


Model.prototype._save = function(table, attrs, done){
  var args = []
  var names = ""
  var values = ""

  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]

    if(it.name == 'id')
      continue

    names += it.name + ","
    values += "?,"

    if(it.type == 'date'){
      if(attrs[it.name]){
        var val = attrs[it.name] && moment(attrs[it.name]).isValid() ? moment(attrs[it.name]).format('YYYY-MM-DD HH:mm:ss.SSS') : null
        args.push(val)
      }else{
        args.push(null)        
      }
    }else if(it.type == 'boolean'){
      args.push(attrs[it.name] ? 1 : 0)
    }else{ 
      args.push(attrs[it.name] || null)
    }
  }


  

  // remove last (,)
  names = names.substring(0, names.length-1)
  values = values.substring(0, values.length-1)

  execute("insert into " + table + " (" + names + ") values (" + values + ")", args, function(err, id){
    
    if(!err)
      attrs['id'] = id
    
    say('save done in model. err=' + err)

    done(err)
  })   
}

Model.prototype._update = function(table, attrs, done){
  var args = []
  var names = ""

  debug("Model.prototype._update") 

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
    }else{ 
      args.push(attrs[it.name] || null)
    }
  }

  args.push(attrs['id'])

  // remove last (,)
  names = names.substring(0, names.length-1)

  var query = "update " + table + " set " + names + " where id = ?"
  debug("## execute " + query)

  execute(query, args, function(err){
    say('update done in model. err=' + err)
    done(err)
  })   
}

Model.prototype._remove = function(table, attrs, done){
  execute("delete from " + table + " where id = ?", [attrs['id']], function(err){
    say('delete done in model. err=' + err)
    done(err)
  })     
}

Model.prototype._removeAll = function(table, done){
  execute("delete from " + table, [], function(err){
    say('delete all models done. err=' + err)
    done(err)
  })     
}


Model.prototype._count = function(table, done){
  get("select count(id) from " + table, [], done)     
}

Model.prototype._get = function(table, attrs, conditions, done){
  var names = ""
  var cons = ""
  var args = []

  for(var i = 0; i < this.columns.length; i++)
    names += this.columns[i].name + ","    
  
  names = names.substring(0, names.length-1)

  for(it in conditions){
    say('get ' + it)
    cons += conditions[it].col + " " + conditions[it].op + " ? and"
    args.push(conditions[it].val)
  }  

  cons = cons.substring(0, cons.length-3)

  get(" select " + names + " from " + table + " where " + cons, args, done)
}

Model.prototype._all = function(table, attrs, conditions, done){
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
      cons += conditions[it].col + " " + conditions[it].op + " ? and"
      args.push(conditions[it].val)
    }  

    cons = cons.substring(0, cons.length-3)
    sql += " where " + cons
  }

  all(sql, args, done)
}

Model.prototype._selectAll = function(query, args, done){
  all(query, args, done)
}

Model.prototype._selectOne = function(query, args, done){
  get(query, args, done)
}


Model.prototype._init = function(_this, attrs){
  for(it in attrs)
    _this[it] = attrs[it]
}  

Model.prototype._prepare = function(_this, attrs){
  for(it in attrs)
    attrs[it] = _this[it]
}  

Model.prototype._resultToJson = function(item, done, onItemConverter){

  say("Model.prototype._resultToJson")

  if(item){
    var opts = {}
    var i = 0          
    for(var j = 0; j < this.columns.length; j++){

      var it = this.columns[j]
      var value = item[i++]

      //console.log("## it.type=" + it.type + ", it.name=" + it.name + ", value=" + value)

      if(it.type == 'date' &&  value && moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').isValid())
        opts[it.name] = moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').toDate()
      else if(it.type == 'boolean')   
        opts[it.name] = value && value == 1 ? true : false
      else
        opts[it.name] = value

    }    

    var itemConverted = new this.clazz(opts)
    if(onItemConverter)
      onItemConverter(item, itemConverted)

    return done(itemConverted)
  }
  done(undefined)
}  

Model.prototype._resultsToJson = function(items, done, onItemConverter){

  say("Model.prototype._resultsToJson")
  
  var results = []
  if(items){
    for(var j = 0; j < items.length; j++){

      var item = items[j]
      var opts = {}
      var i = 0          

      for(var k = 0; k < this.columns.length; k++){

        var it = this.columns[k]
        var value = item[i++]

        //console.log("## it.name=" + it.name + ", it.type=" + it.type + ", value=" + value)

        if(it.type == 'date' &&  value && moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').isValid())
          opts[it.name] = moment(value, 'YYYY-MM-DD HH:mm:ss.SSS').toDate()
        else if(it.type == 'boolean')   
        opts[it.name] = value && value == 1 ? true : false
        else   
          opts[it.name] = value

      }    

      var itemConverted = new this.clazz(opts)
      if(onItemConverter)
        onItemConverter(item, itemConverted)
      results.push(itemConverted)
    }

    return done(results)    
  }
  done(undefined)
} 

Model.prototype._set = function(params){
  for(it in params){    
    this.attrs[it] = params[it]
  }

  Model.prototype._init.call(this, this, this.attrs)
}


// implements

Model.prototype.save = function(done){
  var self = this
  Model.prototype._prepare.call(this, this, this.attrs)
  Model.prototype._save.call(this, this.tableName, this.attrs, function(err){
    if(!err)
      self['id'] = self.attrs['id']      
    if(done)
      done(err)
  })
}


Model.prototype.update = function(done){
  Model.prototype._prepare.call(this, this, this.attrs)
  Model.prototype._update.call(this, this.tableName, this.attrs, done)
}

Model.prototype.remove = function(done){    
  Model.prototype._remove.call(this, this.tableName, this.attrs, done)
}

Model.prototype.removeAll = function(done){    
  Model.prototype._removeAll.call(this, this.tableName, done)
}

Model.prototype.count = function(done){    
  Model.prototype._count.call(this, this.tableName, done)
}

Model.prototype.get = function(id, done){
  var self = this
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: 'id', 'op': '=', 'val': id }] , function(err, item){      
    if(item)
      Model.prototype._resultToJson.call(self, item, done)    
    else
      done(null)
  })
}

Model.prototype.getByServerId = function(serverId, done){
  var self = this
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: 'serverId', 'op': '=', 'val': serverId }] , function(err, item){      
    if(item)
      Model.prototype._resultToJson.call(self, item, done)    
    else
      done(null)
  })
}

Model.prototype.all = function(done){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){
    if(items){
      console.log("###### select count " + self.tableName + "(" + items.length + ")")      
      Model.prototype._resultsToJson.call(self, items, done)      
    }else{
      debug("###### select count " + self.tableName + "(0)")
      done(null)
    }
  })
},

Model.prototype.filter = function(conditions, done){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, conditions, function(err, items){
    if(items){
      console.log("###### select count " + self.tableName + "(" + items.length + ")")
      Model.prototype._resultsToJson.call(self, items, done)      
    }else{
      debug("###### select count " + self.tableName + "(0)")
      done(null)
    }
  })
},


Model.prototype.each = function(each, done){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){      
    if(items){
      console.log("###### select count " + self.tableName + "(" + items.length + ")")
      Model.prototype._resultsToJson.call(self, items, done)      
    }else{
      debug("###### select count " + self.tableName + "(0)")
      done()
    }
  })
}


exports.DbChecker = DbChecker;
exports.Model = Model;