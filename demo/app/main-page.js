var  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

var orm = require("nativescript-db-orm")
var Model = orm.Model
var ORM = orm.ORM

var createViewModel = require("./main-view-model").createViewModel;

var Person = (function(superClass){
    extend(Person, superClass);

    function Person(args) {
        args = args || {}
        this.tableName = "person"
        this.clazz = Person
        this.columns = [
            { name: 'id', key: true },
            { name: 'name', type: 'string' },
            { name: 'age', type: 'int' },
            { name: 'other', type: 'string' },
            { name: 'phones', type: PersonFone, list: true, relationColumn: 'person_id', relationName: 'person', eager: false, cascade: true }
        ]

        this.attrs = {}

        for(var i = 0; i < this.columns.length; i++){
            var col = this.columns[i]
            this.attrs[col.name] = args[col.name]
        }

        this._init(this, this.attrs)
    }   

    return Person

})(Model)

var PersonFone = (function(superClass){
    extend(PersonFone, superClass);

    function PersonFone(args) {
        args = args || {}
        this.tableName = "person_fone"
        this.clazz = PersonFone
        this.columns = [
            { name: 'id', key: true },
            { name: 'fone', type: 'string' },
            { name: 'person', columnName: 'person_id', type: Person, eager: false, cascade: false }
        ]

        this.attrs = {}

        for(var i = 0; i < this.columns.length; i++){
            var col = this.columns[i]
            this.attrs[col.name] = args[col.name]
        }

        this._init(this, this.attrs)
    }   

    return PersonFone

})(Model)

function onNavigatingTo(args) {
    var page = args.object;

    page.bindingContext = createViewModel();

    new ORM().init({
        databaseName: 'demo.sqlite',
        reset: true,
        debug: true,
        models: [ new Person(), new PersonFone() ]
    }).then(function(){
        onOk(function(){
            onLoad()
        })
        
    }).catch(function(err){

        console.log('********************************')
        console.log('**** ' + err)
        console.log('********************************')

    })
}

function onOk(callback){

    new Person({
        name: 'jonh',
        phones: [
            new PersonFone({ fone: '1213'}),
            new PersonFone({ fone: '34234'}),
            new PersonFone({ fone: '5453'})
        ]
    }).persist().then(function(){
        callback()
    }).catch(function(err){
        console.log('err ' + err)
    })
    return

    new PersonFone({
        fone: '1234',
        person: new Person({
            name: 'jonas'
        })
    }).persist().then(function(){
        //callback()
    }).catch(function(err){
        console.log('err ' + err)
    })

    return

    person = new Person({name: 'Ricardo Bocchi'})
    person.save(function(err){
        if(err){
            console.log('********************************')
            console.log('**** ' + err)
            console.log('********************************')            
            return
        }else{
            console.log('** save person successful')
        }

        personFone = new PersonFone({
            fone: '12434234',
            person: person
        })

        personFone.save(function(err){
            if(err){
                console.log('********************************')
                console.log('**** ' + err)
                console.log('********************************')   
                return         
            }else{
                console.log('** save person fone successful')
            }            

            callback()
        })
    })


}

function onLoad(){

    var PersonFoneModel = new PersonFone()

    PersonFoneModel.all(function(results){

        console.log(" ** find all ok ")
        results[0].getPerson().then(function(){        
            console.log(" ** get person ok ")
            console.log(results[0].person.name)
            results[0].person.getPhones().then(function(){
                console.log(" ** get phones ok ")
                console.log(results[0].person.phones)                            
                console.log(results[0].person.phones.length)                            
            })
        })

    })

}

exports.onNavigatingTo = onNavigatingTo;