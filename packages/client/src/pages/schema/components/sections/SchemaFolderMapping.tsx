"use client";

import { useSchemaPage } from "../../context/SchemaPageProvider";
import { FolderMappingEditor } from "../FolderMappingEditor";

export function SchemaFolderMapping() {
  const { localFolderMapping, setLocalFolderMapping } = useSchemaPage();

  return (
    <div data-testid="schema-folder-mapping">
      <FolderMappingEditor
        mappings={localFolderMapping}
        onChange={setLocalFolderMapping}
      />
    </div>
  );
}
