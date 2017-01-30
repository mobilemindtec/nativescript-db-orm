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

## create a base model (support json opratins)

```
orm = require "nativescript-db-orm" 
moment = require "moment"
Model = orm.Model

class BaseModel extends Model 

	constructor: (args) ->

	set: (opts) ->
		@_set(opts)

	save: (callback) ->
		super(callback)

	saveOrUpdatePromise: () ->
		that = @
		return new Promise (resolve, reject) ->
			
			that.getByServerId that.serverId, (entity) ->

				if entity
					that.id = entity.id
					that.update (err) ->
						if err
							reject(err)
						else
							resolve()
				else
					that.save (err) ->
						if err
							reject(err)
						else
							resolve()

	savePromise: () ->
		that = @
		return new Promise (resolve, reject) ->			
			that.save (err) ->
				if errallNative
					reject(err)
				else
					resolve()							


	update: (callback) ->
		super(callback)

	saveOrUpdate: (callback) ->
		that = @
		@getByServerId @serverId, (entity) ->
			if entity
				that.id = entity.id
				that.update callback
			else
				that.save callback
 
	remove: (callback) ->
		super(callback)

	removePromise: (callback) ->
		that = @

		return new Promise (resolve, reject) ->
			that.remove (err) ->
				if err
					reject(err)
				else
					resolve()


	removeAll: (callback) ->
		super(callback)

	removeAllPromise: () ->
		that = @

		return new Promise (resolve, reject) ->
			that.removeAll (err) ->
				if err
					reject(err)
				else
					resolve()

	removeByFilterPromise: (args) ->
		that = @

		if Object.prototype.toString.call(args) != '[object Array]'
			args = [args]

		for it in args
			if !it.op 
				it.op = '='

		return new Promise (resolve, reject) ->
	    that.removeByFilter [args], (err) ->
				if err
					reject(err)
				else
					resolve()


	get: (id, callback) ->
		super(id, callback)  

	getByServerId: (id, callback) ->
		if id && id > 0
			super(id, callback)
		else
			callback(undefined)

	all: (callback) ->
		super(callback)

	each: (each, callback) ->
		super(each, callback)

	toInsertQuery: () ->
		super()

	toUpdateQuery: () ->
		super()

	count: (callback) ->
		super(callback)

	foreach: (items, each, callback) ->

		nextIndex = 0
		that = @

		next = () ->

			if !items || nextIndex >= items.length
				if callback
					callback()
				return	    

			entity = items[nextIndex]

			# entity and next callback
			result = each entity, () ->
				nextIndex++
				try
					next()
				catch e
					that.debug("foreach error 1: #{e}")


			if !result # continuar
				nextIndex++
				try
					next()
				catch e
					that.debug("foreach error 2: #{e}")

		try
			next()
		catch e
			@debug("foreach error 3: #{e}")

	runAll: (list) ->

		that = @

		return new Promise (resolve, reject) ->

			each = (p, next) ->
				
				p.then(() ->
					next()
				).catch (error) ->
					reject(error)

				return true

			that.foreach list, each, () ->
				resolve()

	saveOrUpdateBatch: (list) ->

		that = @

		return new Promise (resolve, reject) ->

			each = (p, next) ->
				
				p.saveOrUpdatePromise().then(() ->
					next()
				).catch (error) ->
					reject(error)

				return true

			that.foreach list, each, () ->
				resolve()	

	saveBatch: (list) ->

		that = @

		return new Promise (resolve, reject) ->

			each = (p, next) ->
				
				p.savePromise().then(() ->
					next()
				).catch (error) ->
					reject(error)

				return true

			that.foreach list, each, () ->
				resolve()
        
// json utils

	fromJson: (json, model) ->
		if !json
			return undefined

		obj = model || new @clazz()

		for col in @columns
			if col.json

				value = undefined

				if col.owner
					value = json[col.owner][col.json]
				else
					value = json[col.json]

				if typeof col.type is "function"
					m = new col.type()
					obj[col.name] = m.fromJson(value)
				else if col.fromJsonParser
					col.fromJsonParser(json, col.name, obj)
				else
					obj[col.name] = value

		return obj

	fromJsonList: (jsonList) ->
		if !jsonList
			return []

		items = []

		for it in jsonList
			obj = @fromJson(it)
			items.push(new @clazz(obj))	  

		return items

	toJson: () ->
		json = {}

		for col in @columns
			if col.json

				it = json

				if col.owner
					json[col.owner] = {}
					it = json[col.owner]

				if typeof col.type is "function"
					it[col.json] = @[col.name].toJson()
				else if col.toJsonParser					
					col.toJsonParser(@, col.name, it)
				else
					if col.type == 'date' && @[col.name] && moment(@[col.name]).isValid()
						it[col.json] = moment(@[col.name]).format()
					else if col.type == 'int' || col.type == 'decimal'
						it[col.json] = @[col.name] + ""
					else
						it[col.json] = @[col.name]

		return json

	toJsonList: (list) ->
		jsonList = []

		for it in list
			jsonList.push(it.toJson())	  

		return jsonList


module.exports = BaseModel

```

## create a model

```
class Foo extends BaseModel

	constructor: (params) ->
		super(@)
		params = params || {}
	
		@tableName = 'foo'

		@clazz = Foo

		@columns = [
			{name: 'serverId', type: 'int', "json": "Id"}
			{name: 'id', key: true}
			{name: 'name', type: 'string', size: 100, json: 'Description' }
		]

		@attrs = {}
		for col in @columns
			@attrs[col.name] = params[col.name]

		Model.prototype._init.call(@, @, @.attrs)
    
    
class Bar extends BaseModel

	constructor: (params) ->
		super(@)
		params = params || {}
	
		@tableName = 'bar'

		@clazz = Bar

		@columns = [
			{name: 'serverId', type: 'int', "json": "Id"}
			{name: 'id', key: true}
			{name: 'foo', type: Foo, size: 100, json: 'Foo' }
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
