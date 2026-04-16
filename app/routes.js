//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const path = require('path')
const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Set active nav state for header (Search menu item – active only on search form page)
router.use((req, res, next) => {
  res.locals.activeNavSearch = req.path.endsWith('/single-search-results/search-results')
  next()
})

// Serve permit PDFs by reference (for View permit PDF button)
const PERMIT_PDF_REFS = [
  '25GBIMPABS719', '25GBIMPABZPMT', '25GBIMPCDO2DA', '25GBIMPEFPJOB',
  '25GBIMPGHAQTG', '25GBIMPSTYHNO', '25GBIMPSTYXH1', '25GBIMPUVWOFM',
  '25GBIMPWX0N12', '25GBIMPYZOPGY'
]
router.get('/public/documents/:permitRef.pdf', (req, res) => {
  const ref = req.params.permitRef
  if (!PERMIT_PDF_REFS.includes(ref)) {
    return res.status(404).send('Permit PDF not found')
  }
  res.sendFile(path.join(__dirname, 'assets', 'documents', `${ref}.pdf`))
})

// Clear data and redirect back to current page
router.get('/clear-data', (req, res) => {
  req.session.data = {}
  const returnUrl = req.get('Referrer') || '/'
  res.redirect(returnUrl)
})

// Alpha 24-02-26 – single and combined search results journeys
require('./views/alpha-24-02-26/routes')(router)

// Beta 16-04-26 – copy of iteration 1 flows for beta testing
require('./views/beta-16-04-26/routes')(router)

// Alpha 02-03-26 – single search results journey
require('./views/alpha-02-03-26/routes')(router)

// Alpha 18-03-26 – Design iteration 3, single permit view
require('./views/alpha-18-03-26/routes')(router)
