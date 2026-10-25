/**
 * TxScript Capability Object
 *
 * A Rossum TxScript-like capability object for formula execution.
 * All reads, writes, and side effects are mediated through this object.
 *
 * The formula code receives this as the only parameter (tx).
 *
 * @module tx-capability
 */

import type {
  TxResult,
  TxNotification,
  TxNotificationLevel,
  TxFormulaContext,
  TxHttpOptions,
  TxHttpResponse,
  TxExecutionMetadata,
  TX_DEFAULT_LIMITS,
} from "@zdocs/types";

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validation error thrown by tx operations
 */
export class TxValidationError extends Error {
  constructor(message: string, public meta: Record<string, unknown> = {}) {
    super(message);
    this.name = "TxValidationError";
  }
}

/**
 * Rate limit error thrown when limits are exceeded
 */
export class TxRateLimitError extends Error {
  constructor(message: string, public meta: Record<string, unknown> = {}) {
    super(message);
    this.name = "TxRateLimitError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TX CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TxScript-like capability object for formula execution
 *
 * Inspired by Rossum TxScript - mediates all reads, writes, and side effects
 * during formula evaluation. The formula code receives this as the only parameter.
 *
 * @example
 * ```javascript
 * // In formula code:
 * const lineItem = tx.getCurrentLineItem();
 * const sku = lineItem?.sku;
 *
 * const match = tx.dataset.lookup('sku2en', 'SKU', sku);
 * if (!match) {
 *   tx.addMessage(`SKU "${sku}" not found`, { level: 'warning', field: 'sku' });
 *   return;
 * }
 *
 * tx.setResult(match['English Item Name']);
 * ```
 */
export class Tx {
  private context: TxFormulaContext;
  private collectionKey: string | null;
  private collectionIndex: number | null;
  private datasets: Record<string, Record<string, unknown>[]>;

  // Result storage
  private _result: unknown = null;

  // Collected mutations
  private fieldChanges: Record<string, unknown> = {};
  private lineFieldChanges: Record<
    string,
    Record<number, Record<string, unknown>>
  > = {};
  private messages: TxNotification[] = [];

  // Call tracking
  private httpCallCount = 0;
  private readCount = 0;
  private writeCount = 0;
  private datasetLookupCount = 0;

  // Limits
  private readonly maxHttpCalls: number;
  private readonly httpTimeoutMs: number;
  private readonly onLog?: (entry: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    meta?: Record<string, unknown>;
  }) => void;

  constructor(
    context: TxFormulaContext,
    collectionKey: string | null,
    collectionIndex: number | null,
    datasets: Record<string, Record<string, unknown>[]> = {},
    limits: Partial<typeof TX_DEFAULT_LIMITS> = {},
    onLog?: (entry: {
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, unknown>;
    }) => void
  ) {
    this.context = context;
    this.collectionKey = collectionKey;
    this.collectionIndex = collectionIndex;
    this.datasets = datasets;

    // Apply limits with defaults
    this.maxHttpCalls = limits.maxHttpCalls ?? 10;
    this.httpTimeoutMs = limits.httpTimeoutMs ?? 5000;
    this.onLog = onLog;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a header field value
   * @param name - Field name
   * @returns Cloned field value
   */
  getField(name: string): unknown {
    this.readCount++;
    if (!this.utils.isNonEmptyString(name)) {
      throw new TxValidationError("Field name must be a non-empty string", {
        name,
      });
    }
    return structuredClone(this.context.header[name]);
  }

  /**
   * Get multiple header fields at once
   * @param names - Array of field names
   * @returns Object with field name -> value mappings
   */
  getFields(names: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const name of names) {
      result[name] = this.getField(name);
    }
    // this.log("debug", "getFields", result);
    return result;
  }

  /**
   * Get a specific line item from a collection
   * @param collection - Collection name (e.g., "items")
   * @param index - Item index
   * @returns Cloned line item object
   */
  getLineItem(collection: string, index: number): Record<string, unknown> {
    this.readCount++;
    const items = this.context.lineItems[collection];
    if (!items || !Array.isArray(items)) {
      throw new TxValidationError(`Collection "${collection}" not found`, {
        collection,
      });
    }
    if (index < 0 || index >= items.length) {
      throw new TxValidationError(
        `Index ${index} out of bounds for collection "${collection}"`,
        {
          collection,
          index,
          length: items.length,
        }
      );
    }
    return structuredClone(items[index]);
  }

  /**
   * Get the current line item (only works for line-item formulas)
   * @returns Current line item or null if called from header formula
   */
  getCurrentLineItem(): Record<string, unknown> | null {
    if (this.collectionKey === null || this.collectionIndex === null) {
      return null;
    }
    return this.getLineItem(this.collectionKey, this.collectionIndex);
  }

  /**
   * Get all line items from a collection
   * @param collection - Collection name
   * @returns Array of cloned line items
   */
  getLineItems(collection: string): Array<Record<string, unknown>> {
    this.readCount++;
    const items = this.context.lineItems[collection];
    if (!items || !Array.isArray(items)) {
      return [];
    }
    return structuredClone(items);
  }

  /**
   * Get the full context (read-only frozen copy)
   * Use sparingly - prefer specific getField/getLineItem calls
   */
  getContext(): Readonly<TxFormulaContext> {
    this.readCount++;
    return Object.freeze(structuredClone(this.context));
  }

  /**
   * Get current collection key (for line-item formulas)
   */
  getCurrentCollection(): string | null {
    return this.collectionKey;
  }

  /**
   * Get current line item index (for line-item formulas)
   */
  getCurrentIndex(): number | null {
    return this.collectionIndex;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the result value for this formula field
   * @param value - The computed result
   */
  setResult(value: unknown): void {
    this.writeCount++;
    // Validate that value is JSON-serializable
    try {
      JSON.stringify(value);
    } catch {
      throw new TxValidationError("Result value must be JSON-serializable", {
        value: String(value),
      });
    }
    this._result = value;
  }

  /**
   * Set a header field value
   * Reads after writes in the same execution see the updated value.
   * @param name - Field name
   * @param value - New value
   */
  setField(name: string, value: unknown): void {
    this.writeCount++;
    if (!this.utils.isNonEmptyString(name)) {
      throw new TxValidationError("Field name must be a non-empty string", {
        name,
      });
    }
    // Validate JSON-serializable
    try {
      JSON.stringify(value);
    } catch {
      throw new TxValidationError("Field value must be JSON-serializable", {
        name,
        value: String(value),
      });
    }
    this.fieldChanges[name] = value;
    // Also update context so subsequent reads see the change
    this.context.header[name] = value;
  }

  /**
   * Set multiple header fields at once
   * Reads after writes in the same execution see the updated value.
   * @param fields - Object with field name -> value mappings
   */
  setFields(fields: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(fields)) {
      this.setField(name, value);
    }
  }

  /**
   * Set a field on a specific line item
   * Reads after writes in the same execution see the updated value.
   * @param collection - Collection name
   * @param index - Item index
   * @param name - Field name
   * @param value - New value
   */
  setLineField(
    collection: string,
    index: number,
    name: string,
    value: unknown
  ): void {
    this.writeCount++;
    if (!this.utils.isNonEmptyString(name)) {
      throw new TxValidationError("Field name must be a non-empty string", {
        name,
      });
    }

    // Validate collection exists
    const items = this.context.lineItems[collection];
    if (!items || !Array.isArray(items)) {
      throw new TxValidationError(`Collection "${collection}" not found`, {
        collection,
      });
    }
    if (index < 0 || index >= items.length) {
      throw new TxValidationError(
        `Index ${index} out of bounds for collection "${collection}"`,
        {
          collection,
          index,
          length: items.length,
        }
      );
    }

    // Validate JSON-serializable
    try {
      JSON.stringify(value);
    } catch {
      throw new TxValidationError(
        "Line field value must be JSON-serializable",
        {
          collection,
          index,
          name,
          value: String(value),
        }
      );
    }

    // Store change
    if (!this.lineFieldChanges[collection]) {
      this.lineFieldChanges[collection] = {};
    }
    if (!this.lineFieldChanges[collection][index]) {
      this.lineFieldChanges[collection][index] = {};
    }
    this.lineFieldChanges[collection][index][name] = value;

    // Update context
    this.context.lineItems[collection][index][name] = value;
  }

  /**
   * Set a field on the current line item (for line-item formulas)
   * Reads after writes in the same execution see the updated value.
   * @param name - Field name
   * @param value - New value
   */
  setCurrentLineField(name: string, value: unknown): void {
    if (this.collectionKey === null || this.collectionIndex === null) {
      throw new TxValidationError(
        "setCurrentLineField can only be called from line-item formulas",
        {
          collectionKey: this.collectionKey,
          collectionIndex: this.collectionIndex,
        }
      );
    }
    this.setLineField(this.collectionKey, this.collectionIndex, name, value);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGING (NOTIFICATIONS)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a notification message
   * @param text - Message text
   * @param opts - Options (level, field)
   */
  addMessage(
    text: string,
    opts: { level?: TxNotificationLevel; field?: string } = {}
  ): void {
    if (!this.utils.isNonEmptyString(text)) {
      throw new TxValidationError("Message text must be a non-empty string");
    }

    const level = opts.level ?? "warning";
    let fieldPath = opts.field;

    // Auto-generate fieldPath for current line item if only field name provided
    if (
      fieldPath &&
      !fieldPath.includes("[") &&
      !fieldPath.startsWith("header.") &&
      this.collectionKey !== null &&
      this.collectionIndex !== null
    ) {
      fieldPath = `${this.collectionKey}[${this.collectionIndex}].${fieldPath}`;
    }

    this.messages.push({
      level,
      message: text,
      fieldPath,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log a message (wrapper for console.log)
   * @param level - Log level: 'debug' | 'info' | 'warn' | 'error'
   * @param message - Log message
   * @param meta - Optional metadata object
   */
  log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>
  ): void {
    this.onLog?.({ level, message, meta });

    const prefix = `[tx:${level}]`;
    const logFn =
      level === "error"
        ? console.error
        : level === "warn"
        ? console.warn
        : level === "debug"
        ? console.debug
        : console.log;

    if (meta) {
      logFn(prefix, message, meta);
    } else {
      logFn(prefix, message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  utils = {
    /** Check if value is a non-empty string */
    isNonEmptyString: (s: unknown): s is string =>
      typeof s === "string" && s.trim().length > 0,

    /** Parse number from string or number */
    parseNumber: (s: unknown): number | null => {
      if (typeof s === "number") return isNaN(s) ? null : s;
      if (typeof s === "string") {
        const n = parseFloat(s.trim());
        return isNaN(n) ? null : n;
      }
      return null;
    },

    /** Check if value is nullish (null or undefined) */
    isNullish: (value: unknown): value is null | undefined => value == null,

    /** Format currency (simple version) */
    formatCurrency: (amount: number, currency?: string): string => {
      const formatted = amount.toFixed(2);
      return currency ? `${currency} ${formatted}` : formatted;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DATASET ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  dataset = {
    /**
     * Get all rows from a dataset (case-insensitive name matching)
     * @param name - Dataset name
     * @returns Array of dataset rows
     */
    getAll: (name: string): Record<string, unknown>[] => {
      this.datasetLookupCount++;
      const key = Object.keys(this.datasets).find(
        (k) => k.toLowerCase() === name.toLowerCase()
      );
      return key ? structuredClone(this.datasets[key]) : [];
    },

    /**
     * Find first matching row in a dataset
     * @param name - Dataset name
     * @param predicate - Filter function - run user code
     * @returns First matching row or null
     */
    find: (
      name: string,
      predicate: (row: Record<string, unknown>) => boolean
    ): Record<string, unknown> | null => {
      const rows = this.dataset.getAll(name);
      return rows.find(predicate) ?? null;
    },

    /**
     * Find all matching rows in a dataset
     * @param name - Dataset name
     * @param predicate - Filter function
     * @returns Array of matching rows
     */
    filter: (
      name: string,
      predicate: (row: Record<string, unknown>) => boolean
    ): Array<Record<string, unknown>> => {
      const rows = this.dataset.getAll(name);
      return rows.filter(predicate);
    },

    /**
     * Lookup row by field value (case-insensitive field names)
     * @param name - Dataset name
     * @param field - Field name to match
     * @param value - Value to find
     * @returns First matching row or null
     */
    lookup: (
      name: string,
      field: string,
      value: unknown
    ): Record<string, unknown> | null => {
      return this.dataset.find(name, (row) => {
        // Try exact field name first, then lowercase
        const rowValue = row[field] ?? row[field.toLowerCase()];
        return String(rowValue) === String(value);
      });
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  http = {
    /**
     * Make an HTTP request to an external API
     * @param opts - Request options
     * @returns Response object
     */
    request: async (opts: TxHttpOptions): Promise<TxHttpResponse> => {
      this.httpCallCount++;

      if (this.httpCallCount > this.maxHttpCalls) {
        throw new TxRateLimitError(
          `HTTP call limit exceeded (max ${this.maxHttpCalls} calls per formula)`,
          { callCount: this.httpCallCount }
        );
      }

      const {
        method = "GET",
        url,
        headers = {},
        body,
        timeoutMs = this.httpTimeoutMs,
      } = opts;

      // Validate URL
      if (!this.utils.isNonEmptyString(url)) {
        throw new TxValidationError("URL must be a non-empty string");
      }

      // Setup timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        // Read response
        const bodyText = await response.text();

        // Try to parse as JSON
        let bodyParsed: unknown;
        try {
          bodyParsed = JSON.parse(bodyText);
        } catch {
          bodyParsed = bodyText;
        }

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          status: response.status,
          ok: response.ok,
          body: bodyParsed,
          bodyText,
          headers: responseHeaders,
        };
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          throw new TxValidationError(
            `HTTP request timed out after ${timeoutMs}ms`,
            {
              url,
              timeoutMs,
            }
          );
        }
        throw new TxValidationError(
          `HTTP request failed: ${(error as Error).message}`,
          {
            url,
            error: (error as Error).message,
          }
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL - Get execution result
  // ═══════════════════════════════════════════════════════════════════════════

  /** @internal Get the execution result (called by formula evaluator) */
  getExecutionResult(): TxResult {
    const metadata: TxExecutionMetadata = {
      httpCallCount: this.httpCallCount,
      readCount: this.readCount,
      writeCount: this.writeCount,
      datasetLookupCount: this.datasetLookupCount,
    };

    return {
      result: this._result,
      fieldChanges: structuredClone(this.fieldChanges),
      lineFieldChanges: structuredClone(this.lineFieldChanges),
      messages: structuredClone(this.messages),
      metadata,
    };
  }
}
