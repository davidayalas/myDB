/************************************************************************************************************
	IndexedDB abstraction object. You can create several DB or one DB with several stores/tables

	v0.1
 
	davixyz@gmail.com
	http://about.me/david.ayala
	
	Sample:
	
	var DB = new myDB("myDatabase",[
		"store1", //only a storename
		"store2" : { // a storename with index properties
			"key" : "field1",
			"unique" : false
		}
	]);
	
	DB.add("store1",{"id":1,"key1":"value1","key2":value2,"key3":value3})
	DB.add("store1",{"id":2,"key1":"value11","key2":value22,"key3":value33}) //myDB creates an internal index "myDBid" for each added record

	DB.getAll("store1", function(results){
		....
	})

	DB.get("store1",[
		{
			"key":"key1", //key to query
			"type":"string", //data type. Optional, default "string"
			"content":"value", //value to query
			"compare":"equals" //method for compare. Optional, default "contains" 
		}
	], function(results){
		....
	});

	DB.getByIndex("store1", "index", "exact query", function(results){
		....
	})

	DB.delete("store1",[{"key":"id","type":"number","content":1}],function(){
		....
	});
	
	---------------------
	Compare methods:
		
	"string" : "equals","contains","different"
	"date" && "number": "equals","different","lte", "gte", "gt", "lt" ("l"="lower" "g"="greater" "t"="than" "e"="equals"  lte= "<=")
	"fulltext": performs a string search over all the fields in the db (v0.3)
	
	---------------------------------------------------------------------------------------------------------
	v0.2

	It flattens search strings and string in DB to ingnore diacritical accents [Ã¡Ã Ã¨Ã©...]	

	---------------------------------------------------------------------------------------------------------
	v0.3

	Full text search simulation
	
	---------------------------------------------------------------------------------------------------------
	v0.4

	Some improvements because myDB failed due to some changes in Google Chrome indexedDB api
/************************************************************************************************************


/**
 * myDB object to manage database, object stores (tables) and queries
 *
 * @param {String} databasename 
 * @param {Array} stores: tables of the database
 * @param {String} [optional] version
 * @param {Boolean} [optional] mode debug
 */
function myDB(databasename,stores,version,debug){
	if(typeof(version)=="boolean"){
		debug=version;
	}
	if(!stores ||!databasename){ 
		self.log("store name missing")
		return; 
	}
	this.db = null;
	this.queryResults;
	this.databasename = databasename;
	this.stores = {};
	this.store0 = "";	
	this.debug = debug || false;
	this.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;  
	this.re = [];
	
	if ('webkitIndexedDB' in window) {
		window.IDBTransaction = window.webkitIDBTransaction;
		window.IDBKeyRange = window.webkitIDBKeyRange;
	}
	
	for(var i=0,z=stores.length;i<z;i++){
		if(typeof(stores[i])=="string"){
			this.stores[stores[i]]={};
			this.stores[stores[i]]["myDBid"]=0;
			if(i==0){this.store0 = stores[i];}
		}else if(typeof(stores[i])=="object"){
			for(var k in stores[i]){
				this.stores[k]=stores[i][k];
			}
			this.stores[k]["myDBid"]=0;
			
			if(i==0){this.store0 = k;}
		}
	}
	
	this.version = version || 0.1;
	var self = this;
}

/**
 * Logging
 *
 * @param {Object} self object in callback functions
 * @param {String} message to console.log
 */
myDB.prototype.log = function(self,message){
	if(typeof(self)=="string"){
		console.log(self)
	}else if(self.debug){
		console.log(message)
	}
}

/**
 * Open the database
 *
 * @param {function} callback 
 */
