import { Hono } from 'hono'
import { registerOpenApiDocumentation } from '../openapi'

const docs = new Hono()

// Mount /openapi.json, /openapi.yaml, /doc, and /swagger
registerOpenApiDocumentation(docs)

export default docs
