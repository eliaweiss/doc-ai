import { Folder } from "@zdocs/types";

export interface FolderNode extends Folder {
  children: FolderNode[];
  isExpanded: boolean;
}

