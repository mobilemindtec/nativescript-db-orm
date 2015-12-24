var Sqlite = require( "nativescript-sqlite" );
var moment = require("moment")
var debug = true
var dbName 

function DbChecker(){

}

DbChecker.prototype.createOrUpdate = function(reset, databaseName, models){

  dbName = databaseName

  say('call database version method')

  if(reset)
   Sqlite.deleteDatabase(dbName)

  // version checker
  new Sqlite(dbName, function(err, db) {
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
    });
  });     
}

function extend(ChildClass, ParentClass) {
  ChildClass.prototype = new ParentClass();
  ChildClass.prototype.constructor = ChildClass;
}


function say(message){
  if(debug)
    console.log("### " + message)
}

function execute(sql, params, callback){
  new Sqlite(dbName, function(err, db) {
    
    say('execute ' + sql)

    db.execSQL(sql, params, callback)

  });   
}

function get(sql, params, callback){
  new Sqlite(dbName, function(err, db) {
    
    say('execute ' + sql)

    db.get(sql, params, callback)

  });   
}

function all(sql, params, callback){
  new Sqlite(dbName, function(err, db) {
    
    say('execute ' + sql)

    db.all(sql, params, callback)

  });   
}

function each(sql, params, rowCallback, finishedCallback){
  new Sqlite(dbName, function(err, db) {
    
    say('execute ' + sql)

    db.each(sql, params, rowCallback, finishedCallback)

  });   
}

function Model(){

}

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
        var val = moment(attrs[it.name]).format('yyyy-MM-dd hh:mm:ss.SSS')
        args.push(val)
      }else{
        args.push(null)        
      }
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

  
  for(var i = 0; i < this.columns.length; i++){

    var it = this.columns[i]

    if(it.name == 'id')
      continue

    names += it.name + ","
    values += "?,"

    if(it.type == 'date'){
      if(attrs[it.name]){
        var val = moment(attrs[it.name]).format('yyyy-MM-dd hh:mm:ss.SSS')
        args.push(val)
      }else{
        args.push(null)        
      }
    }else{ 
      args.push(attrs[it.name] || null)
    }
  }

  args.push(attrs['id'])

  // remove last (,)
  names = names.substring(0, names.length-1)

  execute("update " + table + " set " + names + " where id = ?", args, function(err){
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

Model.prototype._get = function(table, attrs, conditions, done){
  var names = ""
  var cons = ""
  var args = []

  for(it in attrs)
    names += it + ","    
  
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

  for(it in attrs)
    names += it + ","    
  
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


// implements

Model.prototype.save = function(done){
  var self = this
  Model.prototype._prepare.call(this, this, this.attrs)
  Model.prototype._save.call(this, this.tableName, this.attrs, function(err){
    if(!err)
      self['id'] = self.attrs['id']      
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

Model.prototype.get = function(id, done){
  var self = this
  Model.prototype._get.call(this, this.tableName, this.attrs, [{ col: 'id', 'op': '=', 'val': id }] , function(err, item){      
    if(item){
      opts = {}
      var i = 0
      for(it in self.attrs)
        opts[it] = item[i++]      
      done(new self.clazz(opts))
    }
    else
      done(null)
  })
}

Model.prototype.all = function(done){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){
    if(items){
      console.log("###### select count " + self.tableName + "(" + items.length + ")")
      var result = []
      for(item in items){                 
        var opts = {}
        var i = 0          
        for(it in self.attrs){          
          opts[it] = items[item][i++]
        }          
        result.push(new self.clazz(opts))
      }
      done(result)      
    }else{
      console.log("###### select count " + self.tableName + "(0)")
      done(null)
    }
  })
},

Model.prototype.each = function(each, done){
  var self = this
  Model.prototype._all.call(this, this.tableName, this.attrs, null, function(err, items){      
    if(items){
      console.log("###### select count " + self.tableName + "(" + items.length + ")")
      var result = []
      for(item in items){                 
        var opts = {}
        var i = 0          
        for(it in self.attrs){
          //console.log(it)
          opts[it] = items[item][i++]
        }          
        each(new this.clazz(opts))
      }    
      done()      
    }else{
      console.log("###### select count " + self.tableName + "(0)")
      done()
    }
  })
}

exports.DbChecker = DbChecker;
exports.Model = Model;