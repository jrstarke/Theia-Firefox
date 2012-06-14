logger.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ logger.showFirefoxContextMenu(e); }, false);
};

logger.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-logger").hidden = gContextMenu.onImage;
};

window.addEventListener("load", logger.onFirefoxLoad, false);
