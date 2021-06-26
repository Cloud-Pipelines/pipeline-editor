import { memo } from 'react';
import {TaskSpec, InputSpec, OutputSpec} from '../componentSpec';

import { Handle, Position, NodeProps, HandleType } from 'react-flow-renderer';

const inputHandlePosition = Position.Top;
const outputHandlePosition = Position.Bottom;

type InputOrOutputSpec = InputSpec | OutputSpec;

function generateHandles(
  ioSpecs: InputOrOutputSpec[],
  handleType: HandleType,
  position: Position,
  idPrefix: string,
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
    const ioTypeName = ioSpec.type?.toString() ?? "Any";
    const className = ioTypeName; // Need to be sanitized
    handleComponents.push(
      <Handle
        key={id}
        type={handleType}
        position={position}
        id={id}
        style={style}
        isConnectable={true}
        title={ioSpec.name + " : " + ioTypeName}
        className={"handle_" + className}
      />
    );
  }
  return handleComponents;
}

function generateInputHandles(inputSpecs: InputSpec[]): JSX.Element[] {
  return generateHandles(inputSpecs, "target", inputHandlePosition, "input_");
}

function generateOutputHandles(outputSpecs: OutputSpec[]): JSX.Element[] {
  return generateHandles(outputSpecs, "source", outputHandlePosition, "output_");
}

const ComponentTaskNode = ({data}: NodeProps<TaskSpec>) => {
  const taskSpec = data;
  const componentSpec = taskSpec.componentRef.spec;
  if (componentSpec === undefined) {
    return (<></>);
  }

  const label = componentSpec.name ?? "<component>";
  const inputHandles = generateInputHandles(componentSpec.inputs ?? []);
  const outputHandles = generateOutputHandles(componentSpec.outputs ?? []);
  const handleComponents = inputHandles.concat(outputHandles);

  return (
    <>
      {label}
      {handleComponents}
    </>
  );
};

export default memo(ComponentTaskNode);
