orm = require "nativescript-db-orm"
moment = require('moment-mini')

Model = orm.Model

class BaseModel extends Model
  
  appDebug: false
  
  constructor: (args) ->
    @that = args

  debug: (text) ->
    if @appDebug
      console.log("base-model.js: #{text}")

  fromJson: (json, model, allString) ->
    if !json
      return undefined

    obj = model || new @clazz()

    obj.jsonEntity = json

    for col in @columns
      if col.json

        value = undefined

        if col.owner
          if json[col.owner]
            value = json[col.owner][col.json]
        else
          value = json[col.json]

        if typeof col.type is "function"
          m = new col.type()
          if col.list
            obj[col.name] = m.fromJsonList(value, obj[col.name])
          else
            obj[col.name] = m.fromJson(value, obj[col.name])
        else if col.fromJsonParser
          col.fromJsonParser(json, col.name, obj)
        else if col.type == 'int' && typeof value is 'string'
          obj[col.name] = parseInt(value) || 0
        else if col.type == 'decimal' && typeof value is 'string'
          obj[col.name] = parseFloat(value) || 0
        else if col.type == 'string'
          obj[col.name] = if value == undefined then "" else value
        else
          obj[col.name] = value

        if allString
          obj[col.name] = obj[col.name] + ""

    return obj

  fromJsonList: (jsonList) ->
    if !jsonList
      return []

    items = []

    for it in jsonList
      obj = @fromJson(it)
      items.push(obj)

    return items

  toJson: () ->
    json = {}

    for col in @columns
      if col.json
        if col.owner
          json[col.owner] = {}

    for col in @columns
      if col.json     
        it = json

        if col.owner
          it = json[col.owner]

          if not it 
            continue

        if typeof col.type is "function"
          if @[col.name]
            if col.list
              it[col.json] = new col.type().toJsonList(@[col.name])
            else
              it[col.json] = @[col.name].toJson()
        else if col.toJsonParser
          col.toJsonParser(@, col.name, col.json, it)
        else
          if col.type == 'date'
            if @[col.name] && moment(@[col.name]).isValid()
              it[col.json] = moment(@[col.name]).format()
          else if col.type == 'int'
            if @[col.name] == undefined
              it[col.json] = "0"
            else if typeof @[col.name] is 'string'
              it[col.json] =  "#{parseInt(@[col.name]) || 0}" || "0"
            else
              it[col.json] = @[col.name] + ""
          else if col.type == 'decimal'
            if @[col.name] == undefined
              it[col.json] = "0.0"
            else if typeof @[col.name] is 'string'
              it[col.json] =  "#{parseFloat(@[col.name]) || 0.0}" || "0.0"
            else
              it[col.json] = @[col.name] + ""
          else if col.type == "string"            
            it[col.json] = @[col.name] || ""
          else if col.type == "boolean"
            it[col.json] = @[col.name]
          else
            it[col.json] = @[col.name]


    return json

  toJsonList: (list) ->
    jsonList = []

    for it in list
      jsonList.push(it.toJson())

    return jsonList

  set: (opts) ->
    @_set(opts)

  save: (callback) ->
    super(callback)

  saveOrUpdatePromise: () ->
    that = @
    return new Promise (resolve, reject) ->

      if that.id > 0 && !that.serverId 
        that.exists that.id, (result) ->
          if result           
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
      else if that.serverId > 0
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
        if err
          reject(err)
        else
          resolve()

  updatePromise: () ->
    that = @
    return new Promise (resolve, reject) ->
      that.update (err) ->
        if err
          reject(err)
        else
          resolve()

  update: (callback) ->
    super(callback)

  saveOrUpdate: (callback) ->
    that = @

    if @id > 0 && !@serverId
      @exists @id, (entity) ->
        if entity         
          that.update callback
        else
          that.save callback
    else if @serverId > 0
      @getByServerId @serverId, (entity) ->
        if entity
          that.id = entity.id
          that.update callback
        else
          that.save callback
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

    if Object.prototype.toString.call(args) isnt '[object Array]'
      args = [args]

    for it in args
      if !it.op
        it.op = '='

    return new Promise (resolve, reject) ->
      that.removeByFilter args, (err) ->
        if err
          console.log 'err ' + err
          reject(err)
        else
          resolve()


  get: (id, callback) ->
    super(id, callback)

  getByServerId: (id, callback) ->
    if id
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

  onSync: () ->
    @sync = false
    return @

  onSyncOk: () ->
    @sync = true
    return @

  foreach2: (items, each, callback) ->

    nextIndex = 0
    that = @

    next = () ->

      if !items || nextIndex >= items.length
        if callback
          callback()
        return

      entity = items[nextIndex]

      # entity and next callback
      nextCall = () ->
        nextIndex++
        try
          next()
        catch e
          that.debug("foreach error 1: #{e}")


      result = each entity, nextCall, nextIndex

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

      that.foreach2 list, each, () ->
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

      that.foreach2 list, each, () ->
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

      that.foreach2 list, each, () ->
        resolve()

  updateBatch: (list) ->

    that = @

    return new Promise (resolve, reject) ->

      each = (p, next) ->

        p.updatePromise().then(() ->
          next()
        ).catch (error) ->
          reject(error)

        return true

      that.foreach2 list, each, () ->
        resolve()

module.exports = BaseModel
