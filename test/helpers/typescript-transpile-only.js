require('reflect-metadata')
const { register } = require('ts-node')

register({
  project: 'tsconfig.spec.json',
  transpileOnly: true
})
