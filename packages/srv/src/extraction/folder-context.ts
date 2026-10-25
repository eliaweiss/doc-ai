import type { DocumentTypeRecord } from "@zdocs/types";
import { getFoldersByOrgId } from "@zdocs/db-schema";

/**
 * Builds folder context for extraction (folder names map, enum, and flag)
 */
export async function buildFolderContext(
  documentType: DocumentTypeRecord,
  orgId: string
): Promise<{
  folderNamesMap: Record<string, string>;
  folderEnum: [string, ...string[]];
  hasFolderMappings: boolean;
}> {
  let folderNamesMap: Record<string, string> = {};
  let folderEnum: [string, ...string[]] = ["NONE"];

  if (documentType.folderMapping && documentType.folderMapping.length > 0) {
    const folders = await getFoldersByOrgId(orgId);
    for (const folder of folders) {
      folderNamesMap[folder.id] = folder.name;
    }

    for (const mapping of documentType.folderMapping) {
      const name = folderNamesMap[mapping.folderId] || mapping.folderId;
      folderEnum.push(name);
    }
  }

  const hasFolderMappings = folderEnum.length > 1;

  return { folderNamesMap, folderEnum, hasFolderMappings };
}
