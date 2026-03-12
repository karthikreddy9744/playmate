describe('Admin seeded flow (dev-only)', () => {
  it('seeds admin and accesses admin endpoints', () => {
    // Attempt to seed admin (dev-only endpoint)
    cy.request({ method: 'POST', url: '/internal/dev/seed-admin', failOnStatusCode: false }).then((seedResp) => {
      // If the seeder succeeded (200) we can test admin login; when disabled (404) skip.
      if (seedResp.status !== 200) {
        cy.log('Dev seeder not enabled; skipping seeded-admin login test');
        return;
      }

      // Login using seeded credentials
      cy.request({ method: 'POST', url: '/api/auth/login', body: { email: 'admin+dev@example.com', password: 'dev-admin' } }).then((login) => {
        expect(login.status).to.eq(200)
        const token = login.body?.token
        expect(token).to.be.a('string')

        // Access admin-only endpoint
        cy.request({ method: 'GET', url: '/api/admin/users', headers: { Authorization: `Bearer ${token}` } }).then((r) => {
          expect(r.status).to.eq(200)
          expect(r.body).to.be.an('array')
        })
      })
    })
  })
})