myDB.prototype.open = function(cb){
  var self = this;
  if(!this.stores ||!this.databasename){ 
	this.log(this,"missing store name");
	return;
  }

  try{	
	var request = this.indexedDB.open(this.databasename,parseInt(self.version));
  }catch(e){
	console.log("Error opening database " + e);
	return;
  }

  request.onsuccess = function(e){
	self.log(self,"open success")
	self.db = e.target.result;
	if(self.db.version<self.version){
		var setVrequest = self.db.setVersion(self.version);
		setVrequest.onsuccess = function(){
		  	self.log(self,"version request");
			var created = false;
			var str;
			var objStore;
			for(var i in self.stores){
				if(!self.db.objectStoreNames.contains(i)) {
					objStore=self.db.createObjectStore(i, {keyPath: "myDBid"});
					self.createIndex(self,objStore,i);
					self.log(self,"created objectstore " + i);
					created = true;
				}
			}
			if(typeof(cb)=="function"){	
				cb(created);
			}
		}
		setVrequest.onfailure = self.error;
	}else{
		if(typeof(cb)=="function"){	
			cb(false);
		}
	}

  }

  request.onversionchange = upgrade;
  request.onerror = this.onerror;
  request.onupgradeneeded = upgrade;

  var upgrade = function(e){
  	self.log(self,"onupgradeneeded");
	self.db = e.target.result;
	var created = false;
	var str;
	var objStore;
	for(var i in self.stores){
		if(!self.db.objectStoreNames.contains(i)) {
			objStore=self.db.createObjectStore(i, {keyPath: "myDBid"});
			self.createIndex(self,objStore,i);
			self.log(self,"created objectstore " + i);
			created = true;
		}
	}
	if(typeof(cb)=="function"){	
		cb(created);
	}
  }
}

/**
 * Create indexes for store
 *
 * @param {Object} objectStore 
 * @param {String} str: storename 
 */
myDB.prototype.createIndex=function(self,objectStore,str){
	self.stores[str]["myDBid"]=0;
	if(typeof(self.stores[str]["keys"])=="object"){
		for(var i=0,z=self.stores[str]["keys"].length;i<z;i++){
			objectStore.createIndex(self.stores[str]["keys"][i].name, self.stores[str]["keys"][i].name, { unique: self.stores[str]["keys"][i].unique || false });
		}
	}
}

/**
 * Get results from store
 *
 * @param {String} [optional] storename 
 * @param {Object} query params 
 * @param {function} callback 
 * @param {boolean} remove 
 */
myDB.prototype.get = function(param1,param2,param3,remove) {
	var self=this;
	if(!self.db){self.log(self,"no db");return}
	var store = typeof(param1)=="string"?param1:self.store0;
	var _query = typeof(param1)=="object"?param1:param2;
	var cb = typeof(param2)=="function"?param2:param3;
	remove = remove || false;

	var transtype = IDBTransaction.READ_ONLY || "readonly";
	if(remove){
		transtype = IDBTransaction.READ_WRITE || "readwrite";
	}
	
	var db = self.db;
	try{
		var _store = db.transaction([store],transtype).objectStore(store);
	}catch(e){
		self.log("store \"" + store + "\" doesn't exist");
		if(typeof(cb)=="function"){
			cb(null);
		}
		return;
	}
	var keyRange = IDBKeyRange.lowerBound(0);
	var cursorRequest = _store.openCursor(keyRange);
	self.queryResults = [];

	var tk;
	self.re = [];
	for(var k=0,z=_query.length;k<z;k++){
		if(typeof(_query[k].content)=="string"){
			_query[k].content=self.flattenWord(_query[k].content);
		}	
		if(_query[k].type=="fulltext"){
			tk = _query[k].content.split(" ");
			for(var ky in tk){
				if(tk[ky].length>0){
					self.re.push(new RegExp("(\\s|^|-|\\.|,|;|:|_|\'|\\\"|\\()"+tk[ky]+"(\\s|$|-|\\.|,|;|:|_|\'|\\\"|\\))","g"));
				}
			}
		}	
	}

	cursorRequest.onsuccess = function(e){
		var result = e.target.result;
		if(!!result == false){
			if(typeof(cb)=="function"){
				self.log(self,"results for " + store);
				self.log(self,self.queryResults);
				cb(self.queryResults);
			}
			return;
		}
		var found = self.resultMatch(self,result,_query,remove);	
		if(found && remove){
			var delRequest = _store.delete(result.value.myDBid);
			delRequest.onsuccess=function(){
				self.log(self, "record deleted");
			}
			delRequest.onerror=self.onerror;
		}
		if(result){
			result.continue();
		}
	};
	cursorRequest.onerror = self.onerror;
	cursorRequest.onfailure = self.onerror;
}	

/**
 * Get results from created indexes
 *
 * @param {String} [optional] storename 
 * @param {String} index 
 * @param {String} search string
 * @param {function} callback 
 */
