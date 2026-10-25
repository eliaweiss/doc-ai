import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import {
  getSampleDocumentsByDocTypeForOrg,
  getDocumentDataForOrg,
  getDocumentTypeByNameForOrg,
  loadDatasetsForFormulas,
  collectDatasetTypeNames,
} from "@zdocs/db-schema";
import { evaluateFormulas } from "@zdocs/srv";
import type { FieldDefinition, FormulaCode } from "@zdocs/types";

const MAX_SAMPLE_DOCS = 5;
const MAX_LOG_ENTRIES_PER_DOC = 200;
const MAX_LOG_MESSAGE_LENGTH = 2000;

interface DryRunDocResult {
  documentId: string;
  fileName: string | null;
  documentDate: string | null;
  fieldResult: unknown;
  logs: Array<{
    level: string;
    message: string;
    fieldPath: string;
  }>;
  notifications: Array<{
    level: string;
    message: string;
    fieldPath?: string;
  }>;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      docTypeName,
      fieldName,
      code,
      fieldType,
      collectionKey,
    }: {
      docTypeName: string;
      fieldName: string;
      code: string;
      fieldType: string;
      collectionKey?: string | null;
    } = await req.json();

    if (!docTypeName || !fieldName || !code) {
      return NextResponse.json(
        { error: "docTypeName, fieldName, and code are required" },
        { status: 400 }
      );
    }

    const documentType = await getDocumentTypeByNameForOrg(docTypeName, orgId);
    if (!documentType) {
      return NextResponse.json(
        { error: "Document type not found" },
        { status: 404 }
      );
    }

    if (
      collectionKey &&
      (!documentType.lineItemSchemas ||
        !(collectionKey in documentType.lineItemSchemas))
    ) {
      return NextResponse.json(
        { error: "Invalid line item collection key" },
        { status: 400 }
      );
    }

    const sampleDocs = await getSampleDocumentsByDocTypeForOrg(
      orgId,
      docTypeName,
      MAX_SAMPLE_DOCS
    );

    if (sampleDocs.length === 0) {
      return NextResponse.json(
        { error: "No extracted documents found for this type" },
        { status: 404 }
      );
    }

    const datasetTypeNames = collectDatasetTypeNames(
      documentType.headerSchema,
      documentType.lineItemSchemas
    );
    const datasets =
      datasetTypeNames.length > 0
        ? await loadDatasetsForFormulas(orgId, datasetTypeNames)
        : {};

    const testField: FieldDefinition = {
      name: fieldName,
      type: "code",
      displayName: fieldName,
      description: "",
      aiExtractable: false,
      searchable: false,
      isImportant: false,
      formula: {
        type: "code",
        fieldType,
        inputFields: [],
        code,
      } as FormulaCode,
    };

    const tempDocType = {
      ...documentType,
      headerSchema: collectionKey
        ? (documentType.headerSchema as FieldDefinition[])
        : [
            ...(documentType.headerSchema as FieldDefinition[]).filter(
              (f) => f.type !== "code" && f.type !== "sum"
            ),
            ...(documentType.headerSchema as FieldDefinition[]).filter(
              (f) => (f.type === "sum")
            ),
            ...(documentType.headerSchema as FieldDefinition[]).filter(
              (f) => f.type === "code" && f.name !== fieldName
            ),
            testField,
          ],
      lineItemSchemas: collectionKey
        ? {
            ...(documentType.lineItemSchemas as Record<string, { fields: FieldDefinition[]; displayName: string; name: string }>),
            [collectionKey]: {
              ...(documentType.lineItemSchemas as Record<string, { fields: FieldDefinition[]; displayName: string; name: string }>)?.[collectionKey],
              fields: [
                ...((documentType.lineItemSchemas as Record<string, { fields: FieldDefinition[] }>)?.[collectionKey]?.fields || []).filter(
                  (f) => f.type !== "code" || f.name !== fieldName
                ),
                testField,
              ],
            },
          }
        : documentType.lineItemSchemas,
    };

    const results: DryRunDocResult[] = [];

    for (const doc of sampleDocs) {
      const docResult: DryRunDocResult = {
        documentId: doc.id,
        fileName: doc.fileName,
        documentDate: doc.documentDate,
        fieldResult: undefined,
        logs: [],
        notifications: [],
      };

      try {
        const documentData = await getDocumentDataForOrg(orgId, doc.id);
        if (!documentData?.headerData) {
          docResult.error = "No document data found";
          results.push(docResult);
          continue;
        }

        const fileMetadata = {
          id: doc.id,
          fileName: doc.fileName || "",
          uploadDate: doc.createdAt.toISOString(),
          fileType: doc.contentType,
          status: doc.extractionStatus,
        };

        const formulaResult = await evaluateFormulas({
          documentType: tempDocType,
          extractedData: {
            headerData: documentData.headerData,
            lineItems:
              (documentData.lineItems as Record<
                string,
                Record<string, unknown>[]
              >) || {},
          },
          fileMetadata,
          datasets,
          onCodeLog: (log) => {
            if (log.formulaField !== fieldName) return;
            if (docResult.logs.length >= MAX_LOG_ENTRIES_PER_DOC) {
              return;
            }

            const message =
              log.message.length > MAX_LOG_MESSAGE_LENGTH
                ? `${log.message.slice(0, MAX_LOG_MESSAGE_LENGTH)}...`
                : log.message;

            docResult.logs.push({
              level: log.level,
              message,
              fieldPath: log.fieldPath,
            });
          },
        });

        if (collectionKey) {
          const items = formulaResult.lineItems[collectionKey];
          docResult.fieldResult = items?.map((item) => item[fieldName]);
        } else {
          docResult.fieldResult = formulaResult.headerData[fieldName];
        }

        docResult.notifications = formulaResult.notifications
          .filter((n) => n.formulaField === fieldName)
          .map((n) => ({
            level: n.level,
            message: n.message,
            fieldPath: n.fieldPath,
          }));
      } catch (err) {
        docResult.error =
          err instanceof Error ? err.message : "Unknown error";
      }

      results.push(docResult);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in dry-run formula:", error);
    return NextResponse.json(
      { error: "Failed to run formula" },
      { status: 500 }
    );
  }
}
