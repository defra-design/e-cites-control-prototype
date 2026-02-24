//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Alpha 24-02-26 – single and combined search results journeys
require('./views/alpha-24-02-26/routes')(router)
