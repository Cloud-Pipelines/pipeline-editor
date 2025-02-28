/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useEffect, useState } from "react";
import type { DragEvent, ReactNode } from "react";

import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';

import type {
  ReactFlowInstance,
  Connection,
  Edge,
  Node,
  ReactFlowProps,
  OnConnect,
} from "@xyflow/react";

import type {
  ArgumentType,
  ComponentSpec,
  GraphInputArgument,
  GraphSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "../componentSpec";

import ComponentTaskNode from "./ComponentTaskNode";
import useComponentSpecToNodes from "../hooks/useComponentSpecToNodes";
import useComponentSpecToEdges from "../hooks/useComponentSpecToEdges";

export const EMPTY_GRAPH_COMPONENT_SPEC: ComponentSpec = {
  implementation: {
    graph: {
      tasks: {},
    },
  },
};


const nodeIdToTaskId = (id: string) => id.replace(/^task_/, "");
const nodeIdToInputName = (id: string) => id.replace(/^input_/, "");
const nodeIdToOutputName = (id: string) => id.replace(/^output_/, "");

const makeNameUniqueByAddingIndex = (name: string, existingNames: Set<string>): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

const getUniqueInputName = (
  componentSpec: ComponentSpec,
  name: string = "Input",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(componentSpec.inputs?.map((inputSpec) => inputSpec.name))
  );
};

const getUniqueOutputName = (
  componentSpec: ComponentSpec,
  name: string = "Output",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(componentSpec.outputs?.map((outputSpec) => outputSpec.name))
  );
};

const getUniqueTaskName = (
  graphSpec: GraphSpec,
  name: string = "Task",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(Object.keys(graphSpec.tasks))
  );
};

export interface GraphComponentSpecFlowProps
  extends Omit<ReactFlowProps, "elements"> {
  componentSpec: ComponentSpec,
  setComponentSpec: (componentSpec: ComponentSpec) => void,
}

const nodeTypes: Record<string, React.ComponentType<any>> = {
  task: ComponentTaskNode,
};

