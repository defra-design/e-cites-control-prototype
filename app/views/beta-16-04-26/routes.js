// Beta 16-04-26 – single-search-results and combined-search-results journeys

const BASE = '/beta-16-04-26'

module.exports = (router) => {
  // Single search results – search-results (form posts to itself)
  router.get(`${BASE}/single-search-results/search-results`, (req, res) => {
    res.render('beta-16-04-26/single-search-results/search-results')
  })

  const PERMIT_SEARCH_DATA = {
    '26GBIMP12344X': { species: 'Falco peregrinus', expires: '28 February 2026' },
    '26GBIMP7GH45R': { species: 'Milvus milvus', expires: '28 February 2026' },
    '26GBIMPHG453Y': { species: 'Aquila chrysaetos', expires: '22 February 2026' }
  }

  router.post(`${BASE}/single-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    const permitReferences = (req.body.permitReferences || '').trim()

    delete data.errors
    delete data.errorList

    if (!permitReferences) {
      data.errors = { permitReferences: 'Enter at least one permit reference' }
      data.errorList = [
        { text: 'Enter at least one permit reference', href: '#permitReferences' }
      ]
      return res.redirect(`${BASE}/single-search-results/search-results`)
    }

    const refs = permitReferences
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(r => r)

    data.permitReferences = permitReferences
    data.searchedPermits = refs
    delete data.errors
    delete data.errorList
    req.session.save((err) => {
      if (err) return res.redirect(`${BASE}/single-search-results/search-results`)
      res.redirect(`${BASE}/single-search-results/permit-search-results`)
    })
  })

  router.get(`${BASE}/single-search-results/permit-search-results`, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    const data = req.session.data || {}
    let refs = data.searchedPermits || ['26GBIMP12344X', '26GBIMP7GH45R', '26GBIMPHG453Y']
    if (refs.length === 0) refs = ['26GBIMP12344X', '26GBIMP7GH45R', '26GBIMPHG453Y']
    const permitStatuses = data.permitStatuses || {}
    const items = refs.map(ref => {
      const item = PERMIT_SEARCH_DATA[ref] || { species: '–', expires: '–' }
      return { ref, ...item }
    })
    data.permitSearchResults = items
    data.permitSearchRows = items.map(item => {
      const status = permitStatuses[item.ref]
      let tag = '<strong class="govuk-tag govuk-tag--green">Valid</strong>'
      if (status === 'endorsed') tag = '<strong class="govuk-tag govuk-tag--green">Endorsed</strong>'
      else if (status === 'refused') tag = '<strong class="govuk-tag govuk-tag--red">Refused</strong>'
      else if (item.ref === '26GBIMPHG453Y') tag = '<strong class="govuk-tag govuk-tag--blue">Expired</strong>'
      return [
        { text: item.ref },
        { text: item.species },
        { text: item.expires },
        { html: tag },
        { html: `<a href="${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(item.ref)}">Check permit</a>` }
      ]
    })
    res.locals.data.permitSearchResults = data.permitSearchResults
    res.locals.data.permitSearchRows = data.permitSearchRows
    res.render('beta-16-04-26/single-search-results/permit-search-results')
  })

  router.get(`${BASE}/single-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    data.permit = req.query.permit || data.permit
    if (req.query.edit === '1') {
      data.endorsed = false
      data.refused = false
    } else {
      data.endorsed = req.query.endorsed === '1' || data.endorsed
      data.refused = req.query.refused === '1' || data.refused
    }
    res.render('beta-16-04-26/single-search-results/check-permit-details')
  })

  router.post(`${BASE}/single-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    data.permit = req.body.permit || req.query.permit || data.permit

    const actualQuantity = (req.body.actualQuantity || '').trim()
    const deadOnArrival = (req.body.deadOnArrival || '').trim()
    const mrnReference = (req.body.mrnReference || '').trim()
    const awbReference = (req.body.awbReference || '').trim()

    const isEndorse = !!req.body.endorse
    const isRefuse = !!req.body.refuse

    delete data.errors
    delete data.errorList
    data.actualQuantity = actualQuantity
    data.deadOnArrival = deadOnArrival
    data.mrnReference = mrnReference
    data.awbReference = awbReference

    const errors = {}
    const errorList = []

    if (isEndorse) {
      if (!actualQuantity) {
        errors.actualQuantity = 'Enter the actual quantity'
        errorList.push({ text: 'Enter the actual quantity', href: '#actualQuantity' })
      } else if (!/^\d+$/.test(actualQuantity) || parseInt(actualQuantity, 10) < 1) {
        errors.actualQuantity = 'Actual quantity must be a whole number of 1 or more'
        errorList.push({ text: 'Actual quantity must be a whole number of 1 or more', href: '#actualQuantity' })
      }

      if (!deadOnArrival) {
        errors.deadOnArrival = 'Enter the number of animals dead on arrival'
        errorList.push({ text: 'Enter the number of animals dead on arrival', href: '#deadOnArrival' })
      } else if (!/^\d+$/.test(deadOnArrival) || parseInt(deadOnArrival, 10) < 0) {
        errors.deadOnArrival = 'Number must be 0 or more'
        errorList.push({ text: 'Number must be 0 or more', href: '#deadOnArrival' })
      }

      if (!mrnReference) {
        errors.mrnReference = 'Enter the CDS MRN reference'
        errorList.push({ text: 'Enter the CDS MRN reference', href: '#mrnReference' })
      }

      if (!awbReference) {
        errors.awbReference = 'Enter the Bill of Lading or Air waybill (AWB) reference'
        errorList.push({ text: 'Enter the Bill of Lading or Air waybill (AWB) reference', href: '#awbReference' })
      }
    }

    if (errorList.length > 0) {
      data.errors = errors
      data.errorList = errorList
      return res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(data.permit || '')}`)
    }

    delete data.errors
    delete data.errorList
    const permitId = data.permit || '26GBIMP12344X'
    data.permitStatuses = data.permitStatuses || {}
    if (isEndorse) {
      data.endorsed = true
      data.refused = false
      data.permitStatuses[permitId] = 'endorsed'
      res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&endorsed=1`)
    } else {
      data.refused = true
      data.endorsed = false
      data.permitStatuses[permitId] = 'refused'
      res.redirect(`${BASE}/single-search-results/check-permit-details?permit=${encodeURIComponent(permitId)}&refused=1`)
    }
  })

  // Combined search – add/remove permit inputs (form posts to itself)
  router.get(`${BASE}/combined-search-results/search-results`, (req, res) => {
    res.render('beta-16-04-26/combined-search-results/search-results')
  })

  router.post(`${BASE}/combined-search-results/search-results`, (req, res) => {
    const data = req.session.data || {}
    const refs = []
    let i = 0
    while (req.body[`permit-${i}`] !== undefined) {
      const v = (req.body[`permit-${i}`] || '').trim()
      if (v) refs.push(v)
      i++
    }

    delete data.errors
    delete data.errorList

    if (refs.length === 0) {
      data.errors = { permitReferences: 'Enter at least one permit reference' }
      data.errorList = [
        { text: 'Enter at least one permit reference', href: '#permit-0' }
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.render('beta-16-04-26/combined-search-results/check-permit-details')
  })

  router.get(`${BASE}/combined-search-results/endorsement-confirmation`, (req, res) => {
    res.render('beta-16-04-26/combined-search-results/endorsement-confirmation')
  })

  router.get(`${BASE}/combined-search-results/refusal-confirmation`, (req, res) => {
    res.render('beta-16-04-26/combined-search-results/refusal-confirmation')
  })

  router.post(`${BASE}/combined-search-results/check-permit-details`, (req, res) => {
    const data = req.session.data || {}
    const isRefuse = !!req.body.refuse

    if (isRefuse) {
      data.combinedPermitCount = 2
      return res.redirect(`${BASE}/combined-search-results/refusal-confirmation`)
    }

    const mrnReference = (req.body.mrnReference || '').trim()
    const awbReference = (req.body.awbReference || '').trim()

    const errors = {}
    const errorList = []

    if (!mrnReference) {
      errors.mrnReference = 'Enter the CDS MRN reference'
      errorList.push({ text: 'Enter the CDS MRN reference', href: '#mrnReference' })
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
