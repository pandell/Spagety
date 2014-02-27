define(["knockout","jquery"], function(ko, $) {
    "use strict";

    /*
    ========================
    TODO
    ========================
    [ ] Transition pendingVisibleState to visible on successful url
        [ ] Nofity spa that the url has finished being navigated / is successful
    [x] Make spa have a root page it binds to entire site, instead of dummy functions like navigate / subPages (see if can add onto body tag)
    [ ] Add title for pages onto browser
    [ ] why is bindingContexts not working as expected
    */
    
    //if no viewModel supplied, used parentViewModel
    function pageBindingModel(element, settings, parentPage) {
        this.element    = element;
        console.log(settings);
        this.id         = settings.id;
        this.htmlPath   = settings.html || null;
        this.cssPath    = settings.css || null;
        this.jsPath     = settings.viewModel || null;
        //this.active ? perhaps to indicate when the page is active/visible for the viewModel to use??
        //this.urlParams = settings.urlParams;  --> this could be for: #!/user?id=2&age=23 -> #!/user/2/23, and have them specify an array for urlParams
        
        //link with parentPage
        this.subPages   = [];
        this.parentPage = parentPage;
        if(this.parentPage !== null)
            this.parentPage.addSubPage(this.id, this);
        
        this.pendingVisibleState    = false; //used to store next state of page, incase url fails dont need to be switching things on before they need to
        this.loaded                 = false; //used as a flag to indicate the resources have been loaded...
        
        this.setElementVisibility();
        
        //listen to when url change has happened, and set pendingVisibleState to false
        this.constructor._pendingVisibilityTrigger.subscribe(function() {
            this.pendingVisibleState = false;
        }, this);
        
        //listen to when to actually toggle the visibility
        this.constructor._visibilityTrigger.subscribe(this.setElementVisibility);
    }
    
    pageBindingModel.prototype.setElementVisibility = function() {
        if(this.parentPage !== null)
            this.element.style.display = (this.pendingVisibleState) ? "" : "none";
    };
    
    //-----------------------------------------------------
    // addSubPage
    //-----------------------------------------------------
    pageBindingModel.prototype.addSubPage = function(id, page) {
        if(this.subPages[id]) 
            throw new Error("A page with id: '"+id+"' already exists at this level.");
        this.subPages[id] = page;
    };
    
    //-----------------------------------------------------
    // navigate (maybe call this locate.. and the other one reveal)
    //-----------------------------------------------------
    //need to figure out how to make queryStrings work, or better yet, nicely routed urls, example.com/#!/user/123/settings
    pageBindingModel.prototype.navigate = function(urlParts) {
        var self = this;

        if(this.loaded === false) {
            //need to extract out the queryString (if leafNode), and possible routed urls
            loadElementResources(this.element, this.htmlPath, this.jsPath, this.cssPath, function(html, css, js) {
                //in a try block, so that when we get to passing params to viewModel, and viewModel throws an err...
                //try {
                    html = setElementHtml(html, self.element);
                    css = setElementCss(css, self.element);
                    js = setElementJs(js, self.element, this); //pass in querystring and urlparams here... maybe if querystring/urlparams specified might have to remake js everytime...
                    //actually, can get user to specify them in an array, ex: urlParams: ['name', 'age'], then can look these up and try to update if already exists, else first time pass to constructor
                    
                    self.loaded = true;
                    self.navigate(urlParts);
                //}
                //catch(e) {
                //    console.log(e);
                //    alert("AN ERROR!");
                //}
            });
            return;
        }
        
        this.pendingVisibleState = true;
        
        //not quite, because need to decide about urlparams as well...
        if(urlParts.length > 0) {
            if(this.subPages[urlParts[0]]) {
                this.subPages[urlParts[0]].navigate(urlParts.slice(1));
                return;
            }
            else {
                
                console.log(urlParts);
                alert("DOES NOT EXIST");
                //no subPage / url does not exist
            }
        }
        else {
            //maybe also climb parents first, then trigger this? to ensure no choppyness?
            this.revealPages();
            //this.constructor._visibilityTrigger.notifySubscribers();
            
            //alert("LEAF NODE");
            //leaf node, update querystring/urlparams, then stop and notify spa
        }
    };

    pageBindingModel.prototype.revealPages = function() {
        var key;
        
        this.setElementVisibility();
        for(key in this.subPages) {
            this.subPages[key].setElementVisibility();
        }
        
        if(this.parentPage !== null)
            this.parentPage.revealPages();
    };
    
    //-----------------------------------------------------
    // loadHTML (need a different for modal, to load them onto a different element, probz off of spa)
    //-----------------------------------------------------
    function loadElementResources(element, htmlPath, jsPath, cssPath, callback) {
        var deps = [], hasErr = false;
        if(htmlPath) { deps.push("text!" + htmlPath + "!strip"); }
        if(cssPath) { deps.push("text!" + cssPath + "!strip"); }
        if(jsPath) { deps.push(jsPath); }
        
        //hhrrrm.... 
        require(deps, 
            function(/*html, css, js*/) {
                var n = 0,
                    html = (htmlPath) ? arguments[n++] : null,
                    css = (cssPath) ? arguments[n++] : null,
                    js = (jsPath) ? arguments[n++] : null;
                
                callback(html, css, js);
            }, 
            function(err) {
                if(hasErr === false) {
                    hasErr = true;
                    console.log("Error loading module");
                    //firstErrCallBack / or maybe just a redirect...?
                }
                //allErrCallBack / postbox publish
                console.log(err);
            }
        );
    }
    
    //-----------------------------------------------------
    // setElementJs
    //-----------------------------------------------------
    function setElementJs(viewModel, element, page) {
        var bindingContext, childBindingContext;
        
        //if(viewModel === null) 
        //    return viewModel;
            
        if(typeof viewModel === "function" && !ko.isObservable(viewModel))
            viewModel = new viewModel();
            
        
            
        bindingContext = ko.contextFor(element);
        ko.cleanNode(element);
        
        if(viewModel === null || viewModel === undefined) 
            viewModel = bindingContext.$data;
        
        //if(viewModel !== null)
            childBindingContext = bindingContext.createChildContext(viewModel);
        //else
        //    childBindingContext = bindingContext;
        
        //? this is hacky / testing
        childBindingContext.$__page__ = page;
        //if(bindingContext.$__page__.id === "__ROOT__")
        //    bindingContext.$__page__ = undefined;
        //?
        
        ko.applyBindingsToDescendants(childBindingContext, element);
        return viewModel;
    }
    
    //-----------------------------------------------------
    // setElementCss
    //-----------------------------------------------------
    function setElementCss(css, element) {
        //TODO
        return css;
    }
    
    //-----------------------------------------------------
    // setElementHtml
    //-----------------------------------------------------
    function setElementHtml(html, element) {
        var $children, $el = $(element);
            
        if(html === null) 
            return html;
        
        $children = $el.children();
        $.each($children, function(i, $child) {
            ko.utils.domNodeDisposal.removeNode(child);
        });
        
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        $el.empty().html(html);
        return html;
    }
    
    //-----------------------------------------------------
    // getParentPage (this could get messed up if doing modals by pulling them out...)
    //-----------------------------------------------------
    function _getParentPage(bindingContext) {
        while(bindingContext) {
            console.log(bindingContext);
            if(bindingContext.$__page__ && bindingContext.$__page__ instanceof pageBindingModel) 
                return bindingContext.$__page__;
            bindingContext = bindingContext.$parentContext;
        }
        return null;
    };
    
    //-----------------------------------------------------
    // splitUrl
    //-----------------------------------------------------
    function splitUrl(url, hashbang) {
        var path, last, hash, query, i, n, set, sets, params;
        
        if(typeof url !== "string") throw new Error("The url must be a string.");
        
        //check if there is a hashbang, if not add one at end of url, and before '?'
        if(url.indexOf(hashbang) === -1) {
            if(url.indexOf("?") === -1) {
                url += (url[url.length-1] === "/") ? hashbang : "/" + hashbang;
            }
            else {
                path = url.split("?");
                url = path[0];
                url += (url[url.length-1] === "/") ? hashbang : "/" + hashbang;
                url += "?" + path[1];
            }
        }
        
        //clean out any duplicate hashbangs
        while(url.match(/#!\//g).length > 1) {
            url = url.replace(/#!\//, "");
        }
        
        //extract everything after the hashbang
        hash = url.split(hashbang);
        hash = hash[hash.length-1];
        
        //split the hash into a decoded array of each path section
        path = $.map(hash.replace(/\+/g, " ").split("/"), decodeURIComponent);
        last = path[path.length-1].split("?");
        
        //remove the querystring off of last element
        path[path.length-1] = last[0];
        query = last[1];
        
        //extract the querystring into key/val set
        if(query) {
            sets = query.split("&");
            params = {};
            
            for(i=0, n=sets.length; i<n; i++) {
                set = sets[i].split("=");
                params[set[0]] = set[1];
            }
        }
        
        //remove "" from path, if path doesn't exist
        if(path[0] === "") path = [];
        if(path[path.length - 1] === "") path.pop();
        
        return {path: path, params: params, url: url};
    };
    
    
    //-----------------------------------------------------
    // binding
    //-----------------------------------------------------
    var x = 0;
    ko.bindingHandlers.page = {
        init: function(element, valueAccessor, allBindingsHandler, viewModel, bindingContext) {
            var page = new pageBindingModel(element, valueAccessor(), _getParentPage(bindingContext));
            if(!bindingContext.$__page__) 
                bindingContext.$__page__ = page;
             
            return {controlsDescendantBindings: true};
        }
    };
    
    //------------------------------------------------------------------------------------
    // SPA MODULE / statics
    //------------------------------------------------------------------------------------
    pageBindingModel._pendingVisibilityTrigger = ko.observable();
    pageBindingModel._visibilityTrigger = ko.observable();
    
    var spa = {
        _hashbang:          "#!/",
        _rootPage:          null,

        start: function(/*config options here??*/) {
            var self = this, body = document.getElementsByTagName("body")[0];
            
            body.setAttribute("data-bind", "page: {id: '__ROOT__'}");
            ko.applyBindings();

            self._rootPage = ko.contextFor(body.children[0]).$__page__;
            self._rootPage.navigate(splitUrl(window.location.href, self._hashbang).path);
            
            window.addEventListener("hashchange", function() {
                pageBindingModel._pendingVisibilityTrigger.notifySubscribers();
                self._rootPage.navigate(splitUrl(window.location.href, self._hashbang).path);
            }, false);
        }
    }
    return spa;
});
