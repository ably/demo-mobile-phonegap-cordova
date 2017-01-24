"use strict"

const express = require('express')
const app = express()
const Ably = require('ably')
const restClient = process.env.ABLY_API_KEY ? new Ably.Rest(process.env.ABLY_API_KEY) : undefined

app.get('/token', function (req, res) {
  if (restClient) {
    let clientId = req.query.clientId || "anonymous-" + Math.floor(Math.random() * 1000000)
    restClient.auth.createTokenRequest({ clientId: clientId }, function(err, tokenRequest) {
      if (err) {
        res.status(500).send('Could not obtain token: ' + JSON.stringify(err))
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.send(JSON.stringify(tokenRequest))
      }
    })
  } else {
    res.status(500).send('ABLY_API_KEY is not set, token cannot be issued')
  }
})

const port = process.env.PORT || 4000;
app.use('/', express.static('www'))
app.listen(port)

if (!restClient) {
  console.warn("ABLY_API_KEY env var is not present so tokens cannot be issued. This demo will most likely not work")
}

console.log("Listening for HTTP requests on port", port);
