(function(){
  window.DDLOGI = window.DDLOGI || {};
  window.DDLOGI.dom = {
    $: function(sel, root){ return (root || document).querySelector(sel); },
    $$: function(sel, root){ return Array.from((root || document).querySelectorAll(sel)); },
    safeText: function(v){ return v == null ? '' : String(v); },
    clamp: function(n, min, max){ return Math.max(min, Math.min(max, n)); },
    setHidden: function(el, hidden){
      if (!el) return;
      el.hidden = !!hidden;
      el.style.display = hidden ? 'none' : '';
    }
  };
})();
