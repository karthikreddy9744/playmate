describe('Admin access checks', () => {
  it('non-admin cannot access admin endpoints', () => {
    const fbUid = 'cypress-nonadmin-001'
    cy.request('POST', '/api/auth/firebase-sync', { firebaseUid: fbUid, email: 'nonadmin+cy@example.com', name: 'NonAdmin' })
      .then((resp) => {
        const token = resp.body.token
        cy.request({ method: 'GET', url: '/api/admin/users', headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false }).then((r) => {
          expect([401, 403]).to.include(r.status)
        })
      })
  })
})
