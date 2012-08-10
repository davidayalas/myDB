IndexedDB abstraction object 
=============================

davixyz@gmail.com
http://about.me/david.ayala

v0.1
_____

(You can create several DB or one DB with several stores/tables)

### Sample:

var **DB** = new **myDB**("myDatabase",[
	"store1", //only a storename
	"store2" : { // a storename with index properties
		"key" : "field1",
		"unique" : false
	}
]);

+	DB.**add**("store1",{"id":1,"key1":"value1","key2":value2,"key3":value3})

+	DB.**add**("store1",{"id":2,"key1":"value11","key2":value22,"key3":value33}) //myDB creates an internal index "myDBid" for each added record

+	DB.**getAll**("store1", function(results){
	....
})

+	DB.**get**("store1",[
	{
		"key":"key1", //key to query
		"type":"string", //data type. Optional, default "string"
		"content":"value", //value to query
		"compare":"equals" //method for compare. Optional, default "contains" 
	}]
	, function(results){
		....
	});

+	DB.**getByIndex**("store1", "index", "exact query", function(results){
	....
})

+	DB.**delete**("store1",[{"key":"id","type":"number","content":1}],function(){
	....
});

+	Compare methods:
	
	-	"string" : "equals","contains","different"
	-	"date" && "number": "equals","different","lte", "gte", "gt", "lt" ("l"="lower" "g"="greater" "t"="than" "e"="equals"  lte= "<=")
	-	"fulltext": performs a string search over all the fields in the db (v0.3)

v0.2
_____

It flattens search strings and string in DB to ingnore diacritical accents [Ã¡Ã Ã¨Ã©...]	

v0.3
_____

Full text search simulation

v0.4
_____

Some improvements because myDB failed due to some changes in Google Chrome indexedDB api
