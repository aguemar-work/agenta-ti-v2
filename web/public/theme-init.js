(function () {
  try {
    var t = localStorage.getItem('mc-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}

  var fontsLink = document.getElementById('gfonts-link');
  if (fontsLink) {
    fontsLink.addEventListener('load', function () {
      fontsLink.media = 'all';
    });
  }
})();
