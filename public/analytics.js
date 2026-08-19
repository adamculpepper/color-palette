// Google Analytics (gtag) initialisation. The loader tag in index.html has to
// come from Google's domain, but the init lives here as a file rather than an
// inline block, the same rule the theme boot script follows.
//
// gtag forwards its arguments object, so it stays a function declaration.
window.dataLayer = window.dataLayer || []
function gtag() {
  window.dataLayer.push(arguments)
}

gtag('js', new Date())
gtag('config', 'G-VT37Z7Y1L7')
