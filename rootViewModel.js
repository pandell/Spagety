define(["knockout"], function(ko) {
    
    function viewModel() {
        this.nav = {};
        this.nav.about = ko.observable(false);
        this.nav.events = ko.observable(false);
        this.nav.css = ko.observable(false);
        this.nav.html = ko.observable(false);
        this.nav.viewModel = ko.observable(false);
        
        this.events = ko.observableArray();
    }
    
    viewModel.prototype.onFound = function(urlObj) {
        var key;
        for(key in this.nav) {
            if(urlObj.crumbs[0] === key) {
                this.nav[key](true);
            }
            else {
                this.nav[key](false);
            }
        }
        
        this.events.unshift({label: "onFound", 
                            message: "#!/"+urlObj.crumbs.join("/"),
                            color: "#eef"});
    };
    
    return viewModel;
});