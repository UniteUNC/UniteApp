(function() {
"use strict";
	
var DEFAULT_ROUTE = '';
	
var template = document.querySelector('#t');
var tabs = document.querySelector('paper-tabs');
	
template.pages = [
  {name: 'My Profile', hash: 'one'},
  {name: 'Settings', hash: 'two'}
];

template.keyHandler = function(e, detail, sender) {
  var pages = document.querySelector('#pages');

  // Select page by num key. 
  var num = parseInt(detail.key);
  if (!isNaN(num) && num <= this.pages.length) {
    pages.selectIndex(num - 1);
    return;
  }
};

template.cyclePages = function(e, detail, sender) {
  // Click clicks should navigate and not cycle pages.
  if (e.path[0].localName == 'a') {
    return;
  }

  e.shiftKey ? sender.selectPrevious(true) : sender.selectNext(true);
};

//Automatically close scaffold drawer
template.menuItemSelected = function(e, detail, sender) {
  if (detail.isSelected) {
    this.$ && document.querySelector('#scaffold').closeDrawer();
  }
};
	
	//Script for paper tabs
	var tabs = document.querySelector('paper-tabs');

	tabs.addEventListener('core-select', function() {
		console.log("Selected: " + tabs.selected);
	});
	
})();