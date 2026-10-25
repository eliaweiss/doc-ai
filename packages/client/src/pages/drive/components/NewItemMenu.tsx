"use client";
import { Plus as PlusIcon, Upload, FolderPlus, ScanSearch } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import CreateFolderModal from "./CreateFolderModal";
import UploadDocumentModal from "./UploadDocumentModal";
import ImportFromFolderModal from "./ImportFromFolderModal";
import { ContextMenu } from "@zdocs/client-component";
import { useTranslations } from "next-intl";
import { useDocsStore } from "packages/client/src/context-providers/docsStore";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export default function NewItemMenu() {
  const { showUploadOnInit, isUploadModalOpen, setIsUploadModalOpen } = useDocsStore();
  const { logEvent } = useLogUserJourneyEvent();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const t = useTranslations("drive");
  const tImport = useTranslations("importFromFolder");

  const openUploadModal = useCallback(() => {
    logEvent({
      eventType: "browse_new_item_menu_upload_selected",
    });
    setIsUploadModalOpen(true);
    setIsMenuOpen(false);
  }, [setIsUploadModalOpen, logEvent]);

  useEffect(() => {
    if (showUploadOnInit) {
      openUploadModal();
    }
  }, [showUploadOnInit, openUploadModal]);

  const toggleMenu = () => {
    const newState = !isMenuOpen;
    setIsMenuOpen(newState);
    if (newState) {
      logEvent({
        eventType: "browse_new_item_menu_opened",
      });
    }
  };

  const openFolderModal = () => {
    logEvent({
      eventType: "browse_new_item_menu_folder_selected",
    });
    setIsFolderModalOpen(true);
    setIsMenuOpen(false);
  };

  const closeFolderModal = () => {
    setIsFolderModalOpen(false);
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  return (
    <div className="relative mb-4" data-testid="new-item-menu">
      <button
        onClick={toggleMenu}
        className="flex items-center p-2 px-4 bg-primary text-primary-foreground rounded-full shadow hover:bg-primary/90"
        data-testid="new-item-btn"
      >
        <PlusIcon className="w-4 h-4 mr-1" />
        <span>{t("new")}</span>
      </button>

      {isMenuOpen && (
        <ContextMenu
          x={0}
          y={40}
          onClose={() => setIsMenuOpen(false)}
        >
          <ul>
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-foreground"
              onClick={openFolderModal}
              data-testid="new-folder-option"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              <span>{t("newFolder")}</span>
            </li>
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-foreground"
              onClick={openUploadModal}
              data-testid="upload-document-option"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span>{t("uploadDocument")}</span>
            </li>
            {/* doc-ai: sort a local folder with Eye and import the receipts/documents */}
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-foreground"
              onClick={() => {
                setIsImportModalOpen(true);
                setIsMenuOpen(false);
              }}
              data-testid="import-from-folder-option"
            >
              <ScanSearch className="w-4 h-4 mr-2" />
              <span>{tImport("menuItem")}</span>
            </li>
          </ul>
        </ContextMenu>
      )}

      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={closeFolderModal}
      />

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
      />

      <ImportFromFolderModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

