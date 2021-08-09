import { useCallback, useState, useEffect, useRef } from "react";
import { ComponentSpec, isGraphImplementation } from "../componentSpec";
import {
  loadComponentAsRefFromText,
  storeComponentText,
  addComponentRefToList,
  getAllComponentFilesFromList,
  ComponentFileEntry,
} from "../componentStore";
import GraphComponentLink from "./GraphComponentLink";
import SamplePipelineLibrary from "./SamplePipelineLibrary";
import { preloadComponentReferences } from "./samplePipelines";

const USER_PIPELINES_LIST_NAME = "user_pipelines";

interface PipelineLibraryProps {
  componentSpec?: ComponentSpec;
  setComponentSpec?: (componentSpec: ComponentSpec) => void;
}

const removeSuffixes = (s: string, suffixes: string[]) => {
  for (const suffix of suffixes) {
    if (s.endsWith(suffix)) {
      s = s.substring(0, s.length - suffix.length);
    }
  }
  return s;
};

const PipelineLibrary = ({
  componentSpec,
  setComponentSpec,
}: PipelineLibraryProps) => {
  // const [errorMessage, setErrorMessage] = useState("");
  const [componentFiles, setComponentFiles] = useState(
    new Map<string, ComponentFileEntry>()
  );

  useEffect(() => {
    getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME).then(
      setComponentFiles
    );
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
        const fileName =
          removeSuffixes(file.name, [
            ".pipeline.component.yaml",
            ".component.yaml",
            ".pipeline.yaml",
            ".yaml",
          ]) || "Pipeline";
        try {
          const componentRefPlusData1 = await loadComponentAsRefFromText(binaryStr);
          const componentRef1 = componentRefPlusData1.componentRef;
          if (!isGraphImplementation(componentRef1.spec.implementation)) {
            console.error("Dropped component is not a graph component");
            return;
          }
          // Caching the child components
          await preloadComponentReferences(componentRef1.spec);
          // TODO: Do not load the component twice
          const componentRefPlusData = await storeComponentText(binaryStr);
          const componentRef = componentRefPlusData.componentRef;
          await addComponentRefToList(
            USER_PIPELINES_LIST_NAME,
            componentRef,
            fileName
          );
          console.debug("storeComponentText succeeded", componentRef);
          (window as any).gtag?.("event", "PipelineLibrary_pipeline_import", {
            result: "succeeded",
          });
          // setErrorMessage("");
          const componentFilesMap = await getAllComponentFilesFromList(
            USER_PIPELINES_LIST_NAME
          );
          setComponentFiles(componentFilesMap);
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
        {Array.from(componentFiles.entries()).map(([fileName, fileEntry]) => (
          <div key={fileName}>
            ⋮ {/* ⋮ ≡ ⋅ */}
            <button
              className="link-button"
              onClick={async (e) => {
                // Loading all child components
                // TODO: Move this functionality to the setComponentSpec
                await preloadComponentReferences(fileEntry.componentRef.spec);
                setComponentSpec?.(fileEntry.componentRef.spec);
              }}
            >
              {fileName}
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