myDB.prototype.getByIndex=function(param1,param2,param3,param4) {
	var self=this;
	if(!self.db){self.log(self,"no db");return}
	var cb = typeof(param4)=="function"?param4:param3;
	
	if(typeof(cb)!="function"){
		self.log(self,"callback not defined");return
	}
	
	var _search = typeof(param4)=="function"?param3:param2;
	var _index = typeof(param4)=="function"?param2:param1;
	var _store = typeof(param4)=="function"?param1:self.store0;
	var store = self.db.transaction([_store],"readonly").objectStore(_store);
	var index = store.index(_index);  
	
	self.queryResults = [];
	var singleKeyRange = IDBKeyRange.only(_search); 

	index.openCursor(singleKeyRange).onsuccess = function(event){
		  var cursor = event.target.result;  
		  if (cursor) {  
			console.log(cursor.value)
			self.queryResults.push(cursor.value);
			cursor.continue();  
		  }else{
			cb(self.queryResults);
		  }
	}; 
}
	
/**
 * Match result the query?
 *
 * @param {Object} self 
 * @param {Object} result 
 * @param {Object} query params 
 * @param {Boolean} remove 
 */
myDB.prototype.resultMatch=function(self,result,_query,remove){
	var found=true;
	var res = "",type,compare,re=null;
	for(var k=0,u=_query.length;k<u;k++){
		if((result.value[_query[k].key] || _query[k].type=="fulltext") && found){
			if(_query[k].type!="fulltext"){
				res = result.value[_query[k].key].toString().toLowerCase();
			}
			type=_query[k].type || "string";
			compare = _query[k].compare	|| "contains";		
			switch(type){
				case "fulltext":
					for(var l=0,n=self.re.length;l<n;l++){
						//if(!self.re[l].test(result.value["myDB_FTS"])){found=false;}
						if(!result.value["myDB_FTS"].match(self.re[l])){found=false;}
						
					}	
					break;
					
				case "string":
					res = self.flattenWord(res);
					switch(compare){
						case "equals":
							if(res!=_query[k].content){found=false;} break;
						case "different":
							if(res==_query[k].content){found=false;} break;
						default: //contains
							if(res.indexOf(_query[k].content)==-1){found=false;}
					}
					break;
					
				case "number":
				case "date":
					switch(compare){
						case "different":
							if(parseInt(res)==parseInt(_query[k].content)){found=false;}break;
						case "gte":
							if(parseInt(res)<parseInt(_query[k].content)){found=false;}break;
						case "lte":
							if(parseInt(res)>parseInt(_query[k].content)){found=false;}break;
						case "lt":
							if(parseInt(res)>=parseInt(_query[k].content)){found=false;}break;
						case "gt":
							if(parseInt(res)<=parseInt(_query[k].content)){found=false;}break;
						default: //equals
							if(parseInt(res)!=parseInt(_query[k].content)){found=false;}break;
					}
			}

		}else{
			found=false;
			break;
		}
	}  
	
	if(found){
		if(!remove){
			self.queryResults.push(result.value);
		}
	}
	return found;
}

/**
 * Get all results from store
 *
 * @param {String} [optional] storename 
 * @param {function} callback 
 */	
myDB.prototype.getAll = function(param1,param2) {
	var self = this;
	this.get(param1,[{"key":"myDBid","content":"c"}],param2);
};	

/**
 * Delete records from table. Equals to "get" records with extra param "remove" 
 *
 * @param {String} [optional] storename 
 * @param {Object} query params 
 * @param {function} callback 
 */	
myDB.prototype.delete = function(param1,param2,param3) {
	var self=this;
	if(!self.db){self.log(self,"no db");return}
	var store = typeof(param1)=="string"?param1:self.store0;
	var _query = typeof(param1)=="object"?param1:param2;
	var cb = typeof(param2)=="function"?param2:param3;

	self.get(store,_query,cb,true);
};	


/**
 * Common error logging
 *
 * @param {String} message
 */	
myDB.prototype.onerror = function(message) {
	if(this && this.log){
		this.log("ERROR > " + message);
	}else{
		console.log("ERROR > " + JSON.stringify(message));		
	}
}; 

/**
 * JSON keys concatenator
 *
 * @param {Object} json
 */	
myDB.prototype.jsonConcat = function(json) {
	var stb=[];
	var _type;
	for(var k in json){
		if(k!="myDBid"){
			_type=typeof(json[k]);
			if(_type=="object" || _type=="array"){
				stb.push(this.jsonConcat(json[k]));
			}else{
				if(_type=="string"){
					stb.push(this.flattenWord(json[k]));
				}else{
					stb.push(json[k]);
				}
			}
		}
	}
	return stb.join(" ");
}; 

