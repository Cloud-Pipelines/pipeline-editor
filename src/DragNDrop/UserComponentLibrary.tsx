/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  TextField,
} from "@material-ui/core";
import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  addComponentToListByText,
  deleteComponentFileFromList,
  ComponentFileEntry,
  getAllComponentFilesFromList,
  addComponentToListByUrl,
} from "../componentStore";
import DraggableComponent from "./DraggableComponent";

const USER_COMPONENTS_LIST_NAME = "user_components";

const UserComponentLibrary = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [componentFiles, setComponentFiles] = useState(
    new Map<string, ComponentFileEntry>()
  );
  const [contextMenuFileName, setContextMenuFileName] = useState<string>();
  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement>();
  const [isImportComponentDialogOpen, setIsImportComponentDialogOpen] =
    useState(false);

  const refreshComponents = useCallback(() => {
    getAllComponentFilesFromList(USER_COMPONENTS_LIST_NAME).then(
      setComponentFiles
    );
  }, [setComponentFiles]);

  useEffect(refreshComponents, [refreshComponents]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onabort = () => console.log("file reading was aborted");
      reader.onerror = () => console.log("file reading has failed");
      reader.onload = async () => {
        const binaryStr = reader.result;
        if (binaryStr === null || binaryStr === undefined) {
          console.error(`Dropped file reader result was ${binaryStr}`);
          return;
        }
        try {
          const componentRefPlusData = await addComponentToListByText(
            USER_COMPONENTS_LIST_NAME,
            binaryStr,
          );
          const componentRef = componentRefPlusData.componentRef;
          console.debug("storeComponentText succeeded", componentRef);
          (window as any).gtag?.("event", "UserComponents_component_import", {
            result: "succeeded",
          });
          setErrorMessage("");
          refreshComponents();
        } catch (err) {
          setErrorMessage(
            `Error parsing the dropped file as component: ${err.toString()}.`
          );
          console.error("Error parsing the dropped file as component", err);
          (window as any).gtag?.("event", "UserComponents_component_import", {
            result: "failed",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, [refreshComponents]);

  const onImportFromUrl = useCallback(
    async (url: string) => {
      try {
        const componentFileEntry = await addComponentToListByUrl(
          USER_COMPONENTS_LIST_NAME,
          url
        );
        const componentRef = componentFileEntry.componentRef;
        console.debug("addComponentToListByUrl succeeded", componentRef);
        (window as any).gtag?.(
          "event",
          "UserComponents_component_import_from_url_succeeded"
        );
        setErrorMessage("");
        refreshComponents();
        setIsImportComponentDialogOpen(false);
      } catch (err) {
        setErrorMessage(
          `Error parsing the file as component: ${err.toString()}.`
        );
        console.error("Error importing component from the URL", err);
        (window as any).gtag?.(
          "event",
          "UserComponents_component_import_from_url_failed"
        );
      }
    },
    [refreshComponents]
  );

  const handleContextMenuDelete = async () => {
    if (contextMenuFileName) {
      setContextMenuFileName(undefined);
      await deleteComponentFileFromList(
        USER_COMPONENTS_LIST_NAME,
        contextMenuFileName
      );
      refreshComponents();
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ".yaml",
  });

  return (
    <div>
      <button
        onClick={(e) => setIsImportComponentDialogOpen(true)}
        style={{ marginBottom: "4px" }}
      >
        Import from URL
      </button>
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        <div
          style={{
            border: "1px solid black",
            padding: "4px",
            minHeight: "3em",
          }}
        >
          {isDragActive
            ? "Drop the files here ..."
            : errorMessage ||
              "Drag and drop component.yaml files or click to select files"}
          {Array.from(componentFiles.entries()).map(([fileName, fileEntry]) => (
            <DraggableComponent
              key={fileName}
              componentReference={fileEntry.componentRef}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuAnchor(e.currentTarget);
                setContextMenuFileName(fileName);
              }}
            />
          ))}
        </div>
      </div>
      <Menu
        open={contextMenuFileName !== undefined}
        anchorEl={contextMenuAnchor}
        onClose={() => {
          setContextMenuFileName(undefined);
        }}
      >
        <MenuItem dense={true} onClick={handleContextMenuDelete}>
          Delete
        </MenuItem>
      </Menu>
      <ImportComponentFromUrlDialog
        isOpen={isImportComponentDialogOpen}
        onCancel={() => setIsImportComponentDialogOpen(false)}
        initialValue={"https://raw.githubusercontent.com/.../component.yaml"}
        onImport={onImportFromUrl}
      />
    </div>
  );
};

export default UserComponentLibrary;

interface SaveAsDialogProps {
  isOpen: boolean;
  onImport: (name: string) => void;
  onCancel: () => void;
  initialValue: string | undefined;
}

const ImportComponentFromUrlDialog = ({
  isOpen,
  onImport,
  onCancel,
  initialValue,
}: SaveAsDialogProps) => {
  const urlInputRef = useRef<HTMLInputElement>();
  return (
    <Dialog open={isOpen} fullWidth>
      <DialogTitle>{"Import component"}</DialogTitle>
      <form
        onSubmit={(e) => {
          if (urlInputRef.current) {
            onImport(urlInputRef.current.value);
          }
          e.preventDefault();
        }}
      >
        <DialogContent>
          <TextField
            id="name"
            type="text"
            placeholder={initialValue}
            label="Component URL"
            inputRef={urlInputRef}
            required
            autoFocus
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button color="primary" type="submit" autoFocus>
            Import
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
