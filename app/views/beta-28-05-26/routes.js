// Beta 28-05-26 – interaction scaffold
//
// This iteration currently reuses the Beta 16-04-26 route logic. We still copy the
// view folder to `app/views/beta-28-05-26/` so you can start making changes without
// touching the previous iteration.

const BASE = '/beta-28-05-26'
const TARGET_BASE = '/beta-16-04-26'

module.exports = (router) => {
  // Redirect all Beta 28 routes to the Beta 16 implementation (keeping querystring).
  router.all(`${BASE}`, (req, res) => {
    const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''
    return res.redirect(302, TARGET_BASE + q)
  })

  router.all(`${BASE}/*`, (req, res) => {
    const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''
    const rest = req.path.slice(BASE.length)
    return res.redirect(302, TARGET_BASE + rest + q)
  })
}
