import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  getAllComponentsFromList,
  addComponentToListByText,
  ComponentReferenceWithSpec,
} from "../componentStore";
import DraggableComponent from "./DraggableComponent";

const USER_COMPONENTS_LIST_NAME = "user_components";

const UserComponentLibrary = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [componentRefs, setComponentRefs] = useState<
    ComponentReferenceWithSpec[]
  >([]);

  useEffect(() => {
    getAllComponentsFromList(USER_COMPONENTS_LIST_NAME).then(setComponentRefs);
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
          const componentRef = await addComponentToListByText(
            USER_COMPONENTS_LIST_NAME,
            binaryStr,
            "Component"
          );
          console.debug("storeComponentText succeeded", componentRef);
          (window as any).gtag?.("event", "UserComponents_component_import", {
            result: "succeeded",
          });
          setErrorMessage("");
          const allComponentRefs = await getAllComponentsFromList(
            USER_COMPONENTS_LIST_NAME
          );
          setComponentRefs(allComponentRefs);
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
  }, []);

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
          {componentRefs.map((componentRef) => (
            <DraggableComponent
              key={componentRef.digest}
              componentReference={componentRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserComponentLibrary;
