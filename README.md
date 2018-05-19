# nativescript-db-orm

## General

```

Model.save (err) ->

Model.remove (err) ->

Model.removeAll (err) ->allNative

Model.removeByFilter {col: 'name', op: 'like', val: '%nobody%'}, (err) ->

Model.update (err) ->

Model.get 1, (it) ->

Model.getByServerId 1, (it) ->

Model.filter {col: 'name', op: 'like', val: '%nobody%'}, (items) ->

Model.all  (items) ->

Model.count  (count) ->

Model.toInsertQuery()

Model.toUpdateQuery()

Model.toReplaceQuery 'join logic', (callbackColumn) ->

Model.set({id: 1, name: 'nobody'})

Model.allNative query, args, (item) ->
  // item callback

Model.eachNative(query, args, (item) ->
  // row callback
  , () ->
  // finished callback
)

```
## data types

```

string - text
date -> format 'YYYY-MM-DD HH:mm:ss.SSS' (orm convets to Date)
boolean - int (orm converts to true and false)
decimal - real
int - nt
Complext type - another model type.. 

```

## Model

Should extends base model orm.Model and in constructor define:

```
tableName
clazz - same
columns: json with 
  name - column name
  key - if is primary key
  type - data type
  default - default value
  notNull - not null column
  columnName - name of db column.. if not set, name is used
```

## create a model


```

orm = require "nativescript-db-orm" 
moment = require "moment"
Model = orm.Model

class Foo extends Model

	constructor: (params) ->
		super(@)
		params = params || {}
	
		@tableName = 'foo'

		@clazz = Foo

		@columns = [
			{name: 'serverId', type: 'int' }
			{name: 'id', key: true}
			{name: 'name', type: 'string', size: 100 }
		]

		@attrs = {}
		for col in @columns
			@attrs[col.name] = params[col.name]

		Model.prototype._init.call(@, @, @.attrs)
    
    
class Bar extends Model

	constructor: (params) ->
		super(@)
		params = params || {}
	
		@tableName = 'bar'

		@clazz = Bar

		@columns = [
			{name: 'serverId', type: 'int'}
			{name: 'id', key: true}
			{name: 'foo', columnName: 'fooId' ,type: Foo}
		]

		@attrs = {}
		for col in @columns
			@attrs[col.name] = params[col.name]

		Model.prototype._init.call(@, @, @.attrs)
    
    filterByServerId: (id, callback) ->
      args = {
        col: 'serverId',
        val: id,
        op: '='
      }

      @filter([args], callback)

``` 
## get insert query
```
var result Model.toInsertQuery()

// result.query 
// result.args

```

## get update query
```
var result Model.toUpdateQuery()

// result.query 
// result.args

```

## get update query
```

// give the class model
class Foo {
  id
  name
  bar_id
}

// getting replace query

var result = Model.toReplaceQuery("inner join bar p on c.bar_id == p.id", function(name){
  if(name == 'bar_id')
    return "p.id"
})

// results
results = "replace into foo (id, name, bar_id) select c.id, c.name, p.id from foo c inner join bar p on c.bar_id == p.id"


```

## init orm

```
orm = require "nativescript-db-orm" 

dbChecker = new orm.DbChecker()

dbChecker.onDebug(false)

dropAndCreate = false
myAppDbName = 'myapp.db'

dbChecker.createOrUpdate(dropAndCreate, myAppDbName ,[
  new Foo(), // models
  new Bar()
], () ->
  // finished callback
, (err) ->
  // error callback
)


```

## filter
```

model.filter({
	conditions:[
		{ col: 'name', op: 'like', val: '%jonh%' },
		{ native: "p.birthday < date('now','+5 day')" }
	],
	sort: 'name',
	order: 'desc',
	limit: 10,
	offset: 0,
	joins: [
		"join profiles p on p.id == c.user_id "
	]
}, (results) ->
	
)

```

## getNative

```

model.getNative "select count(*) from users", (err, count) ->
	

```

## allNative

```

model.allNative "select id, name from users", (err, results) ->
	
	# convert data to model
	model._resultsToJson(results, (modelItem) ->
		
		#result callback
		
	, (dbRow, modelItem) ->
		#converter data to model callback (optional)
		return modelItem
	)
})

