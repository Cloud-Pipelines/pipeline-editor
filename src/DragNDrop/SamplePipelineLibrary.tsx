/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useState, useEffect } from "react";
import { ComponentSpec } from "../componentSpec";
import {
  storeComponentFromUrl,
  ComponentReferenceWithSpec,
} from "../componentStore";
import {
  preloadComponentReferences,
  PRELOADED_PIPELINE_URLS,
} from "./samplePipelines";

interface PipelineLibraryProps {
  setComponentSpec?: (componentSpec: ComponentSpec) => void;
}

const SamplePipelineLibrary = ({ setComponentSpec }: PipelineLibraryProps) => {
  const [componentRefs, setComponentRefs] = useState<
    ComponentReferenceWithSpec[]
  >([]);

  useEffect(() => {
    (async () => {
      if (componentRefs.length === 0) {
        const loadedComponentRefs = await Promise.all(
          PRELOADED_PIPELINE_URLS.map(async (url) => {
            const componentRefPlusData = await storeComponentFromUrl(url);
            const componentRef = componentRefPlusData.componentRef;
            await preloadComponentReferences(componentRef.spec);
            return componentRef;
          })
        );
        setComponentRefs(loadedComponentRefs);
      }
    })();
  }, [componentRefs.length]);

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
