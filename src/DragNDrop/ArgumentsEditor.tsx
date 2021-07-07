import { useState } from "react";
import { ArgumentType, TaskSpec, TypeSpecType } from "../componentSpec";

interface ArgumentsEditorProps {
  taskSpec: TaskSpec;
  closeEditor?: () => void;
  setArguments?: (args: Record<string, ArgumentType>) => void;
}

const getPatternForTypeSpec = (typeSpec?: TypeSpecType) => {
  // TODO: Implement
  return undefined;
};

const ArgumentsEditor = ({
  taskSpec,
  closeEditor,
  setArguments,
}: ArgumentsEditorProps) => {
  const [currentArguments, setCurrentArguments] = useState<
    Record<string, ArgumentType>
  >({ ...taskSpec.arguments });

  const componentSpec = taskSpec.componentRef.spec;
  if (componentSpec === undefined) {
    console.error(
      "ArgumentsEditor called with missing taskSpec.componentRef.spec",
      taskSpec
    );
    return <></>;
  }

  const inputSpecs = componentSpec.inputs ?? [];

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
      }}
      // Does not work
      // draggable={false}
      style={{
        position: "fixed",
        display: "table",
        borderSpacing: "5px",
        background: "white",
        border: "1px solid black",
        borderRadius: "4px",
        padding: "15px",
        // Does not work
        // zIndex: 11,
      }}
    >
      <legend>Input arguments for {componentSpec.name}</legend>
      <div>
        {inputSpecs.map((inputSpec) => {
          const inputName = inputSpec.name;
          let value: string | undefined = undefined;
          let placeholder: string | undefined = undefined;
          const argument = currentArguments[inputName];
          if (argument === undefined) {
            value = inputSpec.default;
          } else {
            if (typeof argument === "string") {
              value = argument;
            } else if ("taskOutput" in argument) {
              placeholder = `<from task ${argument.taskOutput.taskId} / ${argument.taskOutput.outputName}>`;
            } else if ("graphInput" in argument) {
              placeholder = `<from graph input ${argument.graphInput.inputName}>`;
            } else {
              placeholder = "<reference>";
            }
          }

          return (
            <div
              key={inputName}
              style={{
                display: "table-row",
              }}
            >
              <label
                key={inputName}
                style={{
                  textAlign: "right",
                  display: "table-cell",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{inputName} ({inputSpec.type?.toString() ?? "Any"}): </span>
              </label>
              <input
                style={{
                  display: "table-cell",
                }}
                placeholder={placeholder}
                // required={inputSpec.optional !== true && inputSpec.default === undefined}
                value={value ?? ""}
                pattern={getPatternForTypeSpec(inputSpec.type)}
                onChange={(e) => {
                  currentArguments[inputName] = e.target.value;
                  setCurrentArguments({ ...currentArguments });
                }}
              />
              <div
                style={{
                  display: "table-cell",
                }}
              >
                <button
                  type="button"
                  title="Reset to default"
                  onClick={(e) => {
                    delete currentArguments[inputName];
                    setCurrentArguments({ ...currentArguments });
                  }}
                  disabled={!(inputName in currentArguments)}
                >
                  ⌧
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={closeEditor}>
        Close
      </button>
      <button
        type="button"
        onClick={(e) => {
          setArguments?.(currentArguments);
          closeEditor?.();
        }}
      >
        Apply
      </button>
      {process?.env?.NODE_ENV === "development" ? (
        <div style={{ overflow: "auto", maxWidth: "300px" }}>
          <pre style={{ textAlign: "left" }}>
            {JSON.stringify(currentArguments, undefined, 2)}
          </pre>
        </div>
      ) : undefined}
    </form>
  );
};

//export default memo(ArgumentsEditor);
export default ArgumentsEditor;
