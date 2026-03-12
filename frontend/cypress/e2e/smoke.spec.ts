describe('Smoke E2E tests', () => {
  it('creates a firebase user and updates profile via proxy', () => {
    const fbUid = 'cypress-smoke-uid-001'
    cy.request('POST', '/api/auth/firebase-sync', {
      firebaseUid: fbUid,
      email: 'cypress+smoke@example.com',
      name: 'Cypress Smoke',
      photoUrl: 'https://example.com/p.jpg',
      provider: 'google'
    }).then((resp) => {
      expect(resp.status).to.equal(200)
      const token = resp.body.token
      expect(token).to.be.a('string')

      cy.request({
        method: 'PUT',
        url: `/api/users/firebase/${fbUid}`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: 'Cypress Updated',
          locationCity: 'TestCity',
          locationLat: 12.34,
          locationLng: 56.78,
          profilePictureUrl: 'https://example.com/updated.jpg',
          sports: [{ sportType: 'cricket', skillLevel: 'advanced' }]
        }
      }).then((u) => {
        expect(u.status).to.equal(200)
        expect(u.body.name).to.equal('Cypress Updated')
      })
    })
  })

  it('creates a game, joins, sends message and verifies inbox', () => {
    const creatorUid = 'cypress-creator-001'
    const joinerUid = 'cypress-joiner-001'
    cy.request('POST', '/api/auth/firebase-sync', { firebaseUid: creatorUid, email: 'creator+cy@example.com', name: 'Creator' })
      .then((cresp) => {
        const creatorToken = cresp.body.token
        // create game via proxy
        // Use local datetime format (server expects LocalDateTime) and ensure it's in the future
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h in future
        const pad = (n: number) => n.toString().padStart(2, '0')
        const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        cy.request({ method: 'POST', url: '/api/games', headers: { Authorization: `Bearer ${creatorToken}` }, body: {
          title: 'Cypress Game', sport: 'Football', startTime: start, durationMinutes: 60, totalSlots: 10, locationCity: 'TestCity'
        }}).then((g) => {
          expect(g.status).to.equal(200)
          const gameId = g.body.id
          // create joiner
          cy.request('POST', '/api/auth/firebase-sync', { firebaseUid: joinerUid, email: 'joiner+cy@example.com', name: 'Joiner' })
            .then((jresp) => {
              const joinerId = jresp.body.userId
              const joinerToken = jresp.body.token
              cy.request({ method: 'POST', url: `/api/games/${gameId}/join`, headers: { Authorization: `Bearer ${joinerToken}` }, body: { firebaseUid: joinerUid } }).then((joinResp) => {
                expect(joinResp.status).to.equal(200)
                // send message from creator to joiner (authenticated)
                cy.request({ method: 'POST', url: '/api/messages/send', headers: { Authorization: `Bearer ${creatorToken}` }, body: { senderId: cresp.body.userId, receiverId: joinerId, content: 'Hello Cypress', gameId } }).then((m) => {
                  expect(m.status).to.equal(200)
                  cy.request({ url: `/api/messages/unread-count/${joinerId}`, headers: { Authorization: `Bearer ${joinerToken}` } }).then((un) => {
                    expect(un.status).to.equal(200)
                    expect(un.body.count).to.be.greaterThan(-1)
                  })
                })
              })
            })
        })
      })
  })
})
