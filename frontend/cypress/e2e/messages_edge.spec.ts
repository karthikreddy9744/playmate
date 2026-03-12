describe('Messaging edge cases', () => {
  it('sending message without auth is forbidden', () => {
    cy.request({ method: 'POST', url: '/api/messages/send', body: { senderId: 99999, receiverId: 99998, content: 'hi' }, failOnStatusCode: false }).then((r) => {
      expect([401, 403, 404]).to.include(r.status)
    })
  })

  it('sending message with empty content returns bad request', () => {
    const s = 'cypress-msg-sender-001'
    const r = 'cypress-msg-recv-001'
    cy.request('POST', '/api/auth/firebase-sync', { firebaseUid: s, email: 'sender+cy@example.com', name: 'Sender' })
      .then((sresp) => {
        cy.request('POST', '/api/auth/firebase-sync', { firebaseUid: r, email: 'recv+cy@example.com', name: 'Recv' })
          .then((rresp) => {
            const token = sresp.body.token
            const receiverId = rresp.body.userId
            cy.request({ method: 'POST', url: '/api/messages/send', headers: { Authorization: `Bearer ${token}` }, body: { senderId: sresp.body.userId, receiverId, content: '' }, failOnStatusCode: false }).then((m) => {
              expect([400, 422]).to.include(m.status)
            })
          })
      })
  })
})
