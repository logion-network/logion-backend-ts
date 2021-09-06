# Authentication

This document is a proposal of authentication scheme, using Polkadot signature.

The purpose of the authentication is to ensure that the client issuing a call to the REST api is the legitimate owner
of the Polkadot account. The Polkadot signature is reused, which has several advantages:
* One unique authentication mechanism, regardless of whether it's an on- or off-chain operation.
* UX: No extra password, one password per Polkadot account
* Extra security: No password stored on backend.

Standard: [RFC 7519 - JSON Web Tokens](https://jwt.io/)

See this [sequence diagram](Authentication.puml) - requires PlanUML plugin for [Eclipse](https://plantuml.com/en/eclipse)
or [IntelliJ](https://plugins.jetbrains.com/plugin/7017-plantuml-integration) 

## Back-end
* Tokens are signed by the emitter. We will use a public/private key pair. This will allow other parties (like the
  front or another backend) to verify the signature.
* The authentic source for determining if a given user is legal officer will be ultimately the chain. As a temporary
  solution, the info could be stored locally (database), and later on the backend can query the chain to get this info.
* Operations (Http method `POST`) can still be protected by the existing signature mechanism
* Read access to resources (Http method `PUT` or `GET`) require authentication, 
    * Some resources can be statically protected via annotation `@PreAuthorize("hasRole('LEGAL_OFFICER')")`
    * Some resources require specific validations, for instance:
        * Fetching all protections requests of a requester is only possible by the requester him/herself.
        * Fetching all protections requests of a legal officer is only possible by the legal officer him/herself.
  

## Front-end
* Starts a session.
* Authenticates a session by signing a payload.
* Receives a token with a limited temporal validity.
* Adds the token as an http header in each subsequent API call.
* Has the possibility to verify token's signature.
* Has the possibility to access to token's content (token expiration date and roles).

## Open issues
* We have no classical user/password input screen - what about UX ?
