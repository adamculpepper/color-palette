// Runs as a blocking script before first paint: stamps the saved theme on
// <html> so a light-mode reload never flashes the dark default. Mirrors the
// seeding in AppContext (stored value first, then the OS preference).
;(function () {
  try {
    var stored = localStorage.getItem('palette-theme')
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    document.documentElement.dataset.theme = theme
  } catch (storageDisabled) {
    // Storage blocked: the html attribute default stands.
  }
})()
