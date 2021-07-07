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
  GraphInputArgument,
  GraphSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "../componentSpec";
import ComponentTaskNode, { ComponentTaskNodeProps } from "./ComponentTaskNode";

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

  const nodes = Object.entries(graphSpec.tasks).map<Node<ComponentTaskNodeProps>>(
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
        data: {
          taskSpec: taskSpec,
          setArguments: (args) => setTaskArguments(taskId, args),
        },
        position: position,
        type: "task",
      };
    }
  );

  const inputNodes = (componentSpec.inputs ?? []).map<Node>(
    (inputSpec) => {
      let position: XYPosition = { x: 0, y: 0 };
      if (inputSpec.annotations !== undefined) {
        try {
          const layoutAnnotation = inputSpec.annotations[
            "editor.position"
          ] as string;
          const decodedPosition = JSON.parse(layoutAnnotation);
          position = { x: decodedPosition["x"], y: decodedPosition["y"] };
        } catch (err) {}
      }
      return {
        id: inputSpec.name,
        data: { label: inputSpec.name },
        position: position,
        type: "input",
      };
    }
  );

  const outputNodes = (componentSpec.outputs ?? []).map<Node>(
    (outputSpec) => {
      let position: XYPosition = { x: 0, y: 0 };
      if (outputSpec.annotations !== undefined) {
        try {
          const layoutAnnotation = outputSpec.annotations[
            "editor.position"
          ] as string;
          const decodedPosition = JSON.parse(layoutAnnotation);
          position = { x: decodedPosition["x"], y: decodedPosition["y"] };
        } catch (err) {}
      }
      return {
        id: outputSpec.name,
        data: { label: outputSpec.name },
        position: position,
        type: "output",
      };
    }
  );

  const edges: Edge[] = Object.entries(graphSpec.tasks).flatMap(
    ([taskId, taskSpec]) => {
      return Object.entries(taskSpec.arguments ?? {}).flatMap(
        ([inputName, argument]) => {
          if (typeof argument === "string") {
            return [];
          }
          if ("taskOutput" in argument) {
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
          } else if ("graphInput" in argument) {
            const graphInput = argument.graphInput;
            const edge: Edge = {
              id: `Input_${graphInput.inputName}-${taskId}_${inputName}`,
              source: graphInput.inputName,
              //sourceHandle: undefined,
              //sourceHandle: "Input",
              sourceHandle: null,
              target: taskId,
              targetHandle: `input_${inputName}`,
              arrowHeadType: ArrowHeadType.ArrowClosed,
            };
            return [edge];
          } else {
            console.error("Impossible task input argument kind: ", argument);
            return [];
          }
        }
      );
    }
  );

  const outputEdges: Edge[] = Object.entries(graphSpec.outputValues ?? {}).map(
    ([outputName, argument]) => {
      const taskOutput = argument.taskOutput;
      const edge: Edge = {
        id: `${taskOutput.taskId}_${taskOutput.outputName}-Output_${outputName}`,
        source: taskOutput.taskId,
        sourceHandle: `output_${taskOutput.outputName}`,
        target: outputName,
        //targetHandle: undefined,
        //targetHandle: "Output",
        targetHandle: null,
        arrowHeadType: ArrowHeadType.ArrowClosed,
      };
      return edge;
    }
  );

  const elements = (nodes as Elements).concat(inputNodes).concat(outputNodes).concat(edges).concat(outputEdges);
  
  const replaceComponentSpec = (newComponentSpec: ComponentSpec) => {
    componentSpec = newComponentSpec;
    setComponentSpec(newComponentSpec);
  };

  const replaceGraphSpec = (newGraphSpec: GraphSpec) => {
    graphSpec = newGraphSpec;
    replaceComponentSpec({ ...componentSpec, implementation: { graph: graphSpec } });
  };

  const setTaskArguments = (
    taskId: string,
    taskArguments?: Record<string, ArgumentType>,
  ) => {
    let newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: { ...graphSpec.tasks },
    };
    newGraphSpec.tasks[taskId] = {
      ...graphSpec.tasks[taskId],
      arguments: taskArguments,
    };
    replaceGraphSpec(newGraphSpec);
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
    setTaskArguments(taskId, newTaskSpecArguments);
  };

  const removeTaskArgument = (taskId: string, inputName: string) =>
    setTaskArgument(taskId, inputName, undefined);

  const setGraphOutputValue = (
    outputName: string,
    outputValue?: TaskOutputArgument
  ) => {
    let newGraphOutputValues = { ...graphSpec.outputValues };
    if (outputValue === undefined) {
      delete newGraphOutputValues[outputName];
    } else {
      newGraphOutputValues[outputName] = outputValue;
    }
    graphSpec = { ...graphSpec, outputValues: newGraphOutputValues };
    replaceGraphSpec(graphSpec);
  };

  const removeGraphOutputValue = (outputName: string) =>
    setGraphOutputValue(outputName);

  const addConnection = (connection: Connection | Edge) => {
    if (connection.source === null || connection.target === null) {
      console.error(
        "addConnection called with missing source or target: ",
        connection
      );
      return;
    }

    const targetTaskInputName = connection.targetHandle?.replace(/^input_/, "");
    const sourceTaskOutputName = connection.sourceHandle?.replace(/^output_/, "");

    if (sourceTaskOutputName !== undefined) {
      // Source is task output
      const taskOutputArgument: TaskOutputArgument = {
        taskOutput: {
          taskId: connection.source,
          outputName: sourceTaskOutputName,
        },
      };

      if (targetTaskInputName !== undefined) {
        // Target is task input
        setTaskArgument(
          connection.target,
          targetTaskInputName,
          taskOutputArgument
        );
      } else {
        // Target is graph output
        setGraphOutputValue(connection.target, taskOutputArgument);
        // TODO: Perhaps propagate type information
      }
    } else {
      // Source is graph input
      const graphInputName = connection.source;
      const graphInputArgument: GraphInputArgument = {
        graphInput: {
          inputName: graphInputName,
        },
      };
      if (targetTaskInputName !== undefined) {
        // Target is task input
        setTaskArgument(
          connection.target,
          targetTaskInputName,
          graphInputArgument
        );
        // TODO: Perhaps propagate type information
      } else {
        // Target is graph output
        console.error(
          "addConnection: Cannot directly connect graph input to graph output: ",
          connection
        );
      }
    }
  };

  const onConnect = (params: Connection | Edge) => {
    addConnection(params);
  };

  const removeEdge = (edge: Edge) => {
    const inputName = edge.targetHandle?.replace(/^input_/, "");

    if (inputName !== undefined) {
      removeTaskArgument(edge.target, inputName);
    } else {
      removeGraphOutputValue(edge.target);
    }
  };

  const removeComponentInput = (inputName: string) => {
    // Removing the outcoming edges
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      for (const [inputName, argument] of Object.entries(
        taskSpec.arguments ?? {}
      )) {
        if (typeof argument !== "string" && "graphInput" in argument) {
          if (argument.graphInput.inputName === inputName) {
            removeTaskArgument(taskId, inputName);
          }
        }
      }
    }
    // Not checking the sources of graph outputs, since they cannot be directly connected to the graph inputs

    // Removing the input itself
    const newInputs = (componentSpec.inputs ?? []).filter(
      (inputSpec) => inputSpec.name !== inputName
    );
    componentSpec = { ...componentSpec, inputs: newInputs };
    replaceComponentSpec(componentSpec);
  };

  const removeComponentOutput = (outputName: string) => {
    removeGraphOutputValue(outputName);
    // Removing the output itself
    const newOutputs = (componentSpec.outputs ?? []).filter(
      (outputSpec) => outputSpec.name !== outputName
    );
    componentSpec = { ...componentSpec, outputs: newOutputs };
    replaceComponentSpec(componentSpec);
  };

  const removeTask = (taskId: string) => {
    // Removing the outcoming edges
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      for (const [inputName, argument] of Object.entries(
        taskSpec.arguments ?? {}
      )) {
        if (typeof argument !== "string" && "taskOutput" in argument) {
          if (argument.taskOutput.taskId === taskId) {
            removeTaskArgument(taskId, inputName);
          }
        }
      }
    }

    // Removing outcoming edges that go to graph outputs.
    // ? Should we delete the outputs themselves
    const newGraphOutputValues = Object.fromEntries(
      Object.entries(graphSpec.outputValues ?? {}).filter(
        ([_, argument]) => argument.taskOutput.taskId !== taskId
      )
    );
    graphSpec = { ...graphSpec, outputValues: newGraphOutputValues };

    // Removing the task
    let newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: { ...graphSpec.tasks },
    };
    delete newGraphSpec.tasks[taskId];
    replaceGraphSpec(newGraphSpec);
  };

  const removeNode = (node: Node) => {
    // TODO: Use global constants for node types
    if (node.type === "input") {
      const inputName = node.id;
      removeComponentInput(inputName);
    } else if (node.type === "output") {
      const outputName = node.id;
      removeComponentOutput(outputName);
    } else if (node.type === "task") {
      const taskId = node.id;
      removeTask(taskId);
    } else {
      console.log("removeNode: Unexpected note type: ", node);
    }
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

  const makeNameUniqueByAddingIndex = (name: string, existingNames: Set<string>): ElementId => {
    let finalName = name;
    let index = 1;
    while (existingNames.has(finalName)) {
      index++;
      finalName = name + " " + index.toString();
    }
    return finalName;
  };

  const getUniqueInputName = (name: string = "Input") => {
    return makeNameUniqueByAddingIndex(
      name,
      new Set(componentSpec.inputs?.map((inputSpec) => inputSpec.name))
    );
  };

  const getUniqueOutputName = (name: string = "Output") => {
    return makeNameUniqueByAddingIndex(
      name,
      new Set(componentSpec.outputs?.map((outputSpec) => outputSpec.name))
    );
  };

  const getUniqueTaskName = (name: string = "Task") => {
    return makeNameUniqueByAddingIndex(
      name,
      new Set(Object.keys(graphSpec.tasks))
    );
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
      
      // Correcting the position using the drag point location information
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      const dragStartOffsetData = event.dataTransfer.getData("DragStart.offset");
      if (dragStartOffsetData !== "") {
        const dragStartOffset = JSON.parse(dragStartOffsetData);
        // Hack to work around Chrome's draggable anchor bug. TODO: Remove once Chrome is fixed
        dragOffsetX = dragStartOffset.offsetX * 0.68 ?? 0;
        dragOffsetY = dragStartOffset.offsetY * 0.64 ?? 0;
      }

      // Node position. Offsets should be included in projection, so that they snap to the grid.
      // Otherwise the dropped nodes will be out of phase with the rest of the nodes even when snapping.
      let position = reactFlowInstance.project({
        x: event.clientX - dragOffsetX,
        y: event.clientY - dragOffsetY,
      });

      const nodePosition = { x: position.x, y: position.y };
      const positionAnnotations = {
        "editor.position": JSON.stringify(nodePosition),
      }
      if (nodeType === "task") {
        const taskSpec = nodeData as TaskSpec;
        const mergedAnnotations = {
          ...taskSpec.annotations,
          ...positionAnnotations,
        };
        taskSpec.annotations = mergedAnnotations;
        const taskSpecWithAnnotation: TaskSpec = {
          ...taskSpec,
          annotations: mergedAnnotations,
        };
        const taskId = getUniqueTaskName(taskSpec.componentRef.spec?.name ?? "Task");
        graphSpec = { ...graphSpec, tasks: { ...graphSpec.tasks } };
        graphSpec.tasks[taskId] = taskSpecWithAnnotation;
        replaceGraphSpec(graphSpec);
      } else if (nodeType === "input") {
        const inputId = getUniqueInputName();
        const inputSpec: InputSpec = {
          name: inputId,
          annotations: positionAnnotations,
        };
        const inputs = (componentSpec.inputs ?? []).concat([inputSpec]);
        componentSpec = { ...componentSpec, inputs: inputs };
        replaceComponentSpec(componentSpec);
      } else if (nodeType === "output") {
        const outputId = getUniqueOutputName();
        const outputSpec: OutputSpec = {
          name: outputId,
          annotations: positionAnnotations,
        };
        const outputs = (componentSpec.outputs ?? []).concat([outputSpec]);
        componentSpec = { ...componentSpec, outputs: outputs };
        replaceComponentSpec(componentSpec);
      }
    }
  };

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