const GraphComponentSpecFlow = ({
  children,
  componentSpec = { implementation: { graph: { tasks: {} } } },
  setComponentSpec,
  ...rest
}: GraphComponentSpecFlowProps) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
  const nodes = useComponentSpecToNodes(componentSpec, setComponentSpec);
  const edges = useComponentSpecToEdges(componentSpec);

  if (!('graph' in componentSpec.implementation)) {
    return <></>;
  }
  const graphSpec = componentSpec.implementation.graph;


  const setTaskArguments = (
    taskId: string,
    taskArguments?: Record<string, ArgumentType>,
  ) => {
    const newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: {
        ...graphSpec.tasks,
        [taskId]: {
          ...graphSpec.tasks[taskId],
          arguments: taskArguments,
        }
      }
    };

    setComponentSpec({ ...componentSpec, implementation: { graph: newGraphSpec } });
  };

  const setTaskArgument = (
    taskId: string,
    inputName: string,
    argument?: ArgumentType
  ) => {
    const oldTaskSpec = graphSpec.tasks[taskId];
    const oldTaskSpecArguments = oldTaskSpec.arguments || {};

    const nonNullArgumentObject = argument ? { [inputName]: argument } : {};
    const newTaskSpecArguments = {
      ...oldTaskSpecArguments,
      ...nonNullArgumentObject,
    };

    setTaskArguments(taskId, newTaskSpecArguments);
  };
  const setGraphOutputValue = (
    outputName: string,
    outputValue?: TaskOutputArgument
  ) => {
    const nonNullOutputObject = outputValue ? { [outputName]: outputValue } : {};
    const newGraphOutputValues = {
      ...graphSpec.outputValues,
      ...nonNullOutputObject,
    };
    const newGraphSpec = { ...graphSpec, outputValues: newGraphOutputValues };
    setComponentSpec({ ...componentSpec, implementation: { graph: newGraphSpec } });
  };

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
          taskId: nodeIdToTaskId(connection.source),
          outputName: sourceTaskOutputName,
        },
      };

      if (targetTaskInputName !== undefined) {
        // Target is task input
        setTaskArgument(
          nodeIdToTaskId(connection.target),
          targetTaskInputName,
          taskOutputArgument
        );
      } else {
        // Target is graph output
        setGraphOutputValue(
          nodeIdToOutputName(connection.target),
          taskOutputArgument
        );
        // TODO: Perhaps propagate type information
      }
    } else {
      // Source is graph input
      const graphInputName = nodeIdToInputName(connection.source);
      const graphInputArgument: GraphInputArgument = {
        graphInput: {
          inputName: graphInputName,
        },
      };
      if (targetTaskInputName !== undefined) {
        // Target is task input
        setTaskArgument(
          nodeIdToTaskId(connection.target),
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
      setTaskArgument(nodeIdToTaskId(edge.target), inputName);
    } else {
      setGraphOutputValue(nodeIdToOutputName(edge.target));
    }
  };

  const removeComponentInput = (inputNameToRemove: string) => {
    // Removing the outcoming edges
    // Not really needed since react-flow sends the node's incoming and outcoming edges for deletion when a node is deleted
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      for (const [inputName, argument] of Object.entries(
        taskSpec.arguments ?? {}
      )) {
        if (typeof argument !== "string" && "graphInput" in argument) {
          if (argument.graphInput.inputName === inputNameToRemove) {
            console.log("removing task argument", taskId, inputName);
            setTaskArgument(taskId, inputName);
          }
        }
      }
    }
    // Not checking the sources of graph outputs, since they cannot be directly connected to the graph inputs

    // Removing the input itself
    const newInputs = (componentSpec.inputs ?? []).filter(
      (inputSpec) => inputSpec.name !== inputNameToRemove
    );
    console.log("newInputs", newInputs);
    setComponentSpec({ ...componentSpec, inputs: newInputs });
  };

  const removeComponentOutput = (outputNameToRemove: string) => {
    setGraphOutputValue(outputNameToRemove);
    // Removing the output itself
    const newOutputs = (componentSpec.outputs ?? []).filter(
      (outputSpec) => outputSpec.name !== outputNameToRemove
    );
    setComponentSpec({ ...componentSpec, outputs: newOutputs });
  };

  const removeTask = (taskIdToRemove: string) => {
    // Step 1: Remove any connections where this task is used as a source
    // (i.e., other tasks that depend on this task's outputs)
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      if (!taskSpec.arguments) continue;

      for (const [inputName, argument] of Object.entries(taskSpec.arguments)) {
        // Check if this argument references the task we're removing
        const isReferencingRemovedTask =
          typeof argument !== "string" &&
          "taskOutput" in argument &&
          argument.taskOutput.taskId === taskIdToRemove;

        if (isReferencingRemovedTask) {
          console.log("removing task argument", taskId, inputName);
          setTaskArgument(taskId, inputName);
        }
      }
    }

    // Step 2: Remove any connections from this task to graph outputs
    const newGraphOutputValues = Object.fromEntries(
      Object.entries(graphSpec.outputValues ?? {}).filter(
        ([_, argument]) => argument.taskOutput.taskId !== taskIdToRemove
      )
    );

    // Step 3: Remove the task itself from the graph
    const newTasks = Object.fromEntries(
      Object.entries(graphSpec.tasks).filter(
        ([taskId]) => taskId !== taskIdToRemove
      )
    );

    // Step 4: Update the component spec with our changes
    const newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: newTasks,
      outputValues: newGraphOutputValues,
    };

    setComponentSpec({ ...componentSpec, implementation: { graph: newGraphSpec } });
  };

  const removeNode = (node: Node) => {
    if (node.type === "task") {
      const taskId = nodeIdToTaskId(node.id);
      removeTask(taskId);
    }

    if (node.type === "input") {
      const inputName = nodeIdToInputName(node.id);
      removeComponentInput(inputName);
    }

    if (node.type === "output") {
      const outputName = nodeIdToOutputName(node.id);
      removeComponentOutput(outputName);
    }
  };

  const onLoad = (_reactFlowInstance: ReactFlowInstance) =>
    setReactFlowInstance(_reactFlowInstance);

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
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
        dragOffsetX = dragStartOffset.offsetX ?? 0;
        dragOffsetY = dragStartOffset.offsetY ?? 0;
      }

      // Node position. Offsets should be included in projection, so that they snap to the grid.
      // Otherwise the dropped nodes will be out of phase with the rest of the nodes even when snapping.
      let position = reactFlowInstance.screenToFlowPosition({
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
        const taskId = getUniqueTaskName(
          graphSpec,
          taskSpec.componentRef.spec?.name ?? "Task"
        );
        const newGraphSpec: GraphSpec = {
          ...graphSpec,
          tasks: {
            ...graphSpec.tasks,
            [taskId]: taskSpecWithAnnotation,
          },
        };
        setComponentSpec({ ...componentSpec, implementation: { graph: newGraphSpec } });
      } else if (nodeType === "input") {
        const inputId = getUniqueInputName(componentSpec);
        const inputSpec: InputSpec = {
          name: inputId,
          annotations: positionAnnotations,
        };
        const inputs = (componentSpec.inputs ?? []).concat([inputSpec]);
        setComponentSpec({ ...componentSpec, inputs: inputs });
      } else if (nodeType === "output") {
        const outputId = getUniqueOutputName(componentSpec);
        const outputSpec: OutputSpec = {
          name: outputId,
          annotations: positionAnnotations,
        };
        const outputs = (componentSpec.outputs ?? []).concat([outputSpec]);
        setComponentSpec({ ...componentSpec, outputs: outputs });
      }
    }
  };

  const onElementsRemove = (params: { nodes: Node[]; edges: Edge[] }) => {
    for (const edge of params.edges) {
      removeEdge(edge);
    }
    for (const node of params.nodes) {
      removeNode(node);
    }
  };
  return (
    <Flow
      {...rest}
      initialNodes={nodes}
      initialEdges={edges}
      onConnect={onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onLoad={onLoad}
      onElementsRemove={onElementsRemove}
    >
      {children}
    </Flow>
  );
};

