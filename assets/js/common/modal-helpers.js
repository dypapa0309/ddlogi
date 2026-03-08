(function(){
  window.DDLOGI = window.DDLOGI || {};

  function syncModalBodyLock(){
    var opened = document.querySelectorAll('.modal.open').length;
    document.body.classList.toggle('modal-open', opened > 0);
  }

  function openModal(id){
    var modal = document.getElementById(id);
    if (!modal) return false;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalBodyLock();
    return true;
  }

  function closeModal(id){
    var modal = document.getElementById(id);
    if (!modal) return false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    syncModalBodyLock();
    return true;
  }

  function closeAllModals(){
    document.querySelectorAll('.modal.open').forEach(function(modal){
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
    syncModalBodyLock();
  }

  window.DDLOGI.modal = {
    syncModalBodyLock: syncModalBodyLock,
    openModal: openModal,
    closeModal: closeModal,
    closeAllModals: closeAllModals
  };
})();
