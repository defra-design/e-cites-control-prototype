//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

window.GOVUKPrototypeKit.documentReady(() => {
  // MRN generator – click copies random 18-char MRN to clipboard
  const mrnLink = document.querySelector('[data-mrn-generator]')
  if (mrnLink) {
    mrnLink.addEventListener('click', (e) => {
      e.preventDefault()
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let mrn = '26GB'
      for (let i = 0; i < 14; i++) {
        mrn += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      navigator.clipboard.writeText(mrn).then(() => {
        const orig = mrnLink.textContent
        mrnLink.textContent = 'Copied!'
        setTimeout(() => { mrnLink.textContent = orig }, 1500)
      }).catch(() => {
        mrnLink.textContent = 'Copy failed'
        setTimeout(() => { mrnLink.textContent = 'Generate MRN' }, 2000)
      })
    })
  }
})