interface FlowProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onConnect: OnConnect;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onLoad: (reactFlowInstance: ReactFlowInstance) => void;
  onElementsRemove: (params: { nodes: Node[]; edges: Edge[] }) => void;
  children: ReactNode;
  [key: string]: any; // For rest props
}

const Flow = ({
  initialNodes,
  initialEdges,
  onConnect,
  onDragOver,
  onDrop,
  onLoad,
  onElementsRemove,
  children,
  ...rest
}: FlowProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleOnDrop = (event: DragEvent) => {
    onDrop(event);
  };

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges]);

  return <ReactFlow
    {...rest}
    nodes={nodes}
    edges={edges}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    nodeTypes={nodeTypes}
    onConnect={onConnect}
    onDragOver={onDragOver}
    onDrop={handleOnDrop}
    onDelete={onElementsRemove}
    onInit={onLoad}
    deleteKeyCode={
      rest.deleteKeyCode ?? (isAppleOS() ? "Backspace" : "Delete")
    }
    multiSelectionKeyCode={
      rest.multiSelectionKeyCode ?? (isAppleOS() ? "Command" : "Control")
    }
  >
    {children}
  </ReactFlow>
};

export default GraphComponentSpecFlow;

const isAppleOS = () =>
  window.navigator.platform.startsWith("Mac") ||
  window.navigator.platform.startsWith("iPhone") ||
  window.navigator.platform.startsWith("iPad") ||
  window.navigator.platform.startsWith("iPod");
