import { useCallback, useState, useEffect, useRef } from "react";
import { ComponentSpec, isGraphImplementation } from "../componentSpec";
import {
  getAllComponentsFromList,
  ComponentReferenceWithSpec,
  loadComponentAsRefFromText,
  storeComponentText,
  addComponentRefToList,
} from "../componentStore";
import GraphComponentLink from "./GraphComponentLink";
import SamplePipelineLibrary from "./SamplePipelineLibrary";
import { preloadComponentReferences } from "./samplePipelines";

const USER_PIPELINES_LIST_NAME = "user_pipelines";

interface PipelineLibraryProps {
  componentSpec?: ComponentSpec;
  setComponentSpec?: (componentSpec: ComponentSpec) => void;
}

const PipelineLibrary = ({
  componentSpec,
  setComponentSpec,
}: PipelineLibraryProps) => {
  // const [errorMessage, setErrorMessage] = useState("");
  const [componentRefs, setComponentRefs] = useState<
    ComponentReferenceWithSpec[]
  >([]);

  useEffect(() => {
    (async () => {
      let componentRefs = await getAllComponentsFromList(
        USER_PIPELINES_LIST_NAME
      );
      setComponentRefs(componentRefs);
    })();
  }, []);

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
          const componentRef1 = await loadComponentAsRefFromText(binaryStr);
          if (!isGraphImplementation(componentRef1.spec.implementation)) {
            console.error("Dropped component is not a graph component");
            return;
          }
          // Caching the child components
          await preloadComponentReferences(componentRef1.spec);
          // TODO: Do not load the component twice
          const componentRef = await storeComponentText(binaryStr);
          await addComponentRefToList(
            USER_PIPELINES_LIST_NAME,
            componentRef,
            file.name || "Pipeline"
          );
          console.debug("storeComponentText succeeded", componentRef);
          (window as any).gtag?.("event", "PipelineLibrary_pipeline_import", {
            result: "succeeded",
          });
          // setErrorMessage("");
          const allComponentRefs = await getAllComponentsFromList(
            USER_PIPELINES_LIST_NAME
          );
          setComponentRefs(allComponentRefs);
        } catch (err) {
          // setErrorMessage(
          //   `Error parsing the dropped file as component: ${err.toString()}.`
          // );
          console.error("Error parsing the dropped file as component", err);
          (window as any).gtag?.("event", "PipelineLibrary_pipeline_import", {
            result: "failed",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const fileInput = useRef<HTMLInputElement>(null);
  const componentLink = useRef<HTMLAnchorElement>(null);

  return (
    <div
      style={{
        //border: "1px solid black",
        overflow: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ margin: "5px" }}>
        <input
          ref={fileInput}
          type="file"
          accept=".yaml"
          onChange={(e) => onDrop(Array.from(e.target.files ?? []))}
          style={{ display: "none" }}
        />
        <button onClick={(e) => fileInput.current?.click()}>
          + Import pipeline
        </button>
        <button
          onClick={(e) => {
            componentLink.current?.click();
          }}
        >
          Export pipeline
        </button>
        {componentSpec && (
          <GraphComponentLink
            linkRef={componentLink}
            componentSpec={componentSpec}
            linkText="🔗"
            downloadFileName={
              (componentSpec.name ? componentSpec.name + "." : "") +
              "pipeline.component.yaml"
            }
            style={{ textDecoration: "none" }}
          />
        )}
      </div>
      <div style={{ overflow: "auto", marginLeft: "10px" }}>
        {componentRefs.map((componentRef) => (
          <div key={componentRef.digest}>
            ⋮ {/* ⋮ ≡ ⋅ */}
            <button
              className="link-button"
              onClick={async (e) => {
                // Loading all child components
                // TODO: Move this functionality to the setComponentSpec
                await preloadComponentReferences(componentRef.spec);
                setComponentSpec?.(componentRef.spec);
              }}
            >
              {componentRef.spec.name ?? "<Pipeline>"}
            </button>
          </div>
        ))}
      </div>
      <details
        open
        style={{
          border: "1px solid #aaa",
          borderRadius: "4px",
          padding: "4px",
        }}
      >
        <summary>
          <strong>Sample pipelines</strong>
        </summary>
        <SamplePipelineLibrary setComponentSpec={setComponentSpec} />
      </details>
    </div>
  );
};

export default PipelineLibrary;
