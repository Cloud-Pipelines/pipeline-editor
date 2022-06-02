/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { downloadTextWithCache } from "../cacheUtils";

import { ComponentReference, ComponentSpec } from "../componentSpec";
import DraggableComponent from "./DraggableComponent";
import { fullyLoadComponentFromUrl } from "../componentStore";

type ComponentLibraryFolder = {
  name: string;
  folders: ComponentLibraryFolder[];
  components: ComponentReference[];
};

type ComponentLibraryStruct = {
  annotations?: {
    [k: string]: unknown;
  };
  folders: ComponentLibraryFolder[];
};

export const isValidComponentLibraryStruct = (
  obj: object
): obj is ComponentLibraryStruct => "folders" in obj;

interface DraggableComponentRowProps {
  componentUrl: string;
  downloadText: (url: string) => Promise<string>;
}

const DraggableComponentRow = ({
  componentUrl,
  downloadText = downloadTextWithCache,
}: DraggableComponentRowProps) => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>(
    undefined
  );
  useEffect(() => {
    // TODO: Validate the component
    // Loading the component (preloading the graph component children as well).
    fullyLoadComponentFromUrl(componentUrl, downloadText).then(setComponentSpec);
  }, [componentUrl, downloadText]);

  if (componentSpec === undefined) {
    return <div>Loading...</div>;
  } else {
    return (
      <DraggableComponent
        componentReference={{
          url: componentUrl,
          spec: componentSpec,
        }}
      />
    );
  }
};

const SingleFolderVis = ({
  folder,
  isOpen = false,
  downloadText = downloadTextWithCache
}: {
  folder: ComponentLibraryFolder;
  isOpen?: boolean;
  downloadText: (url: string) => Promise<string>;
}) => {
  return (
    <details
      key={folder.name}
      open={isOpen}
      style={{
        border: "1px solid #aaa",
        borderRadius: "4px",
        padding: "4px",
        paddingLeft: "10px",
      }}
    >
      <summary style={{ borderWidth: "1px", padding: "4px" }}>
        <strong>{folder.name}</strong>
      </summary>
      {folder.folders &&
        Array.from(folder.folders).map((componentFolder, index) => (
          <SingleFolderVis
            key={componentFolder.name}
            folder={componentFolder}
            isOpen={isOpen && index === 0}
            downloadText={downloadText}
          />
        ))}
      {folder.components &&
        Array.from(folder.components).map(
          (componentReference) =>
            componentReference.url && (
              <DraggableComponentRow
                key={componentReference.url}
                componentUrl={componentReference.url}
                downloadText={downloadText}
              />
            )
        )}
    </details>
  );
};

const ComponentLibraryVisFromStruct = ({
  componentLibraryStruct,
  downloadText = downloadTextWithCache
}: {
  componentLibraryStruct?: ComponentLibraryStruct;
  downloadText: (url: string) => Promise<string>;
}) => {
  return (
    <details open>
      <summary
        style={{
          border: "1px solid #aaa",
          padding: "4px",
          borderRadius: "4px",
        }}
      >
        <strong>Component library</strong>
      </summary>
      <div style={{ paddingLeft: "10px" }}>
        {componentLibraryStruct === undefined
          ? "The library is not loaded"
          : Array.from(componentLibraryStruct.folders).map(
              (componentFolder, index) => (
                <SingleFolderVis
                  key={componentFolder.name}
                  folder={componentFolder}
                  isOpen={index === 0}
                  downloadText={downloadText}
                />
              )
            )}
      </div>
    </details>
  );
};

const loadComponentLibraryStruct = async (
  url: string,
  downloadText: (url: string) => Promise<string> = downloadTextWithCache
) => {
  const libraryText = await downloadText(url);
  const componentLibrary = yaml.load(libraryText);
  if (typeof componentLibrary !== "object" || componentLibrary === null) {
    throw Error(
      `Component library data is not a YAML-encoded object: ${componentLibrary}`
    );
  }
  if (!isValidComponentLibraryStruct(componentLibrary)) {
    throw Error(
      `Invalid Component library data structure: ${componentLibrary}`
    );
  }
  return componentLibrary;
};

interface ComponentLibraryVisFromUrlProps {
  url: string;
  downloadText: (url: string) => Promise<string>;
}

const ComponentLibraryVisFromUrl = ({
  url,
  downloadText = downloadTextWithCache,
}: ComponentLibraryVisFromUrlProps) => {
  const [componentLibraryStruct, setComponentLibraryStruct] = useState<
    ComponentLibraryStruct | undefined
  >();

  useEffect(() => {
    if (componentLibraryStruct === undefined) {
      (async () => {
        try {
          const loadedComponentLibrary = await loadComponentLibraryStruct(
            url,
            downloadText
          );
          setComponentLibraryStruct(loadedComponentLibrary);
        } catch (err) {
          console.error(err);
        }
      })();
    }
  }, [componentLibraryStruct, url, downloadText]);

  return (
    <ComponentLibraryVisFromStruct
      componentLibraryStruct={componentLibraryStruct}
      downloadText={downloadText}
    />
  );
};

export default ComponentLibraryVisFromUrl;
