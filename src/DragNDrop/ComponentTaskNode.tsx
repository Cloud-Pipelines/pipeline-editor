import { memo } from 'react';
import {TaskSpec, InputSpec, OutputSpec} from '../componentSpec';

import { Handle, Position, NodeProps, HandleType } from 'react-flow-renderer';

const inputHandlePosition = Position.Top;
const outputHandlePosition = Position.Bottom;

type InputOrOutputSpec = InputSpec | OutputSpec;

const MISSING_ARGUMENT_CLASS_NAME = "missing-argument";

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
      />
    );
  }
  return handleComponents;
}

function generateInputHandles(inputSpecs: InputSpec[], inputsWithInvalidArguments?: string[]): JSX.Element[] {
  return generateHandles(inputSpecs, "target", inputHandlePosition, "input_", inputsWithInvalidArguments);
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

  return (
    <>
      {label}
      {handleComponents}
    </>
  );
};

export default memo(ComponentTaskNode);
