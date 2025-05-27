//@ts-nocheck

declare function unescape(s:string): string;
declare function escape(s:string): string;

export const UrlEncoder = {

  /**
  * Encode a [deeply] nested object for use in a url
  * Assumes Array.forEach is defined
  */
  encode: function(params, prefix = null) {
  
    var items = [];
    
    for(var field in params) {
      
      var key  = prefix ? prefix + "[" + field + "]" : field;
      var type = typeof params[field];
      
      switch(type) {
      
        case "object":
          if(params[field] == null) {
            items.push(key + "=null");
          } else if(params[field].constructor == Array) { //handle arrays appropriately x[]=1&x[]=3
            params[field].forEach(function(val) {
              items.push(key + "[]=" + encodeURIComponent(val));
            }, this);
          } else {
            //recusrively construct the sub-object
            items = items.concat(this.encode(params[field], key));
          }
          break;
        case "function":
          break;
        default:
          items.push(key + "=" + params[field]);
          break;
      }
    }

    return items.join("&");
  },
  
  /**
  * Decode a deeply nested Url
  */
  decode: function(params) {
    
    var obj    = {};
    var parts = params.split("&");
    
    parts.forEach(function(kvs) {

      var kvp = kvs.split("=");
      var key = kvp[0];
      var val = kvp[1];
      
      if(/\[\w+\]/.test(key)) {

        var rgx = /\[(\w+)\]/g;
        var top = /^([^\[]+)/.exec(key)[0];
        var sub = rgx.exec(key);
        
        if(!obj[top]) {
          obj[top] = {};
        }
        
        var unroot = function(o) {
          
          if(sub == null) {
            return;
          }
          
          var sub_key = sub[1];
          
          sub = rgx.exec(key);
          
          if(!o[sub_key]) {
            o[sub_key] = sub ? {} : val;
          }
          
          unroot(o[sub_key]);
        };
        
        
        unroot(obj[top]);
        
      //array
      } else if(/\[\]$/.test(key)) {
        key = /(^\w+)/.exec(key)[0];
        if(!obj[key]) {
          obj[key] = [];
        }
        obj[key].push(val);
      } else {
        obj[key] = val;
      }
      
    });
    
    return obj;
  }
  
};