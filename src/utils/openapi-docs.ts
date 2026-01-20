/**
 * @fileoverview OpenAPI documentation utilities for Express routes.
 * 
 * This module provides a decorator-style approach to documenting Express routes
 * with OpenAPI specifications. It automatically collects route documentation
 * and merges it with the base OpenAPI specification.
 * 
 * Usage:
 * ```typescript
 * import { doc, getOpenAPIRoutes } from '../utils/openapi-docs.js';
 * 
 * // Document a route
 * router.get('/users', doc({
 *   summary: 'Get all users',
 *   tags: ['Users'],
 *   responses: {
 *     200: { description: 'List of users', schema: 'Account[]' }
 *   }
 * }), getUsers);
 * ```
 * 
 * @author Jacques Fourie
 */

import { RequestHandler } from 'express';

/**
 * OpenAPI response definition
 */
export interface OpenAPIResponse {
  description: string;
  /** Schema name from typeit (e.g., 'Account', 'Product[]') */
  schema?: string;
  /** Raw OpenAPI schema object (alternative to schema name) */
  content?: Record<string, any>;
}

/**
 * OpenAPI parameter definition
 */
export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: {
    type: string;
    format?: string;
    enum?: string[];
  };
}

/**
 * OpenAPI request body definition
 */
export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  /** Schema name from typeit (e.g., 'AccountBaseForm', 'ProductForm') */
  schema?: string;
  /** Raw OpenAPI schema object (alternative to schema name) */
  content?: Record<string, any>;
}

/**
 * Route documentation options
 */
export interface RouteDocOptions {
  /** Short summary of what the endpoint does */
  summary: string;
  /** Detailed description (optional) */
  description?: string;
  /** Tags for grouping in Swagger UI */
  tags: string[];
  /** Whether authentication is required (default: true) */
  security?: boolean | Array<Record<string, string[]>>;
  /** Path parameters */
  parameters?: OpenAPIParameter[];
  /** Request body specification */
  requestBody?: OpenAPIRequestBody;
  /** Response specifications by status code */
  responses: Record<number | string, OpenAPIResponse>;
  /** Mark as deprecated */
  deprecated?: boolean;
}

/**
 * Internal storage for documented routes
 */
interface DocumentedRoute {
  method: string;
  path: string;
  doc: RouteDocOptions;
}

const documentedRoutes: DocumentedRoute[] = [];

/**
 * Registers a route's documentation.
 * Call this when setting up routes to collect OpenAPI specs.
 */
export function registerRoute(method: string, basePath: string, path: string, doc: RouteDocOptions): void {
  const fullPath = normalizePath(basePath + path);
  documentedRoutes.push({ method: method.toLowerCase(), path: fullPath, doc });
}

/**
 * Normalize path for OpenAPI (convert Express :param to {param})
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/:([^/]+)/g, '/{$1}')  // Convert :param to {param}
    .replace(/\/+/g, '/')              // Remove duplicate slashes
    .replace(/\/$/, '');               // Remove trailing slash
}

/**
 * Convert a schema reference to OpenAPI format
 */
function schemaToOpenAPI(schema: string): any {
  // Handle array types (e.g., 'Account[]')
  if (schema.endsWith('[]')) {
    const itemType = schema.slice(0, -2);
    return {
      type: 'array',
      items: { $ref: `#/components/schemas/${itemType}` }
    };
  }
  
  // Handle primitive types
  const primitives: Record<string, any> = {
    'string': { type: 'string' },
    'number': { type: 'number' },
    'integer': { type: 'integer' },
    'boolean': { type: 'boolean' },
    'object': { type: 'object' },
  };
  
  if (primitives[schema.toLowerCase()]) {
    return primitives[schema.toLowerCase()];
  }
  
  // Reference to component schema
  return { $ref: `#/components/schemas/${schema}` };
}

/**
 * Build response content object
 */
function buildResponseContent(response: OpenAPIResponse): any {
  if (response.content) {
    return response.content;
  }
  
  if (response.schema) {
    return {
      'application/json': {
        schema: schemaToOpenAPI(response.schema)
      }
    };
  }
  
  return undefined;
}

/**
 * Build request body object
 */
