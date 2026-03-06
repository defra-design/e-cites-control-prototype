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

// Serve sample permit PDF (for View permit PDF button)
router.get('/public/documents/sample-permit.pdf', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'documents', 'sample-permit.pdf'))
})

// Clear data and redirect back to current page
router.get('/clear-data', (req, res) => {
  req.session.data = {}
  const returnUrl = req.get('Referrer') || '/'
  res.redirect(returnUrl)
})

// Alpha 24-02-26 – single and combined search results journeys
require('./views/alpha-24-02-26/routes')(router)

// Alpha 02-03-26 – single search results journey
require('./views/alpha-02-03-26/routes')(router)
