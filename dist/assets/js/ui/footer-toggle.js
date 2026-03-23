(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.querySelector('.dd-footer-toggle');
    var panel = document.getElementById('ddBizInfo');
    if (!btn || !panel) return;

    btn.addEventListener('click', function(){
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      panel.hidden = isOpen;
    });
  });
})();