/**
 * Add object to store
 *
 * @param {String} storename 
 * @param {Object} data to insert 
 * @param {Function} [optional] callback 
 */	
myDB.prototype.add = function(param1, param2,param3){
  var self = this;
  if(!self.db){self.log(self,"no db");return}
  var store = typeof(param1)=="string"?param1:self.store0;
  var data = typeof(param1)=="object"?param1:param2;
  var cb = typeof(param2)=="function"?param2:param3;
  
  var _store = self.db.transaction([store], IDBTransaction.READ_WRITE).objectStore(store);
  if(!data["myDBid"]){
	data["myDBid"] = "c"+self.stores[store].myDBid;
  }
  
  self.stores[store].myDBid++;
  data["myDB_FTS"] = self.jsonConcat(data);
  var request = _store.put(data);

  request.onsuccess = function(e) {
	if(typeof(cb)=="function"){
		cb(true);
	}
  };
  request.onerror = function(e) {
	self.log("Error Adding: ", e);
	if(typeof(cb)=="function"){
		cb(false);
	}
  };
};

/**
 * Reset all stores
 *
 * @param {function} callback 
 */	
myDB.prototype.reset = function(cb){
	var self=this;
	if(!self.db){self.log(self,"no db");return}
	/*var req = self.db.setVersion(self.version);
	req.onsuccess = function(){
		var objStore;
		for(var i in self.stores){
			self.db.deleteObjectStore(i);
			self.log("object store "+i+" deleted ")
			objStore=self.db.createObjectStore(i, {keyPath: "myDBid"});
			self.createIndex(self,objStore,i);
			self.log("object store "+i+" created ")
		}
		if(typeof(cb)=="function"){	
			cb();
		}
	}
	req.onfailure = self.onerror*/

	var ccb = null;
	for(var i=0,z=self.db.objectStoreNames.length;i<z;i++){
		if(i==z-1){
			ccb=cb;			
		}
		self.delete(self.db.objectStoreNames[i],[{"key":"myDBid","content":"c"}],ccb);
	}

}

/**
 * Remove DB
 *
 * @param {function} callback 
 */	
myDB.prototype.removeDB=function(cb){
	var self=this;
	if(!self.indexedDB){self.log(self,"no indexedDB");return;}
	var req = self.indexedDB.deleteDatabase(this.databasename);
	req.onsuccess = function(e) {
		self.log(self,"database deleted");
		if(typeof(cb)=="function"){
			cb();
		}
	}
	req.onerror = self.onerror;
}

/**
 * Flatten diacritics from lower case string
 *
 * @param {String} str 
 */	
myDB.prototype.flattenWord = function(str){
	try{
		str=decodeURIComponent(str.toLowerCase());
	}catch(e){
		str=unescape(str.toLowerCase());
	}
	var rExps=[
		{re:/[\xE0-\xE6]/g, ch:'a'},
		{re:/[\xE8-\xEB]/g, ch:'e'},
		{re:/[\xEC-\xEF]/g, ch:'i'},
		{re:/[\xF2-\xF6]/g, ch:'o'},
		{re:/[\xF9-\xFC]/g, ch:'u'},
		{re:/[\xF1]/g, ch:'n'} 
	];

	for(var i=0, len=rExps.length; i<len; i++){
		str=str.replace(rExps[i].re, rExps[i].ch);
	}
	return str;
}

/**
 * Unflatten diacritics from lower case string. Maybe useful for highlighting in the view/presentation (unFlattenWord(flattenWord(string)))
 *
 * @param {String} str 
 */	
myDB.prototype.unFlattenWord = function(str){
	str=str.toLowerCase();
	var rExps=[
		{re:/a/g, ch:'[a\xE0\xE1\xE2\xE3\xE4\xE5\xE6]'},
		{re:/e/g, ch:'[e\xE8\xE9\xEA\xEB]'},
		{re:/i/g, ch:'[i\xEC\xED\xEF]'},
		{re:/o/g, ch:'[o\xF2\xF3\xF4\xF5\xF6]'},
		{re:/u/g, ch:'[u\xF9\xFA\xFB\xFC]'},
		{re:/n/g, ch:'[n\xF1]'} 
	];

	for(var i=0, len=rExps.length; i<len; i++){
		str=str.replace(rExps[i].re, rExps[i].ch);
	}
	return str;
}

/**
 * Init DB
 *
 * @param {function} callback 
 */	
myDB.prototype.init = function(fnc){
	this.open(fnc);
}