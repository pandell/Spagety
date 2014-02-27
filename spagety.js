// Spagety JavaScript library v1.0.0
// Copyright (c) 2014 Corey Jasinski, Pandell, and other contributors
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// https://github.com/pandell/Spagety

/*jslint browser: true*/
/*global define: true*/

define(["knockout"], function (ko) {
    "use strict";

    /// ==========================================================================================
    /// CLASS: PageBindingModel
    /// ==========================================================================================
    function PageBindingModel(element, settings, elementBindingContext) {

        //validate basic settings
        if (!settings) { throw new Error("Please supply some settings for the page binding"); }
        if (typeof settings.id !== "string" || settings.id === "") { throw new Error("An 'id' must be set, and it must be a string"); }
        if (settings.html && typeof settings.html !== "string") { throw new Error("Please provide a string for the html path"); }
        if (settings.css && typeof settings.css !== "string") { throw new Error("Please provide a string for the css path"); }
        if (settings.viewModel && typeof settings.viewModel !== "string") { throw new Error("Please provide a string for the javascript module you want to load"); }
        if (settings.autoShow && typeof settings.autoShow !== "boolean") { throw new Error("Please provide true/false for the 'autoShow' property"); }
        if (settings.title && typeof ko.unwrap(settings.title) !== "string") { throw new Error("Please provide a string/observable for the title."); }
        
        //apply basic settings
        this.id = settings.id;
        this.htmlPath = settings.html;
        this.cssPath = settings.css;
        this.jsPath = settings.viewModel;
        this.autoShow = settings.autoShow;
        
        this.title = (settings.title) 
            ? ((ko.isObservable(settings.title)) 
                ? settings.title : ko.observable(settings.title)) 
            : ko.observable(this.id);
        
        //attach events
        this.events = PageBindingModel.createEventsObject(settings);

        //apply element and parentPage
        this.element = element;
        this.parentPage = PageBindingModel.getParentPage(elementBindingContext);

        //create a div element that is the container for a loader
        this.element.loaderDiv = document.createElement("div");
        
        //create fields about if the resources are loaded and element is visible
        this.loaded = false;
        this.pendingVisible = false;
        this.visible = this.createVisibleObservable();

        //create field to store potential error messages
        this.error;
        
        //store the bindingContext, to apply it later, 
        this.bindingContext = null;
        this.viewModelContainer = ko.observable();
        
        //need to manually update $data, because the context is only dealing with $rawData itself
        //https://github.com/knockout/knockout/blob/master/src/binding/bindingAttributeSyntax.js#L109
        this.viewModelContainer.subscribe(function(data) { 
            this.bindingContext.$data = data; 
        }, this);

        //create an array of subpages, and register with parent (unless root)
        this.subPages = [];
        if (this.parentPage !== null) {
            if(this.parentPage.subPages[this.id]) {
                throw new Error("A page with '"+ this.id +"', already exists as a subPage on '"+ this.parentPage.id +"'");
            }
            this.parentPage.subPages[this.id] = this;
        } else {
            PageBindingModel.rootPage = this;
        }
        
        //if not root, then create a child context bound with the parent's viewModelContainer, else use element's bindingContext
        this.bindingContext = (this.parentPage !== null)
            ? elementBindingContext.createChildContext(this.parentPage.viewModelContainer())
            : elementBindingContext;

        //store a reference of page on the bindingContext, and initialize the context with some initial data/inherited data
        this.bindingContext._pageBindingModel = this;
        this.viewModelContainer(this.bindingContext.$rawData);
    }

    /// ==========================================================================================
    /// STATIC FIELDS
    /// ==========================================================================================
    PageBindingModel.rootPage = undefined;
    PageBindingModel.allowBubbling = true;
    PageBindingModel.redirecting = false;
    PageBindingModel.asyncCounter = 0;
    PageBindingModel.hashbang = "#!/";
    PageBindingModel.events = {};
    PageBindingModel.urlObj;
    
    /// ==========================================================================================
    /// PROTOTYPES
    /// ==========================================================================================
    /// -----------------------------------------------------
    /// createVisibleObservable
    /// -----------------------------------------------------
    /// <summary>
    ///     Creates a writable computed, that triggers before/after show/hide events
    /// </summary>
    /// <returns>A writable computed</return>
    /// -----------------------------------------------------
    PageBindingModel.prototype.createVisibleObservable = function () {
        var raw = ko.observable(false);

        return ko.computed({
            read: raw,
            write: function (v) {
                if (v === true && raw() === false) {
                    this.eventBubbleUp("beforeShow");
                    raw(v);
                    this.eventBubbleUp("afterShow");
                } else if (v === false && raw() === true) {
                    this.eventBubbleUp("beforeHide");
                    raw(v);
                    this.eventBubbleUp("afterHide");
                }
            }
        }, this);
    };

    /// -----------------------------------------------------
    /// eventBubbleUp
    /// -----------------------------------------------------
    /// <summary>
    ///     Triggers the event callback on the page binding, and bubbles up through parents until defaultEvent is found
    ///     It calls the events with 3 parameters. event(Element, PageBindingModel, urlObj) 
    ///     If no events are defined for a page, then it bubbles past it
    ///     If an event callback returns {preventBubbling: true} then the bubbling will not continue upwards
    /// </summary>
    /// <param name="name">The name of the event to bubble</param>
    /// -----------------------------------------------------
    PageBindingModel.prototype.eventBubbleUp = function (name) {
        var result, eventPg = arguments[1];
        
        if(eventPg === null || eventPg === undefined) { eventPg = this; }
        
        if (typeof this.events[name] !== "function" && this.events[name] !== undefined) {
            throw new Error("Cant bubble up: '" + name + "'");
        }

        if (typeof this.events[name] === "function") {
            result = this.events[name](this.element, this, PageBindingModel.urlObj);
        }

        if (PageBindingModel.allowBubbling === true && (!result || result.preventBubbling !== "true")) {
            if (this.parentPage !== null) {
                this.parentPage.eventBubbleUp(name, eventPg);
            } else if (typeof PageBindingModel.events[name] === "function") {
                PageBindingModel.events[name](eventPg.element, eventPg, PageBindingModel.urlObj);
            }
        }
    };

    /// -----------------------------------------------------
    /// resetSubPagesPendingVisibility
    /// -----------------------------------------------------
    /// <summary>
    ///     Iterates each child page, resetting their pendingVisible flag to false
    ///     Each child page recurses until leaf nodes are found
    /// </summary>
    /// -----------------------------------------------------
    PageBindingModel.prototype.resetSubPagesPendingVisibility = function () {
        var key, subPg;
        for (key in this.subPages) {
            if(this.subPages.hasOwnProperty(key)) {
                subPg = this.subPages[key];
                subPg.pendingVisible = false;
                subPg.resetSubPagesPendingVisibility();
            }
        }
    };

    /// -----------------------------------------------------
    /// navigate
    /// -----------------------------------------------------
    /// <summary>
    ///     Resolves the url by recursively traversing the graph of page bindings
    ///     If the resources for a page binding have not been loaded yet, then it will load the resources, before continuing
    /// </summary>
    /// <param name="crumbs">
    ///     An array of the next crumbs in the path (after the current id)
    /// </param>
    /// -----------------------------------------------------
    PageBindingModel.prototype.navigate = function (crumbs) {
        var viewModel, result, defaultViewModel, self = this;

        //check to see if the resources have been loaded yet, if not load them, then continue nav
        if (this.loaded === false) {
            this.loadAndApplyResources(function() { self.navigate(crumbs); });
            return;
        }

        //since this is part of the path, set the pending flag to true
        this.pendingVisible = true;

        //if there are still more crumbs to be navigated to, then go to that child page
        if (crumbs.length > 0) {
            if (this.subPages[crumbs[0]]) {
                this.subPages[crumbs[0]].navigate(crumbs.slice(1));
                return;
            } else {
                this.eventBubbleUp("onNotFound");
                
                //check if a custom onNotFound is redirecting at this point
                if(PageBindingModel.isRedirecting()) {
                    self.eventBubbleUp("onRedirect");
                    return;
                }
                
                this.reveal();
                this.eventBubbleUp("afterNavigate");
            }
        } else {
            //now that no more crumbs, see if any child pages are autoShow
            this.setAutoSubPages(function () {
                self.eventBubbleUp("onFound");
                
                //check if a custom onFound is redirecting at this point
                if(PageBindingModel.isRedirecting()) {
                    self.eventBubbleUp("onRedirect");
                    return;
                }
                
                self.reveal();
                self.eventBubbleUp("afterNavigate");
                
                //dont set for root
                if(self.parentPage !== null) {
                    window.document.title = self.title();
                }
            });
        }
    };

    /// -----------------------------------------------------
    /// loadAndApplyResources
    /// -----------------------------------------------------
    /// <summary>
    ///     Calls to load the resources, then applies them to the element. 
    /// </summary>
    /// <param name="callback">A function to callback once the resources are successfully loaded</param>
    /// -----------------------------------------------------
    PageBindingModel.prototype.loadAndApplyResources = function (callback) {
        var self = this;

        this.error = null;
        this.eventBubbleUp("beforeSourceLoad");
        this.element.insertBefore(this.element.loaderDiv, this.element.firstChild);
        
        PageBindingModel.asyncCounter += 1;
        PageBindingModel.loadResources(this.htmlPath, this.cssPath, this.jsPath,
            function (html, css, viewModel) {
                PageBindingModel.asyncCounter -= 1;

                //remove the loading div that was added
                if(self.element.loaderDiv) {
                    self.element.removeChild(self.element.loaderDiv);
                }

                //update viewModelContainer with new viewModel
                var viewModel = (typeof viewModel === "function") ? new viewModel() : viewModel;
                if(viewModel) { self.viewModelContainer(viewModel); }

                //apply the html and css to the element
                PageBindingModel.setElementHtml(self.element, html);
                PageBindingModel.setElementCss(self.element, css, self.cssPath, css);

                //apply the bindings
                ko.applyBindingsToDescendants(self.bindingContext, self.element);
                self.loaded = true;
                
                self.eventBubbleUp("afterSourceLoad");
                
                //if a callback is supplied, then call it
                if(typeof callback === "function") { callback(); }
        },  function (err) {
                PageBindingModel.asyncCounter -= 1;
                self.error = err;
                self.eventBubbleUp("onSourceError");
                
                //check if a custom onSourceError is redirecting at this point
                if(PageBindingModel.isRedirecting()) {
                    self.eventBubbleUp("onRedirect");
                    return;
                }
                
                self.reveal();
                self.eventBubbleUp("afterNavigate");
        });
    };
    
    /// -----------------------------------------------------
    /// setAutoSubPages
    /// -----------------------------------------------------
    /// <summary>
    ///     Checks all subPages to see if they have an autoShow flag
    ///     If they have not loaded yet, then load the autoShow subPages
    ///     traverse all subPages, until no more autoShow are detected / on leaf nodes
    ///     Tracks all async server requests, so only calls callback once everything has finished
    /// </summary>
    /// <param name="callback">A callback function to be triggered once all async calls have finished</param>
    /// -----------------------------------------------------
    PageBindingModel.prototype.setAutoSubPages = function (callback) {
        var key, subPg;
        
        //needed to persist the pg, since the for loop would change subPg by the time we needed it
        function scopeCallback(pg) {
            return function() {
                pg.setAutoSubPages(callback);
            };
        }
        
        for (key in this.subPages) {
            subPg = this.subPages[key];
            if (subPg.autoShow === true) {
                subPg.pendingVisible = true;
                //if the resources have not been loaded yet
                if (subPg.loaded === false) {
                    subPg.loadAndApplyResources(scopeCallback(subPg));
                } else {
                    //use asyncCounter here, to prevent multiple callbacks below
                    PageBindingModel.asyncCounter += 1;
                    subPg.setAutoSubPages(callback);
                    PageBindingModel.asyncCounter -= 1;
                }
            }
        }

        //track async, only call callback once all are returned
        if (PageBindingModel.asyncCounter === 0 && callback) {
            callback();
        }
    };
    
    /// -----------------------------------------------------
    /// reveal
    /// -----------------------------------------------------
    /// <summary>
    ///     Toggles visibility for all sibling pages (and self) by calling upon parent
    ///     Recurses up parents until root, toggling all sibling pages
    ///     This helps with a smoother UI display, instead of starting at root and recursing downwards
    /// </summary>
    /// -----------------------------------------------------
    PageBindingModel.prototype.reveal = function() {
        var key, pg;

        if(this.parentPage !== null) {
            for(key in this.parentPage.subPages) {
                pg = this.parentPage.subPages[key];
                pg.visible(pg.pendingVisible);
            }
            this.parentPage.reveal();
        } else {
            this.visible(true);
            this.toggleSubPages();
        }
    };
    
    /// -----------------------------------------------------
    /// toggleSubPages
    /// -----------------------------------------------------
    /// <summary>
    ///     Recurses through subPages toggling visibility to match the pending flag
    /// </summary>
    /// -----------------------------------------------------
    PageBindingModel.prototype.toggleSubPages = function() {
        var key, subPg;

        for(key in this.subPages) {
            subPg = this.subPages[key];
            subPg.visible(subPg.pendingVisible);
            subPg.toggleSubPages();
        }
    };

    /// ==========================================================================================
    /// STATIC FUNCTIONS
    /// ==========================================================================================
    /// -----------------------------------------------------
    /// createEventsObject
    /// -----------------------------------------------------
    /// <summary>
    ///     Creates an object that stores all the user defined event callbacks
    /// </summary>
    /// <param name='settings'>The user provided settings. An object of event callbacks</param>
    /// <returns>An object containing all user defined events</returns>
    /// -----------------------------------------------------
    PageBindingModel.createEventsObject = function (settings) {
        var i, n, result = {},
            events = ['onNotFound', 'onFound', 'onSourceError', 'beforeShow', 'afterShow', 
                      'beforeHide', 'afterHide', 'beforeNavigate', 'afterNavigate', 'onRedirect',
                      'beforeSourceLoad', 'afterSourceLoad'];
        
        for(i = 0, n = events.length; i < n; i += 1) {
            if(settings.hasOwnProperty(events[i])) {
                if (typeof settings[events[i]] !== "function") {
                    throw new Error("Please provide a function as the callback for '"+events[i]+"'");
                }
                result[events[i]] = settings[events[i]];
            }
        }
        return result;
    };
    
    /// -----------------------------------------------------
    /// loadResources
    /// -----------------------------------------------------
    /// <summary>
    ///     Loads the resources for given html, css, js paths
    /// </summary>
    /// <param name="htmlPath">The path to the html file (with extension)</param>
    /// <param name="cssPath">The path to the css file (with extension)</param>
    /// <param name="jsPath">The path to the javascript module (AMD)</param>
    /// <param name="callback(html, css, js)">The callback once the resources successfully finished</param>
    /// <param name="errCallback(err)">The callback if the resources unsuccessfully loaded</param>
    /// -----------------------------------------------------
    PageBindingModel.loadResources = function (htmlPath, cssPath, jsPath, callback, errCallback) {
        var deps = [], hasErr = false;

        //TODO: pass params to html as well, when sending request
        htmlPath = (htmlPath) ? htmlPath : "";
        if(htmlPath) {
            if(htmlPath.search(/\w*\.\w*/) < 0) { 
                throw new Error("Please provide a file extension for your html.");
            };
            htmlPath = "text!" + htmlPath + "!strip";
        }

        cssPath = (cssPath) ? cssPath : "";
        if(cssPath) {
            if(cssPath.search(/\w*\.\w*/) < 0) { 
                throw new Error("Please provide a file extension for your css.");
            };
            cssPath = "text!" + cssPath + "!strip";
        }

        require([htmlPath, cssPath, jsPath], 
            function(html, css, js) {
                callback(html, css, js);
            },
            function(err) {
                if(hasErr === false) {
                    hasErr = true;
                    errCallback(err);
                }
            }
        );
    };

    /// -----------------------------------------------------
    /// setElementHtml
    /// -----------------------------------------------------
    /// <summary>
    ///     Inserts the loaded html into the element.
    /// </summary>
    /// <param name="element">The element to insert the html into</param>
    /// <param name="html">A string of html to insert</param>
    /// -----------------------------------------------------
    PageBindingModel.setElementHtml = function(element, html) {
        var children, i, n;

        if(!html) { return; }

        children = element.children;
        for(i = 0, n = children.length; i < n; i++) {
            ko.utils.domNodeDisposal.removeNode(children[i]);
        }

        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        element.innerHTML = html;
    };

    /// -----------------------------------------------------
    /// setElementCss
    /// -----------------------------------------------------
    /// <summary>
    ///     Inserts css into a style tag in head
    ///     Creates a unique ID and appends this string to each rule, to create a scope for the CSS
    /// </summary>
    /// <param name="element">The element to apply the CSS to</param>
    /// <param name="css">A string of css rules</param>
    /// -----------------------------------------------------
    PageBindingModel.setElementCss = function (element, css) {
        var rules, i, n, first, scope = 0, style;

        if(!css) { return; }

        //replace all unnecessary whitespace
        css = css.replace(/[\f\n\r\t\v]/g, "").replace(/\{\s*/g, "{");
        rules = css.split("}");
        rules.pop();

        //generate an id for scope, based off of first rule, and length of css
        first = rules[0].split("{")[0];
        for(i = 0, n = first.length; i < n; i++) {
            scope += first.charCodeAt(i); 
        }
        scope = "scope_" + scope + "_" + css.length;

        //add the scope to the parent element
        if(element.classList) {
            element.classList.add(scope);
        } else {
            element.className += " " + scope;
        }

        //see if it already has been added to head, so to return
        style = document.getElementById(scope);
        if(style && style.type === "text/css") {
            return;
        }

        //prepend the cssid to each rule, to scope the stylesheet
        for(i = 0, n = rules.length; i < n; i++) {
            rules[i] =  "." + scope + " " + rules[i]
        }
        css = rules.join("}") + "}";

        //add the new css to head
        style = document.createElement("style");
        style.id = scope;
        style.type = "text/css";
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    };

    /// -----------------------------------------------------
    /// getParentPage
    /// -----------------------------------------------------
    /// <summary>
    ///     Given a bindingContext, it will find the next bindingContext that has a pageBindingModel as a property
    /// </summary>
    /// <param name="bindingContext">An elements knockout bindingContext</param>
    /// <returns>A PageBindingModel, or null if no parent pages exist</returs>
    /// -----------------------------------------------------
    PageBindingModel.getParentPage = function(bindingContext) {
        while(bindingContext) {
            if(bindingContext._pageBindingModel && bindingContext._pageBindingModel instanceof PageBindingModel) {
                return bindingContext._pageBindingModel;
            }
            bindingContext = bindingContext.$parentContext;
        }
        return null;
    };

    /// -----------------------------------------------------
    /// isRedirecting
    /// -----------------------------------------------------
    /// <summary>
    ///     Checks if the location.href matches the current url being navigated. If no match, then a redirect needs to happen
    /// </summary>
    /// <returns>True if the urls do not match, false if they do</returns>
    /// -----------------------------------------------------
    PageBindingModel.isRedirecting = function() {
        return (PageBindingModel.normalizeUrl(window.location.href, PageBindingModel.hashbang) !== PageBindingModel.urlObj.url);
    };
    
    /// -----------------------------------------------------
    /// normalizeUrl
    /// -----------------------------------------------------
    /// <summary>
    ///     Takes a url, and adds a hashbang to it if it is missing
    /// </summary>
    /// <param name="url">A url string</param>
    /// <param name="hashbang">The symbol used to identify the start of the SPA paths, ex: "#!/"</param>
    /// -----------------------------------------------------
    PageBindingModel.normalizeUrl = function(url, hashbang) {
        var parts, hashEscaped, regex;
        //append hashbang incase its not on url
        if(url.indexOf(hashbang) === -1) {
            if(url.indexOf("?") === -1) {
                url += (url[url.length-1] === "/") ? hashbang : "/" + hashbang;
            } else {
                parts = url.split("?");
                url = parts[0];
                url += (url[url.length-1] === "/") ? hashbang : "/" + hashbang;
                url += "?" + parts[1];
            }
        }

        //clean out duplicate hashbangs
        hashEscaped = hashbang.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        regex = new RegExp(hashEscaped, "g");
        while(url.match(regex).length > 1) {
            url = url.replace(hashEscaped, "");
        }
        return url;
    };
    
    /// -----------------------------------------------------
    /// splitUrl
    /// -----------------------------------------------------
    /// <summary>
    ///     Takes a url, splits out everything after the hashbang into an array of crumbs
    ///     Splits out the query string into a key/val object
    /// </summary>
    /// <param name="url">A url string</param>
    /// <param name="hashbang">The symbol used to identify the start of the SPA paths, ex: "#!/"</param>
    /// -----------------------------------------------------
    PageBindingModel.splitUrl = function(url, hashbang) {
        var i, n, p, parts, hash, crumbs, query, params;

        url = PageBindingModel.normalizeUrl(url, hashbang);

        //extract everything after the hashbang
        hash = url.split(hashbang);
        hash = hash[hash.length-1];

        //extract crumbs
        crumbs = hash.replace(/\+/g, " ").split("/");
        for(i = 0, n = crumbs.length; i < n; i++) {
            crumbs[i] = decodeURIComponent(crumbs[i]);
        }
        parts = crumbs[crumbs.length-1].split("?");
        crumbs[crumbs.length-1] = parts[0];
        query = parts[1];

        //extract querystring into key/val params
        if(query) {
            parts = query.split("&");
            params = {};

            for(i = 0, n = parts.length; i < n; i++) {
                p = parts[i].split("=");
                params[p[0]] = p[1];
            }
        }

        //clean unused crumbs
        if(crumbs[0] === "") { 
            crumbs = [];
        }
        if(crumbs[crumbs.length-1] === "") {
            crumbs.pop();
        }

        return {crumbs: crumbs, params: params, url: url};
    };

    /// ==========================================================================================
    /// BINDINGS
    /// ==========================================================================================
    /// -----------------------------------------------------
    /// page
    /// -----------------------------------------------------
    /// <summary>
    ///     Creates a page binding, that helps to resolve url paths, and viewModel scopes
    ///     Accepts an object of different options to setup the binding
    /// </summary>
    /// -----------------------------------------------------
    ko.bindingHandlers.page = {
        init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
            var page = new PageBindingModel(element, valueAccessor(), bindingContext);

            ko.applyBindingsToNode(element, {
                visible: page.visible
            });

            return { controlsDescendantBindings: true };
        }
    };

    /// ==========================================================================================
    /// REVEAL
    /// ==========================================================================================
    /// -----------------------------------------------------
    /// RETURN
    /// -----------------------------------------------------
    /// <summary>
    ///     Reveals a start method, for a config to setup the initial requirements
    ///     Creates a page binding on the body tag, and listens for hashchange event
    /// </summary>
    /// -----------------------------------------------------
    return {
        pageBindingModel: PageBindingModel,
        
        start: function(settings) {
            var vm, body, page, bindingContext;

            body = document.getElementsByTagName("body")[0];
            body.setAttribute("data-bind", "page: {id: '__ROOT__'}");

            vm = (settings) ? settings.viewModel : {};
            ko.applyBindings((typeof vm === "function") ? new vm() : vm);
            page = ko.contextFor(body)._pageBindingModel;

            //extract global settings
            PageBindingModel.events = PageBindingModel.createEventsObject(settings);
            PageBindingModel.allowBubbling = (settings.allowBubbling === false) ? false : true;
            
            //perform the initial navigation
            PageBindingModel.urlObj = PageBindingModel.splitUrl(window.location.href, PageBindingModel.hashbang);
            PageBindingModel.rootPage.eventBubbleUp("beforeNavigate");
            PageBindingModel.rootPage.resetSubPagesPendingVisibility();
            PageBindingModel.rootPage.navigate(PageBindingModel.urlObj.crumbs);
            
            //navigate everytime the hashchange event fires
            window.addEventListener("hashchange", function() {
                PageBindingModel.urlObj = PageBindingModel.splitUrl(window.location.href, PageBindingModel.hashbang);
                PageBindingModel.rootPage.eventBubbleUp("beforeNavigate");
                PageBindingModel.rootPage.resetSubPagesPendingVisibility();
                PageBindingModel.rootPage.navigate(PageBindingModel.urlObj.crumbs);
            }, false);
        }
    };
});