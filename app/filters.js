//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter

// Species if same across all permits, otherwise null (for consignment summary)
addFilter('uniformSpecies', (permitList) => {
  if (!permitList || !Array.isArray(permitList) || permitList.length === 0) return null
  const first = (permitList[0].species || permitList[0].specimen?.species || '').trim()
  if (!first || first === '–') return null
  const allSame = permitList.every(p => (p.species || p.specimen?.species || '').trim() === first)
  return allSame ? first : null
})

// Issue date = 6 months before expiry date (for permit details)
addFilter('issueDate', (expires) => {
  if (!expires || expires === '–') return '–'
  const d = new Date(expires)
  if (isNaN(d.getTime())) return '–'
  d.setMonth(d.getMonth() - 6)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
})

