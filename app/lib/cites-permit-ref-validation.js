const CITES_PERMIT_REF_REGEX = /^\d{2}GB[A-Z]{3}[A-Z0-9]{6}$/

const CITES_PERMIT_FORMAT_ERROR =
  'Enter permit references in the correct format'

function normalizePermitReference (ref) {
  return (ref || '').replace(/\./g, '').trim().toUpperCase()
}

function isValidCitesPermitReferenceFormat (ref) {
  return CITES_PERMIT_REF_REGEX.test(normalizePermitReference(ref))
}

module.exports = {
  CITES_PERMIT_FORMAT_ERROR,
  normalizePermitReference,
  isValidCitesPermitReferenceFormat
}
