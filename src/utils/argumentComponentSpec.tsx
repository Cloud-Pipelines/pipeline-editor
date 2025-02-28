import { isGraphImplementation, type ComponentSpec, type GraphSpec, type InputSpec, type OutputSpec, type TaskSpec } from "../componentSpec";
import type {
    Node,
  } from "@xyflow/react";
import { isComponentTaskNode } from "../DragNDrop/ComponentTaskNode";

const NODE_LAYOUT_ANNOTATION_KEY = "editor.position";
const SDK_ANNOTATION_KEY = "sdk";
const SDK_ANNOTATION_VALUE = "https://cloud-pipelines.net/pipeline-editor/";


const nodeIdToTaskId = (id: string) => id.replace(/^task_/, "");
const nodeIdToInputName = (id: string) => id.replace(/^input_/, "");
const nodeIdToOutputName = (id: string) => id.replace(/^output_/, "");


export const augmentComponentSpec = (
    componentSpec: ComponentSpec,
    nodes: Node[],
    includeSpecs = false,
    includePositions = true
  ) => {
    componentSpec = { ...componentSpec };

    const getNodePositionAnnotation = (node: Node) =>
      JSON.stringify({
        // node.position cannot be used since set at 1st drop and never updated
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      });

    const nodeXPositionComparer = (n1: Node, n2: Node) => {
      const deltaX = n1.position.x - n2.position.x;
      const deltaY = n1.position.y - n2.position.y;
      return deltaX !== 0 ? deltaX : deltaY;
    };
    const nodeYPositionComparer = (n1: Node, n2: Node) => {
      const deltaX = n1.position.x - n2.position.x;
      const deltaY = n1.position.y - n2.position.y;
      return deltaY !== 0 ? deltaY : deltaX;
    };

    // Input and output nodes
    // Sorting them by horizontal position to make reordering inputs and outputs easy.
    const inputNodes = nodes
      .filter((node) => node.type === "input")
      .sort(nodeXPositionComparer);
    const outputNodes = nodes
      .filter((node) => node.type === "output")
      .sort(nodeXPositionComparer);
    const taskNodes = nodes
      .filter(isComponentTaskNode)
      .sort(nodeYPositionComparer);

    const inputPositionMap = new Map<string, string>(
      inputNodes.map((node) => [
        nodeIdToInputName(node.id),
        getNodePositionAnnotation(node),
      ])
    );
    const inputOrderMap = new Map<string, number>(
      inputNodes.map((node, index) => [nodeIdToInputName(node.id), index])
    );
    const inputOrderComparer = (a: InputSpec, b: InputSpec) =>
      (inputOrderMap.get(a.name) ?? Infinity) -
      (inputOrderMap.get(b.name) ?? Infinity);
    const outputPositionMap = new Map<string, string>(
      outputNodes.map((node) => [
        nodeIdToOutputName(node.id),
        getNodePositionAnnotation(node),
      ])
    );
    const outputOrderMap = new Map<string, number>(
      outputNodes.map((node, index) => [nodeIdToOutputName(node.id), index])
    );
    const outputOrderComparer = (a: OutputSpec, b: OutputSpec) =>
      (outputOrderMap.get(a.name) ?? Infinity) -
      (outputOrderMap.get(b.name) ?? Infinity);
    const taskPositionMap = new Map<string, string>(
      taskNodes.map((node) => [
        nodeIdToTaskId(node.id),
        getNodePositionAnnotation(node),
      ])
    );
    const taskOrderMap = new Map<string, number>(
      taskNodes.map((node, index) => [nodeIdToTaskId(node.id), index])
    );
    const taskOrderComparer = (
      pairA: [string, TaskSpec],
      pairB: [string, TaskSpec]
    ) =>
      (taskOrderMap.get(pairA[0]) ?? Infinity) -
      (taskOrderMap.get(pairB[0]) ?? Infinity);

    componentSpec.inputs = componentSpec.inputs
      ?.map((inputSpec) => {
        if (!inputPositionMap.has(inputSpec.name) || !inputOrderMap.has(inputSpec.name)) {
          throw Error(`The nodes array does not have input node ${inputSpec.name}`);
        }
        let newAnnotations = { ...inputSpec.annotations };
        if (includePositions) {
          newAnnotations[NODE_LAYOUT_ANNOTATION_KEY] = inputPositionMap.get(
            inputSpec.name
          );
        } else {
          delete newAnnotations[NODE_LAYOUT_ANNOTATION_KEY];
        }
        let newInputSpec: InputSpec = {
          ...inputSpec,
          annotations: newAnnotations,
        };
        if (Object.keys(newAnnotations).length === 0) {
          delete newInputSpec.annotations;
        }
        return newInputSpec;
      })
      .sort(inputOrderComparer);

    componentSpec.outputs = componentSpec.outputs
      ?.map((outputSpec) => {
        if (!outputPositionMap.has(outputSpec.name) || !outputOrderMap.has(outputSpec.name)) {
          throw Error(`The nodes array does not have output node ${outputSpec.name}`);
        }
        let newAnnotations = { ...outputSpec.annotations };
        if (includePositions) {
          newAnnotations[NODE_LAYOUT_ANNOTATION_KEY] = outputPositionMap.get(
            outputSpec.name
          );
        } else {
          delete newAnnotations[NODE_LAYOUT_ANNOTATION_KEY];
        }
        let newOutputSpec: OutputSpec = {
          ...outputSpec,
          annotations: newAnnotations,
        };
        if (
          newAnnotations === undefined ||
          Object.keys(newAnnotations).length === 0
        ) {
          delete newOutputSpec.annotations;
        }
        return newOutputSpec;
      })
      .sort(outputOrderComparer);

    if (!isGraphImplementation(componentSpec.implementation)) {
      return componentSpec;
    }

    let graphSpec: GraphSpec = { ...componentSpec.implementation.graph };
    const newTasks = Object.fromEntries(
      Object.entries(graphSpec.tasks || {})
        .map(([taskId, taskSpec]) => {
          if (!taskPositionMap.has(taskId) || !taskOrderMap.has(taskId)) {
            throw Error(`The nodes array does not have task node ${taskId}`);
          }
          let newAnnotations = { ...taskSpec.annotations };
          if (includePositions) {
            newAnnotations[NODE_LAYOUT_ANNOTATION_KEY] =
              taskPositionMap.get(taskId);
          } else {
            delete newAnnotations[NODE_LAYOUT_ANNOTATION_KEY];
          }
          let newTaskSpec: TaskSpec = {
            ...taskSpec,
            annotations: newAnnotations,
          };
          if (
            newAnnotations === undefined ||
            Object.keys(newAnnotations).length === 0
          ) {
            delete newTaskSpec.annotations;
          }
          // TODO: Sort the arguments based on the ordering of the component inputs.
          if (
            !includeSpecs &&
            newTaskSpec.componentRef.spec !== undefined &&
            newTaskSpec.componentRef.url !== undefined
          ) {
            newTaskSpec.componentRef = { ...newTaskSpec.componentRef };
            delete newTaskSpec.componentRef.spec;
          }
          // Always deleting the text since it's not yet supported in some SDKs.
          delete newTaskSpec.componentRef.text;
          return [taskId, newTaskSpec] as [string, TaskSpec];
        })
        .sort(taskOrderComparer)
    );
    if (newTasks !== undefined) {
      graphSpec.tasks = newTasks;
    }
    componentSpec = {
      ...componentSpec,
      implementation: { ...componentSpec.implementation, graph: graphSpec },
    };

    componentSpec = {
      ...componentSpec,
      metadata: {
        ...componentSpec.metadata,
        annotations: {
          ...componentSpec.metadata?.annotations,
          [SDK_ANNOTATION_KEY]: SDK_ANNOTATION_VALUE
        }
      }
    }

    // Reordering the attributes and removing the undefined ones
    const rebuildComponentSpec = ({
      name,
      description,
      metadata,
      inputs,
      outputs,
      implementation,
      ...rest
    }: ComponentSpec): ComponentSpec => ({
      ...(name && { name: name }),
      ...(description && { description: description }),
      ...(metadata && { metadata: metadata }),
      ...(inputs && { inputs: inputs }),
      ...(outputs && { outputs: outputs }),
      implementation: implementation,
      ...rest,
    });
    componentSpec = rebuildComponentSpec(componentSpec);

    return componentSpec;
  };
