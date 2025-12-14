export default {
  beforeMount(el, binding) {
    el.__clickOutsideHandler__ = (event) => {
      // Prüfen ob Klick außerhalb des Elements war
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };

    document.addEventListener('click', el.__clickOutsideHandler__);
  },

  unmounted(el) {
    document.removeEventListener('click', el.__clickOutsideHandler__);
    delete el.__clickOutsideHandler__;
  },
};
