import { DragEvent } from "react";

import { ComponentReference, TaskSpec } from "../componentSpec";

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeData));
  event.dataTransfer.setData(
    "DragStart.offset",
    JSON.stringify({
      offsetX: event.nativeEvent.offsetX,
      offsetY: event.nativeEvent.offsetY,
    })
  );
  event.dataTransfer.effectAllowed = "move";
};

interface DraggableComponentProps {
  componentReference: ComponentReference;
}

const DraggableComponent = ({
  componentReference,
}: DraggableComponentProps) => {
  return (
    <div
      className="react-flow__node react-flow__node-task"
      draggable
      onDragStart={(event: DragEvent) => {
        const taskSpec: TaskSpec = {
          componentRef: componentReference,
        };
        return onDragStart(event, { task: taskSpec });
      }}
    >
      {componentReference.spec?.name ?? "Component"}
    </div>
  );
};

export default DraggableComponent;
