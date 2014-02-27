(function() {

    ///---------------------------------------------------
    /// CONFIG
    ///---------------------------------------------------
    /// <summary>
    ///     init the configuration for require, and AMD modules
    /// </summary>
    ///---------------------------------------------------
    require.config({
        //for cache busting / debuging
        //urlArgs: "bust=" + (new Date()).getTime(),  
        baseUrl: "/spagety",                               
        paths: {                                    
            knockout:                   'Libraries/knockout',
            text:                       'Libraries/require_text'
        }
    });

    //---------------------------------------------------
    // MAIN
    //---------------------------------------------------
    // <summary>
    //      Begin the program, by starting knockout and pager
    //      attach plugins first, before executing.     
    // </summary>
    //---------------------------------------------------
    require(['spagety', "rootViewModel"], function(spa, vm) { 
        vm = new vm();
        spa.start({
            viewModel: vm,
            onFound: function(el, pg, urlObj) { vm.onFound(urlObj); },
            onNotFound: function(el, pg, urlObj) { vm.events.unshift({label: "onNotFound", message: "#!/" + urlObj.crumbs.join("/"), color: "#fee"});},
            beforeNavigate: function(el, pg, urlObj) {vm.events.unshift({label: "beforeNavigate", message: "#!/"+urlObj.crumbs.join("/"), color: "#efe"});},
            afterNavigate: function(el, pg, urlObj) {vm.events.unshift({label: "afterNavigate", message: "#!/"+urlObj.crumbs.join("/"), color: "#aef"});},
            onRedirect: function(el, pg, urlObj) {vm.events.unshift({label: "onRedirect", message: "#!/"+urlObj.crumbs.join("/"), color: "#eaf"});},
            onSourceError: function(el, pg, urlObj) {vm.events.unshift({label: "onSourceError", message: pg.error, color: "#efa"});},
            beforeShow: function(el, pg, urlObj) {vm.events.unshift({label: "beforeShow", message: pg.id, color: "#afe"});},
            afterShow: function(el, pg, urlObj) {vm.events.unshift({label: "afterShow", message: pg.id, color: "#fea"});},
            beforeHide: function(el, pg, urlObj) {vm.events.unshift({label: "beforeHide", message: pg.id, color: "#fae"});},
            afterHide: function(el, pg, urlObj) {vm.events.unshift({label: "afterHide", message: pg.id, color: "#fff"});},
            beforeSourceLoad: function(el, pg, urlObj) {
                vm.events.unshift({label: "beforeSourceLoad", message: pg.id, color: "#ff0"});
                el.loaderDiv.className += " loadingPanel";
                el.loaderDiv.innerHTML = "LOADING...";
            },
            afterSourceLoad: function(el, pg, urlObj) {vm.events.unshift({label: "afterSourceLoad", message: pg.id, color: "#f0f"});}
        });
    });
    
    //call debug() to get a handle on libaries
    window.debug = function() {
        window.ko       = require("knockout");
        window.spa      = require("spagety");
    };
    
}());