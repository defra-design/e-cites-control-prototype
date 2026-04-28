/**
 * CDS / EU-style Movement Reference Number (MRN): 18 characters after normalisation —
 * 2-digit year, 2-letter country / customs office code, 14 alphanumeric characters.
 */
const CDS_MRN_REGEX = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/

const CDS_MRN_FORMAT_ERROR =
  'Enter the Customs document reference in the correct format.'

function normalizeMrn (value) {
  return (value || '').trim().replace(/[\s-]/g, '').toUpperCase()
}

function isValidCdsMrnFormat (value) {
  return CDS_MRN_REGEX.test(normalizeMrn(value))
}

module.exports = {
  CDS_MRN_FORMAT_ERROR,
  normalizeMrn,
  isValidCdsMrnFormat
}
