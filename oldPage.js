define(["knockout"], function(ko) {
    "use strict";
    
    //TODO: need to come up with all actions/events that can be triggered... callbacks and observables from viewmodel
    //TODO: need to load only on first visible? or should we specify when it can load?
    function page(element, val, bindingContext) {
        this._$element = element;
        this._val = val;
        this._bindingContext = bindingContext;
        
        this.id;
        this.auto = false;
        this.path = [];
        this.autoPath = [];
        this.params = ko.observable();
        this.visible = ko.observable(false);
        
        //determine if visible woop-de-doop
        ko.postbox.subscribe("spa[hashChange]", visibilityListener);
    }
    
    //-----------------------------------------------------
    // getParentPage
    //-----------------------------------------------------
    page.prototype.getParentPage = function(bindingContext) {
        while(bindingContext) {
            if(bindingContext.$__page__ && bindingContext.$__page__ instanceof page) 
                return bindingContext.$__page__;
            bindingContext = bindingContext.$parentContext;
        }
        return null;
    };
    
    //-----------------------------------------------------
    // visibilityListener
    //-----------------------------------------------------
    page.prototype.visibilityListener = function(urlObj) {
        var currentPath = urlObj.path;
        var currentPathLength = currentPath.length;
        var pathLength = this.path.length;
        var autoPathLength = this.autoPath.length;
        var isvisible = true;
        
        isvisible = (_isPathAinPathB(this.path, urlObj.path))
            ? true
            : _isPathAinPathB(_resolveAutoPath(this.autoPath, urlObj.path, "__AUTO__"), urlObj.path);
        
        //set params and visible flag
        this.params((isvisible) ? urlObj.params : null);
        this.visible(isvisible);
        
        //events
        //beforeShow /beforeHide
        //afterShow /afterHide
        //onMatch / onNoMatch - but how?... spa has a handle on all pages, and does a path check first? 
        //  build tree as we go, if path doesn't exist, need to see if it does, by loading everything...
        
        //hmmm... actually... what if we instead had the spa roll out the messages sequentially. so it does piece by piece, slowly building the whole path
        //and then this allows each section to load first/call to server... then ping back that its done. once it has then the pages respond with true if the page exists
        
        //DAMN. k. we do need a child manager i guess... and separate observables for when to load/call server, and when is visible... so that we can call a server, apply bindings, get each 
        //child to register with its parent, and then the callback, would ping back to spa to FFFFUUUUKKKK... so.. we need a handshake protocol between spa and its pages... 
        //also send a timestamp with the handshake, incase another one comes into play halfway through...
        //yay, bindings magic... so the top most ones, will be children of spa. need a loaded observable to check as well.
        
    };
    
    function _isPathAinPathB(pathA, pathB) {
        var i, nA, nB;
        
        //check params
        _isStringArray(pathA);
        _isStringArray(pathB);
        
        //pathA must be shorter or equal length to pathB
        nA = pathA.length;
        nB = pathB.length;
        if(nA > nB) 
            return false;

        //iterate backwards to quickly end loop if no match
        for(i=nA - 1; i>=0; i--) 
            if(pathA[i] !== pathB[i])
                return false;
                
        return true;
    }
    
    function _resolveAutoPath(autoPath, path, wildCard) {
        var i, n;
        
        _isStringArray(autoPath);
        _isStringArray(path);
        if(typeof wildCard !== "string") throw new Error("The wildCard must be a string.");
        
        //clone the array, so not to alter the original
        autoPath = _cloneArray(autoPath);
        
        //replace all wildcards with values from path (use shorter length)
        n = (autoPath.length > path.length) ? path.length : autoPath.length;
        for(i = 0; i < n; i++) {
            if(autoPath[i] === wildCard)
                autoPath[i] = path[i];
        }
        
        //if autoPath is longer, remove all excess wildcards starting at end, until hits a real value
        if(autoPath.length > path.length) {
            for(i = autoPath.length - 1, n = path.length; i >= n; i--) {
                if(autoPath[i] === wildCard)
                    autoPath.pop();
                else
                    break;
            }
        }
        return autoPath;
    }
    
    function _isStringArray(arr) {
        if($.isArray(arr) === false) throw new Error("This is not an array of strings.");
        $.map(arr, function(v) { if(typeof v !== "string") throw new Error("This is not an array of strings."); });
    }
    
    function _cloneArray(arr) {
        var i, arrB = []; 
        if(!$.isArray(arr)) throw new Error("Not an array");
        
        i = arr.length;
        while(i--) arrB[i] = arr[i];
        
        return arrB;
    }
});