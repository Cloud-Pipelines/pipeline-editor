import { ArgumentType, ComponentSpec, TypeSpecType } from "../componentSpec";

interface ArgumentsEditorProps {
  componentSpec: ComponentSpec;
  componentArguments: Record<string, ArgumentType>;
  setComponentArguments: (args: Record<string, ArgumentType>) => void;
}

const getPatternForTypeSpec = (typeSpec?: TypeSpecType) => {
  // TODO: Implement
  return undefined;
};

const typeSpecToString = (typeSpec?: TypeSpecType): string => {
  if (typeSpec === undefined) {
    return "Any";
  }
  if (typeof typeSpec === "string") {
    return typeSpec;
  }
  return JSON.stringify(typeSpec);
};

const ArgumentsEditor = ({
  componentSpec,
  componentArguments,
  setComponentArguments,
}: ArgumentsEditorProps) => {
  return (
    <div
      style={{
        display: "table",
        borderSpacing: "5px",
      }}
    >
      {(componentSpec.inputs ?? []).map((inputSpec) => {
        const inputName = inputSpec.name;
        let value: string | undefined = undefined;
        let placeholder: string | undefined = undefined;
        const argument = componentArguments[inputName];
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

        const argumentIsRequiredButMissing =
          !(inputName in componentArguments) &&
          inputSpec.optional !== true &&
          inputSpec.default === undefined;

        const typeSpecString = typeSpecToString(inputSpec.type);

        return (
          <div
            key={inputName}
            style={{
              display: "table-row",
            }}
          >
            <label
              style={{
                textAlign: "right",
                display: "table-cell",
                whiteSpace: "nowrap",
              }}
            >
              <span>
                {inputName} (
                <span
                  style={{
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    maxWidth: "90px",
                    display: "inline-block",
                    verticalAlign: "bottom",
                  }}
                  title={typeSpecString}
                >
                  {typeSpecString}
                </span>
                )
              </span>
            </label>
            <input
              style={{
                display: "table-cell",
                // Prevents border flickering and disappearing on movement
                borderWidth: "1px",
              }}
              placeholder={placeholder}
              required={argumentIsRequiredButMissing}
              value={value ?? ""}
              pattern={getPatternForTypeSpec(inputSpec.type)}
              onChange={(e) => {
                componentArguments[inputName] = e.target.value;
                setComponentArguments({ ...componentArguments });
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
                  delete componentArguments[inputName];
                  setComponentArguments({ ...componentArguments });
                }}
                disabled={!(inputName in componentArguments)}
              >
                ⌧
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ArgumentsEditor;
