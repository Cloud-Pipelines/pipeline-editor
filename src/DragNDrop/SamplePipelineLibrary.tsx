/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import yaml from "js-yaml";
import { useState, useEffect } from "react";
import { downloadTextWithCache } from "../cacheUtils";
import { ComponentReference, ComponentSpec } from "../componentSpec";
import {
  storeComponentFromUrl,
  ComponentReferenceWithSpec,
} from "../componentStore";
import { preloadComponentReferences } from "../componentStore";

type PipelineLibraryStruct = {
  annotations?: {
    [k: string]: unknown;
  };
  components: ComponentReference[];
};

const isValidPipelineLibraryStruct = (
  obj: object
): obj is PipelineLibraryStruct => "components" in obj;

const loadPipelineLibraryStruct = async (
  url: string,
  downloadText: (url: string) => Promise<string> = downloadTextWithCache,
) => {
  const libraryText = await downloadText(url);
  const pipelineLibrary = yaml.load(libraryText);
  if (typeof pipelineLibrary !== "object" || pipelineLibrary === null) {
    throw Error(
      `Component library data is not a YAML-encoded object: ${pipelineLibrary}`
    );
  }
  if (!isValidPipelineLibraryStruct(pipelineLibrary)) {
    throw Error(`Invalid Component library data structure: ${pipelineLibrary}`);
  }
  return pipelineLibrary;
};

function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

interface PipelineLibraryProps {
  pipelineLibraryUrl: string;
  setComponentSpec?: (componentSpec: ComponentSpec) => void;
  downloadText: (url: string) => Promise<string>;
}

const SamplePipelineLibrary = ({
  pipelineLibraryUrl,
  setComponentSpec,
  downloadText = downloadTextWithCache
}: PipelineLibraryProps) => {
  const [componentRefs, setComponentRefs] = useState<
    ComponentReferenceWithSpec[]
  >([]);

  useEffect(() => {
    (async () => {
      if (componentRefs.length === 0) {
        try {
          const loadedComponentLibrary = await loadPipelineLibraryStruct(
            pipelineLibraryUrl,
            downloadText
          );
          const pipelineUrls = loadedComponentLibrary.components
            .map((componentRef) => componentRef.url)
            .filter(notUndefined);
          const loadedComponentRefs = await Promise.all(
            pipelineUrls.map(async (url) => {
              // ?!!
              const componentRefPlusData = await storeComponentFromUrl(url);
              const componentRef = componentRefPlusData.componentRef;
              await preloadComponentReferences(componentRef.spec, downloadText);
              return componentRef;
            })
          );
          setComponentRefs(loadedComponentRefs);
        } catch (err) {
          console.error(err);
        }
      }
    })();
  }, [pipelineLibraryUrl, downloadText, componentRefs.length]);

  return (
    <div
      style={{
        //border: "1px solid black",
        overflow: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ overflow: "auto", marginLeft: "10px" }}>
        {componentRefs.map((componentRef) => (
          <div key={componentRef.digest}>
            ⋮ {/* ⋮ ≡ ⋅ */}
            <button
              className="link-button"
              onClick={(e) => {
                setComponentSpec?.(componentRef.spec);
              }}
            >
              {componentRef.spec.name ?? "<Pipeline>"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SamplePipelineLibrary;