function buildRequestBody(requestBody: OpenAPIRequestBody): any {
  const result: any = {
    required: requestBody.required ?? true,
  };
  
  if (requestBody.description) {
    result.description = requestBody.description;
  }
  
  if (requestBody.content) {
    result.content = requestBody.content;
  } else if (requestBody.schema) {
    result.content = {
      'application/json': {
        schema: schemaToOpenAPI(requestBody.schema)
      }
    };
  }
  
  return result;
}

/**
 * Get all documented routes as OpenAPI paths object
 */
export function getOpenAPIPaths(): Record<string, any> {
  const paths: Record<string, any> = {};
  
  for (const route of documentedRoutes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    
    const operation: any = {
      summary: route.doc.summary,
      tags: route.doc.tags,
      responses: {},
    };
    
    if (route.doc.description) {
      operation.description = route.doc.description;
    }
    
    if (route.doc.deprecated) {
      operation.deprecated = true;
    }
    
    // Handle security
    if (route.doc.security === false) {
      operation.security = [];
    } else if (Array.isArray(route.doc.security)) {
      operation.security = route.doc.security;
    }
    // Default security is inherited from global spec
    
    // Add parameters
    if (route.doc.parameters && route.doc.parameters.length > 0) {
      operation.parameters = route.doc.parameters.map(param => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required ?? (param.in === 'path'),
        schema: param.schema ?? { type: 'string' },
      }));
    }
    
    // Add request body
    if (route.doc.requestBody) {
      operation.requestBody = buildRequestBody(route.doc.requestBody);
    }
    
    // Add responses
    for (const [status, response] of Object.entries(route.doc.responses)) {
      const responseObj: any = {
        description: response.description,
      };
      
      const content = buildResponseContent(response);
      if (content) {
        responseObj.content = content;
      }
      
      operation.responses[status] = responseObj;
    }
    
    paths[route.path][route.method] = operation;
  }
  
  return paths;
}

/**
 * Merge documented routes into an existing OpenAPI document
 */
export function mergeRoutesIntoOpenAPI(openapi: any): any {
  const paths = getOpenAPIPaths();
  
  openapi.paths = openapi.paths ?? {};
  
  // Merge paths, with documented routes taking precedence
  for (const [path, methods] of Object.entries(paths)) {
    if (!openapi.paths[path]) {
      openapi.paths[path] = {};
    }
    Object.assign(openapi.paths[path], methods);
  }
  
  return openapi;
}

/**
 * Clear all documented routes (useful for testing)
 */
export function clearDocumentedRoutes(): void {
  documentedRoutes.length = 0;
}

/**
 * Get count of documented routes (useful for debugging)
 */
export function getDocumentedRouteCount(): number {
  return documentedRoutes.length;
}

// ============================================================================
// Route Documentation Helpers
// ============================================================================

/**
 * Common response definitions for reuse
 */
export const CommonResponses = {
  Success: { description: 'Operation successful' },
  SuccessEmpty: { description: 'Operation successful', schema: 'object' },
  Created: { description: 'Resource created successfully' },
  BadRequest: { description: 'Invalid request payload' },
  Unauthorized: { description: 'Authentication required' },
  Forbidden: { description: 'Insufficient permissions' },
  NotFound: { description: 'Resource not found' },
  ServerError: { description: 'Internal server error', schema: 'Error' },
};

/**
 * Common parameter definitions for reuse
 */
export const CommonParameters = {
  accountId: (description = 'Account ID'): OpenAPIParameter => ({
    name: 'accountId',
    in: 'path',
    description,
    required: true,
    schema: { type: 'string' }
  }),
  productId: (description = 'Product ID'): OpenAPIParameter => ({
    name: 'productId',
    in: 'path',
    description,
    required: true,
    schema: { type: 'string' }
  }),
  refillId: (description = 'Refill ID'): OpenAPIParameter => ({
    name: 'refillId',
    in: 'path',
    description,
    required: true,
    schema: { type: 'string' }
  }),
  taskId: (description = 'Task ID'): OpenAPIParameter => ({
    name: 'taskId',
    in: 'path',
    description,
    required: true,
    schema: { type: 'string' }
  }),
  dateOption: (description = 'Date range option'): OpenAPIParameter => ({
    name: 'dateOption',
    in: 'path',
    description,
    required: true,
    schema: { 
      type: 'string',
      enum: ['all', '1d', '1w', '1m', '3m', '1y']
    }
  }),
};
