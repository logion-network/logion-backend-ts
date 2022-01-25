import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from "express-oas-generator";
import { predefinedSpec, setupApp } from "../../src/logion/app.support";
import express from "express";

describe('app', () => {

    it("succeeds to do init sequence", () => {
        const app = express()
        expressOasGenerator.handleResponses(app, {
            predefinedSpec,
            specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
            swaggerDocumentOptions: {},
            alwaysServeDocs: true,
        });
        setupApp(app);
        expressOasGenerator.handleRequests()
    })
})
