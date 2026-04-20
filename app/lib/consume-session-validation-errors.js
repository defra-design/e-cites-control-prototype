function consumeSessionValidationErrors (req) {
  const data = req.session.data
  if (!data) return
  delete data.errors
  delete data.errorList
}

module.exports = { consumeSessionValidationErrors }
