/**
 * @fileoverview OpenAPI documentation routes.
 * 
 * This module provides endpoints for:
 * - Swagger UI documentation viewer
 * - Downloading the OpenAPI specification (JSON/YAML)
 * - Programmatic access to the spec
 * 
 * @author Jacques Fourie
 */

import express from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import logger from '../../core/logger/index.js';
import { mergeTypeitSchemasIntoOpenAPI } from '../../utils/typesit-schema.js';
import { mergeRoutesIntoOpenAPI, getDocumentedRouteCount, registerRoute } from '../../utils/openapi-docs.js';

const router = express.Router();

// ============================================================================
// Register documentation endpoints for self-documentation
// ============================================================================

registerRoute('GET', '/docs', '/openapi.json', {
  summary: 'Download OpenAPI specification (JSON)',
  description: 'Download the complete OpenAPI 3.0 specification as a JSON file. This can be imported into tools like Postman, Insomnia, or used to generate API clients.',
  tags: ['Documentation'],
  security: false,
  responses: {
    200: {
      description: 'OpenAPI specification in JSON format',
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    }
  }
});

registerRoute('GET', '/docs', '/openapi.yaml', {
  summary: 'Download OpenAPI specification (YAML)',
  description: 'Download the complete OpenAPI 3.0 specification as a YAML file. This can be imported into tools like Swagger Editor or used with code generators.',
  tags: ['Documentation'],
  security: false,
  responses: {
    200: {
      description: 'OpenAPI specification in YAML format',
      content: {
        'application/x-yaml': {
          schema: { type: 'string' }
        }
      }
    }
  }
});

registerRoute('GET', '/docs', '/spec', {
  summary: 'Get OpenAPI specification inline',
  description: 'Retrieve the OpenAPI specification for programmatic access. Use query parameter `format=yaml` for YAML output, otherwise JSON is returned.',
  tags: ['Documentation'],
  security: false,
  parameters: [{
    name: 'format',
    in: 'query',
    description: 'Output format (json or yaml)',
    required: false,
    schema: { type: 'string', enum: ['json', 'yaml'] }
  }],
  responses: {
    200: {
      description: 'OpenAPI specification',
      content: {
        'application/json': {
          schema: { type: 'object' }
        },
        'application/x-yaml': {
          schema: { type: 'string' }
        }
      }
    }
  }
});

// ============================================================================
// Load and build OpenAPI document
// ============================================================================

let openapiDocument: any | undefined;

/**
 * Initialize the OpenAPI document by loading the base YAML file
 * and merging in typeit schemas and route documentation.
 */
export function initOpenAPIDocument(): any | undefined {
  try {
    const openapiPath = join(process.cwd(), "openapi.yaml");
    
    if (!existsSync(openapiPath)) {
      logger.error(`OpenAPI base file not found at: ${openapiPath}`);
      return undefined;
    }
    
    const openapiRaw = readFileSync(openapiPath, "utf8");
    openapiDocument = YAML.parse(openapiRaw);
    
    // Merge typeit schemas (types from the shared library)
    openapiDocument = mergeTypeitSchemasIntoOpenAPI(openapiDocument);
    
    // Merge auto-documented routes from Express routers
    openapiDocument = mergeRoutesIntoOpenAPI(openapiDocument);
    
    logger.info(`OpenAPI documentation loaded with ${getDocumentedRouteCount()} documented routes`);
    
    return openapiDocument;
  } catch (err) {
    logger.error("Failed to load OpenAPI / JSON schema", { error: err });
    return undefined;
  }
}

/**
 * Get the current OpenAPI document.
 * Call initOpenAPIDocument() first to ensure it's loaded.
 */
export function getOpenAPIDocument(): any | undefined {
  return openapiDocument;
}

// ============================================================================
// Setup routes
// ============================================================================

/**
 * Setup the OpenAPI documentation routes.
 * Must be called after all other routes have registered their documentation.
 */
export function setupOpenAPIRoutes(): express.Router {
  // Initialize the document if not already done
  if (!openapiDocument) {
    initOpenAPIDocument();
  }
  
  if (openapiDocument) {
    // Custom CSS to hide default topbar and style download links
    const customCss = `
      .swagger-ui .topbar { display: none }
      .download-links {
        background: #1b1b1b;
        padding: 12px 20px;
        display: flex;
        gap: 16px;
        align-items: center;
        border-bottom: 1px solid #333;
        font-family: sans-serif;
        font-size: 14px;
      }
      .download-links span {
        color: #fff;
        font-weight: 600;
      }
      .download-links a {
        color: #61affe;
        text-decoration: none;
        padding: 6px 12px;
        border: 1px solid #61affe;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .download-links a:hover {
        background: #61affe;
        color: #fff;
      }
    `;
    
    // Custom HTML to inject download links at the top
    const customJs = `
      window.onload = function() {
        const container = document.querySelector('.swagger-ui');
        if (container) {
          const downloadBar = document.createElement('div');
          downloadBar.className = 'download-links';
          downloadBar.innerHTML = '<span>Download Spec:</span><a href="/docs/openapi.json" download>JSON</a><a href="/docs/openapi.yaml" download>YAML</a><a href="/docs/spec" target="_blank">View Raw</a>';
          container.parentNode.insertBefore(downloadBar, container);
        }
      }
    `;

    // Swagger UI viewer
    router.use('/', swaggerUi.serve);
    router.get('/', swaggerUi.setup(openapiDocument, {
      swaggerOptions: {
        tryItOutEnabled: false,
        displayRequestDuration: true,
      },
      customCss,
      customJs,
      customSiteTitle: 'Serveit API Documentation',
    }));
    
    // Download as JSON file
    router.get('/openapi.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="serveit-openapi.json"');
      res.json(openapiDocument);
    });
    
    // Download as YAML file
    router.get('/openapi.yaml', (req, res) => {
      res.setHeader('Content-Type', 'application/x-yaml');
      res.setHeader('Content-Disposition', 'attachment; filename="serveit-openapi.yaml"');
      res.send(YAML.stringify(openapiDocument));
    });
    
    // Inline spec for programmatic access
    router.get('/spec', (req, res) => {
      const format = req.query.format || 'json';
      if (format === 'yaml') {
        res.setHeader('Content-Type', 'application/x-yaml');
        res.send(YAML.stringify(openapiDocument));
      } else {
        res.json(openapiDocument);
      }
    });
    
    logger.info('OpenAPI documentation available at /docs');
    logger.info('Download OpenAPI spec: /docs/openapi.json or /docs/openapi.yaml');
  } else {
    // Fallback route when document is not available
    router.use('/', (req, res) => {
      res.status(503).json({
        error: 'OpenAPI documentation not available',
        message: 'The API documentation could not be loaded. Check server logs for details.'
      });
    });
    
    logger.warning('OpenAPI document not loaded; /docs endpoint will return 503');
  }
  
  return router;
}

export default router;