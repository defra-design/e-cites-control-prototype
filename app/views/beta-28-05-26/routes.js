// Beta 28-05-26 – single search, batch search, and combined-search journeys

const BASE = '/beta-28-05-26'

const { normalizePermitReference } = require('../../lib/cites-permit-ref-validation')
const { CDS_MRN_FORMAT_ERROR, normalizeMrn, isValidCdsMrnFormat } = require('../../lib/cds-mrn-validation')
const { consumeSessionValidationErrors } = require('../../lib/consume-session-validation-errors')

module.exports = (router) => {
  const DEBUG_PERMITS = process.env.DEBUG_PERMITS === '1'

  const DEFAULT_PERMIT_REFS = [
    '26GBIMPABS719', '26GBIMPSTYXH1', '26GBIMPSTYHNO'
  ]

  function issueDateFromExpiry (expires) {
    if (!expires || expires === '–') return '–'
    const d = new Date(expires)
    if (isNaN(d.getTime())) return '–'
    d.setMonth(d.getMonth() - 6)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  function buildAndSortPermitList (refs, permitData, options) {
    const preserveOrder = options && options.preserveOrder
    const items = refs.map(ref => {
      const item = permitData[ref] || { species: '–', commonName: '–', description: '–', expires: '–', quantity: '–' }
      const expires = item.expires || '–'
      return { ref, ...item, issueDate: item.issueDate || issueDateFromExpiry(expires) }
    })
    if (!preserveOrder) {
      items.sort((a, b) => {
        if (a.expires === '–') return 1
        if (b.expires === '–') return -1
        const dateDiff = new Date(a.expires) - new Date(b.expires)
        if (dateDiff !== 0) return dateDiff
        const idxA = DEFAULT_PERMIT_REFS.indexOf(a.ref)
        const idxB = DEFAULT_PERMIT_REFS.indexOf(b.ref)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return (a.ref || '').localeCompare(b.ref || '')
      })
    }
    return items
  }

  /** Surface a one-shot MRN validation error after redirect (consumeSessionValidationErrors clears errors on GET). */
  function flushApplyMrnValidationError (data) {
    if (!data || !data.applyMrnValidationError) return
    const msg = data.applyMrnValidationError
    delete data.applyMrnValidationError
    data.errors = { mrnReference: msg }
    data.errorList = [{ text: msg, href: '#mrnReference' }]
  }

  /** Copy customs document ref to each permit draft when user chooses "Apply to all". Per-permit only — avoids session-wide data.mrnReference (e.g. from autoStoreData) pre-filling other permits. */
  function applyMrnReferenceToShipmentPermits (data, permitList, mrnValue) {
    const mrn = normalizeMrn(mrnValue)
    data.endorsedDetails = data.endorsedDetails || {}
    const statuses = data.permitStatuses || {}
    ;(permitList || []).forEach((p) => {
      const ref = p.ref
      if (!ref) return
      if (statuses[ref] === 'refused') return
      const existing = data.endorsedDetails[ref] || {}
      if (existing.refusalReason && !existing.dateOfEndorsement) return
      data.endorsedDetails[ref] = { ...existing, mrnReference: mrn }
    })
    delete data.mrnReference
  }

  /** Single-search permit list: match results table order (search line order, else MVP default list order). */
  function buildSingleSearchPermitList (data) {
    let refs = data.searchedPermits || DEFAULT_PERMIT_REFS
    if (refs.length === 0) refs = DEFAULT_PERMIT_REFS
    const orderRefs = (Array.isArray(data.allFormattedSearchRefs) && data.allFormattedSearchRefs.length > 0)
      ? data.allFormattedSearchRefs
      : null
    const matched = new Set(refs)
    const listRefs = orderRefs ? orderRefs.filter((r) => matched.has(r)) : refs
    const preserveOrder = !!orderRefs
    return buildAndSortPermitList(listRefs, PERMIT_SEARCH_DATA, preserveOrder ? { preserveOrder: true } : undefined)
  }

  function mapRefToSearchResultItem (ref) {
    const item = PERMIT_SEARCH_DATA[ref]
    if (!item) {
      return {
        ref,
        matched: false,
        species: '–',
        commonName: '–',
        quantity: '–',
        expires: '–',
        issueDate: '–'
      }
    }
    const expires = item.expires || '–'
    return {
      ref,
      matched: true,
      ...item,
      issueDate: item.issueDate || issueDateFromExpiry(expires)
    }
  }

  router.get(`${BASE}/single-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    consumeSessionValidationErrors(req)
    if (req.query.empty === '1') {
      delete data.permitReferences
      delete data.errors
      delete data.errorList
      if (res.locals.data) {
        delete res.locals.data.permitReferences
        delete res.locals.data.errors
        delete res.locals.data.errorList
      }
    } else if (req.query.prefill === '1') {
      const prefillValue = DEFAULT_PERMIT_REFS.join('\n')
      data.permitReferences = prefillValue
      delete data.errors
      delete data.errorList
      res.locals.data = res.locals.data || {}
      res.locals.data.permitReferences = prefillValue
      delete res.locals.data.errors
      delete res.locals.data.errorList
    }
    res.render('beta-28-05-26/single-search-results/search-results')
  })

  const PERMIT_SEARCH_DATA = {
    '26GBIMPABS719': {
      species: 'Hirudo verbana',
      commonName: 'Southern medicinal leech',
      description: 'Ten kilograms of live leeches<br>LIV',
      expires: '24 June 2026',
      issueDate: '19 January 2026',
      quantity: '10',
      netMass: '10kg',
      citesAppendix: 'II',
      gbAnnex: 'B',
      source: 'W: Wild',
      purpose: 'T: Commercial trade',
      exporterName: 'Anatolia Medicinal Leeches Export',
      exporterAddressHtml: 'Su Urunleri Mah.<br>Balikci Sokak<br>No: 12 55000<br>Carsamba Samsun<br>Turkey',
      countryOfReexport: 'Turkey',
      importerName: 'Medileech Supplies UK Ltd',
      importerAddressHtml: '14 Riverside Business Park<br>Mill Lane<br>Bristol<br>BS2 0XT<br>United Kingdom',
      countryOfImport: 'United Kingdom',
      originCountry: 'Turkey',
      originIssueDate: '20 March 2026',
      originPermitNumber: 'TR120126/ANK/00079',
      remarksPlaceAndDateOfIssue: 'Bristol, 19 January 2026'
    },
    '26GBIMPSTYXH1': {
      species: 'Hirudo verbana',
      commonName: 'Southern medicinal leech',
      description: 'Ten kilograms of live leeches<br>LIV',
      expires: '24 June 2026',
      issueDate: '19 January 2026',
      quantity: '10',
      netMass: '10kg',
      citesAppendix: 'II',
      gbAnnex: 'B',
      source: 'W: Wild',
      purpose: 'T: Commercial trade',
      exporterName: 'Anatolia Medicinal Leeches Export',
      exporterAddressHtml: 'Su Urunleri Mah.<br>Balikci Sokak<br>No: 12 55000<br>Carsamba Samsun<br>Turkey',
      countryOfReexport: 'Turkey',
      importerName: 'Medileech Supplies UK Ltd',
      importerAddressHtml: '14 Riverside Business Park<br>Mill Lane<br>Bristol<br>BS2 0XT<br>United Kingdom',
      countryOfImport: 'United Kingdom',
      originCountry: 'Turkey',
      originIssueDate: '20 March 2026',
      originPermitNumber: 'TR120126/ANK/00079',
      remarksPlaceAndDateOfIssue: 'Bristol, 19 January 2026'
    },
    '26GBIMPSTYHNO': {
      species: 'Hirudo verbana',
      commonName: 'Southern medicinal leech',
      description: 'Ten kilograms of live leeches<br>LIV',
      expires: '24 June 2026',
      issueDate: '19 January 2026',
      quantity: '10',
      netMass: '10kg',
      citesAppendix: 'II',
      gbAnnex: 'B',
      source: 'W: Wild',
      purpose: 'T: Commercial trade',
      exporterName: 'Anatolia Medicinal Leeches Export',
      exporterAddressHtml: 'Su Urunleri Mah.<br>Balikci Sokak<br>No: 12 55000<br>Carsamba Samsun<br>Turkey',
      countryOfReexport: 'Turkey',
      importerName: 'Medileech Supplies UK Ltd',
      importerAddressHtml: '14 Riverside Business Park<br>Mill Lane<br>Bristol<br>BS2 0XT<br>United Kingdom',
      countryOfImport: 'United Kingdom',
      originCountry: 'Turkey',
      originIssueDate: '20 March 2026',
      originPermitNumber: 'TR120126/ANK/00079',
      remarksPlaceAndDateOfIssue: 'Bristol, 19 January 2026'
    },
    '26GBIMP12344X': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '9 March 2026', quantity: '20', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP7GH45R': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '9 March 2026', quantity: '100', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMPHG453Y': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '10 March 2026', quantity: '80', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP4AB123': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '10 March 2026', quantity: '80', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP5CD456': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '10 March 2026', quantity: '80', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP6EF789': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '11 March 2026', quantity: '20', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP7GH012': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '11 March 2026', quantity: '20', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP8IJ345': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '11 March 2026', quantity: '50', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP9KL678': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '9 March 2026', quantity: '30', citesAppendix: 'II', gbAnnex: 'B' },
    '26GBIMP0MN901': { species: 'Alligator mississippiensis', commonName: 'American alligator', description: 'Watch straps made of alligator skin', expires: '11 March 2026', quantity: '10', citesAppendix: 'II', gbAnnex: 'B' }
  }

  router.post(`${BASE}/single-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    const permitReferences = (req.body.permitReferences || '').trim()

    delete data.errors
    delete data.errorList

    if (!permitReferences) {
      data.errors = { permitReferences: 'Enter at least one permit number' }
      data.errorList = [
        { text: 'Enter at least one permit number', href: '#permitReferences' }
      ]
      return res.redirect(`${BASE}/single-search-results/search-results`)
    }

    const refs = permitReferences
      .split(/[\n,]+/)
      .map((r) => normalizePermitReference(r))
      .filter((r) => r)

    if (refs.length === 0) {
      data.permitReferences = permitReferences
      data.errors = { permitReferences: 'Enter at least one permit number' }
      data.errorList = [
        { text: 'Enter at least one permit number', href: '#permitReferences' }
      ]
      return res.redirect(`${BASE}/single-search-results/search-results`)
    }

    const uniqueRefs = [...new Set(refs)]

    const validRefs = uniqueRefs.filter((r) => !!PERMIT_SEARCH_DATA[r])
    const invalidRefs = [...new Set(uniqueRefs.filter((r) => !PERMIT_SEARCH_DATA[r]))]

    data.permitReferences = uniqueRefs.join('\n')
    data.allFormattedSearchRefs = uniqueRefs
    data.searchedPermits = validRefs
    data.invalidSearchedPermits = invalidRefs
    delete data.errors
    delete data.errorList
    req.session.save((err) => {
      if (err) return res.redirect(`${BASE}/single-search-results/search-results`)
      if (validRefs.length === 1 && invalidRefs.length === 0) {
        res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(validRefs[0])}`)
      } else {
        res.redirect(`${BASE}/single-search-results/permit-search-results`)
      }
    })
  })

  const DEFAULT_PERMIT_STATUSES = {}

  router.get(`${BASE}/single-search-results/permit-search-results`, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    const data = req.session.data || {}
    const invalidRefs = data.invalidSearchedPermits || []
    const hasInvalid = invalidRefs.length > 0
    const orderRefs = (Array.isArray(data.allFormattedSearchRefs) && data.allFormattedSearchRefs.length > 0)
      ? data.allFormattedSearchRefs
      : null

    let items
    if (orderRefs) {
      items = orderRefs.map((ref) => mapRefToSearchResultItem(ref))
    } else {
      let refs = Array.isArray(data.searchedPermits) ? data.searchedPermits : null
      if (refs === null || refs.length === 0) {
        refs = hasInvalid ? [] : DEFAULT_PERMIT_REFS.slice()
      }
      items = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA).map((row) => ({ ...row, matched: true }))
    }

    const permitStatuses = { ...DEFAULT_PERMIT_STATUSES, ...(data.permitStatuses || {}) }
    data.permitStatuses = permitStatuses
    const matchedItems = items.filter((item) => item.matched)
    const notFoundCount = items.filter((item) => !item.matched).length
    data.permitSearchResults = matchedItems
    data.permitSearchNotFoundCount = notFoundCount
    data.permitSearchRows = matchedItems.map((item) => {
      const status = permitStatuses[item.ref]
      let tag = '<strong class="govuk-tag govuk-tag--blue">Valid</strong>'
      if (status === 'endorsed') tag = '<strong class="govuk-tag govuk-tag--green">Endorsed</strong>'
      else if (status === 'refused') tag = '<strong class="govuk-tag govuk-tag--red">Refused</strong>'
      else if (status === 'expired') tag = '<strong class="govuk-tag govuk-tag--red">Expired</strong>'
      const checkHref = `${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(item.ref)}`
      const netMass = (item.netMass || '').toString().trim()
      const quantityOrNetMass = netMass
        ? (/^\d+$/.test(netMass) ? `${netMass}kg` : netMass)
        : (item.quantity || '–')
      return [
        { text: item.ref },
        { text: 'Import' },
        { text: item.species },
        { text: quantityOrNetMass },
        { text: item.expires },
        { html: tag },
        { html: `<a href="${checkHref}" class="govuk-link">Check permit</a>` }
      ]
    })
    res.locals.data.permitSearchResults = data.permitSearchResults
    res.locals.data.permitSearchRows = data.permitSearchRows
    res.locals.data.invalidSearchedPermits = invalidRefs
    res.locals.data.permitSearchNotFoundCount = notFoundCount
    res.render('beta-28-05-26/single-search-results/permit-search-results')
  })

  const STATIC_PERMIT_PAGES = [
    'check-permit-1', 'check-permit-2', 'check-permit-3'
  ]
  STATIC_PERMIT_PAGES.forEach((page) => {
    router.get(`${BASE}/single-search-results/${page}`, (req, res) => {
      res.render(`beta-28-05-26/single-search-results/${page}`)
    })
  })

  router.get(`${BASE}/single-search-results/refuse-permit`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    const permitList = buildSingleSearchPermitList(data)
    const permitRef = (req.query.permit || '').trim() || data.permit || '26GBIMPABS719'
    let currentIndex = permitList.findIndex(p => p.ref === permitRef) + 1
    if (currentIndex < 1) currentIndex = 1
    if (currentIndex > permitList.length) currentIndex = permitList.length
    const currentPermit = permitList[currentIndex - 1] || {}
    data.permit = currentPermit.ref
    data.currentPermit = currentPermit
    res.locals.data.permit = currentPermit.ref
    res.locals.data.currentPermit = currentPermit
    res.render('beta-28-05-26/single-search-results/refuse-permit')
  })

  router.post(`${BASE}/single-search-results/refuse-permit`, (req, res) => {
    const data = req.session.data || {}
    const permitId = (req.body.permit || '').trim() || data.permit || '26GBIMPABS719'
    const refusalReason = (req.body.refusalReason || '').trim()
    const additionalDetails = (req.body.additionalDetails || req.body.additionalDetailsAlt || '').trim().slice(0, 200)

    delete data.errors
    delete data.errorList

    const errors = {}
    const errorList = []

    if (!refusalReason) {
      errors.refusalReason = 'Select a reason for refusing this permit'
      errorList.push({ text: 'Select a reason for refusing this permit', href: '#refusalReason' })
    }

    if (errorList.length > 0) {
      data.errors = errors
      data.errorList = errorList
      data.additionalDetails = req.body.additionalDetails || req.body.additionalDetailsAlt || ''
      return res.redirect(`${BASE}/single-search-results/refuse-permit?permit=${encodeURIComponent(permitId)}`)
    }

    const permitList = buildSingleSearchPermitList(data)
    const currentPermit = permitList.find(p => p.ref === permitId) || {}
    const port = currentPermit.port || 'Dover'
    const officerId = '233215'

    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = now.getDate()
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const dateOfRefusal = `${day} ${month} ${year}, ${hours}:${minutes}`

    data.endorsedDetails = data.endorsedDetails || {}
    data.endorsedDetails[permitId] = {
      refusalReason,
      additionalDetails: additionalDetails || null,
      dateOfRefusal,
      port,
      officerId
    }
    data.permitStatuses = data.permitStatuses || {}
    data.permitStatuses[permitId] = 'refused'
    data.endorsed = false
    data.refused = true
    data.successPermit = permitId
    res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&refused=1`)
  })

  router.get(`${BASE}/single-search-results/check-permit-details`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    flushApplyMrnValidationError(data)
    delete data.mrnReference
    data.endorsementDrafts = data.endorsementDrafts || {}
    data.permitStatuses = { ...DEFAULT_PERMIT_STATUSES, ...(data.permitStatuses || {}) }
    const permitList = buildSingleSearchPermitList(data)
    data.permitSearchResults = permitList
    const totalCount = permitList.length
    const permitRef = (req.query.permit || '').trim()
    let currentIndex = permitList.findIndex(p => p.ref === permitRef) + 1
    if (currentIndex < 1) currentIndex = 1
    if (currentIndex > totalCount) currentIndex = totalCount
    const currentPermit = permitList[currentIndex - 1]
    data.permit = currentPermit.ref
    data.currentPermit = currentPermit
    data.checkPermitIndex = currentIndex
    data.checkPermitTotal = totalCount
    data.checkPermitList = permitList
    res.locals.data.checkPermitList = permitList
    res.locals.data.checkPermitIndex = currentIndex
    res.locals.data.checkPermitTotal = totalCount
    res.locals.data.permit = currentPermit.ref
    res.locals.data.currentPermit = currentPermit
    if (req.query.applyReference === '1' && req.query.mrnReference) {
      if (!isValidCdsMrnFormat(req.query.mrnReference)) {
        data.applyMrnValidationError = CDS_MRN_FORMAT_ERROR
        return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitRef || data.permit)}`)
      }
      applyMrnReferenceToShipmentPermits(data, permitList, req.query.mrnReference)
      return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitRef || data.permit)}`)
    }
    if (req.query.edit === '1') {
      delete data.endorsed
      delete data.refused
      delete data.updated
      delete data.successPermit
      data.editEndorsement = true
      res.locals.data.editEndorsement = true
      if (!data.endorsementDrafts[currentPermit.ref]) {
        const existing = data.endorsedDetails && data.endorsedDetails[currentPermit.ref] ? data.endorsedDetails[currentPermit.ref] : {}
        data.endorsementDrafts[currentPermit.ref] = { ...existing }
      }
    } else {
      data.editEndorsement = false
      res.locals.data.editEndorsement = false
      if (data.endorsementDrafts && data.endorsementDrafts[currentPermit.ref]) {
        delete data.endorsementDrafts[currentPermit.ref]
      }
      if (req.query.endorsed === '1') {
        data.endorsed = true
        data.successPermit = permitRef
        delete data.refused
        delete data.updated
      } else if (req.query.refused === '1') {
        data.refused = true
        data.successPermit = permitRef
        delete data.endorsed
        delete data.updated
      } else if (req.query.updated === '1') {
        data.updated = true
        data.successPermit = permitRef
        res.locals.data.updated = true
        delete data.endorsed
        delete data.refused
      } else {
        delete data.endorsed
        delete data.refused
        delete data.updated
      }
      if (data.successPermit && data.successPermit !== permitRef) {
        delete data.endorsed
        delete data.refused
        delete data.updated
        delete data.successPermit
      }
    }
    // Override in res.locals – autoStoreData populates res.locals.data before our route runs,
    // so we must update locals for the template to see editEndorsement and banner flags
    if (req.query.endorsed !== '1') delete res.locals.data.endorsed
    if (req.query.refused !== '1') delete res.locals.data.refused
    if (req.query.updated === '1') res.locals.data.updated = true
    else delete res.locals.data.updated
    if (res.locals.data.successPermit && res.locals.data.successPermit !== permitRef) {
      delete res.locals.data.endorsed
      delete res.locals.data.refused
      delete res.locals.data.updated
      delete res.locals.data.successPermit
    }
    res.render('beta-28-05-26/single-search-results/check-permit-details')
  })

  router.post(`${BASE}/single-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    const permitId = (req.body.permit || '').trim() || data.permit || '26GBIMPABS719'
    const permitList = buildSingleSearchPermitList(data)
    const totalCount = permitList.length || DEFAULT_PERMIT_REFS.length
    let currentIndex = permitList.findIndex(p => p.ref === permitId) + 1
    if (currentIndex < 1) currentIndex = 1
    const currentPermit = permitList[currentIndex - 1] || {}

    const isLeechPermit = currentPermit.commonName === 'Southern medicinal leech'

    const actualQuantity = (req.body.actualQuantity || '').trim()
    const deadOnArrival = (req.body.deadOnArrival || '').trim()
    const netMassKg = (req.body.netMassKg || '').trim()
    const mrnReference = normalizeMrn(req.body.mrnReference || '')

    const isEndorse = !!req.body.endorse
    const isUpdate = !!req.body.update
    const isUpdateRefusal = !!req.body.updateRefusal

    delete data.errors
    delete data.errorList
    data.permit = permitId
    data.endorsedDetails = data.endorsedDetails || {}
    data.endorsementDrafts = data.endorsementDrafts || {}

    const errors = {}
    const errorList = []

    if (DEBUG_PERMITS) {
      console.info('[beta-28] endorse submit', {
        permitId,
        isLeechPermit,
        isEndorse,
        isUpdate,
        isUpdateRefusal,
        actualQuantity,
        deadOnArrival,
        netMassKg,
        mrnReference
      })
    }

    if (isUpdateRefusal) {
      const refusalReason = (req.body.refusalReason || '').trim()
      const additionalDetails = (req.body.additionalDetailsAmend || req.body.additionalDetailsAmendAlt || '').trim().slice(0, 200)
      if (!refusalReason) {
        errors.refusalReason = 'Select a reason for refusing this permit'
        errorList.push({ text: 'Select a reason for refusing this permit', href: '#refusalReason-error' })
      }
      if (errorList.length > 0) {
        data.errors = errors
        data.errorList = errorList
        return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&edit=1#endorsement-section`)
      }
      const existing = data.endorsedDetails[permitId] || {}
      const port = currentPermit.port || 'Dover'
      const officerId = '233215'
      data.endorsedDetails[permitId] = {
        refusalReason,
        additionalDetails: additionalDetails || null,
        dateOfRefusal: existing.dateOfRefusal,
        port: existing.port || port,
        officerId: existing.officerId || officerId
      }
      delete data.editEndorsement
      return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&updated=1`)
    }

    if (isEndorse || isUpdate) {
      if (!isLeechPermit) {
        if (!actualQuantity) {
          errors.actualQuantity = 'Enter the actual imported quantity'
          errorList.push({ text: 'Enter the actual imported quantity', href: '#actualQuantity' })
        } else if (!/^\d+$/.test(actualQuantity) || parseInt(actualQuantity, 10) < 1) {
          errors.actualQuantity = 'Actual imported quantity must be 1 or more'
          errorList.push({ text: 'Actual imported quantity must be 1 or more', href: '#actualQuantity' })
        }
        if (deadOnArrival === '') {
          errors.deadOnArrival = 'Enter the number of animals dead on arrival'
          errorList.push({ text: 'Enter the number of animals dead on arrival', href: '#deadOnArrival' })
        } else if (!/^\d+$/.test(deadOnArrival) || parseInt(deadOnArrival, 10) < 0) {
          errors.deadOnArrival = 'Number must be 0 or more'
          errorList.push({ text: 'Number must be 0 or more', href: '#deadOnArrival' })
        } else if (deadOnArrival.length > 4) {
          errors.deadOnArrival = 'Enter no more than 4 characters'
          errorList.push({ text: 'Enter no more than 4 characters', href: '#deadOnArrival' })
        }
      }
      if (isLeechPermit && !netMassKg) {
        errors.netMassKg = 'Enter net mass'
        errorList.push({ text: 'Enter net mass', href: '#netMassKg' })
      } else if (netMassKg && (!/^\d+$/.test(netMassKg) || parseInt(netMassKg, 10) < 0)) {
        errors.netMassKg = 'Net mass must be a whole number of 0 or more'
        errorList.push({ text: 'Net mass must be a whole number of 0 or more', href: '#netMassKg' })
      } else if (isLeechPermit && netMassKg) {
        const permitNetMassRaw = (currentPermit.netMass || '').toString()
        const permitNetMassNum = parseInt(permitNetMassRaw.replace(/[^\d]/g, ''), 10)
        const enteredNetMassNum = parseInt(netMassKg, 10)
        if (!isNaN(permitNetMassNum) && enteredNetMassNum > permitNetMassNum) {
          const msg = `Net mass must be the same as or less than ${permitNetMassRaw || (permitNetMassNum + 'kg')}`
          errors.netMassKg = msg
          errorList.push({ text: msg, href: '#netMassKg' })
        }
      }
      if (!mrnReference) {
        errors.mrnReference = 'Enter the customs document reference'
        errorList.push({ text: 'Enter the customs document reference', href: '#mrnReference' })
      } else if (!isValidCdsMrnFormat(mrnReference)) {
        errors.mrnReference = CDS_MRN_FORMAT_ERROR
        errorList.push({ text: CDS_MRN_FORMAT_ERROR, href: '#mrnReference' })
      }
    }

    if (errorList.length > 0) {
      if (DEBUG_PERMITS) {
        console.info('[beta-28] endorse validation errors', { permitId, errors })
      }
      data.endorsementDrafts[permitId] = { actualQuantity: isLeechPermit ? null : actualQuantity, deadOnArrival: isLeechPermit ? null : deadOnArrival, netMassKg, mrnReference }
      data.errors = errors
      data.errorList = errorList
      const redirectUrl = isUpdate
        ? `${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&edit=1#endorsement-section`
        : `${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}#endorsement-section`
      return res.redirect(redirectUrl)
    }

    delete data.errors
    delete data.errorList
    data.permitStatuses = data.permitStatuses || {}

    const port = currentPermit.port || 'Dover'
    const officerId = '233215'

    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = now.getDate()
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const dateOfEndorsement = `${day} ${month} ${year}, ${hours}:${minutes}`

    if (isUpdate) {
      data.endorsedDetails[permitId] = {
        actualQuantity: isLeechPermit ? null : actualQuantity,
        deadOnArrival: isLeechPermit ? null : deadOnArrival,
        netMassKg,
        mrnReference,
        dateOfEndorsement,
        port,
        officerId
      }
      delete data.endorsementDrafts[permitId]
      delete data.editEndorsement
      return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&updated=1`)
    } else if (isEndorse) {
      data.endorsedDetails[permitId] = { actualQuantity: isLeechPermit ? null : actualQuantity, deadOnArrival: isLeechPermit ? null : deadOnArrival, netMassKg, mrnReference, dateOfEndorsement, port, officerId }
      delete data.endorsementDrafts[permitId]
      data.permitStatuses[permitId] = 'endorsed'
      data.endorsed = true
      data.refused = false
      res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&endorsed=1`)
    } else {
      res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}`)
    }
  })

  // Batch permit view – search, select, endorse or refuse multiple permits
  router.get(`${BASE}/batch-search-results/search-results`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    if (req.query.prefill === '1') {
      const prefillValue = DEFAULT_PERMIT_REFS.join('\n')
      data.batchPermitReferences = prefillValue
      res.locals.data = res.locals.data || {}
      res.locals.data.batchPermitReferences = prefillValue
    }
    res.render('beta-28-05-26/batch-search-results/search-results')
  })

  router.post(`${BASE}/batch-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    const permitReferences = (req.body.permitReferences || '').trim()
    delete data.errors
    delete data.errorList
    if (!permitReferences) {
      data.errors = { permitReferences: 'Enter at least one permit number' }
      data.errorList = [{ text: 'Enter at least one permit number', href: '#permitReferences' }]
      return res.redirect(`${BASE}/batch-search-results/search-results`)
    }
    const refs = permitReferences
      .split(/[\n,]+/)
      .map((r) => normalizePermitReference(r))
      .filter((r) => r)
    if (refs.length === 0) {
      data.batchPermitReferences = permitReferences
      data.errors = { permitReferences: 'Enter at least one permit number' }
      data.errorList = [{ text: 'Enter at least one permit number', href: '#permitReferences' }]
      return res.redirect(`${BASE}/batch-search-results/search-results`)
    }
    const uniqueRefs = [...new Set(refs)]
    data.batchPermitReferences = uniqueRefs.join('\n')
    data.batchSearchedPermits = uniqueRefs
    delete data.errors
    delete data.errorList
    req.session.save((err) => {
      if (err) return res.redirect(`${BASE}/batch-search-results/search-results`)
      res.redirect(`${BASE}/batch-search-results/permit-results`)
    })
  })

  router.get(`${BASE}/batch-search-results/permit-results`, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    const data = req.session.data || {}
    res.locals.data.batchSuccess = data.batchSuccess || null
    res.locals.data.batchCount = data.batchCount || 0
    delete data.batchSuccess
    delete data.batchCount
    data.permitStatuses = { ...DEFAULT_PERMIT_STATUSES, ...(data.permitStatuses || {}) }
    if (data.permitStatuses['26GBIMPABS719'] === 'expired') delete data.permitStatuses['26GBIMPABS719']
    let refs = data.batchSearchedPermits || DEFAULT_PERMIT_REFS
    if (refs.length === 0) refs = DEFAULT_PERMIT_REFS
    const noPermitsFound = refs.length > 0 && refs.every(r => !PERMIT_SEARCH_DATA[r])
    res.locals.data.noPermitsFound = noPermitsFound
    const permitList = noPermitsFound ? [] : buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    const selectablePermits = permitList.filter(item => {
      const s = data.permitStatuses[item.ref]
      return s !== 'endorsed' && s !== 'refused'
    })
    const batchTableRows = permitList.map((item) => {
      const status = data.permitStatuses[item.ref]
      let tag = '<strong class="govuk-tag govuk-tag--blue">Valid</strong>'
      if (status === 'endorsed') tag = '<strong class="govuk-tag govuk-tag--green">Endorsed</strong>'
      else if (status === 'refused') tag = '<strong class="govuk-tag govuk-tag--red">Refused</strong>'
      else if (status === 'expired') tag = '<strong class="govuk-tag govuk-tag--red">Expired</strong>'
      const viewHref = `${BASE}/batch-search-results/check-permit-details?permit=${encodeURIComponent(item.ref)}`
      const isSelectable = status !== 'endorsed' && status !== 'refused'
      const checkbox = isSelectable
        ? `<span class="batch-permit-checkbox"><input type="checkbox" id="sel-${item.ref}" name="selectedPermits" value="${item.ref}" aria-label="Select permit ${item.ref}" class="batch-permit-checkbox__input"></span>`
        : ''
      const speciesCell = item.commonName && item.commonName !== '–'
        ? `${item.species}<br>(${item.commonName})`
        : item.species || '–'
      const netMass = (item.netMass || '').toString().trim()
      const quantityOrNetMass = netMass
        ? (/^\d+$/.test(netMass) ? `${netMass}kg` : netMass)
        : (item.quantity || '–')
      return [
        { html: checkbox },
        { text: item.ref },
        { html: speciesCell },
        { text: quantityOrNetMass },
        { text: item.expires },
        { html: tag },
        { html: `<a href="${viewHref}">View</a>` }
      ]
    })
    res.locals.data.permitList = permitList
    res.locals.data.selectablePermits = selectablePermits
    res.locals.data.batchTableRows = batchTableRows
    res.render('beta-28-05-26/batch-search-results/permit-results')
  })

  // Batch single-permit view (View link from batch results – stays in batch folder)
  const BATCH_CHECK_BASE = `${BASE}/batch-search-results`

  router.get(`${BASE}/batch-search-results/refuse-permit`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    let refs = data.batchSearchedPermits || DEFAULT_PERMIT_REFS
    if (refs.length === 0) refs = DEFAULT_PERMIT_REFS
    const permitList = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    const permitRef = (req.query.permit || '').trim() || data.permit || '26GBIMPABS719'
    let currentIndex = permitList.findIndex(p => p.ref === permitRef) + 1
    if (currentIndex < 1) currentIndex = 1
    if (currentIndex > permitList.length) currentIndex = permitList.length
    const currentPermit = permitList[currentIndex - 1] || {}
    data.permit = currentPermit.ref
    data.currentPermit = currentPermit
    res.locals.data.permit = currentPermit.ref
    res.locals.data.currentPermit = currentPermit
    res.render('beta-28-05-26/batch-search-results/refuse-permit')
  })

  router.post(`${BASE}/batch-search-results/refuse-permit`, (req, res) => {
    const data = req.session.data || {}
    const permitId = (req.body.permit || '').trim() || data.permit || '26GBIMPABS719'
    const refusalReason = (req.body.refusalReason || '').trim()
    const additionalDetails = (req.body.additionalDetails || req.body.additionalDetailsAlt || '').trim().slice(0, 200)

    delete data.errors
    delete data.errorList

    const errors = {}
    const errorList = []

    if (!refusalReason) {
      errors.refusalReason = 'Select a reason for refusing this permit'
      errorList.push({ text: 'Select a reason for refusing this permit', href: '#refusalReason' })
    }

    if (errorList.length > 0) {
      data.errors = errors
      data.errorList = errorList
      data.additionalDetails = req.body.additionalDetails || req.body.additionalDetailsAlt || ''
      return res.redirect(`${BATCH_CHECK_BASE}/refuse-permit?permit=${encodeURIComponent(permitId)}`)
    }

    const permitList = buildAndSortPermitList(data.batchSearchedPermits || DEFAULT_PERMIT_REFS, PERMIT_SEARCH_DATA)
    const currentPermit = permitList.find(p => p.ref === permitId) || {}
    const port = currentPermit.port || 'Dover'
    const officerId = '233215'

    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = now.getDate()
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const dateOfRefusal = `${day} ${month} ${year}, ${hours}:${minutes}`

    data.endorsedDetails = data.endorsedDetails || {}
    data.endorsedDetails[permitId] = {
      refusalReason,
      additionalDetails: additionalDetails || null,
      dateOfRefusal,
      port,
      officerId
    }
    data.permitStatuses = data.permitStatuses || {}
    data.permitStatuses[permitId] = 'refused'
    data.endorsed = false
    data.refused = true
    data.successPermit = permitId
    res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&refused=1`)
  })

  router.get(`${BASE}/batch-search-results/check-permit-details`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    flushApplyMrnValidationError(data)
    delete data.mrnReference
    data.endorsementDrafts = data.endorsementDrafts || {}
    data.permitStatuses = { ...DEFAULT_PERMIT_STATUSES, ...(data.permitStatuses || {}) }
    let refs = data.batchSearchedPermits || DEFAULT_PERMIT_REFS
    if (refs.length === 0) refs = DEFAULT_PERMIT_REFS
    const permitList = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    data.permitSearchResults = permitList
    const totalCount = permitList.length
    const permitRef = (req.query.permit || '').trim()
    let currentIndex = permitList.findIndex(p => p.ref === permitRef) + 1
    if (currentIndex < 1) currentIndex = 1
    if (currentIndex > totalCount) currentIndex = totalCount
    const currentPermit = permitList[currentIndex - 1]
    data.permit = currentPermit.ref
    data.currentPermit = currentPermit
    data.checkPermitIndex = currentIndex
    data.checkPermitTotal = totalCount
    data.checkPermitList = permitList
    res.locals.data.checkPermitList = permitList
    res.locals.data.checkPermitIndex = currentIndex
    res.locals.data.checkPermitTotal = totalCount
    res.locals.data.permit = currentPermit.ref
    res.locals.data.currentPermit = currentPermit
    if (req.query.applyReference === '1' && req.query.mrnReference) {
      if (!isValidCdsMrnFormat(req.query.mrnReference)) {
        data.applyMrnValidationError = CDS_MRN_FORMAT_ERROR
        return res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitRef || data.permit)}`)
      }
      applyMrnReferenceToShipmentPermits(data, permitList, req.query.mrnReference)
      return res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitRef || data.permit)}`)
    }
    if (req.query.edit === '1') {
      delete data.endorsed
      delete data.refused
      delete data.updated
      delete data.successPermit
      data.editEndorsement = true
      res.locals.data.editEndorsement = true
      if (!data.endorsementDrafts[currentPermit.ref]) {
        const existing = data.endorsedDetails && data.endorsedDetails[currentPermit.ref] ? data.endorsedDetails[currentPermit.ref] : {}
        data.endorsementDrafts[currentPermit.ref] = { ...existing }
      }
    } else {
      data.editEndorsement = false
      res.locals.data.editEndorsement = false
      if (data.endorsementDrafts && data.endorsementDrafts[currentPermit.ref]) {
        delete data.endorsementDrafts[currentPermit.ref]
      }
      if (req.query.endorsed === '1') {
        data.endorsed = true
        data.successPermit = permitRef
        delete data.refused
        delete data.updated
      } else if (req.query.refused === '1') {
        data.refused = true
        data.successPermit = permitRef
        delete data.endorsed
        delete data.updated
      } else if (req.query.updated === '1') {
        data.updated = true
        data.successPermit = permitRef
        res.locals.data.updated = true
        delete data.endorsed
        delete data.refused
      } else {
        delete data.endorsed
        delete data.refused
        delete data.updated
      }
      if (data.successPermit && data.successPermit !== permitRef) {
        delete data.endorsed
        delete data.refused
        delete data.updated
        delete data.successPermit
      }
    }
    if (req.query.endorsed !== '1') delete res.locals.data.endorsed
    if (req.query.refused !== '1') delete res.locals.data.refused
    if (req.query.updated === '1') res.locals.data.updated = true
    else delete res.locals.data.updated
    if (res.locals.data.successPermit && res.locals.data.successPermit !== permitRef) {
      delete res.locals.data.endorsed
      delete res.locals.data.refused
      delete res.locals.data.updated
      delete res.locals.data.successPermit
    }
    res.render('beta-28-05-26/batch-search-results/check-permit-details')
  })

  router.post(`${BASE}/batch-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    const permitId = (req.body.permit || '').trim() || data.permit || '26GBIMPABS719'
    let refs = data.batchSearchedPermits || DEFAULT_PERMIT_REFS
    if (refs.length === 0) refs = DEFAULT_PERMIT_REFS
    const permitList = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    const totalCount = permitList.length || DEFAULT_PERMIT_REFS.length
    let currentIndex = permitList.findIndex(p => p.ref === permitId) + 1
    if (currentIndex < 1) currentIndex = 1
    const currentPermit = permitList[currentIndex - 1] || {}

    const actualQuantity = (req.body.actualQuantity || '').trim()
    const mrnReference = normalizeMrn(req.body.mrnReference || '')
    const billOfLadingReference = (req.body.billOfLadingReference || '').trim()

    const isEndorse = !!req.body.endorse
    const isUpdate = !!req.body.update
    const isUpdateRefusal = !!req.body.updateRefusal

    delete data.errors
    delete data.errorList
    data.permit = permitId
    data.endorsedDetails = data.endorsedDetails || {}
    data.endorsementDrafts = data.endorsementDrafts || {}

    const errors = {}
    const errorList = []

    if (isUpdateRefusal) {
      const refusalReason = (req.body.refusalReason || '').trim()
      const additionalDetails = (req.body.additionalDetailsAmend || req.body.additionalDetailsAmendAlt || '').trim().slice(0, 200)
      if (!refusalReason) {
        errors.refusalReason = 'Select a reason for refusing this permit'
        errorList.push({ text: 'Select a reason for refusing this permit', href: '#refusalReason-error' })
      }
      if (errorList.length > 0) {
        data.errors = errors
        data.errorList = errorList
        return res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&edit=1#endorsement-section`)
      }
      const existing = data.endorsedDetails[permitId] || {}
      const port = currentPermit.port || 'Dover'
      const officerId = '233215'
      data.endorsedDetails[permitId] = {
        refusalReason,
        additionalDetails: additionalDetails || null,
        dateOfRefusal: existing.dateOfRefusal,
        port: existing.port || port,
        officerId: existing.officerId || officerId
      }
      delete data.editEndorsement
      return res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&updated=1`)
    }

    if (isEndorse || isUpdate) {
      if (!actualQuantity) {
        errors.actualQuantity = 'Enter the quantity'
        errorList.push({ text: 'Enter the quantity', href: '#actualQuantity' })
      } else if (!/^\d+$/.test(actualQuantity) || parseInt(actualQuantity, 10) < 1) {
        errors.actualQuantity = 'Quantity must be a whole number of 1 or more'
        errorList.push({ text: 'Quantity must be a whole number of 1 or more', href: '#actualQuantity' })
      }
      if (!mrnReference) {
        errors.mrnReference = 'Enter the customs document reference'
        errorList.push({ text: 'Enter the customs document reference', href: '#mrnReference' })
      } else if (!isValidCdsMrnFormat(mrnReference)) {
        errors.mrnReference = CDS_MRN_FORMAT_ERROR
        errorList.push({ text: CDS_MRN_FORMAT_ERROR, href: '#mrnReference' })
      }
    }

    if (errorList.length > 0) {
      data.endorsementDrafts[permitId] = { actualQuantity, mrnReference, billOfLadingReference }
      data.errors = errors
      data.errorList = errorList
      const redirectUrl = isUpdate
        ? `${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&edit=1#endorsement-section`
        : `${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}#endorsement-section`
      return res.redirect(redirectUrl)
    }

    delete data.errors
    delete data.errorList
    data.permitStatuses = data.permitStatuses || {}

    const port = currentPermit.port || 'Dover'
    const officerId = '233215'

    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = now.getDate()
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const dateOfEndorsement = `${day} ${month} ${year}, ${hours}:${minutes}`

    if (isUpdate) {
      data.endorsedDetails[permitId] = {
        actualQuantity,
        mrnReference,
        billOfLadingReference,
        dateOfEndorsement,
        port,
        officerId
      }
      delete data.endorsementDrafts[permitId]
      delete data.editEndorsement
      return res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&updated=1`)
    } else if (isEndorse) {
      data.endorsedDetails[permitId] = { actualQuantity, mrnReference, billOfLadingReference, dateOfEndorsement, port, officerId }
      delete data.endorsementDrafts[permitId]
      data.permitStatuses[permitId] = 'endorsed'
      data.endorsed = true
      data.refused = false
      res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}&endorsed=1`)
    } else {
      res.redirect(`${BATCH_CHECK_BASE}/check-permit-details?permit=${encodeURIComponent(permitId)}`)
    }
  })

  router.post(`${BASE}/batch-search-results/select-action`, (req, res) => {
    const data = req.session.data || {}
    const selected = req.body.selectedPermits
    let refs = Array.isArray(selected) ? selected : (selected ? [selected] : [])
    refs = refs.filter((r) => r && r !== '_unchecked' && String(r).trim() !== '')
    const action = (req.body.action || '').toLowerCase()
    delete data.errors
    delete data.errorList
    if (refs.length === 0) {
      data.errors = { selectedPermits: 'Select at least one permit' }
      data.errorList = [{ text: 'Select at least one permit', href: '#batch-form' }]
      return res.redirect(`${BASE}/batch-search-results/permit-results`)
    }
    data.batchSelectedPermits = refs
    if (action === 'refuse') {
      return res.redirect(`${BASE}/batch-search-results/batch-refuse`)
    }
    res.redirect(`${BASE}/batch-search-results/batch-endorse`)
  })

  router.get(`${BASE}/batch-search-results/batch-endorse`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    let refs = data.batchSelectedPermits || []
    refs = refs.filter((r) => r && r !== '_unchecked' && String(r).trim() !== '')
    if (refs.length === 0) return res.redirect(`${BASE}/batch-search-results/permit-results`)
    data.batchSelectedPermits = refs
    const permitList = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    res.locals.data.batchSelectedPermits = refs
    res.locals.data.batchSelectedList = permitList
    res.render('beta-28-05-26/batch-search-results/batch-endorse')
  })

  router.post(`${BASE}/batch-search-results/batch-endorse`, (req, res) => {
    const data = req.session.data || {}
    const refs = data.batchSelectedPermits || []
    const actualQuantities = req.body.actualQuantity || {}
    const mrnReference = normalizeMrn(req.body.mrnReference || '')
    delete data.errors
    delete data.errorList
    const errors = {}
    const errorList = []

    if (!mrnReference) {
      errors.mrnReference = 'Enter the customs document reference'
      errorList.push({ text: 'Enter the customs document reference', href: '#mrnReference' })
    } else if (!isValidCdsMrnFormat(mrnReference)) {
      errors.mrnReference = CDS_MRN_FORMAT_ERROR
      errorList.push({ text: CDS_MRN_FORMAT_ERROR, href: '#mrnReference' })
    }

    refs.forEach((permitId) => {
      const qty = (actualQuantities[permitId] || '').trim()
      if (!qty) {
        errors.quantity = errors.quantity || {}
        errors.quantity[permitId] = 'Enter the actual quantity'
        errorList.push({ text: `Enter the actual quantity for ${permitId}`, href: `#actualQuantity-${permitId}` })
      } else if (!/^\d+$/.test(qty) || parseInt(qty, 10) < 1) {
        errors.quantity = errors.quantity || {}
        errors.quantity[permitId] = 'Quantity must be a whole number of 1 or more'
        errorList.push({ text: `Quantity for ${permitId} must be 1 or more`, href: `#actualQuantity-${permitId}` })
      }
    })

    if (errorList.length > 0) {
      data.errors = errors
      data.errorList = errorList
      data.batchMrnReference = mrnReference
      data.batchBillOfLadingReference = (req.body.billOfLadingReference || '').trim()
      data.batchEndorsedDetails = {}
      refs.forEach((permitId) => {
        data.batchEndorsedDetails[permitId] = { actualQuantity: (actualQuantities[permitId] || '').trim() }
      })
      return res.redirect(`${BASE}/batch-search-results/batch-endorse`)
    }

    const port = 'Dover'
    const officerId = '233215'
    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const dateOfEndorsement = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    data.endorsedDetails = data.endorsedDetails || {}
    data.permitStatuses = data.permitStatuses || {}
    refs.forEach((permitId) => {
      const qty = (actualQuantities[permitId] || '').trim()
      data.endorsedDetails[permitId] = { actualQuantity: qty, mrnReference, dateOfEndorsement, port, officerId }
      data.permitStatuses[permitId] = 'endorsed'
    })
    delete data.batchSelectedPermits
    delete data.batchEndorsedDetails
    delete data.batchMrnReference
    delete data.batchBillOfLadingReference
    data.batchSuccess = 'endorsed'
    data.batchCount = refs.length
    res.redirect(`${BASE}/batch-search-results/permit-results`)
  })

  router.get(`${BASE}/batch-search-results/batch-refuse`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    let refs = data.batchSelectedPermits || []
    refs = refs.filter((r) => r && r !== '_unchecked' && String(r).trim() !== '')
    if (refs.length === 0) return res.redirect(`${BASE}/batch-search-results/permit-results`)
    data.batchSelectedPermits = refs
    const permitList = buildAndSortPermitList(refs, PERMIT_SEARCH_DATA)
    res.locals.data.batchSelectedPermits = refs
    res.locals.data.batchSelectedList = permitList
    res.render('beta-28-05-26/batch-search-results/batch-refuse')
  })

  router.post(`${BASE}/batch-search-results/batch-refuse`, (req, res) => {
    const data = req.session.data || {}
    const refs = data.batchSelectedPermits || []
    const refusalReason = (req.body.refusalReason || '').trim()
    const additionalDetails = (req.body.additionalDetails || req.body.additionalDetailsAlt || '').trim().slice(0, 200)
    delete data.errors
    delete data.errorList
    if (!refusalReason) {
      data.errors = { refusalReason: 'Select a reason for refusing these permits' }
      data.errorList = [{ text: 'Select a reason for refusing these permits', href: '#refusalReason' }]
      return res.redirect(`${BASE}/batch-search-results/batch-refuse`)
    }
    const port = 'Dover'
    const officerId = '233215'
    const now = new Date()
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const dateOfRefusal = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    data.endorsedDetails = data.endorsedDetails || {}
    data.permitStatuses = data.permitStatuses || {}
    refs.forEach((permitId) => {
      data.endorsedDetails[permitId] = { refusalReason, additionalDetails: additionalDetails || null, dateOfRefusal, port, officerId }
      data.permitStatuses[permitId] = 'refused'
    })
    delete data.batchSelectedPermits
    data.batchSuccess = 'refused'
    data.batchCount = refs.length
    res.redirect(`${BASE}/batch-search-results/permit-results`)
  })

  // Combined search – add/remove permit inputs (form posts to itself)
  router.get(`${BASE}/combined-search-results/search-results`, (req, res) => {
    consumeSessionValidationErrors(req)
    res.render('beta-28-05-26/combined-search-results/search-results')
  })

  router.post(`${BASE}/combined-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    const refs = []
    let i = 0
    while (req.body[`permit-${i}`] !== undefined) {
      const v = normalizePermitReference(req.body[`permit-${i}`] || '')
      if (v) refs.push(v)
      i++
    }

    delete data.errors
    delete data.errorList

    if (refs.length === 0) {
      data.errors = { permitReferences: 'Enter at least one permit number' }
      data.errorList = [
        { text: 'Enter at least one permit number', href: '#permit-0' }
      ]
      return res.redirect(`${BASE}/combined-search-results/search-results`)
    }

    data.combinedPermitReferences = refs
    delete data.errors
    delete data.errorList
    req.session.save((err) => {
      if (err) return res.redirect(`${BASE}/combined-search-results/search-results`)
      res.redirect(`${BASE}/combined-search-results/check-permit-details`)
    })
  })

  router.get(`${BASE}/combined-search-results/check-permit-details`, (req, res) => {
    consumeSessionValidationErrors(req)
    const data = req.session.data || {}
    flushApplyMrnValidationError(data)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.render('beta-28-05-26/combined-search-results/check-permit-details')
  })

  router.get(`${BASE}/combined-search-results/endorsement-confirmation`, (req, res) => {
    res.render('beta-28-05-26/combined-search-results/endorsement-confirmation')
  })

  router.get(`${BASE}/combined-search-results/refusal-confirmation`, (req, res) => {
    res.render('beta-28-05-26/combined-search-results/refusal-confirmation')
  })

  router.post(`${BASE}/combined-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    const isRefuse = !!req.body.refuse

    if (isRefuse) {
      data.combinedPermitCount = 2
      return res.redirect(`${BASE}/combined-search-results/refusal-confirmation`)
    }

    const mrnReference = normalizeMrn(req.body.mrnReference || '')
    const awbReference = (req.body.awbReference || '').trim()

    const errors = {}
    const errorList = []

    if (!mrnReference) {
      errors.mrnReference = 'Enter the CDS MRN reference'
      errorList.push({ text: 'Enter the CDS MRN reference', href: '#mrnReference' })
    } else if (!isValidCdsMrnFormat(mrnReference)) {
      errors.mrnReference = CDS_MRN_FORMAT_ERROR
      errorList.push({ text: CDS_MRN_FORMAT_ERROR, href: '#mrnReference' })
    }
    if (!awbReference) {
      errors.awbReference = 'Enter the Bill of Lading or Air waybill (AWB) reference'
      errorList.push({ text: 'Enter the Bill of Lading or Air waybill (AWB) reference', href: '#awbReference' })
    }

    for (let i = 0; i < 2; i++) {
      const deadOnArrival = (req.body[`deadOnArrival-${i}`] || '').trim()
      const actualQuantity = (req.body[`actualQuantity-${i}`] || '').trim()

      if (!deadOnArrival) {
        errors[`deadOnArrival-${i}`] = 'Enter the number of animals dead on arrival'
        errorList.push({ text: `Permit ${i + 1}: Enter the number of animals dead on arrival`, href: `#deadOnArrival-${i}` })
      } else if (!/^\d+$/.test(deadOnArrival) || parseInt(deadOnArrival, 10) < 0) {
        errors[`deadOnArrival-${i}`] = 'Number must be 0 or more'
        errorList.push({ text: `Permit ${i + 1}: Number must be 0 or more`, href: `#deadOnArrival-${i}` })
      } else if (deadOnArrival.length > 4) {
        errors[`deadOnArrival-${i}`] = 'Enter no more than 4 characters'
        errorList.push({ text: `Permit ${i + 1}: Enter no more than 4 characters`, href: `#deadOnArrival-${i}` })
      }

      if (!actualQuantity) {
        errors[`actualQuantity-${i}`] = 'Enter the actual quantity'
        errorList.push({ text: `Permit ${i + 1}: Enter the actual quantity`, href: `#actualQuantity-${i}` })
      } else if (!/^\d+$/.test(actualQuantity) || parseInt(actualQuantity, 10) < 1) {
        errors[`actualQuantity-${i}`] = 'Actual quantity must be a whole number of 1 or more'
        errorList.push({ text: `Permit ${i + 1}: Actual quantity must be a whole number of 1 or more`, href: `#actualQuantity-${i}` })
      }
    }

    data.combinedMrnReference = mrnReference
    data.combinedAwbReference = awbReference
    data.combinedDeadOnArrival = {
      0: (req.body['deadOnArrival-0'] || '').trim(),
      1: (req.body['deadOnArrival-1'] || '').trim()
    }
    data.combinedActualQuantity = {
      0: (req.body['actualQuantity-0'] || '').trim(),
      1: (req.body['actualQuantity-1'] || '').trim()
    }

    if (errorList.length > 0) {
      data.errors = errors
      data.errorList = errorList
      return res.redirect(`${BASE}/combined-search-results/check-permit-details`)
    }

    delete data.errors
    delete data.errorList
    data.combinedPermitCount = 2
    res.redirect(`${BASE}/combined-search-results/endorsement-confirmation`)
  })

}
