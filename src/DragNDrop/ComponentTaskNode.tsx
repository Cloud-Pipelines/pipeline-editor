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

const NODE_WIDTH_IN_PX = 180;

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

    const [labelClasses, labelStyle] = generateLabelStyle(position, numHandles);
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
        <div className={labelClasses} style={labelStyle}>
          {ioSpec.name}
        </div>
      </Handle>
    );
  }
  return handleComponents;
}


function generateLabelStyle(
  position: Position,
  numHandles: number
): [string, CSSProperties] {
  let maxLabelWidthPx = NODE_WIDTH_IN_PX;
  // By default, we want to place the label on the same side of the handle as the handle is on the side of the node.
  let labelClasses = "label";
  // When there are too many inputs/outputs, we need to move the label so it starts from the handle.
  // Based on my tests, we always want this for >4 handles (top/bottom), so the rotated default placement is never used at all.

  if (position === Position.Top || position === Position.Bottom) {
    if (numHandles > 1) {
      // For single handle max width is the node width, while the formula would give half of that
      maxLabelWidthPx = NODE_WIDTH_IN_PX / (numHandles + 1);
    }
    //if (numHandles > 4) {
    if (maxLabelWidthPx < 35) {
      maxLabelWidthPx = 50;
      labelClasses += " label-angled";
    }
  } else {
    maxLabelWidthPx = 60;
  }

  const labelStyle: CSSProperties = { maxWidth: `${maxLabelWidthPx}px` };
  return [labelClasses, labelStyle];
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
