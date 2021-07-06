import React, { DragEvent, useState } from "react";
import ReactFlow, {
  ArrowHeadType,
  Connection,
  Edge,
  ElementId,
  Elements,
  isEdge,
  isNode,
  Node,
  OnLoadParams,
  ReactFlowProps,
  XYPosition,
} from "react-flow-renderer";

import {
  ArgumentType,
  ComponentSpec,
  GraphSpec,
  TaskOutputArgument,
  TaskSpec,
} from "../componentSpec";
import ComponentTaskNode from "./ComponentTaskNode";

export interface GraphComponentSpecFlowProps
  extends Omit<ReactFlowProps, "elements"> {
  initialComponentSpec?: ComponentSpec
}

const nodeTypes = {
  task: ComponentTaskNode,
};

const GraphComponentSpecFlow = ({
  children,
  initialComponentSpec = { implementation: { graph: { tasks: {} } } },
  ...rest
}: GraphComponentSpecFlowProps) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<OnLoadParams>();
  const [originalComponentSpec, setComponentSpec] =
    useState<ComponentSpec>(initialComponentSpec);
  let componentSpec = originalComponentSpec;

  if (! ('graph' in componentSpec.implementation)) {
    // Only graph components are supported
    return <></>;
  }
  let graphSpec = componentSpec.implementation.graph;

  const nodes = Object.entries(graphSpec.tasks).map<Node<TaskSpec>>(
    ([taskId, taskSpec]) => {
      let position: XYPosition = { x: 0, y: 0 };
      if (taskSpec.annotations !== undefined) {
        try {
          const layoutAnnotation = taskSpec.annotations[
            "editor.position"
          ] as string;
          const decodedPosition = JSON.parse(layoutAnnotation);
          position = { x: decodedPosition["x"], y: decodedPosition["y"] };
        } catch (err) {}
      }

      return {
        id: taskId,
        data: taskSpec,
        position: position,
        type: "task",
      };
    }
  );

  const edges: Edge[] = Object.entries(graphSpec.tasks).flatMap(
    ([taskId, taskSpec]) => {
      return Object.entries(taskSpec.arguments ?? {}).flatMap(
        ([inputName, argument]) => {
          // TODO: Handle graph inputs
          if (typeof argument !== "string" && "taskOutput" in argument) {
            const taskOutput = argument.taskOutput;
            const edge: Edge = {
              id: `${taskOutput.taskId}_${taskOutput.outputName}-${taskId}_${inputName}`,
              source: taskOutput.taskId,
              sourceHandle: `output_${taskOutput.outputName}`,
              target: taskId,
              targetHandle: `input_${inputName}`,
              arrowHeadType: ArrowHeadType.ArrowClosed,
            };
            return [edge];
          } else {
            return [];
          }
        }
      );
    }
  );
  // TODO: Handle graph outputs
  
  const replaceComponentSpec = (newComponentSpec: ComponentSpec) => {
    componentSpec = newComponentSpec;
    setComponentSpec(newComponentSpec);
  };

  const replaceGraphSpec = (newGraphSpec: GraphSpec) => {
    graphSpec = newGraphSpec;
    replaceComponentSpec({ ...componentSpec, implementation: { graph: graphSpec } });
  };

  const setTaskArgument = (
    taskId: string,
    inputName: string,
    argument?: ArgumentType
  ) => {
    const oldTaskSpec = graphSpec.tasks[taskId];
    const oldTaskSpecArguments = oldTaskSpec.arguments;
    let newTaskSpecArguments: Record<string, ArgumentType> = {
      ...oldTaskSpecArguments,
    };
    if (argument === undefined) {
      delete newTaskSpecArguments[inputName];
    } else {
      newTaskSpecArguments[inputName] = argument;
    }
    let newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: { ...graphSpec.tasks },
    };
    newGraphSpec.tasks[taskId] = {
      ...oldTaskSpec,
      arguments: newTaskSpecArguments,
    };
    replaceGraphSpec(newGraphSpec);
  };

  const removeTaskArgument = (taskId: string, inputName: string) =>
    setTaskArgument(taskId, inputName, undefined);

  const addConnection = (connection: Connection | Edge) => {
    if (
      connection.source === null ||
      connection.sourceHandle === null ||
      connection.sourceHandle === undefined ||
      connection.target === null ||
      connection.targetHandle === null ||
      connection.targetHandle === undefined
    ) {
      return;
    }
    const inputName = connection.targetHandle.replace(/^input_/, "");
    const outputName = connection.sourceHandle.replace(/^output_/, "");

    const argument: TaskOutputArgument = {
      taskOutput: {
        taskId: connection.source,
        outputName: outputName,
      },
    };

    setTaskArgument(connection.target, inputName, argument);
  };

  const onConnect = (params: Connection | Edge) => {
    addConnection(params);
  };

  const removeEdge = (edge: Edge) => {
    // TODO: Handle graph input and output connections
    if (
      edge.sourceHandle === null ||
      edge.sourceHandle === undefined ||
      edge.targetHandle === null ||
      edge.targetHandle === undefined
    ) {
      return;
    }
    const inputName = edge.targetHandle.replace(/^input_/, "");

    removeTaskArgument(edge.target, inputName);
  };

  const removeNode = (node: Node) => {
    const taskIdToRemove = node.id;

    // Removing the outcoming edges
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      for (const [inputName, argument] of Object.entries(
        taskSpec.arguments ?? {}
      )) {
        if (typeof argument !== "string" && "taskOutput" in argument) {
          if (argument.taskOutput.taskId === taskIdToRemove) {
            removeTaskArgument(taskId, inputName);
          }
        }
      }
    }

    // ! TODO: Remove outcoming edges that go to graph outputs ? Delete the outputs themselves?

    // Removing the task
    let newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: { ...graphSpec.tasks },
    };
    delete newGraphSpec.tasks[taskIdToRemove];
    replaceGraphSpec(newGraphSpec);
  };

  const onElementsRemove = (elementsToRemove: Elements) => {
    for (const element of elementsToRemove) {
      if (isEdge(element)) {
        removeEdge(element);
      }
    }
    for (const element of elementsToRemove) {
      if (isNode(element)) {
        removeNode(element);
      }
    }
  };

  const onEdgeUpdate = (oldEdge: Edge, newConnection: Connection) => {
    removeEdge(oldEdge);
    addConnection(newConnection);
  };

  const onLoad = (_reactFlowInstance: OnLoadParams) =>
    setReactFlowInstance(_reactFlowInstance);

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const getId = (nodeType: string, nodeData: any): ElementId => {
    const baseName: string = nodeData?.componentRef?.spec?.name ?? nodeType;
    let finalName = baseName;
    let index = 0;
    const nodeNames = new Set(Object.keys(graphSpec.tasks));
    while (nodeNames.has(finalName)) {
      index++;
      finalName = baseName + " " + index.toString();
    }
    return finalName;
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    if (reactFlowInstance) {
      const droppedData = event.dataTransfer.getData("application/reactflow");
      if (droppedData === "") {
        return;
      }
      const droppedDataObject = JSON.parse(droppedData);
      const nodeType = Object.keys(droppedDataObject)[0];
      const nodeData = droppedDataObject[nodeType];
      const position = reactFlowInstance.project({
        x: event.clientX,
        y: event.clientY - 40,
      });

      if (nodeType === "task") {
        let taskSpec = nodeData as TaskSpec;
        let newAnnotations: Record<string, unknown> = {
          ...taskSpec.annotations,
        };
        const taskPosition = { x: position.x, y: position.y };
        newAnnotations["editor.position"] = JSON.stringify(taskPosition);
        taskSpec.annotations = newAnnotations;
        const taskId = getId(nodeType, nodeData);
        graphSpec = { ...graphSpec, tasks: { ...graphSpec.tasks } };
        graphSpec.tasks[taskId] = taskSpec;
        replaceGraphSpec(graphSpec);
      } else if (nodeType === "input") {
        // TODO: Implement
      } else if (nodeType === "output") {
        // TODO: Implement
      }
    }
  };

  const elements = (nodes as Elements).concat(edges);

  return (
    <ReactFlow
      {...rest}
      elements={elements}
      nodeTypes={nodeTypes}
      onConnect={onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onEdgeUpdate={onEdgeUpdate}
      onElementsRemove={onElementsRemove}
      onLoad={onLoad}
    >
      {children}
    </ReactFlow>
  );
};

export default GraphComponentSpecFlow;
