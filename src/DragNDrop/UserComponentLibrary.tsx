/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { Menu, MenuItem } from "@material-ui/core";
import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  addComponentToListByText,
  deleteComponentFileFromList,
  ComponentFileEntry,
  getAllComponentFilesFromList,
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div>
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
    </div>
  );
};

export default UserComponentLibrary;
