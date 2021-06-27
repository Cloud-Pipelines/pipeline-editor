import {
  Node,
  Edge,
} from "react-flow-renderer";

import {
  ComponentSpec,
  TaskSpec,
  InputSpec,
  OutputSpec,
  ArgumentType,
  GraphInputArgument,
  TaskOutputArgument,
  GraphImplementation,
} from "../componentSpec";

const getNodePositionAnnotations = (node: Node): { [k: string]: string } => ({
  "editor.position": JSON.stringify({
    // node.position cannot be used since set at 1st drop and never updated
    x: node.__rf.position.x,
    y: node.__rf.position.y,
    width: node.__rf.width,
    height: node.__rf.height,
  }),
});

const nodeOrderComparer = (n1: Node, n2: Node) =>
  n1.__rf.position.x - n2.__rf.position.x;

const createGraphComponentSpecFromFlowElements = (
  nodes: Node[],
  edges: Edge[],
  name = "Component",
  annotations: Record<string, string> = {},
  includePositions: boolean = true,
  includeSpecs: boolean = false
): ComponentSpec => {
  // Input and output nodes
  // Sorting them by horisontal position to make reordering inputs and outputs easy.
  const inputNodes = nodes.filter((node) => node.type === "input").sort(nodeOrderComparer);
  const outputNodes = nodes.filter((node) => node.type === "output").sort(nodeOrderComparer);
  // Task nodes. They should all be ComponentTaskNode components
  const taskNodes = nodes
    .filter((node) => node.type === "task")
    .map((node) => node as Node<TaskSpec>);
  
  const inputSpecs = inputNodes.map<InputSpec>((node) => {
    let spec: InputSpec = { name: node.id };
    if (includePositions) {
      spec.annotations = getNodePositionAnnotations(node);
    }
    return spec;
  });

  const outputSpecs = outputNodes.map<OutputSpec>((node) => {
    let spec: OutputSpec = { name: node.id };
    if (includePositions) {
      spec.annotations = spec.annotations = getNodePositionAnnotations(node);
    }
    return spec;
  });

  const taskMap = taskNodes.reduce((accumulator, node) => {
    let taskSpec = node.data;
    if (taskSpec !== undefined) {
      // Cloning the spec to modify it
      taskSpec = Object.assign({}, taskSpec);
      if (!includeSpecs) {
        taskSpec.componentRef = Object.assign({}, taskSpec.componentRef);
        delete taskSpec.componentRef.spec;
      }
      if (includePositions) {
        taskSpec.annotations = getNodePositionAnnotations(node);
      }
      accumulator[node.id] = taskSpec;
    }
    return accumulator;
  }, {} as Record<string, TaskSpec>);

  let graphOutputValues: Record<string, TaskOutputArgument> = {};

  for (const edge of edges) {
    const sourceTaskId = edge.source;
    const sourceOutputName = edge.sourceHandle?.replace(/^output_/, '');
    const targetTaskId = edge.target;
    const targetInputName = edge.targetHandle?.replace(/^input_/, '');

    // if (!sourceOutputName || !targetInputName) {
    //   console.error("Enexpected edge without a source or target handle:", edge);
    //   continue;
    // }

    // Checking the source task for sanity
    if (!!sourceOutputName && taskMap[sourceTaskId] === undefined) {
      console.error("Task node is connected to unknown node type:", edge);
      continue;
    }

    // FIX: For now, detecting the graph inputs and outputs by sourceOutputName or targetInputName being null
    const argument: ArgumentType =
      !!sourceOutputName
        ? ({
            taskOutput: { taskId: sourceTaskId, outputName: sourceOutputName },
          } as TaskOutputArgument)
        : ({
            // Using input node ID as graph input name
            graphInput: { inputName: sourceTaskId },
          } as GraphInputArgument);
    if (!!targetInputName) {
      let targetTask = taskMap[targetTaskId];
      if (targetTask === undefined) {
        console.error("Task node is connected to unknown node type:", edge);
        continue;
      }
      if (targetTask.arguments === undefined) {
        targetTask.arguments = {};
      }
      targetTask.arguments[targetInputName] = argument;
    } else {
      // graph output
      // Using output node ID as graph output name
      const taskOutputArgument = argument as TaskOutputArgument;
      // FIX BUG This check does not work to guard against incompatible arguments
      if (!!taskOutputArgument) {
        graphOutputValues[targetTaskId] = taskOutputArgument;
      } else {
        console.error("Graph outputs can only come from task outputs.")
      }
    }
  }

  const graphComponent: ComponentSpec = {
    name: name,
    inputs: inputSpecs,
    outputs: outputSpecs,
    metadata: {
      annotations: annotations
    },
    implementation: {
      graph: {
        tasks: taskMap,
        outputValues: graphOutputValues,
      },
    },
  };

  // Cleanup.
  // I could have prevented these attributes from being added, but then the attribute serialization ordering will be ugly
  // (the first attribute would be "implementation" since it's required).
  if (inputSpecs.length === 0) {
    delete graphComponent.inputs;
  }
  if (outputSpecs.length === 0) {
    delete graphComponent.outputs;
  }
  if (Object.keys(annotations).length === 0) {
    delete graphComponent.metadata;
  }
  if (Object.keys(graphOutputValues).length === 0) {
    delete (graphComponent.implementation as GraphImplementation).graph.outputValues;
  }
  return graphComponent;
};

export { createGraphComponentSpecFromFlowElements };
