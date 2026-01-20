import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { __nodeModulesPath } from "../config/paths.js";

/**
 * Interface representing the structure of typeit's generated JSON schema file.
 * The schema file is OpenAPI 3.0.3 compatible with additional metadata.
 */
interface TypeitJsonSchema {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    license: {
      name: string;
      url: string;
    };
  };
  schemas: Array<{
    type: string;
    properties?: Record<string, any>;
    title?: string;
    $id?: string;
    required?: string[];
    nullable?: boolean;
    [key: string]: any;
  }>;
  components?: {
    schemas?: Record<string, any>;
  };
}

/**
 * Load typeit's json-schema.json and merge its schemas into an OpenAPI doc
 * under components.schemas.
 * 
 * The new typeit schema generation includes:
 * - `title` property on each schema for identification
 * - `$id` property for schema referencing
 * - Comprehensive coverage of all typeit types including:
 *   - Account types (IAccount, IAccountBaseForm, ICredentials, etc.)
 *   - Product types (IProduct, IProductStock, IProductOrder, etc.)
 *   - Cart types (ICart, ICartItem, etc.)
 *   - Ledger types (ITransaction, IRefill, IPreOrder, IStockEntry, etc.)
 *   - Statistics types (IFinanceStats, IInventoryStats, etc.)
 *   - Error and utility types (IError, Log, ITaskLean)
 *   - All enums as component schemas
 * 
 * @param openapi - The OpenAPI document to merge schemas into
 * @returns The OpenAPI document with typeit schemas merged
 */
export function mergeTypeitSchemasIntoOpenAPI(openapi: any): any {
  try {
    const schemaPath = join(__nodeModulesPath, "typesit/schemas/json-schema.json");
    if (!existsSync(schemaPath)) {
      console.warn("Typeit schema file not found at:", schemaPath);
      return openapi;
    }

    const raw = readFileSync(schemaPath, "utf8");
    const app = JSON.parse(raw) as TypeitJsonSchema;

    openapi.components ??= {};
    openapi.components.schemas ??= {};

    const target = openapi.components.schemas;

    // Process each schema using its title property for naming
    // The new typeit schema generation adds title to each schema
    for (const schema of app.schemas) {
      if (schema.title) {
        // Use the title as the schema name, removing the "I" prefix for cleaner OpenAPI naming
        // e.g., "IAccount" -> "Account", "IProductStock" -> "ProductStock"
        const schemaName = schema.title.startsWith("I") 
          ? schema.title.slice(1) 
          : schema.title;
        
        // Create a clean copy without the title and $id (they're metadata, not schema properties)
        const { title, $id, ...cleanSchema } = schema;
        target[schemaName] = cleanSchema;
      }
    }

    // Also merge enum components from typeit if present
    if (app.components?.schemas) {
      for (const [name, schema] of Object.entries(app.components.schemas)) {
        // Don't overwrite schemas that already exist
        if (!target[name]) {
          target[name] = schema;
        }
      }
    }

    // Log success info
    const schemaCount = Object.keys(target).length;
    console.log(`Merged ${app.schemas.length} typeit schemas into OpenAPI (${schemaCount} total schemas)`);

    return openapi;
  } catch (err) {
    // Fail soft; just return the original doc
    console.error("Failed to merge typeit schemas into OpenAPI:", err);
    return openapi;
  }
}

/**
 * Get a specific schema by name from the typeit schema file.
 * 
 * @param schemaName - The name of the schema to retrieve (e.g., "IAccount", "IProduct")
 * @returns The schema object or undefined if not found
 */
export function getTypeitSchema(schemaName: string): any | undefined {
  try {
    const schemaPath = join(__nodeModulesPath, "typesit/schemas/json-schema.json");
    if (!existsSync(schemaPath)) {
      return undefined;
    }

    const raw = readFileSync(schemaPath, "utf8");
    const app = JSON.parse(raw) as TypeitJsonSchema;

    // Find by title
    const schema = app.schemas.find(s => s.title === schemaName);
    if (schema) {
      const { title, $id, ...cleanSchema } = schema;
      return {
        ...cleanSchema,
        // Include components for $ref resolution
        components: app.components
      };
    }

    // Also check component schemas (enums)
    if (app.components?.schemas?.[schemaName]) {
      return app.components.schemas[schemaName];
    }

    return undefined;
  } catch (err) {
    console.error("Failed to get typeit schema:", err);
    return undefined;
  }
}

/**
 * Get all available schema names from the typeit schema file.
 * 
 * @returns Array of schema names, or empty array if schemas couldn't be loaded
 */
export function getTypeitSchemaNames(): string[] {
  try {
    const schemaPath = join(__nodeModulesPath, "typesit/schemas/json-schema.json");
    if (!existsSync(schemaPath)) {
      return [];
    }

    const raw = readFileSync(schemaPath, "utf8");
    const app = JSON.parse(raw) as TypeitJsonSchema;

    const names: string[] = [];

    // Get names from top-level schemas
    for (const schema of app.schemas) {
      if (schema.title) {
        names.push(schema.title);
      }
    }

    // Get names from component schemas (enums)
    if (app.components?.schemas) {
      names.push(...Object.keys(app.components.schemas));
    }

    return names;
  } catch (err) {
    console.error("Failed to get typeit schema names:", err);
    return [];
  }
}