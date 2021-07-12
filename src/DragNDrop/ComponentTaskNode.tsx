import { CSSProperties, memo, useState } from 'react';
import {
  ArgumentType,
  InputSpec,
  OutputSpec,
  TaskSpec,
} from '../componentSpec';

import { Handle, Position, Node, NodeProps, HandleType } from 'react-flow-renderer';

import ArgumentsEditor from './ArgumentsEditor';

const inputHandlePosition = Position.Top;
const outputHandlePosition = Position.Bottom;

type InputOrOutputSpec = InputSpec | OutputSpec;

const MISSING_ARGUMENT_CLASS_NAME = "missing-argument";

export const isComponentTaskNode = (node: Node): node is Node<ComponentTaskNodeProps> =>
  node.type === "task" && node.data !== undefined && "taskSpec" in node.data;

function generateHandles(
  ioSpecs: InputOrOutputSpec[],
  handleType: HandleType,
  position: Position,
  idPrefix: string,
  inputsWithMissingArguments?: string[],
): JSX.Element[] {
  let handleComponents = [];
  const numHandles = ioSpecs.length;
  for (let i = 0; i < numHandles; i++) {
    const ioSpec = ioSpecs[i];
    const id = idPrefix + ioSpec.name;
    const relativePosition = (i + 1) / (numHandles + 1);
    const positionPercentString = String(100 * relativePosition) + "%";
    const style =
      position === Position.Top || position === Position.Bottom
        ? { left: positionPercentString }
        : { top: positionPercentString };
    // TODO: Handle complex type specs
    const ioTypeName = ioSpec.type?.toString() ?? "Any";
    let classNames = [`handle_${idPrefix}${ioTypeName}`.replace(" ", "_")];
    const isInvalid = (inputsWithMissingArguments ?? []).includes(ioSpec.name);
    if (isInvalid) {
      classNames.push(MISSING_ARGUMENT_CLASS_NAME);
    }
    classNames = classNames.map((className) => className.replace(" ", "_"));

    const labelStyle = generateLabelStyle(position, numHandles);
    handleComponents.push(
      <Handle
        key={id}
        type={handleType}
        position={position}
        id={id}
        style={style}
        isConnectable={true}
        title={ioSpec.name + " : " + ioTypeName}
        className={classNames.join(" ")}
      >
        <div style={labelStyle}>
          {ioSpec.name}
        </div>
      </Handle>
    );
  }
  return handleComponents;
}

function generateLabelStyle(position: Position, numHandles: number) {
  const nodeWidthPx = 180;
  let maxLabelWidthPx = nodeWidthPx / (numHandles + 1);
  let angle = "0deg";
  if (numHandles > 4) {
    angle = "30deg";
    maxLabelWidthPx = 50;
  }
  // By default, we want to place the label on the same side of the handle as the handle is on the side of the node.
  let labelPosition = position;
  // When there are too many inputs/outputs, we need to move the label so it starts from the handle.
  // Based on my tests, we always want this for >4 handles, so the default placement is never used at all.
  if (numHandles > 4) {
    angle = "45deg";
    if (position === Position.Top) {
      labelPosition = Position.Right;
    }
    if (position === Position.Bottom) {
      labelPosition = Position.Left;
    }
  }
  let labelPositionStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) rotate(-${angle}) ${labelPositionToTranslation(labelPosition)}`,
    textOverflow: "ellipsis",
  };
  let labelOverflowStyle: CSSProperties = {
    overflow: "hidden",
    whiteSpace: "nowrap",
    maxWidth: `${maxLabelWidthPx}px`,
  };
  const labelStyle = { ...labelPositionStyle, ...labelOverflowStyle };
  return labelStyle;
}

const labelPositionToTranslation = (
  position: Position,
  handleRadius = "4px",
) => {
  switch(position) {
    case Position.Top:
      return `translateY(calc(-50% - ${handleRadius}))`;
    case Position.Bottom:
      return `translateY(calc(50% + ${handleRadius}))`;
    case Position.Left:
      return `translateX(calc(-50% - ${handleRadius}))`;
    case Position.Right:
      return `translateX(calc(50% + ${handleRadius}))`;
  }
}

function generateInputHandles(inputSpecs: InputSpec[], inputsWithInvalidArguments?: string[]): JSX.Element[] {
  return generateHandles(inputSpecs, "target", inputHandlePosition, "input_", inputsWithInvalidArguments);
}

function generateOutputHandles(outputSpecs: OutputSpec[]): JSX.Element[] {
  return generateHandles(outputSpecs, "source", outputHandlePosition, "output_");
}

export interface ComponentTaskNodeProps {
  taskSpec: TaskSpec,
  taskId?: string,
  setArguments?: (args: Record<string, ArgumentType>) => void;
};

const ComponentTaskNode = ({ data }: NodeProps<ComponentTaskNodeProps>) => {
  const [isArgumentsEditorOpen, setIsArgumentsEditorOpen] = useState(false);

  const taskSpec = data.taskSpec;
  const componentSpec = taskSpec.componentRef.spec;
  if (componentSpec === undefined) {
    return (<></>);
  }

  const label = componentSpec.name ?? "<component>";
  const inputsWithInvalidArguments = (componentSpec.inputs ?? [])
    .filter(
      (inputSpec) =>
        inputSpec.optional !== true &&
        inputSpec.default === undefined &&
        !(inputSpec.name in (taskSpec.arguments ?? {}))
    )
    .map((inputSpec) => inputSpec.name);
  const inputHandles = generateInputHandles(componentSpec.inputs ?? [], inputsWithInvalidArguments);
  const outputHandles = generateOutputHandles(componentSpec.outputs ?? []);
  const handleComponents = inputHandles.concat(outputHandles);

  const closeArgumentsEditor = () => {
    setIsArgumentsEditorOpen(false);
  }

  return (
    <div
      onDoubleClick={() => {
        setIsArgumentsEditorOpen(!isArgumentsEditorOpen);
      }}
      title={data.taskId}
    >
      {label}
      {handleComponents}
      {isArgumentsEditorOpen && (
        <ArgumentsEditor
          taskSpec={taskSpec}
          closeEditor={closeArgumentsEditor}
          setArguments={data.setArguments}
        />
      )}
    </div>
  );
};

export default memo(ComponentTaskNode);
